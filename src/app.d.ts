// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import { api } from '$lib/convex/_generated/api';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user?: typeof api.users.auth.getUserData._returnType;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

// oxlint-disable-next-line unicorn/require-module-specifiers
export {};
