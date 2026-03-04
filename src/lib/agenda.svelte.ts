import { api } from '$convex/_generated/api';
import type { MeetingData, MeetingState } from './context.svelte';
import { SvelteMap } from 'svelte/reactivity';

type AgendaItem = MeetingData['meeting']['agenda'][number];
type Poll = AgendaItem['polls'][number];

export class AgendaState {
	#meeting: MeetingState;
	#selectedOptionIndexesByPoll = new SvelteMap<string, number[]>();

	constructor(meeting: MeetingState) {
		this.#meeting = meeting;
	}

	get agenda() {
		return this.#meeting.meeting.agenda ?? [];
	}

	get currentAgendaItemId() {
		return (
			this.#meeting.meeting.currentAgendaItemId ??
			(this.agenda.length > 0 ? this.agenda[0].id : undefined)
		);
	}

	get currentIndex() {
		return this.agenda.findIndex((item) => item.id === this.currentAgendaItemId);
	}

	get currentItem() {
		return this.agenda[this.currentIndex];
	}

	get nextItem() {
		const idx = this.currentIndex;
		return idx >= 0 && idx < this.agenda.length - 1 ? this.agenda[idx + 1] : undefined;
	}

	get previousItem() {
		const idx = this.currentIndex;
		return idx > 0 ? this.agenda[idx - 1] : undefined;
	}

	selectedForPoll(pollId: string) {
		return this.#selectedOptionIndexesByPoll.getOrInsert(pollId, []);
	}

	isOptionSelected(pollId: string, optionIndex: number) {
		return this.selectedForPoll(pollId).includes(optionIndex);
	}

	toggleOption(poll: Poll, optionIndex: number) {
		if (poll.hasVoted) {
			return;
		}
		const current = this.selectedForPoll(poll.id);
		const isSelected = current.includes(optionIndex);
		if (isSelected) {
			this.#selectedOptionIndexesByPoll.set(
				poll.id,
				current.filter((i) => i !== optionIndex),
			);
			return;
		}
		if (current.length >= poll.maxVotesPerVoter) {
			return;
		}

		this.#selectedOptionIndexesByPoll.set(poll.id, [...current, optionIndex]);
	}

	async submitVote(poll: Poll) {
		const optionIndexes = this.selectedForPoll(poll.id);
		if (optionIndexes.length === 0) {
			return;
		}
		await this.#meeting.mutate(api.users.poll.vote, {
			pollId: poll.id,
			optionIndexes,
		});

		this.#selectedOptionIndexesByPoll.set(poll.id, []);
	}
}
