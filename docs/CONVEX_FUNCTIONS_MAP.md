# Convex functions map

This document lists **registered Convex functions** in this app: queries, mutations, actions, and how they are exposed. It was generated from `src/convex/**/*.ts` (excluding `_generated/` and `betterAuth/`). **No runtime code was changed** to produce this file.

## How paths map to client references

| Exposure | TypeScript reference pattern | Notes |
|----------|------------------------------|--------|
| Public query / mutation / action | `api["module/path"].functionName` | Module path uses slashes as in the file path under `src/convex/` (e.g. `api["admin/poll"].createPoll`). |
| Internal | `internal["module/path"].functionName` | Callable only from other Convex functions, crons, or trusted server code. |
| HTTP | `convex/http.ts` | Routes are registered on the Convex HTTP router (e.g. Better Auth and `GET /api/meeting/snapshot`). These are not `api.*` functions. |
| Component: sharded counters | `components.counters.public.*` | Defined in `src/convex/counter/public.ts`; isolated component tables. |
| Component: Better Auth | `components.betterAuth.*` | Adapter and auth-related **internal** functions generated for the Better Auth component (see `src/convex/_generated/api.d.ts` under `components.betterAuth`). The app wires `internal.auth` via `src/convex/auth.ts` for the Better Auth client; individual auth function names are not duplicated here. |

**Cron jobs** (`src/convex/crons.ts`) schedule internal functions: `internal.heartbeat.pruneStaleHeartbeats`, `internal.backup.runOpenMeetingSnapshots`.

**Count:** 121 functions in the table below (app modules only; excludes Better Auth component internals and HTTP handlers).

---

## Function index

| Convex path | Type | Visibility | Source file | Description (from source doc / comment) |
|-------------|------|------------|-------------|----------------------------------------|
| `admin/agenda:createAgendaItem` | mutation | public (`api`) | `src/convex/admin/agenda.ts` | (no docstring in source) |
| `admin/agenda:moveAgendaItem` | mutation | public (`api`) | `src/convex/admin/agenda.ts` | (no docstring in source) |
| `admin/agenda:next` | mutation | public (`api`) | `src/convex/admin/agenda.ts` | (no docstring in source) |
| `admin/agenda:previous` | mutation | public (`api`) | `src/convex/admin/agenda.ts` | (no docstring in source) |
| `admin/agenda:removeAgendaItem` | mutation | public (`api`) | `src/convex/admin/agenda.ts` | (no docstring in source) |
| `admin/agenda:setAgendaItemPollIds` | mutation | public (`api`) | `src/convex/admin/agenda.ts` | (no docstring in source) |
| `admin/agenda:setCurrentAgendaItem` | mutation | public (`api`) | `src/convex/admin/agenda.ts` | (no docstring in source) |
| `admin/agenda:updateAgendaItem` | mutation | public (`api`) | `src/convex/admin/agenda.ts` | (no docstring in source) |
| `admin/global:createUser` | mutation | public (`api`) | `src/convex/admin/global.ts` | (no docstring in source) |
| `admin/heartbeat:getActiveHeartbeats` | query | public (`api`) | `src/convex/admin/heartbeat.ts` | (no docstring in source) |
| `admin/meeting:acceptBreak` | mutation | public (`api`) | `src/convex/admin/meeting.ts` | (no docstring in source) |
| `admin/meeting:acceptPointOfOrder` | mutation | public (`api`) | `src/convex/admin/meeting.ts` | (no docstring in source) |
| `admin/meeting:acceptReply` | mutation | public (`api`) | `src/convex/admin/meeting.ts` | (no docstring in source) |
| `admin/meeting:approveReturnRequest` | mutation | public (`api`) | `src/convex/admin/meeting.ts` | (no docstring in source) |
| `admin/meeting:clearBreak` | mutation | public (`api`) | `src/convex/admin/meeting.ts` | (no docstring in source) |
| `admin/meeting:clearPointOfOrder` | mutation | public (`api`) | `src/convex/admin/meeting.ts` | (no docstring in source) |
| `admin/meeting:clearReply` | mutation | public (`api`) | `src/convex/admin/meeting.ts` | (no docstring in source) |
| `admin/meeting:denyReturnRequest` | mutation | public (`api`) | `src/convex/admin/meeting.ts` | (no docstring in source) |
| `admin/meeting:getAbsenceEntries` | query | public (`api`) | `src/convex/admin/meeting.ts` | (no docstring in source) |
| `admin/meeting:getAbsentees` | query | public (`api`) | `src/convex/admin/meeting.ts` | (no docstring in source) |
| `admin/meeting:getAttendance` | query | public (`api`) | `src/convex/admin/meeting.ts` | (no docstring in source) |
| `admin/meeting:getPointOfOrderEntries` | query | public (`api`) | `src/convex/admin/meeting.ts` | (no docstring in source) |
| `admin/meeting:getReturnRequests` | query | public (`api`) | `src/convex/admin/meeting.ts` | (no docstring in source) |
| `admin/meeting:getSpeakerLogEntries` | query | public (`api`) | `src/convex/admin/meeting.ts` | (no docstring in source) |
| `admin/meeting:logSpeaker` | mutation | internal (`internal`) | `src/convex/admin/meeting.ts` | (no docstring in source) |
| `admin/meeting:recountParticipants` | mutation | public (`api`) | `src/convex/admin/meeting.ts` | (no docstring in source) |
| `admin/meeting:resetMeeting` | mutation | public (`api`) | `src/convex/admin/meeting.ts` | (no docstring in source) |
| `admin/meeting:toggleMeeting` | mutation | public (`api`) | `src/convex/admin/meeting.ts` | (no docstring in source) |
| `admin/meeting:triggerMeetingSnapshot` | mutation | public (`api`) | `src/convex/admin/meeting.ts` | (no docstring in source) |
| `admin/meeting:updateMeetingData` | mutation | public (`api`) | `src/convex/admin/meeting.ts` | (no docstring in source) |
| `admin/poll:cancelPoll` | mutation | public (`api`) | `src/convex/admin/poll.ts` | (no docstring in source) |
| `admin/poll:cleanupPollAgendaItemIds` | mutation | internal (`internal`) | `src/convex/admin/poll.ts` | (no docstring in source) |
| `admin/poll:cleanupPollVotes` | mutation | internal (`internal`) | `src/convex/admin/poll.ts` | (no docstring in source) |
| `admin/poll:clearCurrentPollId` | mutation | public (`api`) | `src/convex/admin/poll.ts` | (no docstring in source) |
| `admin/poll:closePollAndShowResults` | mutation | public (`api`) | `src/convex/admin/poll.ts` | (no docstring in source) |
| `admin/poll:closePollByAdmin` | mutation | public (`api`) | `src/convex/admin/poll.ts` | (no docstring in source) |
| `admin/poll:createPoll` | mutation | public (`api`) | `src/convex/admin/poll.ts` | (no docstring in source) |
| `admin/poll:createPollResultSnapshotAction` | action | internal (`internal`) | `src/convex/admin/poll.ts` | (no docstring in source) |
| `admin/poll:duplicatePoll` | mutation | public (`api`) | `src/convex/admin/poll.ts` | (no docstring in source) |
| `admin/poll:editPoll` | mutation | public (`api`) | `src/convex/admin/poll.ts` | (no docstring in source) |
| `admin/poll:getAllPolls` | query | public (`api`) | `src/convex/admin/poll.ts` | (no docstring in source) |
| `admin/poll:getAllResults` | query | public (`api`) | `src/convex/admin/poll.ts` | (no docstring in source) |
| `admin/poll:getPoll` | query | public (`api`) | `src/convex/admin/poll.ts` | (no docstring in source) |
| `admin/poll:getPollResults` | query | internal (`internal`) | `src/convex/admin/poll.ts` | (no docstring in source) |
| `admin/poll:getPollsByAgendaItemId` | query | public (`api`) | `src/convex/admin/poll.ts` | (no docstring in source) |
| `admin/poll:insertPollResultSnapshot` | mutation | internal (`internal`) | `src/convex/admin/poll.ts` | (no docstring in source) |
| `admin/poll:openPoll` | mutation | public (`api`) | `src/convex/admin/poll.ts` | (no docstring in source) |
| `admin/poll:removePoll` | mutation | public (`api`) | `src/convex/admin/poll.ts` | (no docstring in source) |
| `admin/poll:showPollResults` | mutation | public (`api`) | `src/convex/admin/poll.ts` | (no docstring in source) |
| `admin/standalone_poll:cancel_poll` | mutation | public (`api`) | `src/convex/admin/standalone_poll.ts` | (no docstring in source) |
| `admin/standalone_poll:cleanup_poll_votes` | mutation | internal (`internal`) | `src/convex/admin/standalone_poll.ts` | (no docstring in source) |
| `admin/standalone_poll:close_poll` | mutation | public (`api`) | `src/convex/admin/standalone_poll.ts` | (no docstring in source) |
| `admin/standalone_poll:create_poll` | mutation | public (`api`) | `src/convex/admin/standalone_poll.ts` | (no docstring in source) |
| `admin/standalone_poll:create_poll_result_snapshot_action` | action | internal (`internal`) | `src/convex/admin/standalone_poll.ts` | (no docstring in source) |
| `admin/standalone_poll:edit_poll` | mutation | public (`api`) | `src/convex/admin/standalone_poll.ts` | (no docstring in source) |
| `admin/standalone_poll:get_poll` | query | public (`api`) | `src/convex/admin/standalone_poll.ts` | (no docstring in source) |
| `admin/standalone_poll:get_poll_results` | query | internal (`internal`) | `src/convex/admin/standalone_poll.ts` | (no docstring in source) |
| `admin/standalone_poll:insert_poll_result_snapshot` | mutation | internal (`internal`) | `src/convex/admin/standalone_poll.ts` | (no docstring in source) |
| `admin/standalone_poll:list_my_polls` | query | public (`api`) | `src/convex/admin/standalone_poll.ts` | (no docstring in source) |
| `admin/standalone_poll:open_poll` | mutation | public (`api`) | `src/convex/admin/standalone_poll.ts` | (no docstring in source) |
| `admin/standalone_poll:remove_poll` | mutation | public (`api`) | `src/convex/admin/standalone_poll.ts` | (no docstring in source) |
| `admin/users:addParticipant` | mutation | public (`api`) | `src/convex/admin/users.ts` | (no docstring in source) |
| `admin/users:getParticipantEmail` | query | public (`api`) | `src/convex/admin/users.ts` | (no docstring in source) |
| `admin/users:getParticipants` | query | public (`api`) | `src/convex/admin/users.ts` | (no docstring in source) |
| `admin/users:markAllPresentParticipantsAbsent` | mutation | public (`api`) | `src/convex/admin/users.ts` | (no docstring in source) |
| `admin/users:removeParticipant` | mutation | public (`api`) | `src/convex/admin/users.ts` | (no docstring in source) |
| `admin/users:setParticipantAbsent` | mutation | public (`api`) | `src/convex/admin/users.ts` | (no docstring in source) |
| `admin/users:setParticipantBanned` | mutation | public (`api`) | `src/convex/admin/users.ts` | (no docstring in source) |
| `admin/users:setParticipantRole` | mutation | public (`api`) | `src/convex/admin/users.ts` | (no docstring in source) |
| `backup:getMeetingBackupPayload` | query | internal (`internal`) | `src/convex/backup.ts` | (no docstring in source) |
| `backup:getMeetingSnapshotForExport` | query | internal (`internal`) | `src/convex/backup.ts` | (no docstring in source) |
| `backup:listOpenMeetingIds` | query | internal (`internal`) | `src/convex/backup.ts` | (no docstring in source) |
| `backup:runOpenMeetingSnapshots` | action | internal (`internal`) | `src/convex/backup.ts` | (no docstring in source) |
| `backup:saveSnapshotIfChanged` | mutation | internal (`internal`) | `src/convex/backup.ts` | (no docstring in source) |
| `counter/public:add` | mutation | public (component) | `src/convex/counter/public.ts` | (no docstring in source) |
| `counter/public:count` | query | public (component) | `src/convex/counter/public.ts` | (no docstring in source) |
| `counter/public:countAll` | query | public (component) | `src/convex/counter/public.ts` | (no docstring in source) |
| `counter/public:estimateCount` | query | public (component) | `src/convex/counter/public.ts` | (no docstring in source) |
| `counter/public:rebalance` | mutation | public (component) | `src/convex/counter/public.ts` | (no docstring in source) |
| `counter/public:reset` | mutation | public (component) | `src/convex/counter/public.ts` | (no docstring in source) |
| `counter/public:resetAll` | mutation | public (component) | `src/convex/counter/public.ts` | (no docstring in source) |
| `heartbeat:isActive` | query | public (`api`) | `src/convex/heartbeat.ts` | Returns whether the given tokenIdentifier has an active heartbeat (lastSeenAt within threshold). |
| `heartbeat:pruneStaleHeartbeats` | mutation | internal (`internal`) | `src/convex/heartbeat.ts` | Removes heartbeats older than the inactive threshold. Run by cron every 15 minutes. |
| `heartbeat:recordHeartbeat` | mutation | public (`api`) | `src/convex/heartbeat.ts` | Records the current user's heartbeat (call from client to mark participant active). |
| `meetings:findByCode` | query | public (`api`) | `src/convex/meetings.ts` | (no docstring in source) |
| `meetings:getMeetingById` | query | public (`api`) | `src/convex/meetings.ts` | (no docstring in source) |
| `me:getCurrentUser` | query | public (`api`) | `src/convex/me.ts` | (no docstring in source) |
| `me:getMeetingParticipant` | query | public (`api`) | `src/convex/me.ts` | (no docstring in source) |
| `me:hasAtLeastRole` | query | public (`api`) | `src/convex/me.ts` | Hierarchical role check: admin satisfies any role, moderator satisfies moderator+participant. |
| `moderator/meeting:clearPreviousSpeakers` | mutation | public (`api`) | `src/convex/moderator/meeting.ts` | (no docstring in source) |
| `moderator/meeting:getPreviousSpeaker` | query | public (`api`) | `src/convex/moderator/meeting.ts` | (no docstring in source) |
| `moderator/meeting:getPreviousSpeakers` | query | public (`api`) | `src/convex/moderator/meeting.ts` | (no docstring in source) |
| `moderator/meeting:nextSpeaker` | mutation | public (`api`) | `src/convex/moderator/meeting.ts` | (no docstring in source) |
| `moderator/meeting:previousSpeaker` | mutation | public (`api`) | `src/convex/moderator/meeting.ts` | (no docstring in source) |
| `moderator/meeting:removeFromSpeakerQueue` | mutation | public (`api`) | `src/convex/moderator/meeting.ts` | (no docstring in source) |
| `public/standalone_poll:get_by_code` | query | public (`api`) | `src/convex/public/standalone_poll.ts` | (no docstring in source) |
| `public/standalone_poll:get_my_owned_polls` | query | public (`api`) | `src/convex/public/standalone_poll.ts` | (no docstring in source) |
| `public/standalone_poll:get_results_by_poll_id` | query | public (`api`) | `src/convex/public/standalone_poll.ts` | (no docstring in source) |
| `public/standalone_poll:get_vote_counts` | query | public (`api`) | `src/convex/public/standalone_poll.ts` | (no docstring in source) |
| `public/standalone_poll:retract_vote` | mutation | public (`api`) | `src/convex/public/standalone_poll.ts` | (no docstring in source) |
| `public/standalone_poll:vote` | mutation | public (`api`) | `src/convex/public/standalone_poll.ts` | (no docstring in source) |
| `users/attendance:leaveMeeting` | mutation | public (`api`) | `src/convex/users/attendance.ts` | (no docstring in source) |
| `users/attendance:recallReturnRequest` | mutation | public (`api`) | `src/convex/users/attendance.ts` | (no docstring in source) |
| `users/attendance:requestReturnToMeeting` | mutation | public (`api`) | `src/convex/users/attendance.ts` | (no docstring in source) |
| `users/auth:connect` | mutation | public (`api`) | `src/convex/users/auth.ts` | (no docstring in source) |
| `users/auth:getUserData` | query | public (`api`) | `src/convex/users/auth.ts` | (no docstring in source) |
| `users/meeting:getData` | query | public (`api`) | `src/convex/users/meeting.ts` | (no docstring in source) |
| `users/meeting:getMe` | query | public (`api`) | `src/convex/users/meeting.ts` | (no docstring in source) |
| `users/meeting:getMeeting` | query | public (`api`) | `src/convex/users/meeting.ts` | (no docstring in source) |
| `users/poll:getCurrentPoll` | query | public (`api`) | `src/convex/users/poll.ts` | (no docstring in source) |
| `users/poll:getCurrentPollCounters` | query | public (`api`) | `src/convex/users/poll.ts` | (no docstring in source) |
| `users/poll:getPollResultsById` | query | public (`api`) | `src/convex/users/poll.ts` | (no docstring in source) |
| `users/poll:getPollsByAgendaItemId` | query | public (`api`) | `src/convex/users/poll.ts` | (no docstring in source) |
| `users/poll:retractVote` | mutation | public (`api`) | `src/convex/users/poll.ts` | (no docstring in source) |
| `users/poll:vote` | mutation | public (`api`) | `src/convex/users/poll.ts` | (no docstring in source) |
| `users/queue:doneSpeaking` | mutation | public (`api`) | `src/convex/users/queue.ts` | (no docstring in source) |
| `users/queue:getNextSpeakers` | query | public (`api`) | `src/convex/users/queue.ts` | (no docstring in source) |
| `users/queue:placeInSpeakerQueue` | mutation | public (`api`) | `src/convex/users/queue.ts` | (no docstring in source) |
| `users/queue:recallRequest` | mutation | public (`api`) | `src/convex/users/queue.ts` | (no docstring in source) |
| `users/queue:recallSpeakerQueueRequest` | mutation | public (`api`) | `src/convex/users/queue.ts` | (no docstring in source) |
| `users/queue:request` | mutation | public (`api`) | `src/convex/users/queue.ts` | (no docstring in source) |

---

## Similar and overlapping functions (flags)

### 1. Intentional parallel APIs (same role, different domain)

These pairs normalize to the **same logical name** (camelCase vs `snake_case`). They are strong candidates for shared helpers behind two entrypoints, or for documentation that cross-links them.

| Normalized intent | Functions |
|-------------------|-----------|
| Meeting-attached polls vs standalone polls | `admin/poll:createPoll` ↔ `admin/standalone_poll:create_poll`, `editPoll` ↔ `edit_poll`, `openPoll` ↔ `open_poll`, `removePoll` ↔ `remove_poll`, `cancelPoll` ↔ `cancel_poll`, `getPoll` ↔ `get_poll`, `cleanupPollVotes` ↔ `cleanup_poll_votes`, `insertPollResultSnapshot` ↔ `insert_poll_result_snapshot`, `createPollResultSnapshotAction` ↔ `create_poll_result_snapshot_action`, `getPollResults` ↔ `get_poll_results` |
| Meeting poll vs standalone poll (close) | `admin/poll:closePollByAdmin` ↔ `admin/standalone_poll:close_poll` (same kind, parallel naming) |
| Agenda vs participant views of polls | `admin/poll:getPollsByAgendaItemId` ↔ `users/poll:getPollsByAgendaItemId` (**identical export name**, different auth/middleware) |
| Standalone vs meeting voting | `public/standalone_poll:vote` ↔ `users/poll:vote`, `public/standalone_poll:retract_vote` ↔ `users/poll:retractVote` |

### 2. Same meeting snapshot pipeline (backup)

| Function | Note |
|----------|------|
| `backup:getMeetingBackupPayload` | Builds snapshot via `buildMeetingSnapshotPayload`; supports optional `allowClosedMeeting`. |
| `backup:getMeetingSnapshotForExport` | Same payload builder; additionally enforces **admin** participant for the given `tokenIdentifier` (used from HTTP export). |

These are **not** duplicates; they are two gates on the same underlying snapshot builder.

### 3. Participant / meeting reads (easy to confuse)

| Group | Functions | Distinction to keep in mind |
|-------|-----------|----------------------------|
| Meeting document | `meetings:getMeetingById`, `users/meeting:getMeeting` | Both return meeting data; `getMeetingById` is authed + arbitrary id; `getMeeting` uses `withMeeting` context. |
| Current participant | `me:getMeetingParticipant`, `users/meeting:getMe` | Both resolve the caller’s participant row for a meeting; different modules and call sites. |
| Aggregated UI payload | `users/meeting:getData`, `users/auth:getUserData` | Names suggest overlap; `getData` is the large meeting+agenda+participant bundle; `getUserData` is scoped to user-facing participant fields (see implementations in `users/meeting.ts` and `users/auth.ts`). |

### 4. Poll results naming (cross-surface)

| Function A | Function B | Note |
|------------|------------|------|
| `public/standalone_poll:get_results_by_poll_id` | `users/poll:getPollResultsById` | Same kind (query); token shapes differ but both answer “results for this poll id” for their respective products. |
| `admin/poll:getPollResults` (internal) | `public/standalone_poll:get_results_by_poll_id` | Both “poll results” queries; different visibility and auth. |

### 5. Navigation vs speaker queue (word overlap only)

`admin/agenda:next` / `previous` (agenda) and `moderator/meeting:nextSpeaker` / `previousSpeaker` share “next/previous” vocabulary but operate on **different** meeting structures. Treat as **low-risk name collision** for readers, not duplicate logic.

### 6. False friends (token overlap, unrelated behavior)

Automated name similarity also flags pairs like `counter/public:add` vs `admin/users:addParticipant` or `admin/meeting:resetMeeting` vs `counter/public:reset`. These are **not** semantically related; they only share generic English tokens.

---

## Regenerating or extending this map

The table was built by scanning `export const name = …` registrations that use either the classic Convex helpers (`query({…})`, `internalMutation({…})`, …) or the project builder (`.query().public(…)` / `.internal(…)`). Files under `src/convex/**/_generated` and `src/convex/betterAuth/**` were skipped. Descriptions use the **last** `/** … */` block immediately before each export when present.

To refresh after large refactors, re-run a similar scan or extend the script to emit this markdown again.
