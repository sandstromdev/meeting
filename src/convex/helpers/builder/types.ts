// oxlint-disable typescript/no-explicit-any
import type { EmptyObject } from 'convex-helpers';
import type { GenericValidator, PropertyValidators } from 'convex/values';
import { z } from 'zod';

export type Context = {};
export type Args = {};

export type ValidatorInput = z.core.$ZodShape;

export type MaybePromise<T> = T | Promise<T>;

export type Handler<Ctx extends Context, Args extends Context, Result> = (args: {
	ctx: Ctx;
	args: Args;
}) => MaybePromise<Result>;
export type AnyHandler = Handler<any, any, any>;

export type Middleware<
	TArgs extends Args,
	in TCtxIn extends Context,
	TCtxOut extends Context,
> = (args: {
	ctx: TCtxIn;
	args: TArgs;
	next: <U extends Context>(context: U) => MaybePromise<U>;
}) => MaybePromise<TCtxOut>;

export type AnyMiddleware = Middleware<any, any, any>;

export type Expand<T> = T extends {}
	? {
			[P in keyof T]: T[P];
		}
	: never;

export type ConvexArgsValidator = PropertyValidators | GenericValidator;
export type ConvexReturnsValidator = GenericValidator;
type ValidatorType<T> = T extends GenericValidator ? T['type'] : never;
type OptionalKeys<T extends Record<PropertyKey, any>> = {
	[K in keyof T]: T[K] extends GenericValidator
		? T[K]['isOptional'] extends 'optional'
			? K
			: never
		: never;
}[keyof T];

type RequiredKeys<T extends Record<PropertyKey, any>> = {
	[K in keyof T]: T[K] extends GenericValidator
		? T[K]['isOptional'] extends 'optional'
			? never
			: K
		: never;
}[keyof T];

type OptionalArgs<T extends Record<PropertyKey, any>> = {
	[K in OptionalKeys<T>]?: T[K] extends GenericValidator ? ValidatorType<T[K]> | undefined : never;
};

type RequiredArgs<T extends Record<PropertyKey, any>> = {
	[K in RequiredKeys<T>]: ValidatorType<T[K]>;
};

export type InferArgs<T extends ConvexArgsValidator> = T extends GenericValidator
	? T['type']
	: RequiredArgs<T> & OptionalArgs<T>;

type InferZod<T> = T extends z.ZodType<infer Output> ? Output : never;

type InferFromShape<Shape> = Shape extends ValidatorInput
	? Expand<
			{
				[K in keyof Shape as Shape[K] extends z.ZodOptional<any>
					? never
					: Shape[K] extends z.ZodDefault<any>
						? never
						: K]: Shape[K] extends z.ZodOptional<any>
					? never
					: Shape[K] extends z.ZodDefault<any>
						? never
						: InferZod<Shape[K]>;
			} & {
				[K in keyof Shape as Shape[K] extends z.ZodOptional
					? K
					: never]?: Shape[K] extends z.ZodOptional<infer O> ? InferZod<O> : never;
			} & {
				[K in keyof Shape as Shape[K] extends z.ZodDefault<any>
					? K
					: never]?: Shape[K] extends z.ZodDefault<infer O> ? InferZod<O> : never;
			}
		>
	: never;

export type InferredArgs<Shape> = Shape extends ValidatorInput
	? InferFromShape<Shape>
	: EmptyObject;
