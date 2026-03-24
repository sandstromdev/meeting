import { api } from '$convex/_generated/api';
import type { Id } from '$convex/_generated/dataModel';
import { computeAgendaNumbers } from '$convex/helpers/agenda';
import type { MeetingData, MeetingState } from './context.svelte';
import { SvelteMap } from 'svelte/reactivity';

type AgendaItem = MeetingData['meeting']['agenda'][number];
export type AgendaPoll = {
	id: Id<'polls'>;
	hasVoted: boolean;
	maxVotesPerVoter: number;
};

export class AgendaState {
	#meeting: MeetingState;
	#selectedOptionIndexesByPoll = new SvelteMap<string, number[]>();
	#flat: (AgendaItem & { number: string })[];

	constructor(meeting: MeetingState) {
		this.#meeting = meeting;
		this.#flat = $derived(computeAgendaNumbers(this.agenda));
	}

	get agenda() {
		return this.#meeting.meeting.agenda ?? [];
	}

	get flat() {
		return this.#flat;
	}

	get currentAgendaItemId() {
		const flat = this.flat;
		return this.#meeting.meeting.currentAgendaItemId ?? (flat.length > 0 ? flat[0].id : undefined);
	}

	get currentIndex() {
		return this.flat.findIndex((item) => item.id === this.currentAgendaItemId);
	}

	get currentItem() {
		return this.flat[this.currentIndex];
	}

	get nextItem() {
		const idx = this.currentIndex;
		return idx >= 0 && idx < this.flat.length - 1 ? this.flat[idx + 1] : undefined;
	}

	get previousItem() {
		const flat = this.flat;
		const idx = this.currentIndex;
		return idx > 0 ? flat[idx - 1] : undefined;
	}

	selectedForPoll(pollId: string) {
		return this.#selectedOptionIndexesByPoll.get(pollId) ?? [];
	}

	isOptionSelected(pollId: string, optionIndex: number) {
		return this.selectedForPoll(pollId).includes(optionIndex);
	}

	toggleOption(poll: AgendaPoll, optionIndex: number) {
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
			if (poll.maxVotesPerVoter === 1) {
				this.#selectedOptionIndexesByPoll.set(poll.id, [optionIndex]);
			}
			return;
		}

		this.#selectedOptionIndexesByPoll.set(poll.id, [...current, optionIndex]);
	}

	async submitVote(poll: AgendaPoll) {
		const optionIndexes = this.selectedForPoll(poll.id);
		if (optionIndexes.length === 0) {
			return;
		}
		await this.#meeting.mutate(api.meeting.users.poll.vote, {
			pollId: poll.id,
			optionIndexes,
		});

		this.#selectedOptionIndexesByPoll.set(poll.id, []);
	}
}
