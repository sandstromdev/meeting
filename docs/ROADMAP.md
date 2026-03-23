# Roadmap - Meeting Platform (SMB)

This roadmap captures the next product steps for the meeting platform, based on current capabilities in this repository.

## Product goals

1. Complete the full meeting lifecycle (create -> invite -> run -> follow-up).
2. Improve live collaboration during meetings.
3. Add operational tooling (notifications, calendar, analytics, integrations).
4. Support both open and restricted meeting access models.

---

## P1 - Core product loop (highest priority)

### 1) Meeting creation and lifecycle

**Problem:** Meetings can be managed, but in-app meeting provisioning is missing/thin.

**Deliverables**

- Create meeting flow in admin UI.
- Unique meeting code generation.
- Meeting list for current admin/user context.
- Status model for lifecycle: `draft`, `scheduled`, `active`, `closed`, `archived`.

**Suggested backend functions**

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
- `by_code` (with uniqueness strategy)

---

### 2) Meeting access control (open vs closed)

**Problem:** RSVP tracks intent to attend, but does not enforce authorization.

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

### 3) Profile completion

### 4) Profile completion

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

1. P1.1 Meeting creation and lifecycle
2. P1.2 Meeting access control (open vs closed)
3. P1.3 Invitations and RSVP
4. P1.4 Profile completion
5. P2.5 Shared notes and minutes
6. P2.6 Action items and follow-ups
7. P2.7 In-meeting chat
8. P3.8 Notifications and reminders
9. P3.9 Calendar support (ICS)
10. P3.10 Analytics dashboard
11. P3.11 Integrations and webhooks
