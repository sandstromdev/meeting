/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    public: {
      add: FunctionReference<
        "mutation",
        "internal",
        {
          count: number;
          key?: string;
          name: string;
          shard?: number;
          shards?: number;
        },
        number,
        Name
      >;
      count: FunctionReference<
        "query",
        "internal",
        { key?: string; name: string },
        number,
        Name
      >;
      countAll: FunctionReference<
        "query",
        "internal",
        { name: string },
        Record<string, number>,
        Name
      >;
      estimateCount: FunctionReference<
        "query",
        "internal",
        {
          key?: string;
          name: string;
          readFromShards?: number;
          shards?: number;
        },
        any,
        Name
      >;
      rebalance: FunctionReference<
        "mutation",
        "internal",
        { key?: string; name: string; shards?: number },
        any,
        Name
      >;
      reset: FunctionReference<
        "mutation",
        "internal",
        { key?: string; name: string },
        any,
        Name
      >;
      resetAll: FunctionReference<
        "mutation",
        "internal",
        { name: string },
        any,
        Name
      >;
    };
  };
