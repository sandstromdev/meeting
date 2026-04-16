import type { DataModel } from '@lsnd/convex/_generated/dataModel';
import { createBuilder } from '@lsnd/convex/helpers/builder';
import type { StripSystemFields } from '$lib/types';
import { triggers } from '@lsnd/convex/triggers';

export const c = createBuilder<DataModel>(triggers);

export function stripSystemFields<T extends { _id: unknown; _creationTime: unknown }>(doc: T) {
	const { _id, _creationTime, ...rest } = doc;
	return rest as StripSystemFields<T>;
}

type StripUndefinedFields<T extends Record<string, unknown>> = {
	[K in keyof T]: T[K] extends undefined ? never : T[K];
};
export function stripUndefinedFields<T extends Record<string, unknown>>(obj: T) {
	return Object.fromEntries(
		Object.entries(obj).filter(([_, value]) => value !== undefined),
	) as StripUndefinedFields<T>;
}
