# Race Condition Analysis

## Document Metadata

- **AI model**: gpt-5.3-codex
- **Generated at**: 2026-03-24
- **Repository**: Convex meeting backend (`src/convex/`)
- **Review mode**: Fresh review from current code; previous report treated as historical context only

## Purpose

This analysis evaluates practical concurrency behavior in the current Convex backend and classifies findings into:

- active correctness risk,
- contention/retry risk,
- resolved or low-risk patterns currently mitigated by OCC and existing flow guards.

## Executive Summary

Convex optimistic concurrency control (OCC) is functioning as expected across most overlap scenarios in this codebase. The most common production symptom is likely transient action failure or retries during bursts, not silent corruption.

The main shared-write hotspot is still the `meetings` document: agenda operations, speaker transitions, request flags (break/point/reply), and poll pointer updates all patch that row.

Two active correctness risks remain where OCC does not reliably serialize behavior:

1. concurrent participant creation can create duplicate `meetingParticipants` rows for the same logical user+meeting,
2. concurrent vote submissions from the same voter can leave multiple `meetingPollVotes`/`userPollVotes` rows because vote replacement is implemented as read-delete-insert without uniqueness enforcement.

## Scope

### Reviewed Areas

- `src/convex/schema.ts`
- `src/convex/helpers/auth.ts`
- `src/convex/helpers/meeting.ts`
- `src/convex/helpers/users.ts`
- `src/convex/helpers/meetingPoll.ts`
- `src/convex/helpers/userPoll.ts`
- `src/convex/helpers/counters.ts`
- `src/convex/meeting/users/auth.ts`
- `src/convex/meeting/users/queue.ts`
- `src/convex/meeting/users/attendance.ts`
- `src/convex/meeting/users/meetingPoll.ts`
- `src/convex/meeting/admin/meeting.ts`
- `src/convex/meeting/admin/agenda.ts`
- `src/convex/meeting/admin/meetingPoll.ts`
- `src/convex/meeting/admin/users.ts`
- `src/convex/meeting/moderator/meeting.ts`
- `src/convex/meeting/jobs/snapshots.ts`
- `src/convex/crons.ts`

### Review Method

Each sensitive flow was mapped to:

- documents read,
- documents written,
- likely concurrent actors (admin/moderator/participant, reconnecting clients, multi-tab clients, scheduled jobs),
- expected behavior when calls overlap under Convex OCC.

### Real-World Conditions Considered

- Concurrency is usually bursty (simultaneous clicks, reconnect storms, retries), not sustained.
- Highest-risk windows are moderator/admin controls and voting windows.
- Multi-tab and repeated-click behavior is considered normal in production.
- Main user-facing symptom is expected to be intermittent failure/retry lag under spikes.

## Concurrency Model

- Convex mutations are transactional and use OCC; conflicting transactions retry automatically.
- OCC mostly protects shared-document correctness but does not enforce logical uniqueness across independently inserted rows.
- Actions and `ctx.scheduler.runAfter(...)` paths span multiple transactions and can interleave with later state changes.
- The `meetings` document is a central write hotspot, so unrelated features can conflict because they share one row version.

## Findings

### 1) Duplicate meeting participants under concurrent join/add

**Classification**: Active correctness risk

**Where**:

- `src/convex/helpers/users.ts` (`ensureParticipantInMeeting`)
- callers: `src/convex/users/auth.ts` (`connect`) and `src/convex/admin/users.ts` (`addParticipant`)

**Reasoning**:

- Lookup uses `by_user_meeting` with `.first()` and inserts if no row exists.
- The schema index is not uniqueness-enforced.
- Two concurrent requests can both observe "missing participant" and both insert.

**Practical impact**:

- Later `.first()` reads become nondeterministic across duplicate rows.
- Role/absence/queue updates may target one duplicate while another remains stale.
- Counter side effects can drift because both inserts trigger participant/absence increments.

### 2) Vote replacement is race-prone for same voter

**Classification**: Active correctness risk

**Where**: `ensureParticipantInMeeting` in `src/convex/helpers/users.ts`, called by `meeting/users/auth.connect` and `meeting/admin/users.addParticipant`

**Reasoning**:

- Current pattern is `read existing votes -> delete existing -> insert new votes`.
- There is no uniqueness constraint on (`pollId`, voter identity) in `meetingPollVotes`/`userPollVotes`.
- Two concurrent submissions from the same voter can both pass the initial read and both insert.
- Counter updates are executed through sharded counter component mutations and do not guarantee serialization of voter-level uniqueness.

**Practical impact**:

- One voter can end up with multiple persisted vote rows across concurrent requests.
- This can violate intended "replace my vote" semantics and distort totals/winners.

### 3) Shared `meetings` document remains the dominant contention hotspot

**Classification**: Contention / retry risk

**Where**: Many mutations in `meeting/admin/meeting`, `meeting/admin/agenda`, `meeting/admin/meetingPoll`, `meeting/moderator/meeting`, `meeting/users/queue`, and `meeting/admin/users` patch `meetings`.

**Why it matters**:

- Different controls still converge on one document.
- OCC safely retries but conflict frequency grows during bursts.
- End-user symptom is usually transient failed actions/latency, not confirmed silent corruption.

### 4) Agenda array rewrites increase collision surface

**Classification**: Contention / retry risk

**Where**: Agenda operations in `src/convex/meeting/admin/agenda.ts` and poll operations that rewrite `meeting.agenda` associations in `src/convex/meeting/admin/meetingPoll.ts`

**Why it matters**:

- Full `agenda` array replacement is common for create/move/remove/update operations.
- Longer/more complex mutations touching `agenda` are more likely to collide with speaker/poll control patches on `meetings`.

**Practical impact**:

- Higher conflict probability during active moderator sessions.
- User perception of flaky controls during simultaneous edits.

### 5) Speaker transition overlaps are mostly OCC-safe but burst-sensitive

**Classification**: Contention / retry risk (low correctness risk)

**Where**: `meeting/moderator/meeting.nextSpeaker`, `meeting/users/queue.doneSpeaking`, queue insert/remove flows

**Reasoning**:

- Multiple flows converge on `meetings.currentSpeaker`/`lastConsumedCt` and `speakerQueueEntries`.
- OCC generally serializes updates; guard checks prevent obvious double-advance corruption.

**Practical impact**:

- Most likely issue is transient no-op/retry behavior under simultaneous clicks.

### 6) Poll lifecycle overlaps are mostly safe with snapshot guards

**Classification**: Contention / retry risk

**Where**: `meeting/admin/meetingPoll.openPoll`, `closePollByAdmin`, `closePollAndShowResults`, and `meeting/admin/meeting.toggleMeeting`

**Current behavior**:

- Overlapping admin actions can collide on poll row and meeting pointer updates.
- Poll snapshot insertion path is guarded by `closedAt` check in `insertPollResultSnapshot`, reducing duplicate snapshot writes for the same close timestamp.

### 7) Heartbeat upsert pattern can create duplicate rows

**Classification**: Contention / retry risk (data quality)

**Where**:

- `src/convex/heartbeat.ts` (`recordHeartbeat`)

**Reasoning**:

- First-write pattern is `query by token -> if none insert`.
- Concurrent first heartbeats for the same token can both insert due to lack of uniqueness.

**Practical impact**:

- Duplicate heartbeat rows are possible; `isActive` uses `.first()` and may read any duplicate.
- Usually low product impact, but can add noise and inconsistency.

### 8) Scheduled follow-up work is multi-transaction and intentionally eventual

**Classification**: Low-risk pattern currently mitigated

**Where**: `logSpeakerSlot` scheduling `internal.meeting.jobs.speakerLog.logSpeaker`, poll snapshot action (`internal.meeting.jobs.meetingPollClose.createPollResultSnapshotAction`), vote cleanup (`internal.meeting.jobs.meetingPollCleanup.*`), meeting snapshot cron (`internal.meeting.jobs.snapshots.runOpenMeetingSnapshots`)

**Reasoning**:

- These paths intentionally execute later and can interleave with newer writes.
- Current code uses explicit IDs/timestamps and duplicate guards where needed.

**Practical impact**:

- Mostly an ordering-awareness concern, not a confirmed active correctness bug.

## Interpretation

The dominant concurrency picture is still burst contention on shared operational state, primarily the `meetings` document. Under Convex OCC, this tends to produce retries and occasional action failures rather than silent corruption.

The highest-priority risks are the logical uniqueness gaps in participant creation and vote replacement. Those are correctness concerns because they can persist inconsistent rows without requiring a direct OCC conflict.

## Notes

- `meeting/users/meeting.getData` normalizes `currentAgendaItemId` in query output if the stored ID is no longer present; this is read-side repair, not a write race.
- Identity mapping still uses `ctx.user.subject` in participant lookup and connect paths; keep join and lookup identity source aligned if auth identity handling changes.

## Summary

### Risk Summary

| Area                                                   | Current status                             | Likely production symptom                                 |
| ------------------------------------------------------ | ------------------------------------------ | --------------------------------------------------------- |
| Participant join/add (`meetingParticipants`)           | Active correctness risk                    | Duplicate membership rows, inconsistent follow-up updates |
| Vote replacement (`meetingPollVotes`, `userPollVotes`) | Active correctness risk                    | One voter represented by multiple vote rows               |
| Shared `meetings` state                                | Contention / retry risk                    | Intermittent failed controls under burst overlap          |
| Agenda rewrites                                        | Contention / retry risk                    | Higher collision frequency with other meeting controls    |
| Speaker transitions                                    | Contention / retry risk (low correctness)  | Retry/no-op feel during simultaneous actions              |
| Poll open/close/show                                   | Contention / retry risk                    | Admin action races and occasional retry failures          |
| Heartbeats                                             | Low-to-medium contention/data-quality risk | Duplicate heartbeat rows for same token                   |
| Scheduled follow-ups                                   | Low-risk mitigated pattern                 | Eventual ordering variance, generally acceptable          |

### Recommended next actions

1. **Enforce voter uniqueness semantics**: make vote writes idempotent per voter+poll (single authoritative row or equivalent strict upsert workflow), then reconcile duplicates.
2. **Harden participant idempotency**: enforce one participant row per (`meetingId`, `userId`) and add one-time cleanup for existing duplicates.
3. **Keep hotspot UX resilient**: ensure client actions that hit `meetings` surface retry/failure clearly and avoid silent no-op behavior.
4. **Consider state decomposition if contention rises**: move high-churn sub-state off the `meetings` row if moderator/admin control reliability degrades in larger sessions.
