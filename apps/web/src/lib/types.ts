import type { Id } from '@lsnd-mt/convex/_generated/dataModel';
import type { FunctionReference, FunctionReturnType } from 'convex/server';
import type { Getter } from 'runed';

export type { StripSystemFields } from '@lsnd-mt/common/stripSystemFields';

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
