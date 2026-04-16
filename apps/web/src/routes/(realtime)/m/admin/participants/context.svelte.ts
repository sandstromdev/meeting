import { api } from '@lsnd/convex/_generated/api';
import type { UseQueryReturn } from '@mmailaender/convex-svelte';
import { createContext } from 'svelte';
import type { MeetingState } from '$lib/context.svelte';

export class ParticipantsContext {
	addUserDialogOpen = $state(false);
	bulkImportDialogOpen = $state(false);
	static readonly QUERY_LIMIT = 500;
	#query: UseQueryReturn<typeof api.meeting.admin.users.getParticipants>;
	#meeting: MeetingState;

	constructor(meeting: MeetingState) {
		this.#meeting = meeting;
		this.#query = meeting.adminQuery(
			api.meeting.admin.users.getParticipants,
			() => ({
				pagination: {
					cursor: null,
					numItems: ParticipantsContext.QUERY_LIMIT,
				},
			}),
			{
				keepPreviousData: true,
			},
		);

		setParticipantsContext(this);
	}

	get participants() {
		return this.#query.data?.page ?? [];
	}

	get hasMoreParticipants() {
		return this.#query.data ? !this.#query.data.isDone : false;
	}

	get query() {
		return this.#query;
	}

	get counts() {
		return {
			present: this.#meeting.participants - this.#meeting.absent,
			participants: this.#meeting.participants,
			absent: this.#meeting.absent,
			banned: this.#meeting.banned,
		};
	}
}

const [getParticipantsContext, setParticipantsContext] = createContext<ParticipantsContext>();

export function useParticipantsContext() {
	return getParticipantsContext();
}
