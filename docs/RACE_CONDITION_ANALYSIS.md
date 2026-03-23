# Race Condition Analysis

## Document Metadata

- **Last reviewed (code)**: 2026-03-23
- **Primary backend**: Convex (`src/convex/`)
- **Focus**: Meeting control, queue/speaker transitions, polls, attendance, join/connect
- **Reviewer posture**: Fresh code review of current tree (older analyses treated as historical context only)

## Purpose

This document evaluates concurrency behavior in the Convex meeting backend and distinguishes:

- correctness risks that can create wrong state,
- expected OCC retry/contention behavior,
- low-risk patterns already mitigated by current design.

## Executive Summary

Convex mutations here run with optimistic concurrency control (OCC). The dominant runtime issue is not silent corruption; it is **burst contention on the shared `meetings` document**, where many independent flows patch one row (`agenda`, poll pointers, speaker state, break/point/reply flags, meeting open/close).

One active correctness risk stands out from current code: `ensureParticipantInMeeting` can still create **duplicate `meetingParticipants` rows** for the same `(userId, meetingId)` under concurrent join/add flows because the check-before-insert pattern is not uniqueness-enforced.

Most other overlaps are contention/retry concerns, with practical symptoms like occasional failed button actions, retries, or perceived control lag during spikes (multi-admin actions, reconnect storms, multi-tab usage).

## Scope

### Reviewed Areas

- `src/convex/schema.ts`
- `src/convex/helpers/auth.ts`
- `src/convex/helpers/meeting.ts`
- `src/convex/helpers/users.ts`
- `src/convex/helpers/counters.ts`
- `src/convex/users/auth.ts`
- `src/convex/users/queue.ts`
- `src/convex/users/attendance.ts`
- `src/convex/users/poll.ts`
- `src/convex/admin/meeting.ts`
- `src/convex/admin/agenda.ts`
- `src/convex/admin/poll.ts`
- `src/convex/admin/users.ts`
- `src/convex/moderator/meeting.ts`
- `src/convex/heartbeat.ts`
- `src/convex/backup.ts`
- `src/convex/crons.ts`

### Review Method

For each sensitive flow, this review mapped:

- documents read,
- documents written,
- likely concurrent actors,
- expected behavior when operations overlap.

Findings are classified as:

- active correctness risk,
- contention/retry risk,
- low-risk pattern currently mitigated.

### Real-World Conditions Considered

- Concurrency is bursty, not constant.
- Highest overlap windows are moderator/admin control clicks, reconnects, refresh retries, and multi-tab interactions.
- Main production symptom is usually transient failure ("action did not go through"), not silent data drift.

## Concurrency Model

- **Queries** are snapshot reads; they can become stale versus subsequent writes but do not mutate state.
- **Mutations** are transactional with OCC; overlapping writes to same documents retry.
- **Actions/internal actions** are not DB transactions; when they call multiple queries/mutations they span multiple transactions.
- **Shared-write hotspot**: Many flows patch the same `meetings` document, so unrelated field updates can still conflict because the document version is shared.

## Findings

### 1) Duplicate membership rows on concurrent connect/add

**Classification**: Active correctness risk

**Where**: `ensureParticipantInMeeting` in `src/convex/helpers/users.ts`, called by `users/auth.connect` and `admin/users.addParticipant`

**Why it can happen**:

- Code does `query by_user_meeting -> first()` and then inserts when missing.
- Schema has index `by_user_meeting` but no uniqueness guarantee.
- Two concurrent callers can both observe "no participant yet" and both insert.

**Impact**:

- Subsequent `.first()` lookups become nondeterministic.
- Queue flags, absence updates, or role reads can target different duplicate rows.

### 2) Shared `meetings` row remains the main contention hotspot

**Classification**: Contention / retry risk

**Where**: Many mutations in `admin/meeting`, `admin/agenda`, `admin/poll`, `moderator/meeting`, `users/queue`, and `admin/users` patch `meetings`.

**Why it matters**:

- Different controls still converge on one document.
- OCC safely retries but conflict frequency grows during bursts.
- End-user symptom is usually transient failed actions/latency, not confirmed silent corruption.

### 3) Agenda rewrites increase collision surface

**Classification**: Contention / retry risk

**Where**: Agenda operations in `src/convex/admin/agenda.ts` and poll operations that rewrite `meeting.agenda` associations in `src/convex/admin/poll.ts`

**Why it matters**:

- Multiple operations replace the full `agenda` array on `meetings`.
- Larger/longer write transactions increase chance of colliding with unrelated meeting-state updates.

### 4) Speaker transitions overlap safely under OCC but can feel flaky under spikes

**Classification**: Contention / retry risk (low correctness risk)

**Where**: `moderator/meeting.nextSpeaker`, `users/queue.doneSpeaking`, queue insert/remove flows

**Current behavior**:

- Overlaps on `meetings`, `speakerQueueEntries`, and participant queue flags tend to serialize via retries.
- Guard checks (`currentSpeaker` ownership, queue cursor logic) prevent obvious double-advance corruption.

**Practical symptom**:

- Occasional no-op/failed action when state changed just before commit.

### 5) Poll open/close/show flows contend on `polls` + `meetings.currentPollId`

**Classification**: Contention / retry risk

**Where**: `admin/poll.openPoll`, `closePollByAdmin`, `closePollAndShowResults`, and `admin/meeting.toggleMeeting`

**Current behavior**:

- Overlapping admin actions can collide on poll row and meeting pointer updates.
- Poll snapshot insertion path is guarded by `closedAt` check in `insertPollResultSnapshot`, reducing duplicate snapshot writes for the same close timestamp.

### 6) Sharded counters are a meaningful mitigation

**Classification**: Low-risk pattern currently mitigated

**Where**: `src/convex/helpers/counters.ts` with sharded counter component

**Why it helps**:

- Participant/absent/banned and poll vote/voter counts avoid one counter field on `meetings`.
- This reduces write contention for high-frequency increments/decrements.

### 7) Scheduled logging/snapshot/cleanup paths are multi-transaction by design

**Classification**: Low-risk pattern currently mitigated

**Where**: `logSpeakerSlot` scheduling `internal.admin.meeting.logSpeaker`, poll snapshot action, vote cleanup, backup snapshot cron

**Reasoning**:

- Work runs after trigger mutation and can interleave with newer operations.
- Current logic passes explicit IDs/timestamps and includes idempotent-ish guards where needed (`closedAt` snapshot guard), so this is mainly an ordering-awareness concern rather than an active correctness bug.

## Interpretation

The system's primary concurrency profile is **hot-document contention on `meetings`** during operational bursts. Under Convex OCC, that mostly manifests as retries and occasional user-visible action failure, not confirmed silent state corruption.

The exception is participant creation idempotency: duplicate rows can violate logical uniqueness and produce inconsistent read/update targeting. This is the clearest correctness item to prioritize.

## Notes

- `users/meeting.getData` normalizes `currentAgendaItemId` in query output if the stored ID is no longer present; this is read-side repair, not a write race.
- Identity mapping still uses `ctx.user.subject` in participant lookup and connect paths; keep join and lookup identity source aligned if auth identity handling changes.

## Summary

### Risk Summary

| Area                         | Current status             | Main impact                                               |
| ---------------------------- | -------------------------- | --------------------------------------------------------- |
| Participant join/create path | Active correctness risk    | Duplicate membership rows under concurrent insert         |
| `meetings` control state     | Contention/retry risk      | Transient failed actions and latency during spikes        |
| Agenda updates               | Contention/retry risk      | Larger collisions due to full-array rewrites              |
| Poll lifecycle               | Contention/retry risk      | Overlapping admin actions on `polls` + `meetings`         |
| Counters                     | Mitigated low-risk pattern | Reduced write hot-spotting via sharding                   |
| Scheduled background paths   | Low-risk pattern           | Ordering awareness, mostly acceptable with current guards |

### Recommended next actions

1. **Harden membership insertion**: Make `(meetingId, userId)` creation idempotent under concurrent callers and add a duplicate-row audit query for existing data.
2. **Treat `meetings` as a deliberate hotspot**: Keep high-value UI actions retry-aware and user-visible when OCC conflicts exhaust retries.
3. **Consider splitting high-churn sub-state** if moderator/admin control reliability degrades under load (especially agenda-heavy sessions).
4. **Re-run this audit after major flow changes** touching `meetings` patch paths or action-driven orchestration.
