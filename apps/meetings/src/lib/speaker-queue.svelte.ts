import { api } from '@lsnd-mt/convex/_generated/api';
import { type MeetingState } from './context.svelte';

type SpeakerQueueEntry = (typeof api.meeting.users.queue.getNextSpeakers._returnType)[number];

export class SpeakerQueue {
	#meeting: MeetingState;

	#nextSpeakers = $state<{
		loading: boolean;
		data: SpeakerQueueEntry[];
	}>({
		loading: true,
		data: [],
	});

	constructor(meeting: MeetingState) {
		this.#meeting = meeting;

		const q = meeting.query(api.meeting.users.queue.getNextSpeakers, undefined, {
			keepPreviousData: true,
		});

		$effect(() => {
			this.#nextSpeakers = {
				loading: q.isLoading,
				data: q.data ?? [],
			};
		});
	}

	get loading() {
		return this.#nextSpeakers.loading;
	}

	get nextSpeakers() {
		return this.#nextSpeakers.data;
	}

	get break() {
		return this.#meeting.meeting.break;
	}

	get canAdvance() {
		return this.nextSpeakers.length > 0 || this.current.type !== 'empty';
	}

	get hasBreak() {
		return this.#meeting.meeting.break != null;
	}

	get hasPointOfOrder() {
		const po = this.#meeting.meeting.pointOfOrder;
		return po != null && (po.type === 'accepted' || ('startTime' in po && !('type' in po)));
	}

	get canRequestReply() {
		return !this.#meeting.meeting.reply && !this.isCurrentSpeaker;
	}

	get canRecallReplyRequest() {
		const reply = this.#meeting.meeting.reply;
		return reply?.type === 'requested' && reply.by.userId === this.#meeting.me._id;
	}

	get canRequestPointOfOrder() {
		return !this.#meeting.meeting.pointOfOrder && !this.isCurrentSpeaker;
	}

	get canRecallPointOfOrder() {
		const po = this.#meeting.meeting.pointOfOrder;

		if (po?.type === 'requested') {
			return po.by.userId === this.#meeting.me._id;
		}

		return false;
	}

	get canRequestBreak() {
		return !this.#meeting.meeting.break;
	}

	get current() {
		return this.#meeting.currentSpeaker;
	}

	get isCurrentSpeaker() {
		return this.#meeting.isCurrentSpeaker;
	}
}
