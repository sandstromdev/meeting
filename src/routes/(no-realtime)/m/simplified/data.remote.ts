import { PUBLIC_CONVEX_URL } from '$env/static/public';
import { api } from '$convex/_generated/api';
import type { Id } from '$convex/_generated/dataModel';
import { getAppError } from '$convex/helpers/error';
import { getConvexClient } from '$lib/server/convex';
import { command, getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import { z } from 'zod';

const knownVersionSchema = z.object({
	knownVersion: z.number().int().nonnegative().optional(),
});

const requestTypeSchema = z.enum(['pointOfOrder', 'reply', 'break']);

const meetingPollIdSchema = z.custom<Id<'meetingPolls'>>(
	(value) => typeof value === 'string' && value.length > 0,
	'Ogiltigt omröstnings-id.',
);

const simplifiedApi = api.meeting.users.simplified;

function requireMeetingId() {
	const event = getRequestEvent();
	const meetingId = event.locals.meetingId;

	if (!meetingId) {
		throw error(400, 'Möteskontext saknas.');
	}

	return { event, meetingId };
}

function throwRemoteError(cause: unknown): never {
	const appError = getAppError(cause);

	if (appError) {
		if (
			appError.is('meeting_not_found') ||
			appError.is('meeting_participant_not_found') ||
			appError.is('participant_banned') ||
			appError.is('meeting_archived')
		) {
			throw error(403, appError.message);
		}

		throw error(400, appError.message);
	}

	console.error(cause);
	throw error(500, 'Kunde inte kontakta mötet.');
}

export const getColdSnapshot = query(knownVersionSchema, async ({ knownVersion }) => {
	const { meetingId } = requireMeetingId();
	const convex = getConvexClient();

	try {
		const versions = await convex.query(simplifiedApi.getVersions, { meetingId });
		const fetchedAtMs = Date.now();

		if (knownVersion != null && knownVersion === versions.simplifiedColdVersion) {
			return {
				changed: false as const,
				version: versions.simplifiedColdVersion,
				fetchedAtMs,
			};
		}

		const snapshot = await convex.query(simplifiedApi.getColdSnapshot, { meetingId });

		return {
			changed: true as const,
			version: snapshot.simplifiedColdVersion,
			fetchedAtMs,
			snapshot: {
				...snapshot,
				agenda:
					snapshot.meeting.startedAt && snapshot.meeting.startedAt > fetchedAtMs
						? []
						: snapshot.agenda,
			},
		};
	} catch (cause) {
		throwRemoteError(cause);
	}
});

export const getHotSnapshot = query(knownVersionSchema, async ({ knownVersion }) => {
	const { meetingId } = requireMeetingId();
	const convex = getConvexClient();

	try {
		const versions = await convex.query(simplifiedApi.getVersions, { meetingId });
		const fetchedAtMs = Date.now();

		if (knownVersion != null && knownVersion === versions.simplifiedHotVersion) {
			return {
				changed: false as const,
				version: versions.simplifiedHotVersion,
				fetchedAtMs,
			};
		}

		const snapshot = await convex.query(simplifiedApi.getHotSnapshot, { meetingId });

		return {
			changed: true as const,
			version: snapshot.simplifiedHotVersion,
			fetchedAtMs,
			snapshot,
		};
	} catch (cause) {
		throwRemoteError(cause);
	}
});

export const getMeSnapshot = query(async () => {
	const { meetingId } = requireMeetingId();
	const convex = getConvexClient();

	try {
		return {
			fetchedAtMs: Date.now(),
			snapshot: await convex.query(simplifiedApi.getMeSnapshot, { meetingId }),
		};
	} catch (cause) {
		throwRemoteError(cause);
	}
});

export const getConvexTimeOffset = query(async () => {
	const { event } = requireMeetingId();
	const requestStartedAtMs = Date.now();

	const response = await event.fetch(`${PUBLIC_CONVEX_URL}/api/convex/time`);

	if (!response.ok) {
		throw error(502, 'Kunde inte hämta Convex-tid.');
	}

	const payload = (await response.json()) as { nowMs: number };
	const responseReceivedAtMs = Date.now();
	const midpoint = requestStartedAtMs + (responseReceivedAtMs - requestStartedAtMs) / 2;

	return {
		convexNowMs: payload.nowMs,
		requestStartedAtMs,
		responseReceivedAtMs,
		roundTripMs: responseReceivedAtMs - requestStartedAtMs,
		offsetMs: payload.nowMs - midpoint,
	};
});

export const joinSpeakerList = command(async () => {
	const { meetingId } = requireMeetingId();

	try {
		return await getConvexClient().mutation(api.meeting.users.queue.placeInSpeakerQueue, {
			meetingId,
		});
	} catch (cause) {
		throwRemoteError(cause);
	}
});

export const leaveSpeakerList = command(async () => {
	const { meetingId } = requireMeetingId();

	try {
		return await getConvexClient().mutation(api.meeting.users.queue.recallSpeakerQueueRequest, {
			meetingId,
		});
	} catch (cause) {
		throwRemoteError(cause);
	}
});

export const requestSlot = command(z.object({ type: requestTypeSchema }), async ({ type }) => {
	const { meetingId } = requireMeetingId();

	try {
		return await getConvexClient().mutation(api.meeting.users.queue.request, { meetingId, type });
	} catch (cause) {
		throwRemoteError(cause);
	}
});

export const recallSlotRequest = command(
	z.object({ type: requestTypeSchema }),
	async ({ type }) => {
		const { meetingId } = requireMeetingId();

		try {
			return await getConvexClient().mutation(api.meeting.users.queue.recallRequest, {
				meetingId,
				type,
			});
		} catch (cause) {
			throwRemoteError(cause);
		}
	},
);

export const markAbsent = command(async () => {
	const { meetingId } = requireMeetingId();

	try {
		return await getConvexClient().mutation(api.meeting.users.attendance.leaveMeeting, {
			meetingId,
		});
	} catch (cause) {
		throwRemoteError(cause);
	}
});

export const requestReturn = command(async () => {
	const { meetingId } = requireMeetingId();

	try {
		return await getConvexClient().mutation(api.meeting.users.attendance.requestReturnToMeeting, {
			meetingId,
		});
	} catch (cause) {
		throwRemoteError(cause);
	}
});

export const recallReturn = command(async () => {
	const { meetingId } = requireMeetingId();

	try {
		return await getConvexClient().mutation(api.meeting.users.attendance.recallReturnRequest, {
			meetingId,
		});
	} catch (cause) {
		throwRemoteError(cause);
	}
});

export const voteOnPoll = command(
	z.object({
		pollId: meetingPollIdSchema,
		optionIndexes: z.array(z.number().int().nonnegative()).min(1),
	}),
	async ({ pollId, optionIndexes }) => {
		const { meetingId } = requireMeetingId();

		try {
			return await getConvexClient().mutation(api.meeting.users.meetingPoll.vote, {
				meetingId,
				pollId,
				optionIndexes,
			});
		} catch (cause) {
			throwRemoteError(cause);
		}
	},
);

export const retractPollVote = command(
	z.object({ pollId: meetingPollIdSchema }),
	async ({ pollId }) => {
		const { meetingId } = requireMeetingId();

		try {
			return await getConvexClient().mutation(api.meeting.users.meetingPoll.retractVote, {
				meetingId,
				pollId,
			});
		} catch (cause) {
			throwRemoteError(cause);
		}
	},
);
