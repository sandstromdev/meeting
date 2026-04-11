import type { Id } from '$convex/_generated/dataModel';
import { api } from '$convex/_generated/api';
import {
	getAbsentCounter,
	getParticipantCounter,
	getVotesCounter,
	getVotersCounter,
} from '$convex/helpers/counters';
import { agendaItemMotionSettings } from '$convex/helpers/agenda';
import { withMe } from '$convex/helpers/auth';
import { getLatestMeetingPollResultSnapshot } from '$convex/helpers/meetingPoll';
import { getMeetingRuntimeVersions } from '$convex/helpers/meetingRuntime';
import { normalizeStoredPollOptions, type PollOptionRow } from '$lib/pollOptions';

export type SimplifiedPollResultsPayload = Omit<
	NonNullable<typeof api.meeting.users.meetingPoll.getPollResultsById._returnType>,
	'pollId'
>;

export type SimplifiedVersions = {
	simplifiedColdVersion: number;
	simplifiedHotVersion: number;
};

function resolveSimplifiedCurrentAgendaItemId(
	agenda: Array<{ id: string }>,
	storedId: string | null,
): string | null {
	const hasValid = agenda.some((item) => item.id === storedId);
	return hasValid ? storedId : (agenda[0]?.id ?? null);
}

export type SimplifiedColdSnapshot = {
	simplifiedColdVersion: number;
	meeting: {
		_id: Id<'meetings'>;
		title: string;
		status: 'draft' | 'scheduled' | 'active' | 'closed' | 'archived';
		isOpen: boolean;
		startedAt: number | null;
		timezone: string;
		date: number;
	};
	agenda: Array<{
		id: string;
		title: string;
		description: string | null;
		depth: number;
		allowMotions: boolean;
		motionSubmissionMode: 'open' | 'amendments_only';
	}>;
	/** Resolved like `getData`: valid meeting pointer or first item. */
	currentAgendaItemId: string | null;
};

type SimplifiedRequest = {
	type: 'requested' | 'accepted';
	by: {
		userId: Id<'meetingParticipants'>;
		name: string;
	};
	startTime: number | null;
} | null;

/** Who has the floor; same order as MeetingState.currentSpeaker. */
export type SimplifiedActiveSpeech =
	| { kind: 'empty' }
	| { kind: 'point_of_order'; userId: Id<'meetingParticipants'> }
	| { kind: 'reply'; userId: Id<'meetingParticipants'> }
	| { kind: 'speaker'; userId: Id<'meetingParticipants'> };

export type SimplifiedHotSnapshot = {
	simplifiedHotVersion: number;
	/** Same resolution as cold snapshot: valid meeting pointer or first item. */
	currentAgendaItemId: string | null;
	/** Queue head (talare som tagits från kön). */
	currentSpeaker: { userId: Id<'meetingParticipants'> } | null;
	activeSpeech: SimplifiedActiveSpeech;
	requests: {
		break: SimplifiedRequest;
		reply: SimplifiedRequest;
		pointOfOrder: SimplifiedRequest;
	};
	poll: {
		id: Id<'meetingPolls'>;
		title: string;
		options: PollOptionRow[];
		type: 'single_winner' | 'multi_winner';
		isOpen: boolean;
		isResultPublic: boolean;
		maxVotesPerVoter: number;
		allowsAbstain: boolean;
	} | null;
	/** Present when `poll` is non-null; same semantics as `getCurrentPollCounters`. */
	pollCounters: {
		votersCount: number;
		eligibleVoters: number;
		votesCount: number;
	} | null;
	/** Present when `poll` is closed with a stored result snapshot; mirrors `getPollResultsById` without `pollId`. */
	pollResults: SimplifiedPollResultsPayload | null;
	/** Approved motions on the current agenda item (for participant display). */
	motionsApproved: Array<{
		_id: Id<'meetingMotions'>;
		title: string;
		text: string;
		amendsMotionId?: Id<'meetingMotions'>;
		proposerName: string;
		createdAt: number;
		pollId?: Id<'meetingPolls'>;
	}>;
};

export type SimplifiedMeSnapshot = {
	me: {
		_id: Id<'meetingParticipants'>;
		name: string;
		role: 'admin' | 'moderator' | 'participant' | 'adjuster';
		absentSince: number;
		isInSpeakerQueue: boolean;
		returnRequestedAt: number;
	};
	hasPendingReturnRequest: boolean;
	currentPollVoteOptionIndexes: number[];
	/** Participant's pending motion anywhere in this meeting, if any. */
	pendingMotion: {
		_id: Id<'meetingMotions'>;
		title: string;
		text: string;
		amendsMotionId?: Id<'meetingMotions'>;
		agendaItemId: string;
		createdAt: number;
	} | null;
};

export const getVersions = withMe.query().public(async ({ ctx }): Promise<SimplifiedVersions> => {
	return await getMeetingRuntimeVersions(ctx.db, ctx.meeting._id);
});

export const getColdSnapshot = withMe
	.query()
	.public(async ({ ctx }): Promise<SimplifiedColdSnapshot> => {
		const versions = await getMeetingRuntimeVersions(ctx.db, ctx.meeting._id);

		return {
			simplifiedColdVersion: versions.simplifiedColdVersion,
			meeting: {
				_id: ctx.meeting._id,
				title: ctx.meeting.title,
				status: ctx.meeting.status,
				isOpen: ctx.meeting.isOpen,
				startedAt: ctx.meeting.startedAt,
				timezone: ctx.meeting.timezone,
				date: ctx.meeting.date,
			},
			agenda: ctx.meeting.agenda.map((item) => {
				const m = agendaItemMotionSettings(item);
				return {
					id: item.id,
					title: item.title,
					description: item.description ?? null,
					depth: item.depth,
					allowMotions: m.allowMotions,
					motionSubmissionMode: m.motionSubmissionMode,
				};
			}),
			currentAgendaItemId: resolveSimplifiedCurrentAgendaItemId(
				ctx.meeting.agenda,
				ctx.meeting.currentAgendaItemId,
			),
		};
	});

export const getHotSnapshot = withMe
	.query()
	.public(async ({ ctx }): Promise<SimplifiedHotSnapshot> => {
		const versionsPromise = getMeetingRuntimeVersions(ctx.db, ctx.meeting._id);

		const pollDataPromise = (async () => {
			let poll: SimplifiedHotSnapshot['poll'] = null;
			let pollCounters: SimplifiedHotSnapshot['pollCounters'] = null;
			let pollResults: SimplifiedHotSnapshot['pollResults'] = null;

			if (!ctx.meeting.currentPollId) {
				return { poll, pollCounters, pollResults };
			}

			const pollDoc = await ctx.db.get('meetingPolls', ctx.meeting.currentPollId);

			if (!pollDoc || pollDoc.meetingId !== ctx.meeting._id) {
				return { poll, pollCounters, pollResults };
			}

			poll = {
				id: pollDoc._id,
				title: pollDoc.title,
				options: normalizeStoredPollOptions(pollDoc.options),
				type: pollDoc.type,
				isOpen: pollDoc.isOpen,
				isResultPublic: pollDoc.isResultPublic,
				maxVotesPerVoter: pollDoc.maxVotesPerVoter,
				allowsAbstain: pollDoc.allowsAbstain,
			};

			const [participants, absentees, votersCount, votesCount] = await Promise.all([
				getParticipantCounter(ctx.meeting._id).count(ctx),
				getAbsentCounter(ctx.meeting._id).count(ctx),
				getVotersCounter(ctx.meeting._id, pollDoc._id).count(ctx),
				getVotesCounter(ctx.meeting._id, pollDoc._id).count(ctx),
			]);

			pollCounters = {
				votersCount,
				eligibleVoters: Math.max(0, participants - absentees),
				votesCount,
			};

			if (!pollDoc.isOpen && pollDoc.closedAt != null) {
				const result = await getLatestMeetingPollResultSnapshot(ctx.db, pollDoc._id);
				if (result) {
					const canSeeOptionTotals = pollDoc.isResultPublic || ctx.me.role === 'admin';
					const winners = canSeeOptionTotals
						? result.results.winners
						: result.results.winners.map((winner) => ({
								optionIndex: winner.optionIndex,
								option: winner.option,
								description: winner.description,
								votes: undefined,
							}));
					pollResults = {
						complete: result.complete,
						results: {
							optionTotals: canSeeOptionTotals ? result.results.optionTotals : undefined,
							winners,
							isTie: result.results.isTie,
							majorityRule: result.results.majorityRule,
							counts: result.results.counts,
						},
					};
				}
			}

			return { poll, pollCounters, pollResults };
		})();

		const [versions, pollData] = await Promise.all([versionsPromise, pollDataPromise]);
		const { poll, pollCounters, pollResults } = pollData;

		const currentAgendaResolved = resolveSimplifiedCurrentAgendaItemId(
			ctx.meeting.agenda,
			ctx.meeting.currentAgendaItemId,
		);

		const motionsApproved = currentAgendaResolved
			? await (async () => {
					const rows = await ctx.db
						.query('meetingMotions')
						.withIndex('by_meeting_agenda_status', (q) =>
							q
								.eq('meetingId', ctx.meeting._id)
								.eq('agendaItemId', currentAgendaResolved)
								.eq('status', 'approved'),
						)
						.collect();
					rows.sort((a, b) => a.createdAt - b.createdAt);
					return rows.map((m) => ({
						_id: m._id,
						title: m.title,
						text: m.text,
						amendsMotionId: m.amendsMotionId,
						proposerName: m.proposerName,
						createdAt: m.createdAt,
						pollId: m.pollId,
					}));
				})()
			: [];

		const currentSpeaker = ctx.meeting.currentSpeaker
			? { userId: ctx.meeting.currentSpeaker.userId }
			: null;

		const activeSpeech: SimplifiedActiveSpeech = (() => {
			const po = ctx.meeting.pointOfOrder;
			if (po?.type === 'accepted') {
				return { kind: 'point_of_order', userId: po.by.userId };
			}
			const reply = ctx.meeting.reply;
			if (reply?.type === 'accepted') {
				return { kind: 'reply', userId: reply.by.userId };
			}
			if (ctx.meeting.currentSpeaker) {
				return { kind: 'speaker', userId: ctx.meeting.currentSpeaker.userId };
			}
			return { kind: 'empty' };
		})();

		return {
			simplifiedHotVersion: versions.simplifiedHotVersion,
			currentAgendaItemId: resolveSimplifiedCurrentAgendaItemId(
				ctx.meeting.agenda,
				ctx.meeting.currentAgendaItemId,
			),
			currentSpeaker,
			activeSpeech,
			requests: {
				break: ctx.meeting.break,
				reply: ctx.meeting.reply,
				pointOfOrder: ctx.meeting.pointOfOrder,
			},
			poll,
			pollCounters,
			pollResults,
			motionsApproved,
		};
	});

export const getMeSnapshot = withMe
	.query()
	.public(async ({ ctx }): Promise<SimplifiedMeSnapshot> => {
		const currentPollVoteOptionIndexes = await (async () => {
			const currentPollId = ctx.meeting.currentPollId;

			if (!currentPollId) {
				return [];
			}

			const votes = await ctx.db
				.query('meetingPollVotes')
				.withIndex('by_poll_user', (q) => q.eq('pollId', currentPollId).eq('userId', ctx.me._id))
				.collect();

			return votes.map((vote) => vote.optionIndex);
		})();

		const pendingMotionRow = await ctx.db
			.query('meetingMotions')
			.withIndex('by_meeting_proposer_status', (q) =>
				q.eq('meetingId', ctx.meeting._id).eq('proposerUserId', ctx.me._id).eq('status', 'pending'),
			)
			.first();

		const pendingMotion = pendingMotionRow
			? {
					_id: pendingMotionRow._id,
					title: pendingMotionRow.title,
					text: pendingMotionRow.text,
					amendsMotionId: pendingMotionRow.amendsMotionId,
					agendaItemId: pendingMotionRow.agendaItemId,
					createdAt: pendingMotionRow.createdAt,
				}
			: null;

		return {
			me: {
				_id: ctx.me._id,
				name: ctx.me.name,
				role: ctx.me.role,
				absentSince: ctx.me.absentSince,
				isInSpeakerQueue: ctx.me.isInSpeakerQueue,
				returnRequestedAt: ctx.me.returnRequestedAt,
			},
			hasPendingReturnRequest: !!(ctx.me.absentSince && ctx.me.returnRequestedAt),
			currentPollVoteOptionIndexes,
			pendingMotion,
		};
	});
