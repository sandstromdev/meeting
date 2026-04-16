import type { Id } from '@lsnd/convex/_generated/dataModel';
import type { AppHttpClient } from './app-http-client.svelte';
import type { DefaultFunctionArgs, FunctionReference } from 'convex/server';

export type MeetingHttpClientDeps = {
	app: AppHttpClient;
	getMeetingId: () => Id<'meetings'> | undefined;
};

/**
 * Merges `meetingId` into every Convex HTTP call; delegates auth to {@link AppHttpClient}.
 * Instantiate per route or module that has meeting context: `new MeetingHttpClient({ app, getMeetingId })`
 * with `app` from `useAppHttpClient()`.
 */
export class MeetingHttpClient {
	readonly #app: AppHttpClient;
	readonly #getMeetingId: () => Id<'meetings'> | undefined;

	constructor(deps: MeetingHttpClientDeps) {
		this.#app = deps.app;
		this.#getMeetingId = deps.getMeetingId;
	}

	ensureAuth(): Promise<void> {
		return this.#app.ensureAuth();
	}

	requireMeetingId(): Id<'meetings'> {
		const id = this.#getMeetingId();
		if (!id) {
			throw new Error('Möteskontext saknas.');
		}
		return id;
	}

	query<Ref extends FunctionReference<'query', 'public', DefaultFunctionArgs, unknown>>(
		ref: Ref,
		args: Omit<Ref['_args'], 'meetingId'>,
	): Promise<Ref['_returnType']> {
		const meetingId = this.requireMeetingId();
		// oxlint-disable-next-line typescript/no-explicit-any
		return this.#app.query(ref, { meetingId, ...args } as any);
	}

	mutation<Ref extends FunctionReference<'mutation', 'public', DefaultFunctionArgs, unknown>>(
		ref: Ref,
		args: Omit<Ref['_args'], 'meetingId'> = {} as Omit<Ref['_args'], 'meetingId'>,
	): Promise<Ref['_returnType']> {
		const meetingId = this.requireMeetingId();
		// oxlint-disable-next-line typescript/no-explicit-any
		return this.#app.mutation(ref, { meetingId, ...args } as any);
	}
}
