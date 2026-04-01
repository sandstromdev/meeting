# Roadmap - Meeting Platform

This roadmap captures the next product steps for the meeting platform, based on current capabilities in this repository.

## As implemented today (repo snapshot)

Use this when scoping tickets so work is additive rather than duplicated.

**Meetings**

- Meetings store both stable config and hot runtime on the `meetings` document: `code`, `title`, `date`, `timezone`, optional `location` / `description`, `agenda`, plus live state (`currentSpeaker`, request slots, `currentPollId`, etc.).
- **Provisioning (platform admins):** Convex `meeting/platform/meetings` — `create` (unique 6-digit code, creator as meeting admin participant), `listForCurrentUser`, `archive`, `reopen`. Dashboard UI: `(realtime)/(dash)/meetings` with create form (timezone, location, description) and meetings table (status, archive/reopen).
- **Lifecycle:** `status` is `draft | scheduled | active | closed | archived` (schema). New meetings start as **draft**. In-meeting `toggleMeeting` opens/closes the session and sets `status` to **active** / **closed** while syncing `isOpen`. **scheduled** exists in the schema but is not yet driven by explicit product transitions or UI.
- In-meeting admins can update `title`, `code`, and `date` via `meeting/admin/meeting:updateMeetingData` (code uniqueness enforced).

**Join and participants**

- Join-by-code flow (`meeting/public/meetings.findByCode`, connect / join routes). Participants in `meetingParticipants` with roles; absence / return-request behavior in [Absence system](ABSENCE.md).
- Access control now supports `meetings.accessMode` plus `meetingAccessList`. `open` meetings still allow join by code; `closed` meetings require the user to already be a participant or be on the meeting access list. **Archived** meetings are still blocked separately. `invite_only` is reserved in schema/API but not yet exposed as a completed end-user flow.

**Live meeting features**

- Agenda editing, polls, voting, projector / admin / moderator surfaces, snapshots / backup helpers. Simplified HTTP participant mode under `(no-realtime)/m/simplified/` per project rules.

**Standalone polls**

- Admin UI under `/polls`, participant flow under `/p/[code]`.

**Auth and admin shell**

- Better Auth; SvelteKit platform admin areas for users and meeting list.

**Gaps vs desired product**

- No `meetingInvites` / RSVP.
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

### 1) Meeting creation and lifecycle — remaining work

**Status:** Core provisioning is implemented; see [Implemented (reference)](#implemented-reference) for what shipped.

**Still open (strategic)**

- Decide whether **draft** or **scheduled** should eventually impose extra UX or join restrictions beyond access control. Current behavior remains: join is blocked by `archived` and access policy, not by `draft` / `scheduled` / `closed` alone.
- Optional explicit transitions: `draft` → `scheduled` → `active` → `closed` → `archived` (beyond today’s create-as-draft + toggle + archive).
- Contributor-facing documentation for the established **status** vs **isOpen** vs **accessMode** mental model (see [docs/TODO.md](TODO.md) for small items).

---

### 2) Meeting access control — remaining work

**Status:** Implemented for `open` and `closed` meetings; see [Implemented (reference)](#implemented-reference) for what shipped. `invite_only` remains a reserved follow-up for invitations / RSVP.

**Still open**

- Dedicated admin UI for manual allowlist add/remove independent of participant creation/import.
- Audit log entries for denied joins and access-list mutations.
- End-user `invite_only` token flow, which should land with [Invitations and RSVP](#3-invitations-and-rsvp).

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

1. **P1.3** Invitations and RSVP (including `invite_only`)
2. **P1.1** Lifecycle polish (`scheduled`, draft join policy, `status` vs `isOpen` documentation)
3. **P1.4** Extract hot meeting runtime state
4. **P1.5** Profile completion
5. **P2.6** Shared notes and minutes
6. **P2.7** Action items and follow-ups
7. **P2.8** In-meeting chat
8. **P3.9** Notifications and reminders
9. **P3.10** Calendar support (ICS)
10. **P3.11** Analytics dashboard
11. **P3.12** Integrations and webhooks

---

## Implemented (reference)

Historical detail for items that are no longer active roadmap priorities. See **As implemented today** above for the live snapshot.

### Bulk user add system (MVP)

**What shipped**

- Meeting-scoped CSV bulk import under the participants admin UI.
- **Platform-admin-only** execution with a hard cap of **200 rows** per import.
- **UTF-8 CSV** parsing with `email`, `name`, `role`, and optional `password`.
- **Preview → commit** flow with per-row outcomes and downloadable error CSV.
- **Upsert-style** handling for existing users: imports do not fail the whole batch when a user already exists.
- Single server-side pipeline per row: resolve or create auth user → write `meetingAccessList` → attach `meetingParticipants`.
- Manual single-user add uses the same backend path, so manual add and bulk add produce the same access-list and participant side effects.

**Notes**

- Optimized for typical room-sized imports (tens to low hundreds of rows), not very large directory sync.
- Bulk import is currently the primary allowlist-management tool; a dedicated add/remove allowlist UI can still be added later if product wants direct closed-meeting roster management without CSV.

---

### Meeting creation and lifecycle — shipped scope

- Meeting schema: `createdByUserId`, `status`, `timezone`, `location`, `description`, indexes (`by_code`, `by_createdByUserId`, `by_status_and_date`, `by_isOpen`).
- Platform API: `meeting/platform/meetings` — `create`, `listForCurrentUser`, `archive`, `reopen`.
- Dashboard provisioning UI and archive/reopen; create captures timezone / location / description.
- In-meeting open/close via `toggleMeeting` (`active` / `closed`, `isOpen` synced).
- In-meeting metadata updates via `updateMeetingData`.
- Archived meetings rejected on join / load paths that use `assertMeetingNotArchived`.

---

### Meeting access control (`open` / `closed`) — shipped scope

- `meetings.accessMode` (`open | closed | invite_only`) with current UI focused on `open` / `closed`.
- `meetingAccessList` with `meetingId`, `userId?`, `email?`, `addedByUserId`, `addedAt`.
- Join gating via shared backend checks used by connect / meeting load paths.
- Clear UI messaging for unauthorized joins to closed meetings.
- Allowlist population from bulk import and server-driven manual add.
