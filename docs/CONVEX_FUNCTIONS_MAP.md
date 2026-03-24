# Convex functions map

This document lists **registered Convex functions** in this app: queries, mutations, actions, and how they are exposed. It reflects `src/convex/**/*.ts` (excluding `_generated/` and `betterAuth/`). Layout: **`meeting/[role]`** (live meeting product), **`app/`** (cross-cutting app modules), **`migrations/`** (internal maintenance), **`polls/[role]`** (standalone polls).

## How paths map to client references

| Exposure                         | TypeScript reference pattern   | Notes                                                                                                                                                                                                                         |
| -------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public query / mutation / action | `api.domain.role.module.fn`    | Each segment maps from the path under `src/convex/` (e.g. `meeting/admin/poll.ts` → `api.meeting.admin.poll.createPoll`, `polls/public/standalone_poll.ts` → `api.polls.public.standalone_poll.getByCode`).                   |
| Internal                         | `internal.<path>.fn`           | Path mirrors `src/convex/**` (e.g. `meeting/jobs/poll_close.ts` → `internal.meeting.jobs.poll_close.*`). Job-style internals live under `*/jobs/*`. Callable only from other Convex functions, crons, or trusted server code. |
| HTTP                             | `convex/http.ts`               | Routes on the Convex HTTP router (Better Auth, meeting snapshot export). Not `api.*` functions.                                                                                                                               |
| Component: sharded counters      | `components.counters.public.*` | `src/convex/counter/public.ts`; isolated component tables.                                                                                                                                                                    |
| Component: Better Auth           | `components.betterAuth.*`      | Adapter and auth **internal** functions; see `src/convex/_generated/api.d.ts`. App wires `internal.auth` via `src/convex/auth.ts`.                                                                                            |

**Cron jobs** (`src/convex/crons.ts`): `internal.meeting.jobs.snapshots.runOpenMeetingSnapshots` (heartbeats / prune cron removed).

**Count:** 111 functions in the index below (meeting + app + polls modules only; excludes Better Auth component internals, HTTP handlers, and counter component exports listed separately above).

---

## Function index

### Meeting — admin (`src/convex/meeting/admin/`)

#### `meeting/admin/agenda` → `api.meeting.admin.agenda`

| Convex path                                 | Type     | Visibility | Description |
| ------------------------------------------- | -------- | ---------- | ----------- |
| `meeting/admin/agenda:createAgendaItem`     | mutation | public     |             |
| `meeting/admin/agenda:moveAgendaItem`       | mutation | public     |             |
| `meeting/admin/agenda:next`                 | mutation | public     |             |
| `meeting/admin/agenda:previous`             | mutation | public     |             |
| `meeting/admin/agenda:removeAgendaItem`     | mutation | public     |             |
| `meeting/admin/agenda:setAgendaItemPollIds` | mutation | public     |             |
| `meeting/admin/agenda:setCurrentAgendaItem` | mutation | public     |             |
| `meeting/admin/agenda:updateAgendaItem`     | mutation | public     |             |

#### `meeting/admin/meeting` → `api.meeting.admin.meeting`

| Convex path                                    | Type     | Visibility | Description |
| ---------------------------------------------- | -------- | ---------- | ----------- |
| `meeting/admin/meeting:getPointOfOrderEntries` | query    | public     |             |
| `meeting/admin/meeting:getSpeakerLogEntries`   | query    | public     |             |
| `meeting/admin/meeting:getAttendance`          | query    | public     |             |
| `meeting/admin/meeting:getAbsentees`           | query    | public     |             |
| `meeting/admin/meeting:getAbsenceEntries`      | query    | public     |             |
| `meeting/admin/meeting:getReturnRequests`      | query    | public     |             |
| `meeting/admin/meeting:approveReturnRequest`   | mutation | public     |             |
| `meeting/admin/meeting:denyReturnRequest`      | mutation | public     |             |
| `meeting/admin/meeting:clearPointOfOrder`      | mutation | public     |             |
| `meeting/admin/meeting:acceptPointOfOrder`     | mutation | public     |             |
| `meeting/admin/meeting:clearBreak`             | mutation | public     |             |
| `meeting/admin/meeting:acceptBreak`            | mutation | public     |             |
| `meeting/admin/meeting:acceptReply`            | mutation | public     |             |
| `meeting/admin/meeting:clearReply`             | mutation | public     |             |
| `meeting/admin/meeting:toggleMeeting`          | mutation | public     |             |
| `meeting/admin/meeting:triggerMeetingSnapshot` | mutation | public     |             |
| `meeting/admin/meeting:resetMeeting`           | mutation | public     |             |
| `meeting/admin/meeting:updateMeetingData`      | mutation | public     |             |
| `meeting/admin/meeting:recountParticipants`    | mutation | public     |             |

#### `meeting/admin/poll` → `api.meeting.admin.poll`

Public queries: `getAllPolls`, `getPoll`, `getPollsByAgendaItemId`, `getAllResults`. Public mutations: `createPoll`, `editPoll`, `openPoll`, `showPollResults`, `closePollByAdmin`, `closePollAndShowResults`, `clearCurrentPollId`, `removePoll`, `duplicatePoll`, `cancelPoll`. Poll-close and cleanup internals live under **Meeting — jobs** (`meeting/jobs/poll_close`, `meeting/jobs/poll_cleanup`).

#### `meeting/admin/users` → `api.meeting.admin.users`

| Convex path                                            | Type     | Visibility | Description |
| ------------------------------------------------------ | -------- | ---------- | ----------- |
| `meeting/admin/users:getParticipants`                  | query    | public     |             |
| `meeting/admin/users:getParticipantEmail`              | query    | public     |             |
| `meeting/admin/users:addParticipant`                   | mutation | public     |             |
| `meeting/admin/users:markAllPresentParticipantsAbsent` | mutation | public     |             |
| `meeting/admin/users:removeParticipant`                | mutation | public     |             |
| `meeting/admin/users:setParticipantAbsent`             | mutation | public     |             |
| `meeting/admin/users:setParticipantBanned`             | mutation | public     |             |
| `meeting/admin/users:setParticipantRole`               | mutation | public     |             |

### Meeting — moderator (`src/convex/meeting/moderator/`)

#### `meeting/moderator/meeting` → `api.meeting.moderator.meeting`

Queries: `getPreviousSpeakers`, `getPreviousSpeaker`. Mutations: `removeFromSpeakerQueue`, `nextSpeaker`, `previousSpeaker`, `clearPreviousSpeakers`.

### Meeting — users (`src/convex/meeting/users/`)

#### `meeting/users/attendance` → `api.meeting.users.attendance`

Mutations: `leaveMeeting`, `requestReturnToMeeting`, `recallReturnRequest`.

#### `meeting/users/auth` → `api.meeting.users.auth`

Query: `getUserData`. Mutation: `connect`.

#### `meeting/users/meeting` → `api.meeting.users.meeting`

Queries: `getMeeting`, `getMe`, `getData`.

#### `meeting/users/participant` → `api.meeting.users.participant`

Queries: `getMeetingParticipant`, `hasAtLeastRole`.

#### `meeting/users/poll` → `api.meeting.users.poll`

Queries: `getPollsByAgendaItemId`, `getCurrentPoll`, `getCurrentPollCounters`, `getPollResultsById`. Mutations: `vote`, `retractVote`.

#### `meeting/users/queue` → `api.meeting.users.queue`

Query: `getNextSpeakers`. Mutations: `request`, `recallRequest`, `placeInSpeakerQueue`, `recallSpeakerQueueRequest`, `doneSpeaking`.

### Meeting — jobs (`src/convex/meeting/jobs/`)

Internal-only modules grouped by **pipeline** (scheduler / cron side effects), not by admin UI surface.

#### `meeting/jobs/poll_close` → `internal.meeting.jobs.poll_close`

Query: `getPollResults`. Mutation: `insertPollResultSnapshot`. Action: `createPollResultSnapshotAction` (runs after a meeting poll closes).

#### `meeting/jobs/poll_cleanup` → `internal.meeting.jobs.poll_cleanup`

Mutations: `cleanupPollVotes`, `cleanupPollAgendaItemIds`.

#### `meeting/jobs/speaker_log` → `internal.meeting.jobs.speaker_log`

Mutation: `logSpeaker` (scheduled when a speaker / reply / point-of-order slot ends).

#### `meeting/jobs/snapshots` → `internal.meeting.jobs.snapshots`

Meeting snapshot / export pipeline (cron + HTTP export + admin “snapshot now”). Queries: `listOpenMeetingIds`, `getMeetingBackupPayload`, `getMeetingSnapshotForExport`. Mutation: `saveSnapshotIfChanged`. Action: `runOpenMeetingSnapshots`.

### Meeting — public (`src/convex/meeting/public/`)

#### `meeting/public/meetings` → `api.meeting.public.meetings`

| Convex path                              | Type  | Visibility | Description |
| ---------------------------------------- | ----- | ---------- | ----------- |
| `meeting/public/meetings:getMeetingById` | query | public     |             |
| `meeting/public/meetings:findByCode`     | query | public     |             |

### App (`src/convex/app/`)

#### `app/admin/global` → `api.app.admin.global`

| Convex path                   | Type     | Visibility | Description |
| ----------------------------- | -------- | ---------- | ----------- |
| `app/admin/global:createUser` | mutation | public     |             |

#### `app/me` → `api.app.me`

| Convex path             | Type  | Visibility | Description |
| ----------------------- | ----- | ---------- | ----------- |
| `app/me:getCurrentUser` | query | public     |             |

### Migrations (`src/convex/migrations/`)

#### `migrations/verify_poll_flat_schema` → internal only

| Convex path                                                   | Type     | Visibility | Description                                                                                      |
| ------------------------------------------------------------- | -------- | ---------- | ------------------------------------------------------------------------------------------------ |
| `migrations/verify_poll_flat_schema:verifyPollFlatSchemaPage` | mutation | internal   | Paginated Zod verification for `polls`, `standalonePolls`, and embedded `poll` on result tables. |

### Polls (`src/convex/polls/`)

#### `polls/admin/standalone_poll` → `api.polls.admin.standalone_poll`

Public queries: `listMyPolls`, `getPoll`. Public mutations: `createPoll`, `editPoll`, `openPoll`, `closePoll`, `cancelPoll`, `removePoll`. Standalone poll close / cleanup internals: **`polls/jobs/standalone_polls`** → `internal.polls.jobs.standalone_polls` (`getPollResults`, `cleanupPollVotes`, `insertPollResultSnapshot`, `createPollResultSnapshotAction`).

#### `polls/public/standalone_poll` → `api.polls.public.standalone_poll`

Queries: `getByCode`, `getVoteCounts`, `getResultsByPollId`, `getMyOwnedPolls`. Mutations: `vote`, `retractVote`.

### Component: sharded counter (`src/convex/counter/public.ts`) → `components.counters.public`

| Convex path                    | Type     | Visibility         | Description |
| ------------------------------ | -------- | ------------------ | ----------- |
| `counter/public:add`           | mutation | public (component) |             |
| `counter/public:count`         | query    | public (component) |             |
| `counter/public:countAll`      | query    | public (component) |             |
| `counter/public:estimateCount` | query    | public (component) |             |
| `counter/public:rebalance`     | mutation | public (component) |             |
| `counter/public:reset`         | mutation | public (component) |             |
| `counter/public:resetAll`      | mutation | public (component) |             |

---

## Similar and overlapping functions (flags)

### 1. Intentional parallel APIs (meeting-attached vs standalone polls)

| Normalized intent                 | Functions                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parallel poll APIs                | `meeting/admin/poll:createPoll` ↔ `polls/admin/standalone_poll:createPoll`, same for `editPoll`, `openPoll`, `removePoll`, `cancelPoll`, `getPoll`. Meeting job internals: `meeting/jobs/poll_close` + `meeting/jobs/poll_cleanup`. Standalone job internals: `polls/jobs/standalone_polls` (`cleanupPollVotes`, `insertPollResultSnapshot`, `createPollResultSnapshotAction`, `getPollResults`). |
| Close semantics                   | `meeting/admin/poll:closePollByAdmin` ↔ `polls/admin/standalone_poll:closePoll`                                                                                                                                                                                                                                                                                                                   |
| Same export, different middleware | `meeting/admin/poll:getPollsByAgendaItemId` ↔ `meeting/users/poll:getPollsByAgendaItemId`                                                                                                                                                                                                                                                                                                         |
| Voting surfaces                   | `polls/public/standalone_poll:vote` ↔ `meeting/users/poll:vote`, `retractVote` ↔ `retractVote`                                                                                                                                                                                                                                                                                                    |

### 2. Same meeting snapshot pipeline (backup)

| Function                                             | Note                                                                              |
| ---------------------------------------------------- | --------------------------------------------------------------------------------- |
| `meeting/jobs/snapshots:getMeetingBackupPayload`     | `buildMeetingSnapshotPayload`; optional `allowClosedMeeting`.                     |
| `meeting/jobs/snapshots:getMeetingSnapshotForExport` | Same builder; enforces **admin** participant for `tokenIdentifier` (HTTP export). |

### 3. Participant / meeting reads (easy to confuse)

| Group               | Functions                                                                        | Distinction                                     |
| ------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------- |
| Meeting document    | `meeting/public/meetings:getMeetingById`, `meeting/users/meeting:getMeeting`     | Arbitrary id + authed vs `withMeeting` context. |
| Current participant | `meeting/users/participant:getMeetingParticipant`, `meeting/users/meeting:getMe` | Same row, different modules.                    |
| Bundles             | `meeting/users/meeting:getData`, `meeting/users/auth:getUserData`                | Large bundle vs participant field slice.        |

### 4. Poll results naming (cross-surface)

| A                                                   | B                                                 | Note                             |
| --------------------------------------------------- | ------------------------------------------------- | -------------------------------- |
| `polls/public/standalone_poll:getResultsByPollId`   | `meeting/users/poll:getPollResultsById`           | Same intent, different products. |
| `meeting/jobs/poll_close:getPollResults` (internal) | `polls/public/standalone_poll:getResultsByPollId` | Different visibility and auth.   |

### 5. Navigation vs speaker queue

`meeting/admin/agenda:next` / `previous` vs `meeting/moderator/meeting:nextSpeaker` / `previousSpeaker` — different structures; low-risk name collision.

### 6. False friends

e.g. `counter/public:add` vs `meeting/admin/users:addParticipant` — unrelated semantics.

---

## Regenerating or extending this map

Scan `export const …` in `src/convex/meeting/`, `src/convex/app/`, `src/convex/migrations/`, `src/convex/polls/`, plus root modules and components. Skip `_generated` and `betterAuth/`. Admin / role modules follow **public first, then internals** when present; dedicated **`*/jobs/*.ts`** files are internal-only and grouped by pipeline. Use `// --- … ---` section comments where helpful.
