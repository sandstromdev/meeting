export type StripSystemFields<T> = T extends { _id: unknown; _creationTime: unknown }
	? Omit<T, '_id' | '_creationTime'>
	: never;
