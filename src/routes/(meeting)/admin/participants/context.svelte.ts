import { api } from '$convex/_generated/api';
import type { UseQueryReturn } from '@mmailaender/convex-svelte';
import { createContext } from 'svelte';
import type { MeetingState } from '$lib/context.svelte';

export class ParticipantsContext {
	addUserDialogOpen = $state(false);
	#query: UseQueryReturn<typeof api.admin.users.getParticipants>;
	#meeting: MeetingState;

	constructor(meeting: MeetingState) {
		this.#meeting = meeting;
		this.#query = meeting.adminQuery(api.admin.users.getParticipants);

		setParticipantsContext(this);
	}

	get participants() {
		return this.#query.data ?? [];
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
