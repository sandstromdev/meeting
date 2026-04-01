import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import type { Id } from '$convex/_generated/dataModel';
import { onDestroy, onMount } from 'svelte';
import {
	getColdSnapshot,
	getConvexTimeOffset,
	getHotSnapshot,
	getMeSnapshot,
	joinSpeakerList,
	leaveSpeakerList,
	markAbsent,
	recallReturn,
	recallSlotRequest,
	requestReturn,
	requestSlot,
	retractPollVote,
	voteOnPoll,
} from './data.remote';

type ColdSnapshot = Extract<
	Awaited<ReturnType<typeof getColdSnapshot>>,
	{ changed: true }
>['snapshot'];

type HotSnapshot = Extract<
	Awaited<ReturnType<typeof getHotSnapshot>>,
	{ changed: true }
>['snapshot'];

type MeSnapshot = Awaited<ReturnType<typeof getMeSnapshot>>['snapshot'];

export type RequestSlotType = 'pointOfOrder' | 'reply' | 'break';

const INTERVAL_MS_OPEN_POLL = 3_200;
const INTERVAL_MS_NORMAL = 8_000;
const INTERVAL_MS_HIDDEN = 28_000;

export function createSimplifiedPolling() {
	let knownColdVersion = $state<number | null>(null);
	let knownHotVersion = $state<number | null>(null);

	let coldSnapshot = $state<ColdSnapshot | null>(null);
	let hotSnapshot = $state<HotSnapshot | null>(null);
	let meSnapshot = $state<MeSnapshot | null>(null);

	let convexOffsetMs = $state<number | null>(null);
	let loading = $state(true);
	let fetchError = $state<string | null>(null);
	let actionError = $state<string | null>(null);
	let actionBusy = $state(false);

	let pollTimer: ReturnType<typeof setTimeout> | null = null;

	const meeting = $derived(coldSnapshot?.meeting ?? null);
	const requests = $derived(hotSnapshot?.requests ?? null);
	const poll = $derived(hotSnapshot?.poll ?? null);

	const me = $derived(meSnapshot?.me ?? null);

	const myPollVoteOptionIndexes = $derived(meSnapshot?.currentPollVoteOptionIndexes ?? []);

	const canJoinQueue = $derived.by(() => {
		const m = meeting;
		const u = me;
		const r = requests;
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

	const canRequestReply = $derived.by(() => {
		if (!requests || !me) {
			return false;
		}
		return !requests.reply;
	});

	const canRecallReply = $derived(
		requests?.reply?.type === 'requested' && requests.reply.by.userId === me?._id,
	);

	const canRequestPointOfOrder = $derived.by(() => {
		if (!requests || !me) {
			return false;
		}
		return !requests.pointOfOrder;
	});

	const canRecallPointOfOrder = $derived(
		requests?.pointOfOrder?.type === 'requested' && requests.pointOfOrder.by.userId === me?._id,
	);

	const hasRequestedBreak = $derived(
		requests?.break?.type === 'requested' && requests.break.by.userId === me?._id,
	);

	const canRequestBreak = $derived(!requests?.break);

	/** True when our streck-förslag is pending (show recall). */
	const shouldRecallBreak = $derived(hasRequestedBreak);

	const isInSpeakerQueue = $derived(!!me?.isInSpeakerQueue);

	const hasPendingReturnRequest = $derived(!!meSnapshot?.hasPendingReturnRequest);

	const canMarkAbsent = $derived(!!me && !me.absentSince);

	function pollIntervalMs(): number {
		if (typeof document !== 'undefined' && document.hidden) {
			return INTERVAL_MS_HIDDEN;
		}
		if (poll?.isOpen) {
			return INTERVAL_MS_OPEN_POLL;
		}
		return INTERVAL_MS_NORMAL;
	}

	function clearPollTimer() {
		if (pollTimer) {
			clearTimeout(pollTimer);
			pollTimer = null;
		}
	}

	function scheduleNextPoll() {
		clearPollTimer();
		pollTimer = setTimeout(() => {
			void runHotCycle().finally(() => {
				scheduleNextPoll();
			});
		}, pollIntervalMs());
	}

	async function fetchConvexOffsetOnce() {
		const q = getConvexTimeOffset();
		const result = await q;
		convexOffsetMs = result.offsetMs;
	}

	async function fetchColdOnce() {
		const q = getColdSnapshot({ knownVersion: knownColdVersion ?? undefined });
		const result = await q;

		knownColdVersion = result.version;

		if (result.changed && 'snapshot' in result && result.snapshot) {
			coldSnapshot = result.snapshot;
		}
	}

	async function fetchHotOnce() {
		const q = getHotSnapshot({ knownVersion: knownHotVersion ?? undefined });
		const result = await q;

		knownHotVersion = result.version;

		if (result.changed && 'snapshot' in result && result.snapshot) {
			hotSnapshot = result.snapshot;
		}
	}

	async function fetchMeOnce() {
		const q = getMeSnapshot();
		const result = await q;
		meSnapshot = result.snapshot;
	}

	async function runHotCycle() {
		try {
			await Promise.all([fetchHotOnce(), fetchMeOnce()]);
			fetchError = null;
		} catch (e) {
			fetchError = e instanceof Error ? e.message : 'Kunde inte uppdatera läget.';
		}
	}

	async function bootstrap() {
		loading = true;
		fetchError = null;
		try {
			await fetchConvexOffsetOnce();
			await fetchColdOnce();
			await Promise.all([fetchHotOnce(), fetchMeOnce()]);
		} catch (e) {
			fetchError = e instanceof Error ? e.message : 'Kunde inte ladda mötet.';
		} finally {
			loading = false;
		}
		scheduleNextPoll();
	}

	function onVisibilityChange() {
		clearPollTimer();
		scheduleNextPoll();
	}

	async function withAction<T>(fn: () => Promise<T>): Promise<T | undefined> {
		actionBusy = true;
		actionError = null;
		try {
			return await fn();
		} catch (e) {
			actionError = e instanceof Error ? e.message : 'Åtgärden misslyckades.';
			return undefined;
		} finally {
			actionBusy = false;
		}
	}

	async function joinQueue() {
		await withAction(() => joinSpeakerList());
		await fetchMeOnce();
	}

	async function leaveQueue() {
		await withAction(() => leaveSpeakerList());
		await fetchMeOnce();
	}

	async function requestSlotAction(type: RequestSlotType) {
		await withAction(() => requestSlot({ type }));
		await runHotCycle();
	}

	async function recallSlotRequestAction(type: RequestSlotType) {
		await withAction(() => recallSlotRequest({ type }));
		await runHotCycle();
	}

	async function leaveMeeting() {
		await withAction(() => markAbsent());
		await runHotCycle();
	}

	async function requestReturnAction() {
		await withAction(() => requestReturn());
		await runHotCycle();
	}

	async function recallReturnAction() {
		await withAction(() => recallReturn());
		await runHotCycle();
	}

	async function vote(pollId: Id<'meetingPolls'>, optionIndexes: number[]) {
		await withAction(() => voteOnPoll({ pollId, optionIndexes }));
		await runHotCycle();
	}

	async function retractVote(pollId: Id<'meetingPolls'>) {
		await withAction(() => retractPollVote({ pollId }));
		await runHotCycle();
	}

	function retryRealtimeNow() {
		void goto(resolve('/m'));
	}

	function retryFetch() {
		void bootstrap();
	}

	if (browser) {
		onMount(() => {
			document.addEventListener('visibilitychange', onVisibilityChange);
			void bootstrap();
		});

		onDestroy(() => {
			document.removeEventListener('visibilitychange', onVisibilityChange);
			clearPollTimer();
		});
	}

	return {
		get knownColdVersion() {
			return knownColdVersion;
		},
		get knownHotVersion() {
			return knownHotVersion;
		},
		get coldSnapshot() {
			return coldSnapshot;
		},
		get hotSnapshot() {
			return hotSnapshot;
		},
		get meSnapshot() {
			return meSnapshot;
		},
		get convexOffsetMs() {
			return convexOffsetMs;
		},
		get loading() {
			return loading;
		},
		get fetchError() {
			return fetchError;
		},
		get actionError() {
			return actionError;
		},
		get actionBusy() {
			return actionBusy;
		},
		get meeting() {
			return meeting;
		},
		get requests() {
			return requests;
		},
		get poll() {
			return poll;
		},
		get me() {
			return me;
		},
		get canJoinQueue() {
			return canJoinQueue;
		},
		get canRequestReply() {
			return canRequestReply;
		},
		get canRecallReply() {
			return canRecallReply;
		},
		get canRequestPointOfOrder() {
			return canRequestPointOfOrder;
		},
		get canRecallPointOfOrder() {
			return canRecallPointOfOrder;
		},
		get canRequestBreak() {
			return canRequestBreak;
		},
		get shouldRecallBreak() {
			return shouldRecallBreak;
		},
		get myPollVoteOptionIndexes() {
			return myPollVoteOptionIndexes;
		},
		get isInSpeakerQueue() {
			return isInSpeakerQueue;
		},
		get hasPendingReturnRequest() {
			return hasPendingReturnRequest;
		},
		get canMarkAbsent() {
			return canMarkAbsent;
		},
		joinQueue,
		leaveQueue,
		requestSlotAction,
		recallSlotRequestAction,
		leaveMeeting,
		requestReturnAction,
		recallReturnAction,
		vote,
		retractVote,
		retryRealtimeNow,
		retryFetch,
	};
}
