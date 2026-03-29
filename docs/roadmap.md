# Roadmap - Meeting Platform (SMB)

This roadmap captures the next product steps for the meeting platform, based on current capabilities in this repository.

## As implemented today (repo snapshot)

Use this when scoping tickets so work is additive rather than duplicated.

**Meetings**

- Meetings store both stable config and hot runtime on the `meetings` document: `code`, `title`, `date`, `timezone`, optional `location` / `description`, `agenda`, plus live state (`currentSpeaker`, request slots, `currentPollId`, etc.).
- **Provisioning (platform admins):** Convex `meeting/platform/meetings` — `create` (unique 6-digit code, creator as meeting admin participant), `listForCurrentUser`, `archive`, `reopen`. Dashboard UI: `(dash)/meetings` with create form (timezone, location, description) and meetings table (status, archive/reopen).
- **Lifecycle:** `status` is `draft | scheduled | active | closed | archived` (schema). New meetings start as **`draft`**. In-meeting **`toggleMeeting`** opens/closes the session and sets `status` to **`active`** / **`closed`** while syncing **`isOpen`**. **`scheduled`** exists in the schema but is not yet driven by explicit product transitions or UI.
- In-meeting admins can update `title`, `code`, and `date` via `meeting/admin/meeting:updateMeetingData` (code uniqueness enforced).

**Join and participants**

- Join-by-code flow (`meeting/public/meetings.findByCode`, connect / join routes). Participants in `meetingParticipants` with roles; absence / return-request behavior in [Absence system](ABSENCE.md).
- Access control: knowing the code + not banned; **archived** meetings are blocked. No allowlist / invite token / RSVP yet.

**Live meeting features**

- Agenda editing, polls, voting, projector / admin / moderator surfaces, snapshots / backup helpers. Simplified HTTP participant mode under `(no-convex)/m/simplified/` per project rules.

**Standalone polls**

- Admin UI under `/polls`, participant flow under `/p/[code]`.

**Auth and admin shell**

- Better Auth; SvelteKit platform admin areas for users and meeting list.

**Gaps vs desired product**

- No `accessMode`, **`meetingAccessList`**, or join gating beyond archive + ban.
- No **`meetingInvites`** / RSVP.
- Profile route is still a placeholder (`profile/+page.svelte`).
- No dedicated **runtime** table; hot fields still live on `meetings`.

---

## Product goals

1. Complete the full meeting lifecycle (create → invite → run → follow-up).
2. Improve live collaboration during meetings.
3. Add operational tooling (notifications, calendar, analytics, integrations).
4. Support both open and restricted meeting access models.

---

## P1 - Core product loop (highest priority)

### Bulk user add system _(current top priority)_

**Problem:** Admins add people one at a time via the meeting participants UI (`add-user-dialog.svelte`): Better Auth `admin.createUser` plus optional `meeting/admin/users.addParticipant`. That is too slow when an organizer needs to onboard a whole team or membership list before a meeting.

**Agreed scope (product)**

- **Accounts:** Create **Better Auth users** in bulk where needed, and **implement the `meetingAccessList` table and writes** as part of the same initiative so closed/access-gated join can use the same identities (see [§2](#2-meeting-access-control-open-vs-closed)).
- **UI placement:** **Meeting-scoped** (import is for a chosen meeting), but **only platform admins** may run it for now (hard cap **200 rows** per import).
- **Input:** **CSV, UTF-8**; columns include **email**, **name**, **role** (align with participant roles); **optional password** per row.
- **Credentials:** **Optional password** column — when present, use it for account creation/update; when absent, generate a **random** password. Organizers will often fill passwords for **temporary-email** rows (`+m{code}@…`-style) they hand out in the room; real-email rows can omit it.
- **Idempotency / partial success:** **Upsert-style** behavior — if the user already exists, **do not fail the batch**; **attach** `meetingParticipants` and/or `meetingAccessList` as appropriate. **Preview → commit**; per-row outcomes; **downloadable error report** for failures; Swedish UI copy.
- **Success criterion (MVP):** Organizer completes a typical import (e.g. tens of rows) in **under ~2 minutes** with **low failure rate** (target **&lt; 5%** row failures excluding bad source data); refine with real usage.

**Architecture**

- **Single pipeline** per import row: resolve or create auth user → write **`meetingAccessList`** (and **`meetingParticipants`** per agreed rules) so bulk import is not duplicated as a separate “allowlist-only” tool later.
- **Server-side:** Convex **action** (or equivalent) with **batching** and rate awareness; **no** large loops of `createUser` from the browser.

**Dependencies**

- Schema and API for **`meetingAccessList`** (and eventually `meetings.accessMode` / `access.canJoin` from §2) must land in step with or immediately before join-gate enforcement; bulk add is the first heavy consumer of allowlist writes.

---

### 1) Meeting creation and lifecycle

**Status:** **Core provisioning is implemented.** Remaining work is lifecycle clarity, optional `scheduled` wiring, and contributor-facing documentation (see [docs/TODO.md](TODO.md) for small items).

**Done**

- [x] Meeting schema: `createdByUserId`, `status`, `timezone`, `location`, `description`, indexes (`by_code`, `by_createdByUserId`, `by_status_and_date`, `by_isOpen`).
- [x] Platform API: `meeting/platform/meetings` — `create`, `listForCurrentUser`, `archive`, `reopen`.
- [x] Dashboard provisioning UI and archive/reopen; create captures timezone / location / description.
- [x] In-meeting open/close via `toggleMeeting` (`active` / `closed`, `isOpen` synced).
- [x] In-meeting metadata updates via `updateMeetingData`.
- [x] Archived meetings rejected on join / load paths that use `assertMeetingNotArchived`.

**Still open (strategic)**

- Decide product semantics for **`draft` / `scheduled`** vs “session open” (join is currently allowed for non-archived meetings regardless of `draft`).
- Optional explicit transitions: `draft` → `scheduled` → `active` → `closed` → `archived` (beyond today’s create-as-draft + toggle + archive).
- Single mental model for **`status` vs `isOpen`** across the codebase and UI.

---

### 2) Meeting access control (open vs closed)

**Problem:** Anyone with the code can become a participant (unless banned); there is no allowlist, invite-only gate, or RSVP-backed authorization yet.

**Sequencing note:** Implement the **`meetingAccessList`** table and write paths together with [Bulk user add](#bulk-user-add-system-current-top-priority) so imports populate allowlist (and participants) in one flow; then wire **`accessMode`** and **`access.canJoin`** / join UX so closed meetings actually enforce the list.

**Deliverables**

- Add access modes per meeting:
  - `open` (join by code)
  - `closed` (only pre-approved users)
  - optional `invite_only` (must accept invite token)
- Block unauthorized join attempts with clear UI messaging.
- Admin tools to manage allowlist (add/remove users, bulk import by email).
- Audit log entries for denied join attempts and access list changes.

**Suggested backend functions**

- `access.setMode`
- `access.addAllowedUser`
- `access.removeAllowedUser`
- `access.bulkAddAllowedUsers`
- `access.canJoin`

**Schema additions**

- `meetings.accessMode` (`open | closed | invite_only`)
- New table `meetingAccessList`: `meetingId`, `userId?`, `email?`, `addedByUserId`, `addedAt`

**Indexes**

- `meetingAccessList.by_meetingId`
- `meetingAccessList.by_meetingId_and_userId`
- `meetingAccessList.by_meetingId_and_email`

---

### 3) Invitations and RSVP

**Problem:** Join-by-code exists, but invite and RSVP workflows are missing.

**Deliverables**

- Invite participants by email or secure invite link.
- RSVP states (`accepted`, `tentative`, `declined`, `pending`).
- Meeting participant view showing expected vs actual attendance.

**Suggested backend functions**

- `invites.sendBulk`
- `invites.acceptByToken`
- `invites.revoke`
- `rsvp.set`
- `invites.listByMeeting`
- `rsvp.summaryByMeeting`

**New table**

- `meetingInvites`: `meetingId`, `email`, `role`, `status`, `inviteToken`, `expiresAt`, `invitedByUserId`

**Indexes**

- `by_meetingId`
- `by_email_and_meetingId`
- `by_inviteToken`
- `by_status_and_meetingId`

---

### 4) Extract hot meeting runtime state into a runtime table

**Problem:** The `meetings` document currently mixes relatively stable configuration (e.g. agenda) with “hot” live-state fields that change frequently during a meeting. This increases write contention and makes it harder to fetch lightweight “what’s happening now” state without also pulling larger, mostly-static data.

**Deliverables**

- Introduce a dedicated runtime table (e.g. `meetingRuntimeStates`) keyed by `meetingId`.
- Move hot, frequently-changing fields out of `meetings` and into the runtime table over time, starting with:
  - `currentSpeaker`
  - `reply`
  - `break`
  - `pointOfOrder`
  - (optionally) other frequently-updated pointers like `currentPollId`
- Add helper functions/queries that join `{ meeting, runtime }` to avoid duplicated fetch logic and to keep a single source of truth per field.
- Keep `meetings.isOpen` for now (do not remove yet); re-evaluate once `status` is fully adopted and all call sites are migrated.

**Why this is high priority**

- Reduces OCC contention on the `meetings` document during active sessions.
- Enables smaller payloads for polling/fallback or projector-style views (agenda can be fetched less often than live state).
- Sets up a clean place for simplified-mode version/hash signals.

---

### 5) Profile completion

**Problem:** Profile page exists but is currently minimal/placeholder.

**Deliverables**

- Profile editing for basic participant details.
- Notification preference settings.

**Suggested backend functions**

- `me.updateProfile`
- `me.notificationSettings.update`

---

## P2 - Collaboration layer

### 6) Shared notes and minutes

**Deliverables**

- Shared notes per meeting and optional agenda-item scope.
- Finalize and lock meeting minutes.
- Include notes in snapshot/export flows.

**Suggested backend functions**

- `notes.upsertDraft`
- `notes.finalizeMeetingMinutes`
- `notes.getForMeeting`

**New table**

- `meetingNotes`: `meetingId`, `agendaItemId?`, `content`, `createdBy`, `updatedAt`, `isFinal`

---

### 7) Action items and follow-ups

**Deliverables**

- Create, assign, and track action items from meeting outcomes.
- "My tasks" view for participants.

**Suggested backend functions**

- `actionItems.create`
- `actionItems.assign`
- `actionItems.updateStatus`
- `actionItems.listByMeeting`
- `actionItems.listForCurrentUser`

**New table**

- `actionItems`: `meetingId`, `agendaItemId?`, `title`, `assigneeUserId`, `dueDate`, `status`, `priority`

**Indexes**

- `by_meetingId`
- `by_assigneeUserId_and_status`
- `by_dueDate_and_status`

---

### 8) In-meeting chat (lightweight)

**Deliverables**

- Real-time meeting chat with optional agenda thread mode.
- Basic moderation tools (optional in first iteration).

**Suggested backend functions**

- `chat.send`
- `chat.list` (paginated)
- `chat.deleteOwn` (optional)

**New table**

- `chatMessages`: `meetingId`, `agendaItemId?`, `senderUserId`, `message`, `createdAt`

**Indexes**

- `by_meetingId_and_createdAt`
- `by_agendaItemId_and_createdAt`

---

## P3 - Operations, reliability, integrations

### 9) Notifications and reminders

**Deliverables**

- Meeting reminder jobs.
- Follow-up reminders for overdue action items.
- Notification logs for auditability.

**Suggested backend functions**

- `notifications.scheduleMeetingReminders`
- `notifications.sendNow` (internal action)
- `notifications.unsubscribe`

---

### 10) Calendar support (ICS first)

**Deliverables**

- Generate ICS files for meeting events.
- "Add to calendar" from invite/meeting details.

**Suggested backend functions**

- `calendar.exportIcs`

---

### 11) Analytics dashboard

**Deliverables**

- Admin dashboard for attendance, poll participation, and speaker dynamics.
- Denormalized stats per meeting for efficient reads.

**Suggested backend functions**

- `analytics.getMeetingOverview`
- `analytics.getParticipationTrends`

---

### 12) Integrations and webhooks

**Deliverables**

- Outbound event hooks for external systems.
- Retry and failure logging.

**Suggested backend functions**

- `webhooks.subscribe`
- `webhooks.unsubscribe`
- `webhooks.dispatchEvent` (internal)

---

## Cross-cutting implementation rules

- Enforce role checks in every query/mutation/action.
- Add indexes before introducing new query paths.
- Use pagination for all list endpoints.
- Avoid unbounded arrays in documents; model child entities in separate tables.
- Keep all user-facing strings in Swedish.
- Prefer feature flags for staged rollout.

---

## Recommended execution order

1. Bulk user add + **`meetingAccessList`** (with join writes), then **P1.2** access modes + **`access.canJoin`**
2. **P1.3** Invitations and RSVP
3. **P1.1** Lifecycle polish (`scheduled`, draft join policy, `status` vs `isOpen` documentation)
4. **P1.4** Extract hot meeting runtime state
5. **P1.5** Profile completion
6. **P2.6** Shared notes and minutes
7. **P2.7** Action items and follow-ups
8. **P2.8** In-meeting chat
9. **P3.9** Notifications and reminders
10. **P3.10** Calendar support (ICS)
11. **P3.11** Analytics dashboard
12. **P3.12** Integrations and webhooks
