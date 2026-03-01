import { api } from '$convex/_generated/api';
import type { Id } from '$convex/_generated/dataModel';
import type { MeetingState } from './context.svelte';

export class SpeakerQueue {
	#meeting: MeetingState;

	constructor(meeting: MeetingState) {
		this.#meeting = meeting;
	}

	get nextSpeakers() {
		return this.#meeting.data.nextSpeakers;
	}

	get previousSpeakers() {
		return this.#meeting.data.previousSpeakers;
	}

	get idx() {
		return this.#meeting.meeting.speakerIndex ?? -1;
	}

	get canAdvance() {
		return this.nextSpeakers.length > 0 || this.current.type !== 'empty';
	}

	get canGoBack() {
		return this.previousSpeakers.length > 0;
	}

	get hasBreak() {
		return this.#meeting.meeting.break != null;
	}

	get hasPointOfOrder() {
		const po = this.#meeting.meeting.pointOfOrder;
		return po != null && (po.type === 'accepted' || ('startTime' in po && !('type' in po)));
	}

	get hasReply() {
		return this.#meeting.meeting.reply != null;
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

	async next() {
		if (!this.#meeting.isAdmin || !this.canAdvance) {
			return;
		}

		this.#meeting.convex.mutation(api.admin.meeting.nextSpeaker, {
			meetingId: this.#meeting.meeting._id,
		});
	}

	async doneSpeaking() {
		await this.#meeting.convex.mutation(api.users.meeting.doneSpeaking, {
			meetingId: this.#meeting.meeting._id,
		});
	}

	async prev() {
		if (!this.#meeting.isAdmin || !this.canGoBack) {
			return;
		}

		this.#meeting.convex.mutation(api.admin.meeting.previousSpeaker, {
			meetingId: this.#meeting.meeting._id,
		});
	}

	async remove(ordinal: number) {
		if (!this.#meeting.isAdmin) {
			return;
		}

		await this.#meeting.convex.mutation(api.admin.meeting.removeFromSpeakerQueue, {
			meetingId: this.#meeting.meeting._id,
			ordinal,
		});
	}

	async moveUp(ordinal: number) {
		if (!this.#meeting.isAdmin) {
			return;
		}

		await this.#meeting.convex.mutation(api.admin.meeting.moveSpeakerInQueue, {
			meetingId: this.#meeting.meeting._id,
			ordinal,
			direction: 'up',
		});
	}

	async moveDown(ordinal: number) {
		if (!this.#meeting.isAdmin) {
			return;
		}

		await this.#meeting.convex.mutation(api.admin.meeting.moveSpeakerInQueue, {
			meetingId: this.#meeting.meeting._id,
			ordinal,
			direction: 'down',
		});
	}

	async placeInQueue() {
		await this.#meeting.convex.mutation(api.users.meeting.placeInSpeakerQueue, {
			meetingId: this.#meeting.meeting._id,
		});
	}

	async recallFromQueue() {
		await this.#meeting.convex.mutation(api.users.meeting.recallSpeakerQueueRequest, {
			meetingId: this.#meeting.meeting._id,
		});
	}

	async requestPointOfOrder() {
		await this.#meeting.convex.mutation(api.users.meeting.requestPointOfOrder, {
			meetingId: this.#meeting.meeting._id,
		});
	}

	async recallPointOfOrderRequest() {
		await this.#meeting.convex.mutation(api.users.meeting.recallPointOfOrderRequest, {
			meetingId: this.#meeting.meeting._id,
		});
	}

	async requestBreak() {
		await this.#meeting.convex.mutation(api.users.meeting.requestBreak, {
			meetingId: this.#meeting.meeting._id,
		});
	}

	async recallBreakRequest() {
		await this.#meeting.convex.mutation(api.users.meeting.recallBreakRequest, {
			meetingId: this.#meeting.meeting._id,
		});
	}

	async clearBreak() {
		if (!this.#meeting.isAdmin) {
			return;
		}

		await this.#meeting.convex.mutation(api.admin.meeting.clearBreak, {
			meetingId: this.#meeting.meeting._id,
		});
	}
	async acceptBreak() {
		if (!this.#meeting.isAdmin || !this.hasBreak) {
			return;
		}

		await this.#meeting.convex.mutation(api.admin.meeting.acceptBreak, {
			meetingId: this.#meeting.meeting._id,
		});
	}

	async acceptPointOfOrder() {
		if (!this.#meeting.isAdmin) {
			return;
		}

		const po = this.#meeting.meeting.pointOfOrder;
		if (!po || po.type !== 'requested') {
			return;
		}

		await this.#meeting.convex.mutation(api.admin.meeting.acceptPointOfOrder, {
			meetingId: this.#meeting.meeting._id,
		});
	}

	async clearPointOfOrder() {
		if (!this.#meeting.isAdmin) {
			return;
		}

		await this.#meeting.convex.mutation(api.admin.meeting.clearPointOfOrder, {
			meetingId: this.#meeting.meeting._id,
		});
	}

	async requestReply() {
		await this.#meeting.convex.mutation(api.users.meeting.requestReply, {
			meetingId: this.#meeting.meeting._id,
		});
	}

	async recallReplyRequest() {
		await this.#meeting.convex.mutation(api.users.meeting.recallReplyRequest, {
			meetingId: this.#meeting.meeting._id,
		});
	}

	async acceptReply() {
		if (!this.#meeting.isAdmin) {
			return;
		}

		const reply = this.#meeting.meeting.reply;
		if (!reply || reply.type !== 'requested') {
			return;
		}

		await this.#meeting.convex.mutation(api.admin.meeting.acceptReply, {
			meetingId: this.#meeting.meeting._id,
		});
	}

	async clearReply() {
		if (!this.#meeting.isAdmin) {
			return;
		}

		await this.#meeting.convex.mutation(api.admin.meeting.clearReply, {
			meetingId: this.#meeting.meeting._id,
		});
	}

	async leaveMeeting() {
		await this.#meeting.convex.mutation(api.users.meeting.leaveMeeting, {
			meetingId: this.#meeting.meeting._id,
		});
	}

	async requestReturnToMeeting() {
		await this.#meeting.convex.mutation(api.users.meeting.requestReturnToMeeting, {
			meetingId: this.#meeting.meeting._id,
		});
	}

	async recallReturnRequest() {
		await this.#meeting.convex.mutation(api.users.meeting.recallReturnRequest, {
			meetingId: this.#meeting.meeting._id,
		});
	}

	async approveReturnRequest(userId: Id<'meetingParticipants'>) {
		if (!this.#meeting.isAdmin) {
			return;
		}
		await this.#meeting.convex.mutation(api.admin.meeting.approveReturnRequest, {
			meetingId: this.#meeting.meeting._id,
			userId,
		});
	}

	async denyReturnRequest(userId: Id<'meetingParticipants'>) {
		if (!this.#meeting.isAdmin) {
			return;
		}
		await this.#meeting.convex.mutation(api.admin.meeting.denyReturnRequest, {
			meetingId: this.#meeting.meeting._id,
			userId,
		});
	}

	async clearPreviousSpeakers(): Promise<void> {
		if (!this.#meeting.isAdmin) {
			return;
		}
		await this.#meeting.convex.mutation(api.admin.meeting.clearPreviousSpeakers, {
			meetingId: this.#meeting.meeting._id,
		});
	}
}
