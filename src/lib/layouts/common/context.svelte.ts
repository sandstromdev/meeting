import { api } from '$convex/_generated/api';
import type { Doc, Id } from '$convex/_generated/dataModel';
import { useConvexClient } from 'convex-svelte';
import type { ConvexClient } from 'convex/browser';
import { createContext } from 'svelte';
import { SpeakerQueue } from './speaker-queue';
import { dev } from '$app/environment';
import { devState } from '$lib/dev.svelte';

export type Me = typeof api.users.auth.getUserData._returnType;
export type Meeting = Doc<'meetings'>;

export type SpeakerQueueEntry = {
	userId: Id<'meetingParticipants'>;
	name: string;
	ordinal: number;
	sessions?: { startTime: number; stopTime?: number }[];
	isAbsent?: boolean;
};

export type PointOfOrderEntry = {
	name: string;
	startTime: number;
	endTime: number;
};

export type SpeakerLogEntry = {
	type: 'speaker' | 'point_of_order' | 'reply';
	name: string;
	startTime: number;
	endTime: number;
};

export type AbsenceEntry = (typeof api.admin.meeting.getAbsenceEntries._returnType)[number];

export type ReturnRequest = {
	userId: Id<'meetingParticipants'>;
	name: string;
	requestedAt: number;
};

export type MeetingData = {
	me: typeof api.users.auth.getUserData._returnType;
	meeting: Doc<'meetings'>;
	nextSpeakers: SpeakerQueueEntry[];
	previousSpeakers: SpeakerQueueEntry[];
	pointOfOrderEntries: PointOfOrderEntry[];
	speakerLogEntries: SpeakerLogEntry[];
	absenceEntries: AbsenceEntry[];
	hasPendingReturnRequest?: boolean;
	returnRequests: ReturnRequest[];
};

const [getContext, setContext] = createContext<MeetingState>();

type CurrentSpeaker =
	| {
			type: 'point_of_order' | 'reply' | 'speaker';
			startTime: number;
			name: string;
			userId: Id<'meetingParticipants'>;
	  }
	| {
			type: 'empty';
			name?: never;
			startTime?: never;
	  };

export class MeetingState {
	data: MeetingData;
	readonly convex: ConvexClient;
	readonly speakerQueue: SpeakerQueue;
	constructor(getter: () => MeetingData) {
		this.data = $state(getter());
		this.convex = useConvexClient();

		this.speakerQueue = new SpeakerQueue(this);

		$effect(() => {
			this.data = getter();
		});
	}

	get currentSpeaker(): CurrentSpeaker {
		const po = this.data.meeting.pointOfOrder;

		if (po?.type === 'accepted') {
			const startTime = po.startTime ?? Date.now();
			return {
				type: 'point_of_order',
				userId: po.by.userId,
				name: po.by.name,
				startTime,
			};
		}

		const reply = this.data.meeting.reply;
		if (reply?.type === 'accepted') {
			const startTime = reply.startTime ?? Date.now();
			return {
				type: 'reply',
				userId: reply.by.userId,
				name: reply.by.name,
				startTime,
			};
		}

		if (this.data.meeting.currentSpeaker) {
			return {
				type: 'speaker',
				...this.data.meeting.currentSpeaker,
			};
		}

		return {
			type: 'empty',
		};
	}

	get meeting() {
		return this.data.meeting;
	}

	get me() {
		return this.data.me;
	}

	get isAdmin() {
		if (dev) {
			return devState.view === 'admin';
		}

		return this.data.me.isAdmin;
	}

	get isCurrentSpeaker() {
		return this.currentSpeaker.type === 'empty'
			? false
			: this.currentSpeaker.userId === this.me._id;
	}

	get pointOfOrderEntries() {
		return this.data.pointOfOrderEntries ?? [];
	}

	get speakerLogEntries() {
		return this.data.speakerLogEntries ?? [];
	}

	get absenceEntries() {
		return this.data.absenceEntries ?? [];
	}

	get hasPendingReturnRequest() {
		return this.data.hasPendingReturnRequest ?? false;
	}

	get returnRequests() {
		return this.data.returnRequests ?? [];
	}
}

export function setMeetingContext(getter: () => MeetingData) {
	const ctx = new MeetingState(getter);
	setContext(ctx);
	return ctx;
}

export function getMeetingContext() {
	const ctx = getContext();

	if (!ctx) {
		throw new Error('getMeetingUserContext must be used under setMeetingUserContext');
	}

	return ctx;
}
