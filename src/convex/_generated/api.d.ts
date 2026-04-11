/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as app_admin_global from "../app/admin/global.js";
import type * as app_me from "../app/me.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as helpers_agenda from "../helpers/agenda.js";
import type * as helpers_auth from "../helpers/auth.js";
import type * as helpers_builder_index from "../helpers/builder/index.js";
import type * as helpers_builder_types from "../helpers/builder/types.js";
import type * as helpers_bulkMeetingUsers from "../helpers/bulkMeetingUsers.js";
import type * as helpers_counters from "../helpers/counters.js";
import type * as helpers_error from "../helpers/error.js";
import type * as helpers_index from "../helpers/index.js";
import type * as helpers_lobbyPresence from "../helpers/lobbyPresence.js";
import type * as helpers_meeting from "../helpers/meeting.js";
import type * as helpers_meetingAccess from "../helpers/meetingAccess.js";
import type * as helpers_meetingAttendanceReset from "../helpers/meetingAttendanceReset.js";
import type * as helpers_meetingBackup from "../helpers/meetingBackup.js";
import type * as helpers_meetingLifecycle from "../helpers/meetingLifecycle.js";
import type * as helpers_meetingPoll from "../helpers/meetingPoll.js";
import type * as helpers_meetingRuntime from "../helpers/meetingRuntime.js";
import type * as helpers_pagination from "../helpers/pagination.js";
import type * as helpers_poll from "../helpers/poll.js";
import type * as helpers_snapshotChecksum from "../helpers/snapshotChecksum.js";
import type * as helpers_types from "../helpers/types.js";
import type * as helpers_userPoll from "../helpers/userPoll.js";
import type * as helpers_users from "../helpers/users.js";
import type * as http from "../http.js";
import type * as meeting_admin_access from "../meeting/admin/access.js";
import type * as meeting_admin_agenda from "../meeting/admin/agenda.js";
import type * as meeting_admin_bulkUsers from "../meeting/admin/bulkUsers.js";
import type * as meeting_admin_meeting from "../meeting/admin/meeting.js";
import type * as meeting_admin_meetingPoll from "../meeting/admin/meetingPoll.js";
import type * as meeting_admin_users from "../meeting/admin/users.js";
import type * as meeting_jobs_meetingPollCleanup from "../meeting/jobs/meetingPollCleanup.js";
import type * as meeting_jobs_meetingPollClose from "../meeting/jobs/meetingPollClose.js";
import type * as meeting_jobs_snapshots from "../meeting/jobs/snapshots.js";
import type * as meeting_jobs_speakerLog from "../meeting/jobs/speakerLog.js";
import type * as meeting_moderator_meeting from "../meeting/moderator/meeting.js";
import type * as meeting_platform_meetings from "../meeting/platform/meetings.js";
import type * as meeting_public_meetings from "../meeting/public/meetings.js";
import type * as meeting_users_attendance from "../meeting/users/attendance.js";
import type * as meeting_users_auth from "../meeting/users/auth.js";
import type * as meeting_users_meeting from "../meeting/users/meeting.js";
import type * as meeting_users_meetingPoll from "../meeting/users/meetingPoll.js";
import type * as meeting_users_participant from "../meeting/users/participant.js";
import type * as meeting_users_queue from "../meeting/users/queue.js";
import type * as meeting_users_simplified from "../meeting/users/simplified.js";
import type * as migrations_backfillMeetingLifecycle from "../migrations/backfillMeetingLifecycle.js";
import type * as migrations_movePollsToMeetingPolls from "../migrations/movePollsToMeetingPolls.js";
import type * as migrations_pollOptionsMigration from "../migrations/pollOptionsMigration.js";
import type * as migrations_verifyPollFlatSchema from "../migrations/verifyPollFlatSchema.js";
import type * as schema_meetingPolls from "../schema/meetingPolls.js";
import type * as schema_meetings from "../schema/meetings.js";
import type * as schema_userPolls from "../schema/userPolls.js";
import type * as triggers_index from "../triggers/index.js";
import type * as triggers_meeting from "../triggers/meeting.js";
import type * as userPoll_admin from "../userPoll/admin.js";
import type * as userPoll_jobs_cleanup from "../userPoll/jobs/cleanup.js";
import type * as userPoll_jobs_results from "../userPoll/jobs/results.js";
import type * as userPoll_jobs_snapshot from "../userPoll/jobs/snapshot.js";
import type * as userPoll_public from "../userPoll/public.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "app/admin/global": typeof app_admin_global;
  "app/me": typeof app_me;
  auth: typeof auth;
  crons: typeof crons;
  "helpers/agenda": typeof helpers_agenda;
  "helpers/auth": typeof helpers_auth;
  "helpers/builder/index": typeof helpers_builder_index;
  "helpers/builder/types": typeof helpers_builder_types;
  "helpers/bulkMeetingUsers": typeof helpers_bulkMeetingUsers;
  "helpers/counters": typeof helpers_counters;
  "helpers/error": typeof helpers_error;
  "helpers/index": typeof helpers_index;
  "helpers/lobbyPresence": typeof helpers_lobbyPresence;
  "helpers/meeting": typeof helpers_meeting;
  "helpers/meetingAccess": typeof helpers_meetingAccess;
  "helpers/meetingAttendanceReset": typeof helpers_meetingAttendanceReset;
  "helpers/meetingBackup": typeof helpers_meetingBackup;
  "helpers/meetingLifecycle": typeof helpers_meetingLifecycle;
  "helpers/meetingPoll": typeof helpers_meetingPoll;
  "helpers/meetingRuntime": typeof helpers_meetingRuntime;
  "helpers/pagination": typeof helpers_pagination;
  "helpers/poll": typeof helpers_poll;
  "helpers/snapshotChecksum": typeof helpers_snapshotChecksum;
  "helpers/types": typeof helpers_types;
  "helpers/userPoll": typeof helpers_userPoll;
  "helpers/users": typeof helpers_users;
  http: typeof http;
  "meeting/admin/access": typeof meeting_admin_access;
  "meeting/admin/agenda": typeof meeting_admin_agenda;
  "meeting/admin/bulkUsers": typeof meeting_admin_bulkUsers;
  "meeting/admin/meeting": typeof meeting_admin_meeting;
  "meeting/admin/meetingPoll": typeof meeting_admin_meetingPoll;
  "meeting/admin/users": typeof meeting_admin_users;
  "meeting/jobs/meetingPollCleanup": typeof meeting_jobs_meetingPollCleanup;
  "meeting/jobs/meetingPollClose": typeof meeting_jobs_meetingPollClose;
  "meeting/jobs/snapshots": typeof meeting_jobs_snapshots;
  "meeting/jobs/speakerLog": typeof meeting_jobs_speakerLog;
  "meeting/moderator/meeting": typeof meeting_moderator_meeting;
  "meeting/platform/meetings": typeof meeting_platform_meetings;
  "meeting/public/meetings": typeof meeting_public_meetings;
  "meeting/users/attendance": typeof meeting_users_attendance;
  "meeting/users/auth": typeof meeting_users_auth;
  "meeting/users/meeting": typeof meeting_users_meeting;
  "meeting/users/meetingPoll": typeof meeting_users_meetingPoll;
  "meeting/users/participant": typeof meeting_users_participant;
  "meeting/users/queue": typeof meeting_users_queue;
  "meeting/users/simplified": typeof meeting_users_simplified;
  "migrations/backfillMeetingLifecycle": typeof migrations_backfillMeetingLifecycle;
  "migrations/movePollsToMeetingPolls": typeof migrations_movePollsToMeetingPolls;
  "migrations/pollOptionsMigration": typeof migrations_pollOptionsMigration;
  "migrations/verifyPollFlatSchema": typeof migrations_verifyPollFlatSchema;
  "schema/meetingPolls": typeof schema_meetingPolls;
  "schema/meetings": typeof schema_meetings;
  "schema/userPolls": typeof schema_userPolls;
  "triggers/index": typeof triggers_index;
  "triggers/meeting": typeof triggers_meeting;
  "userPoll/admin": typeof userPoll_admin;
  "userPoll/jobs/cleanup": typeof userPoll_jobs_cleanup;
  "userPoll/jobs/results": typeof userPoll_jobs_results;
  "userPoll/jobs/snapshot": typeof userPoll_jobs_snapshot;
  "userPoll/public": typeof userPoll_public;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("../betterAuth/_generated/component.js").ComponentApi<"betterAuth">;
  counters: import("../counter/_generated/component.js").ComponentApi<"counters">;
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
};
