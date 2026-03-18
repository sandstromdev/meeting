import type { Id } from '$convex/_generated/dataModel';
import type { FunctionReference, FunctionReturnType } from 'convex/server';
import type { Getter } from 'runed';

export type UseQueryReturn<Query extends FunctionReference<'query'>> =
	| {
			data: undefined;
			error: undefined;
			isLoading: true;
			isStale: false;
	  }
	| {
			data: undefined;
			error: Error;
			isLoading: false;
			isStale: boolean;
	  }
	| {
			data: FunctionReturnType<Query>;
			error: undefined;
			isLoading: false;
			isStale: boolean;
	  };

export type UseQueryOptions<Query extends FunctionReference<'query'>> = {
	initialData?: FunctionReturnType<Query>;
	keepPreviousData?: boolean;
};

export type AdminQuery = {
	<T extends FunctionReference<'query', 'public', { meetingId: Id<'meetings'> }, unknown>>(
		fn: T,
	): UseQueryReturn<T>;
	<T extends FunctionReference<'query', 'public', { meetingId: Id<'meetings'> }, unknown>>(
		fn: T,
		args?: Getter<Omit<T['_args'], 'meetingId'>>,
	): UseQueryReturn<T>;
	<T extends FunctionReference<'query', 'public', { meetingId: Id<'meetings'> }, unknown>>(
		fn: T,
		args?: Getter<Omit<T['_args'], 'meetingId'>>,
		opts?: UseQueryOptions<T>,
	): UseQueryReturn<T>;
};
export type StripSystemFields<T> = T extends { _id: unknown; _creationTime: unknown }
	? Omit<T, '_id' | '_creationTime'>
	: never;
