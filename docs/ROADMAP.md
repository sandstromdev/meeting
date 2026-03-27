# Roadmap - Meeting Platform (SMB)

This roadmap captures the next product steps for the meeting platform, based on current capabilities in this repository.

## As implemented today (repo snapshot)

Use this when scoping tickets so work is additive rather than duplicated.

**Meetings**

- Meetings have both “stable config” and “hot runtime state” stored on the `meetings` document today: `code`, `title`, `date`, `timezone`, optional `location`/`description`, `agenda`, plus live-state like `currentSpeaker`, request slots (`break`, `pointOfOrder`, `reply`), `currentPollId`, etc.
- Provisioning exists **in-app** for platform admins via `meeting/platform/meetings`:
  - `create` (generates unique 6-digit code, inserts meeting row, inserts creator as `meetingParticipants` admin)
  - `listForCurrentUser` (by `createdByUserId`)
  - `archive` / `reopen`
- Lifecycle is now expressed with both `status` (`draft|scheduled|active|closed|archived`) and `isOpen`. In-meeting `toggleMeeting` sets `status` to `active/closed` and keeps `isOpen` in sync.
- Admins can update `title`, `code`, and `date` in-meeting via `meeting/admin/meeting:updateMeetingData` (code uniqueness enforced).

**Join and participants**

- Join-by-code flow exists (`meeting/public/meetings.findByCode`, connect/join routes). Participants stored in `meetingParticipants` with roles; absence/return-request behavior documented in [Absence system](absence.md).
- Access control is still minimal: “know the code” + “not banned” (+ archived meetings are blocked). There is no allowlist / invite token / RSVP model yet.

**Live meeting features**

- Agenda editing, polls, voting, projector/admin/moderator surfaces, snapshots/backup helpers.

**Standalone polls**

- Standalone poll admin UI exists under `/polls` and participant flow under `/p/[code]`.

**Auth and admin shell**

- Better Auth; SvelteKit `/admin` area is oriented around **platform user** management (list/create users).
- Meeting provisioning currently lives under `/meetings` and is restricted to platform admins.

**Gaps vs this document**

- No `accessMode` / allowlist tables, no `meetingInvites` / RSVP.
- Profile page exists but is currently placeholder/minimal.
- “Hot runtime state” is still stored on `meetings` (no dedicated runtime table yet).

---

## Product goals

1. Complete the full meeting lifecycle (create -> invite -> run -> follow-up).
2. Improve live collaboration during meetings.
3. Add operational tooling (notifications, calendar, analytics, integrations).
4. Support both open and restricted meeting access models.

---

## P1 - Core product loop (highest priority)

### 1) Meeting creation and lifecycle (mostly implemented; polish remaining)

**Problem:** Provisioning and lifecycle exist, but there is still some duplication/confusion between `status` vs `isOpen`, and “platform admin provisioning” isn’t yet the same as a dedicated organizer surface with full lifecycle tooling.

**Deliverables**

- Keep a single source of truth for lifecycle (either fully adopt `status` or formally define `isOpen` as a derived/runtime flag).
- Add explicit lifecycle transitions beyond `toggleMeeting`:
  - `draft` → `scheduled`
  - `scheduled` → `active`
  - `active` → `closed`
  - `closed` → `archived` (already gated)
- Ensure all participant entrypoints enforce lifecycle consistently (e.g. block archived everywhere; decide expected behavior for `draft/scheduled`).
- Expand meeting provisioning UI as needed (editing `timezone/location/description`, basic filters, archive/reopen affordances).

**Backend functions (already present)**

- `meetings.create`
- `meetings.archive`
- `meetings.reopen`
- `meetings.listForCurrentUser`

**Schema additions (meetings)**

- `createdByUserId`
- `status`
- `timezone`
- optional `location`, `description`

**Indexes**

- `by_createdByUserId`
- `by_status_and_date`
- `by_code` — already present; extend if composite queries are needed

---

### 2) Meeting access control (open vs closed)

**Problem:** Anyone with the code can become a participant (unless banned); there is no allowlist, invite-only gate, or RSVP-backed authorization yet.

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

### 5) Shared notes and minutes

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

### 6) Action items and follow-ups

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

### 7) In-meeting chat (lightweight)

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

### 8) Notifications and reminders

**Deliverables**

- Meeting reminder jobs.
- Follow-up reminders for overdue action items.
- Notification logs for auditability.

**Suggested backend functions**

- `notifications.scheduleMeetingReminders`
- `notifications.sendNow` (internal action)
- `notifications.unsubscribe`

---

### 9) Calendar support (ICS first)

**Deliverables**

- Generate ICS files for meeting events.
- "Add to calendar" from invite/meeting details.

**Suggested backend functions**

- `calendar.exportIcs`

---

### 10) Analytics dashboard

**Deliverables**

- Admin dashboard for attendance, poll participation, and speaker dynamics.
- Denormalized stats per meeting for efficient reads.

**Suggested backend functions**

- `analytics.getMeetingOverview`
- `analytics.getParticipationTrends`

---

### 11) Integrations and webhooks

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

1. P1.2 Meeting access control (open vs closed)
2. P1.3 Invitations and RSVP
3. P1.1 Meeting creation and lifecycle (polish + lifecycle clarity)
4. P1.4 Extract hot meeting runtime state into a runtime table
5. P1.5 Profile completion
6. P2.5 Shared notes and minutes
7. P2.6 Action items and follow-ups
8. P2.7 In-meeting chat
9. P3.8 Notifications and reminders
10. P3.9 Calendar support (ICS)
11. P3.10 Analytics dashboard
12. P3.11 Integrations and webhooks
