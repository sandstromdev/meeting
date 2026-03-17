// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import { api } from '$convex/_generated/api';
import type { Id, Doc } from '$convex/_generated/dataModel';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			token?: string;
			currentUser?: typeof api.me.getCurrentUser._returnType;
			meetingId?: Id<'meetings'>;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

// oxlint-disable-next-line unicorn/require-module-specifiers
export {};
