import type { Getter } from 'runed';
import type { MeetingPollDraft } from '$lib/polls';
import { RefinePollDraftSchema } from '$lib/validation';

export class PollDrafts {
	#polls: MeetingPollDraft[];
	#editingIdx: number | null;

	constructor(polls: Getter<MeetingPollDraft[]>) {
		this.#polls = $derived(polls());
		this.#editingIdx = $derived(null);
	}

	get polls() {
		return this.#polls;
	}

	get editingIdx() {
		return this.#editingIdx;
	}

	addPollDraft(draft: MeetingPollDraft) {
		this.#polls = [...this.#polls, draft];
		this.#editingIdx = this.#polls.length - 1;
	}

	removePollDraft(index: number) {
		this.#polls = [...this.#polls.slice(0, index), ...this.#polls.slice(index + 1)];
	}

	updatePollDraft(index: number, draft: MeetingPollDraft) {
		this.#polls = [...this.#polls.slice(0, index), draft, ...this.#polls.slice(index + 1)];
	}

	moveUp(index: number) {
		if (index <= 0) {
			return;
		}
		this.#polls = [
			...this.#polls.slice(0, index - 1),
			this.#polls[index],
			this.#polls[index - 1],
			...this.#polls.slice(index + 1),
		];
	}

	moveDown(index: number) {
		if (index >= this.#polls.length - 1) {
			return;
		}
		this.#polls = [
			...this.#polls.slice(0, index),
			this.#polls[index + 1],
			this.#polls[index],
			...this.#polls.slice(index + 2),
		];
	}

	editPoll(index: number) {
		if (this.#editingIdx !== null) {
			return;
		}

		if (index < 0 || index >= this.#polls.length) {
			return;
		}

		this.#editingIdx = index;
	}

	stopEditing() {
		this.#editingIdx = null;
	}

	isEditing(idx: number) {
		return this.#editingIdx === idx;
	}

	discard() {
		if (this.#editingIdx === null) {
			return;
		}

		const idx = this.#editingIdx;

		console.log('discard', this.#polls[idx]);

		if (!this.#polls[idx].id) {
			// This poll hasn't been saved yet, remove it
			this.removePollDraft(idx);
		}

		this.stopEditing();
	}

	submit(draft: MeetingPollDraft) {
		if (this.#editingIdx == null) {
			return;
		}

		const idx = this.#editingIdx;

		this.updatePollDraft(idx, draft);
		this.stopEditing();
	}

	validate() {
		return RefinePollDraftSchema.array().safeParse(this.#polls);
	}
}
