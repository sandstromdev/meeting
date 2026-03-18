import type { DataModel } from '$convex/_generated/dataModel';
import { createBuilder } from '$convex/helpers/builder';
import type { StripSystemFields } from '$lib/types';

export const c = createBuilder<DataModel>();

export function stripSystemFields<T extends { _id: unknown; _creationTime: unknown }>(doc: T) {
	const { _id, _creationTime, ...rest } = doc;
	return rest as StripSystemFields<T>;
}
