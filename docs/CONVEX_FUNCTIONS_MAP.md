# Convex functions map

This document lists **registered Convex functions** in this app: queries, mutations, actions, and how they are exposed. It reflects `src/convex/**/*.ts` (excluding `_generated/` and `betterAuth/`). Layout: **`meeting/[role]`** (live meeting product), **`app/`** (cross-cutting app modules), **`migrations/`** (internal maintenance), **`userPoll/`** (user-owned link polls: `admin.ts`, `public.ts`, `jobs/*`).

## How paths map to client references

| Exposure                         | TypeScript reference pattern   | Notes                                                                                                                                                                                                                                     |
| -------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public query / mutation / action | `api.domain.role.module.fn`    | Each segment maps from the path under `src/convex/` (e.g. `meeting/admin/meetingPoll.ts` → `api.meeting.admin.meetingPoll.createPoll`, `userPoll/public.ts` → `api.userPoll.public.getByCode`).                                           |
| Internal                         | `internal.<path>.fn`           | Path mirrors `src/convex/**` (e.g. `meeting/jobs/meetingPollClose.ts` → `internal.meeting.jobs.meetingPollClose.*`). Job-style internals live under `*/jobs/*`. Callable only from other Convex functions, crons, or trusted server code. |
| HTTP                             | `convex/http.ts`               | Routes on the Convex HTTP router (Better Auth, meeting snapshot export). Not `api.*` functions.                                                                                                                                           |
| Component: sharded counters      | `components.counters.public.*` | `src/convex/counter/public.ts`; isolated component tables.                                                                                                                                                                                |
| Component: Better Auth           | `components.betterAuth.*`      | Adapter and auth **internal** functions; see `src/convex/_generated/api.d.ts`. App wires `internal.auth` via `src/convex/auth.ts`.                                                                                                        |

**Cron jobs** (`src/convex/crons.ts`): `internal.meeting.jobs.snapshots.runOpenMeetingSnapshots` (heartbeats / prune cron removed).

**Count:** Same ballpark as before the rename (meeting + app + migrations + `userPoll` modules only; excludes Better Auth component internals, HTTP handlers, and counter component exports listed separately above).

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

#### `meeting/admin/meetingPoll` → `api.meeting.admin.meetingPoll`

Public queries: `getAllPolls`, `getPoll`, `getPollsByAgendaItemId`, `getAllResults`. Public mutations: `createPoll`, `editPoll`, `openPoll`, `showPollResults`, `closePollByAdmin`, `closePollAndShowResults`, `clearCurrentPollId`, `removePoll`, `duplicatePoll`, `cancelPoll`. Poll-close and cleanup internals live under **Meeting — jobs** (`meeting/jobs/meetingPollClose`, `meeting/jobs/meetingPollCleanup`).

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

#### `meeting/users/meetingPoll` → `api.meeting.users.meetingPoll`

Queries: `getPollsByAgendaItemId`, `getCurrentPoll`, `getCurrentPollCounters`, `getPollResultsById`. Mutations: `vote`, `retractVote`.

#### `meeting/users/queue` → `api.meeting.users.queue`

Query: `getNextSpeakers`. Mutations: `request`, `recallRequest`, `placeInSpeakerQueue`, `recallSpeakerQueueRequest`, `doneSpeaking`.

### Meeting — jobs (`src/convex/meeting/jobs/`)

Internal-only modules grouped by **pipeline** (scheduler / cron side effects), not by admin UI surface.

#### `meeting/jobs/meetingPollClose` → `internal.meeting.jobs.meetingPollClose`

Query: `getPollResults`. Mutation: `insertPollResultSnapshot`. Action: `createPollResultSnapshotAction` (runs after a meeting poll closes).

#### `meeting/jobs/meetingPollCleanup` → `internal.meeting.jobs.meetingPollCleanup`

Mutations: `cleanupPollVotes`, `cleanupPollAgendaItemIds`.

#### `meeting/jobs/speakerLog` → `internal.meeting.jobs.speakerLog`

Mutation: `logSpeaker` (scheduled when a speaker / reply / point-of-order slot ends).

#### `meeting/jobs/snapshots` → `internal.meeting.jobs.snapshots`

Meeting snapshot / export pipeline (cron + HTTP export + admin “snapshot now”). Queries: `listOpenMeetingIds`, `getMeetingBackupPayload`, `getMeetingSnapshotForExport`. Mutation: `saveSnapshotIfChanged`. Action: `runOpenMeetingSnapshots`.

### Meeting — public (`src/convex/meeting/public/`)

#### `meeting/public/meetings` → `api.meeting.public.meetings`

| Convex path                              | Type  | Visibility | Description |
| ---------------------------------------- | ----- | ---------- | ----------- |
| `meeting/public/meetings:getMeetingById` | query | public     |             |
| `meeting/public/meetings:findByCode`     | query | public     |             |

### Meeting — platform (`src/convex/meeting/platform/`)

#### `meeting/platform/meetings` → `api.meeting.platform.meetings`

| Convex path                                    | Type     | Visibility | Description |
| ---------------------------------------------- | -------- | ---------- | ----------- |
| `meeting/platform/meetings:listForCurrentUser` | query    | public     |             |
| `meeting/platform/meetings:create`             | mutation | public     |             |
| `meeting/platform/meetings:archive`            | mutation | public     |             |
| `meeting/platform/meetings:reopen`             | mutation | public     |             |

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

#### `migrations/backfillMeetingLifecycle` → internal only

| Convex path                                                        | Type     | Visibility | Description                                                                                   |
| ------------------------------------------------------------------ | -------- | ---------- | --------------------------------------------------------------------------------------------- |
| `migrations/backfillMeetingLifecycle:backfillMeetingLifecyclePage` | mutation | internal   | Paginated backfill for `meetings` lifecycle fields (`status`, `timezone`, `createdByUserId`). |

#### `migrations/verifyPollFlatSchema` → internal only

| Convex path                                                | Type     | Visibility | Description                                                                                                                  |
| ---------------------------------------------------------- | -------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `migrations/verifyPollFlatSchema:verifyPollFlatSchemaPage` | mutation | internal   | Paginated Zod verification for `meetingPolls`, `userPolls`, and embedded `poll` on `meetingPollResults` / `userPollResults`. |

### User polls (`src/convex/userPoll/`)

#### `userPoll/admin` → `api.userPoll.admin`

Public queries: `listMyPolls`, `getPoll`. Public mutations: `createPoll`, `editPoll`, `openPoll`, `closePoll`, `cancelPoll`, `removePoll`.

#### `userPoll/public` → `api.userPoll.public`

Queries: `getByCode`, `getVoteCounts`, `getResultsByPollId`, `getMyOwnedPolls`. Mutations: `vote`, `retractVote`.

#### `userPoll/jobs/*` → `internal.userPoll.jobs.*` (internal only)

| Module                   | Functions                                                    |
| ------------------------ | ------------------------------------------------------------ |
| `userPoll/jobs/results`  | `getPollResults`                                             |
| `userPoll/jobs/cleanup`  | `cleanupPollVotes`                                           |
| `userPoll/jobs/snapshot` | `insertPollResultSnapshot`, `createPollResultSnapshotAction` |

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

### 1. Intentional parallel APIs (meeting-attached vs user-owned polls)

| Normalized intent                 | Functions                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parallel poll APIs                | `meeting/admin/meetingPoll:createPoll` ↔ `userPoll/admin:createPoll`, same for `editPoll`, `openPoll`, `removePoll`, `cancelPoll`, `getPoll`. Meeting job internals: `meeting/jobs/meetingPollClose` + `meeting/jobs/meetingPollCleanup`. User-poll job internals: `userPoll/jobs/results`, `userPoll/jobs/cleanup`, `userPoll/jobs/snapshot`. |
| Close semantics                   | `meeting/admin/meetingPoll:closePollByAdmin` ↔ `userPoll/admin:closePoll`                                                                                                                                                                                                                                                                      |
| Same export, different middleware | `meeting/admin/meetingPoll:getPollsByAgendaItemId` ↔ `meeting/users/meetingPoll:getPollsByAgendaItemId`                                                                                                                                                                                                                                        |
| Voting surfaces                   | `userPoll/public:vote` ↔ `meeting/users/meetingPoll:vote`, `retractVote` ↔ `retractVote`                                                                                                                                                                                                                                                       |

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

| A                                                         | B                                              | Note                             |
| --------------------------------------------------------- | ---------------------------------------------- | -------------------------------- |
| `userPoll/public:getResultsByPollId`                      | `meeting/users/meetingPoll:getPollResultsById` | Same intent, different products. |
| `meeting/jobs/meetingPollClose:getPollResults` (internal) | `userPoll/public:getResultsByPollId`           | Different visibility and auth.   |

### 5. Navigation vs speaker queue

`meeting/admin/agenda:next` / `previous` vs `meeting/moderator/meeting:nextSpeaker` / `previousSpeaker` — different structures; low-risk name collision.

### 6. False friends

e.g. `counter/public:add` vs `meeting/admin/users:addParticipant` — unrelated semantics.

### 7. Meeting lifecycle controls (same domain, different scope)

| Function group     | Functions                                                                                                                                                   | Distinction                                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Platform lifecycle | `meeting/platform/meetings:archive`, `meeting/platform/meetings:reopen`, `meeting/platform/meetings:listForCurrentUser`, `meeting/platform/meetings:create` | Organizer-level provisioning and lifecycle outside a specific live meeting session.                    |
| In-meeting runtime | `meeting/admin/meeting:toggleMeeting`, `meeting/admin/meeting:updateMeetingData`                                                                            | Session-level controls for an already joined meeting context (`withMeeting` + participant admin role). |

---

## Regenerating or extending this map

Scan `export const …` in `src/convex/meeting/`, `src/convex/app/`, `src/convex/migrations/`, `src/convex/userPoll/`, plus root modules and components. Skip `_generated` and `betterAuth/`. Admin / role modules follow **public first, then internals** when present; dedicated **`*/jobs.ts`** (or `*/jobs/*`) files are internal-only and grouped by pipeline. Use `// --- … ---` section comments where helpful.
