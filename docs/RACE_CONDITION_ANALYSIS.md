# Convex Functions – Race Condition Analysis

This document evaluates Convex mutations for potential race conditions and concurrency issues. It reflects the codebase as of the latest review.

## Convex OCC (Optimistic Concurrency Control)

Convex uses **Optimistic Concurrency Control**. When mutations conflict (read/write the same documents), Convex retries failed mutations (up to 3 times) with fresh state. This mitigates many read-modify-write races.

**However**, under heavy load retries can still hit limits, and some patterns (e.g. uniqueness without a unique index) remain risky.

---

## Mitigations Already in Place

### Sharded counters (`meetingCounters.ts`)

**File:** `src/convex/helpers/meetingCounters.ts`

Participants and absent counts are implemented with **sharded counters** (`@convex-dev/sharded-counter`). Increments and decrements no longer touch the `meetings` document, so there is no RMW race on `meeting.participants` or `meeting.absent`.

- **Used by:** `users/auth.connect` → `incParticipants`; `users/attendance.leaveMeeting` → `incAbsent`; `completeReturnToMeeting` (in `helpers/meeting.ts`) → `decAbsent`.
- **Effect:** Old races on `anonIdCounter`, `participants`, and `absent` are removed.

### Heartbeat API

**File:** `src/convex/heartbeat.ts`

`recordHeartbeat` and `pruneStaleHeartbeats` use the correct Convex API: `ctx.db.patch('heartbeats', id, ...)` and `ctx.db.delete('heartbeats', id)`.

### Queue order from creation time (`orderKey`)

**Files:** `src/convex/schema.ts`, `src/convex/users/queue.ts`, `src/convex/helpers/meeting.ts`

Queue order is derived from **creation time**: each `speakerQueueEntry` has an `orderKey` set from the document’s `_creationTime` on insert. No counter table or RMW on a shared counter; `placeInSpeakerQueue` only inserts and then patches the new doc with `orderKey: entry._creationTime`. Moderator “move” swaps `orderKey` between two entries. Queue joins no longer conflict with agenda or other meeting writes.

---

## Medium Risk: Read-Modify-Write on `meetings.agenda`

**Files:** `admin/poll.ts`, `admin/agenda.ts`

Agenda-related mutations share the same pattern:

1. Read `ctx.meeting.agenda` (from middleware).
2. Compute a new agenda in memory.
3. Patch `meetings` with the new agenda.

**Affected mutations:**

- `admin/poll.createPoll` – adds poll to an agenda item.
- `admin/poll.removePoll` – removes poll from an agenda item.
- `admin/agenda.createAgendaItem`, `updateAgendaItem`, `setAgendaItemPollIds`, `removeAgendaItem`, `moveAgendaItem`, `setCurrentAgendaItem`, `next`, `previous`.

**Risk:** Concurrent admin actions can conflict on the same `meetings` document. OCC will retry; under heavy admin activity you may see serialization errors or hit retry limits.

**Mitigation:** Limit concurrent admin edits (e.g. UI or process), or consider batching agenda updates.

---

## Medium Risk: `updateMeetingData` – Meeting code uniqueness

**File:** `src/convex/admin/meeting.ts`

```typescript
const existing = await db
	.query('meetings')
	.withIndex('by_code', (q) => q.eq('code', newCode))
	.first();
if (existing) return false;
// ...
await db.patch('meetings', meeting._id, updates);
```

**Risk:** Two different meetings can both try to set the same code. Both can see `existing === null` and both patch. One overwrites the other, so two meetings can end up with the same code.

**Mitigation:** Enforce uniqueness at the database level (e.g. unique index on `meetings.code` if supported), or use a transactional “claim code” pattern.

---

## Low Risk: Poll vote + `closePollIfAllEligibleHaveVoted`

**Files:** `users/poll.ts`, `helpers/poll.ts`

**Risk:** Two voters can both be the last eligible voter and both try to close the poll. Both patch the poll. OCC retries one; the second run sees the poll already closed. Closing again is effectively idempotent.

**Note:** `closePollIfAllEligibleHaveVoted` uses `meeting.participants` and `meeting.absent` from the passed-in meeting object. If the meeting document no longer stores these (e.g. after moving to sharded counters), the vote mutation must supply eligible voter count from `countParticipants` / `countAbsent` in `meetingCounters.ts`; otherwise auto-close may never run.

**Status:** Mitigated by OCC for the close race; ensure eligible count source is correct.

---

## Low Risk: Moderator queue and speaker mutations

**File:** `src/convex/moderator/meeting.ts`

- **moveSpeakerInQueue:** Patches two `speakerQueueEntries` to swap ordinals. Concurrent moves on overlapping entries can conflict; OCC retries and the logic is deterministic.
- **nextSpeaker / previousSpeaker / clearPreviousSpeakers:** Read meeting and queue state, then patch `meetings` and/or `speakerQueueEntries` and `meetingParticipants`. Concurrent moderator actions can conflict; OCC retries.

**Status:** Mitigated by OCC; low risk.

---

## Low Risk: User queue and meeting state

**File:** `src/convex/users/queue.ts`

- **requestPointOfOrder / recallPointOfOrderRequest**, **requestReply / recallReplyRequest**, **requestBreak / recallBreakRequest:** Each patches `meetings` once (e.g. `pointOfOrder`, `reply`, `break`). Concurrent requests from different users conflict on the same meeting doc; OCC retries.
- **doneSpeaking:** Patches `meetings` and possibly `speakerQueueEntries` / `meetingParticipants`. Same as above.

**File:** `src/convex/users/attendance.ts`

- **leaveMeeting / requestReturnToMeeting / recallReturnRequest:** Participant and absence state; `incAbsent` uses sharded counter. Other patches are per-participant or per-absence doc; conflicts are limited.

**Status:** Mitigated by OCC and sharded counters where applicable.

---

## Summary

| Category                 | Count | Action                                                                         |
| ------------------------ | ----- | ------------------------------------------------------------------------------ |
| Mitigations in place     | 3     | Sharded counters, heartbeat API, queue order from `_creationTime` (`orderKey`) |
| Medium risk (agenda RMW) | 1     | Reduce concurrent admin edits or batch updates                                 |
| Medium risk (uniqueness) | 1     | `updateMeetingData` code – add unique index or transactional claim             |
| Low risk                 | 3     | Poll close, moderator mutations, user queue/attendance                         |

**Recommended next steps:**

1. Enforce meeting code uniqueness (unique index or transactional pattern).
2. Ensure poll auto-close gets eligible voter count from sharded counters if the meeting doc no longer has `participants` / `absent`.
3. Keep an eye on agenda mutations under heavy admin concurrency; add batching or coordination if needed.
