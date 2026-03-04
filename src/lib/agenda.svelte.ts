import { api } from '$convex/_generated/api';
import type { MeetingData, MeetingState } from './context.svelte';
import { SvelteMap } from 'svelte/reactivity';

type AgendaItem = MeetingData['meeting']['agenda'][number];
type Poll = AgendaItem['polls'][number];

/** Pre-order flatten of nested agenda (matches backend order). */
export function flattenAgenda(agenda: AgendaItem[]): AgendaItem[] {
	const out: AgendaItem[] = [];
	function walk(items: AgendaItem[]) {
		for (const item of items) {
			out.push(item);
			if (item.items?.length) {
				walk(item.items);
			}
		}
	}
	walk(agenda);
	return out;
}

export class AgendaState {
	#meeting: MeetingState;
	#selectedOptionIndexesByPoll = new SvelteMap<string, number[]>();

	constructor(meeting: MeetingState) {
		this.#meeting = meeting;
	}

	get agenda() {
		return this.#meeting.meeting.agenda ?? [];
	}

	/** Flattened agenda (pre-order) for navigation. */
	get flatAgenda() {
		return flattenAgenda(this.agenda);
	}

	get currentAgendaItemId() {
		const flat = this.flatAgenda;
		return (
			this.#meeting.meeting.currentAgendaItemId ??
			(flat.length > 0 ? flat[0].id : undefined)
		);
	}

	get currentIndex() {
		return this.flatAgenda.findIndex((item) => item.id === this.currentAgendaItemId);
	}

	get currentItem() {
		return this.flatAgenda[this.currentIndex];
	}

	get nextItem() {
		const flat = this.flatAgenda;
		const idx = this.currentIndex;
		return idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : undefined;
	}

	get previousItem() {
		const flat = this.flatAgenda;
		const idx = this.currentIndex;
		return idx > 0 ? flat[idx - 1] : undefined;
	}

	selectedForPoll(pollId: string) {
		return this.#selectedOptionIndexesByPoll.get(pollId) ?? [];
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
			if (poll.maxVotesPerVoter === 1) {
				this.#selectedOptionIndexesByPoll.set(poll.id, [optionIndex]);
			}
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
