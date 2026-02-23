/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin_helpers from "../admin/helpers.js";
import type * as admin_meeting from "../admin/meeting.js";
import type * as admin_poll from "../admin/poll.js";
import type * as helpers from "../helpers.js";
import type * as meetings from "../meetings.js";
import type * as users_auth from "../users/auth.js";
import type * as users_helpers from "../users/helpers.js";
import type * as users_meeting from "../users/meeting.js";
import type * as users_poll from "../users/poll.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "admin/helpers": typeof admin_helpers;
  "admin/meeting": typeof admin_meeting;
  "admin/poll": typeof admin_poll;
  helpers: typeof helpers;
  meetings: typeof meetings;
  "users/auth": typeof users_auth;
  "users/helpers": typeof users_helpers;
  "users/meeting": typeof users_meeting;
  "users/poll": typeof users_poll;
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

export declare const components: {};
