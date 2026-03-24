import type { Getter } from 'runed';
import type { EditablePollDraft } from './agenda';
import { RefinePollDraftSchema } from '$lib/validation';

export class PollDrafts {
	#polls: EditablePollDraft[];
	#editingIdx: number | null;

	constructor(polls: Getter<EditablePollDraft[]>) {
		this.#polls = $derived(polls());
		this.#editingIdx = $derived(null);
	}

	get polls() {
		return this.#polls;
	}

	get editingIdx() {
		return this.#editingIdx;
	}

	addPollDraft(draft: EditablePollDraft) {
		this.#polls = [...this.#polls, draft];
		this.#editingIdx = this.#polls.length - 1;
	}

	removePollDraft(index: number) {
		this.#polls = [...this.#polls.slice(0, index), ...this.#polls.slice(index + 1)];
	}

	updatePollDraft(index: number, draft: EditablePollDraft) {
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
		if (!this.#editingIdx) {
			return;
		}

		const idx = this.#editingIdx;

		if (!this.#polls[idx].id) {
			// This poll hasn't been saved yet, remove it
			this.removePollDraft(idx);
		}

		this.stopEditing();
	}

	submit(draft: EditablePollDraft) {
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
