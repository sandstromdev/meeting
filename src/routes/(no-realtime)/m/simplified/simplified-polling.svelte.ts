import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { api } from '$convex/_generated/api';
import type { Id } from '$convex/_generated/dataModel';
import type {
	SimplifiedColdSnapshot,
	SimplifiedHotSnapshot,
	SimplifiedMeSnapshot,
	SimplifiedVersions,
} from '../../../../convex/meeting/users/simplified';
import type { AppHttpClient } from '$lib/app-http/app-http-client.svelte';
import { MeetingHttpClient } from '$lib/app-http/meeting-http-client';
import { messageFromSimplifiedConvexError } from '$lib/simplified/simplified-convex-errors';
import { onDestroy, onMount } from 'svelte';
import type { Getter } from 'runed';

export type RequestSlotType = 'pointOfOrder' | 'reply' | 'break';

export type SimplifiedPollingDeps = {
	app: AppHttpClient;
	getMeetingId: Getter<Id<'meetings'> | undefined>;
};

const simplifiedApi = api.meeting.users.simplified;

const INTERVAL_MS_OPEN_POLL = 3_200;
const INTERVAL_MS_NORMAL = 8_000;
const INTERVAL_MS_HIDDEN = 28_000;

export class SimplifiedPolling {
	loading = $state(true);
	fetchError = $state<string | null>(null);
	actionError = $state<string | null>(null);
	actionBusy = $state(false);

	#pollTimer: ReturnType<typeof setTimeout> | null = null;
	#disposed = false;
	readonly #mx: MeetingHttpClient;

	coldPoll = $state<{
		version: number;
		fetchedAtMs: number;
		snapshot: SimplifiedColdSnapshot | null;
	} | null>(null);

	hotPoll = $state<{
		version: number;
		fetchedAtMs: number;
		snapshot: SimplifiedHotSnapshot | null;
	} | null>(null);

	mePoll = $state<{ fetchedAtMs: number; snapshot: SimplifiedMeSnapshot } | null>(null);

	coldSnapshot = $derived(this.coldPoll?.snapshot ?? null);
	hotSnapshot = $derived(this.hotPoll?.snapshot ?? null);
	meSnapshot = $derived(this.mePoll?.snapshot ?? null);

	meeting = $derived(this.coldSnapshot?.meeting ?? null);
	requests = $derived(this.hotSnapshot?.requests ?? null);
	poll = $derived(this.hotSnapshot?.poll ?? null);
	/** Hot includes this when cold strips agenda after meeting start; otherwise matches cold. */
	currentAgendaItemId = $derived(
		this.hotSnapshot?.currentAgendaItemId ?? this.coldSnapshot?.currentAgendaItemId ?? null,
	);

	me = $derived(this.meSnapshot?.me ?? null);

	myPollVoteOptionIndexes = $derived(this.meSnapshot?.currentPollVoteOptionIndexes ?? []);

	canJoinQueue = $derived.by(() => {
		const m = this.meeting;
		const u = this.me;
		const r = this.requests;
		if (!m?.isOpen || !u) {
			return false;
		}
		if (u.absentSince) {
			return false;
		}
		if (u.isInSpeakerQueue) {
			return false;
		}
		if (r?.break?.type === 'accepted') {
			return false;
		}
		if (r?.pointOfOrder?.type === 'accepted') {
			return false;
		}
		if (r?.reply?.type === 'accepted') {
			return false;
		}
		return true;
	});

	activeSpeech = $derived(this.hotSnapshot?.activeSpeech ?? { kind: 'empty' as const });

	hotCurrentSpeaker = $derived(this.hotSnapshot?.currentSpeaker ?? null);

	isFloorSpeaker = $derived.by(() => {
		const speech = this.activeSpeech;
		const u = this.me;
		if (!u || speech.kind === 'empty') {
			return false;
		}
		return speech.userId === u._id;
	});

	isQueuedCurrentSpeaker = $derived(
		!!this.me && !!this.hotCurrentSpeaker && this.hotCurrentSpeaker.userId === this.me._id,
	);

	canRequestReply = $derived(
		!!this.requests && !!this.me && !this.requests.reply && !this.isFloorSpeaker,
	);

	canRecallReply = $derived(
		this.requests?.reply?.type === 'requested' && this.requests.reply.by.userId === this.me?._id,
	);

	canRequestPointOfOrder = $derived(
		!!this.requests && !!this.me && !this.requests.pointOfOrder && !this.isFloorSpeaker,
	);

	canRecallPointOfOrder = $derived(
		this.requests?.pointOfOrder?.type === 'requested' &&
			this.requests.pointOfOrder.by.userId === this.me?._id,
	);

	hasRequestedBreak = $derived(
		this.requests?.break?.type === 'requested' && this.requests.break.by.userId === this.me?._id,
	);

	canRequestBreak = $derived(!this.requests?.break);

	canMarkAbsent = $derived(!!this.me && !this.me.absentSince && !this.isFloorSpeaker);

	/** True when our streck-förslag is pending (show recall). */
	shouldRecallBreak = $derived(this.hasRequestedBreak);

	isInSpeakerQueue = $derived(!!this.me?.isInSpeakerQueue);

	hasPendingReturnRequest = $derived(!!this.meSnapshot?.hasPendingReturnRequest);

	motionsApproved = $derived(this.hotSnapshot?.motionsApproved ?? []);

	pendingMotion = $derived(this.meSnapshot?.pendingMotion ?? null);

	currentAgendaRow = $derived.by(() => {
		const id = this.currentAgendaItemId;
		const agenda = this.coldSnapshot?.agenda ?? [];
		if (!id) {
			return null;
		}
		return agenda.find((a) => a.id === id) ?? null;
	});

	motionParticipantSettings = $derived(
		this.currentAgendaRow
			? {
					allowMotions: this.currentAgendaRow.allowMotions,
					motionSubmissionMode: this.currentAgendaRow.motionSubmissionMode,
				}
			: { allowMotions: false, motionSubmissionMode: 'open' as const },
	);

	constructor(deps: SimplifiedPollingDeps) {
		this.#mx = new MeetingHttpClient(deps);

		if (!browser) {
			return;
		}

		onMount(() => {
			document.addEventListener('visibilitychange', this.#onVisibilityChange);
			void this.bootstrap();
		});

		onDestroy(() => {
			this.#disposed = true;
			document.removeEventListener('visibilitychange', this.#onVisibilityChange);
			this.#clearPollTimer();
		});
	}

	async #refreshCold(versions: SimplifiedVersions) {
		const fetchedAtMs = Date.now();
		const serverV = versions.simplifiedColdVersion;
		const cachedV = this.coldPoll?.version ?? -1;

		const { version, result } = await wrapRefresh(
			() => this.#mx.query(simplifiedApi.getColdSnapshot, {}),
			cachedV,
			serverV,
		);

		if (this.#disposed) {
			return;
		}

		this.coldPoll = {
			version,
			fetchedAtMs,
			snapshot: result ?? this.coldPoll?.snapshot ?? null,
		};
	}

	async #refreshHot(versions: SimplifiedVersions) {
		const fetchedAtMs = Date.now();
		const serverV = versions.simplifiedHotVersion;
		const cachedV = this.hotPoll?.version ?? -1;

		const { version, result } = await wrapRefresh(
			() => this.#mx.query(simplifiedApi.getHotSnapshot, {}),
			cachedV,
			serverV,
		);

		if (this.#disposed) {
			return;
		}

		this.hotPoll = {
			version,
			fetchedAtMs,
			snapshot: result ?? this.hotPoll?.snapshot ?? null,
		};
	}

	async #refreshMe() {
		const fetchedAtMs = Date.now();
		const snapshot = await this.#mx.query(simplifiedApi.getMeSnapshot, {});
		if (this.#disposed) {
			return;
		}
		this.mePoll = { fetchedAtMs, snapshot };
	}

	#onVisibilityChange = () => {
		this.#clearPollTimer();
		this.#scheduleNextPoll();
	};

	#pollIntervalMs(): number {
		if (typeof document !== 'undefined' && document.hidden) {
			return INTERVAL_MS_HIDDEN;
		}
		if (this.poll?.isOpen) {
			return INTERVAL_MS_OPEN_POLL;
		}
		return INTERVAL_MS_NORMAL;
	}

	#clearPollTimer() {
		if (this.#pollTimer) {
			clearTimeout(this.#pollTimer);
			this.#pollTimer = null;
		}
	}

	#scheduleNextPoll() {
		if (this.#disposed) {
			return;
		}
		this.#clearPollTimer();
		this.#pollTimer = setTimeout(() => {
			if (this.#disposed) {
				return;
			}
			void this.#runHotCycle().finally(() => {
				if (!this.#disposed) {
					this.#scheduleNextPoll();
				}
			});
		}, this.#pollIntervalMs());
	}

	async #runHotCycle() {
		try {
			await this.#mx.ensureAuth();
			if (this.#disposed) {
				return;
			}
			const versions = await this.#mx.query(simplifiedApi.getVersions, {});
			await Promise.all([this.#refreshHot(versions), this.#refreshMe()]);
			if (this.#disposed) {
				return;
			}
			this.fetchError = null;
		} catch (e) {
			console.error(e);
			if (this.#disposed) {
				return;
			}
			this.fetchError = messageFromSimplifiedConvexError(e);
		}
	}

	async bootstrap() {
		this.loading = true;
		this.fetchError = null;
		try {
			await this.#mx.ensureAuth();
			if (this.#disposed) {
				return;
			}
			const versions = await this.#mx.query(simplifiedApi.getVersions, {});
			await Promise.all([
				this.#refreshCold(versions),
				this.#refreshHot(versions),
				this.#refreshMe(),
			]);
		} catch (e) {
			console.error(e);
			if (this.#disposed) {
				return;
			}
			this.fetchError = messageFromSimplifiedConvexError(e);
		} finally {
			if (!this.#disposed) {
				this.loading = false;
			}
		}
		if (!this.#disposed) {
			this.#scheduleNextPoll();
		}
	}

	async #withAction<T>(fn: () => Promise<T>): Promise<T | undefined> {
		this.actionBusy = true;
		this.actionError = null;
		try {
			await this.#mx.ensureAuth();
			return await fn();
		} catch (e) {
			console.error(e);
			this.actionError = messageFromSimplifiedConvexError(e);
			return undefined;
		} finally {
			this.actionBusy = false;
		}
	}

	async joinQueue() {
		await this.#withAction(() =>
			this.#mx.mutation(api.meeting.users.queue.placeInSpeakerQueue, {}),
		);
		await this.#refreshMe();
	}

	async leaveQueue() {
		await this.#withAction(() =>
			this.#mx.mutation(api.meeting.users.queue.recallSpeakerQueueRequest, {}),
		);
		await this.#refreshMe();
	}

	async doneSpeaking() {
		await this.#withAction(() => this.#mx.mutation(api.meeting.users.queue.doneSpeaking, {}));
		await this.#refreshMe();
		await this.#runHotCycle();
	}

	async requestSlotAction(type: RequestSlotType) {
		await this.#withAction(() => this.#mx.mutation(api.meeting.users.queue.request, { type }));
		await this.#runHotCycle();
	}

	async recallSlotRequestAction(type: RequestSlotType) {
		await this.#withAction(() =>
			this.#mx.mutation(api.meeting.users.queue.recallRequest, { type }),
		);
		await this.#runHotCycle();
	}

	async leaveMeeting() {
		await this.#withAction(() => this.#mx.mutation(api.meeting.users.attendance.leaveMeeting, {}));
		await this.#runHotCycle();
	}

	async requestReturnAction() {
		await this.#withAction(() =>
			this.#mx.mutation(api.meeting.users.attendance.requestReturnToMeeting, {}),
		);
		await this.#runHotCycle();
	}

	async recallReturnAction() {
		await this.#withAction(() =>
			this.#mx.mutation(api.meeting.users.attendance.recallReturnRequest, {}),
		);
		await this.#runHotCycle();
	}

	async vote(pollId: Id<'meetingPolls'>, optionIndexes: number[]) {
		await this.#withAction(() =>
			this.#mx.mutation(api.meeting.users.meetingPoll.vote, { pollId, optionIndexes }),
		);
		await this.#runHotCycle();
	}

	async retractVote(pollId: Id<'meetingPolls'>) {
		await this.#withAction(() =>
			this.#mx.mutation(api.meeting.users.meetingPoll.retractVote, { pollId }),
		);
		await this.#runHotCycle();
	}

	async submitMotion(args: {
		title?: string;
		text: string;
		amendsMotionId?: Id<'meetingMotions'>;
	}) {
		const r = await this.#withAction(() =>
			this.#mx.mutation(api.meeting.users.motions.submitMotion, args),
		);
		if (r?.ok) {
			await this.#runHotCycle();
		}
		return r;
	}

	async withdrawMotion() {
		const ok = await this.#withAction(() =>
			this.#mx.mutation(api.meeting.users.motions.withdrawMyPendingMotion, {}),
		);
		if (ok) {
			await this.#runHotCycle();
		}
		return ok;
	}

	retryRealtimeNow() {
		void goto(resolve('/m'));
	}

	retryFetch() {
		void this.bootstrap();
	}
}

export function createSimplifiedPolling(deps: SimplifiedPollingDeps) {
	return new SimplifiedPolling(deps);
}

/** Refetch when cached snapshot version does not match server (behind, ahead, or first load with sentinel). */
async function wrapRefresh<T>(fn: () => Promise<T>, cachedVersion: number, serverVersion: number) {
	if (cachedVersion !== serverVersion) {
		return {
			version: serverVersion,
			result: await fn(),
		};
	}

	return {
		version: serverVersion,
		result: null,
	};
}
