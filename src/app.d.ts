// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import { api } from '$convex/_generated/api';
import type { Id } from '$convex/_generated/dataModel';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			token?: string;
			meetingId?: Id<'meetings'>;
			// user?: typeof api.users.auth.getUserData._returnType;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

// oxlint-disable-next-line unicorn/require-module-specifiers
export {};
