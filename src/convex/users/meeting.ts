import { authed, withMe, withMeeting } from '$convex/helpers/auth';
import { AppError, errors } from '$convex/helpers/error';
import { flattenAgenda, normalizeAgendaItems } from '$convex/helpers/agenda';
import {
	closeSpeakerSessionIfOpen,
	completeReturnToMeeting,
	findNextPresentSpeaker,
	getMeetingParticipant,
	getSpeakerQueueEntryByOrdinal,
	logSpeakerSlot,
	setCurrentSpeaker,
	setNotInSpeakerQueue,
} from '$convex/helpers/meeting';
import {
	computeWinners,
	getEligibleVoterCount,
	getPollMaxVotesPerVoter,
} from '$convex/helpers/poll';
import type { Id } from '$convex/_generated/dataModel';
import { zid } from 'convex-helpers/server/zod4';

export const getMeeting = withMeeting.query().public(async ({ ctx }) => {
	const { meeting } = ctx;
	return meeting;
});

export const getMe = authed
	.input({ meetingId: zid('meetings') })
	.query()
	.public(async ({ ctx, args }) => {
		return getMeetingParticipant(ctx, args.meetingId);
	});

export const getData = withMe.query().public(async ({ ctx }) => {
	const { me, meeting } = ctx;

	if (me.role === 'participant' && meeting.startedAt && meeting.startedAt > Date.now()) {
		return {
			meeting: {
				...meeting,
				agenda: [],
			},
			me,
			hasPendingReturnRequest: false,
		};
	}

	const agenda = normalizeAgendaItems(meeting.agenda);
	const flat = flattenAgenda(agenda);
	const hasValidCurrentAgendaItem = flat.some((item) => item.id === meeting.currentAgendaItemId);
	const currentAgendaItemId = hasValidCurrentAgendaItem ? meeting.currentAgendaItemId : flat[0]?.id;
	const eligibleVoters = getEligibleVoterCount(meeting);

	type HydratedPoll = {
		id: Id<'polls'>;
		title: string;
		options: string[];
		type: string;
		winningCount: number;
		majorityRule?: string;
		allowsAbstain: boolean;
		maxVotesPerVoter: number;
		resultsPublic: boolean;
		isOpen: boolean;
		openedAt?: number;
		closedAt?: number;
		votesCount: number;
		votersCount: number;
		eligibleVoters: number;
		hasVoted: boolean;
		myVoteOptionIndexes: number[];
		optionTotals?: { optionIndex: number; option: string; votes: number }[];
		winnerOptionIndexes: number[];
		isTie: boolean;
	};

	type AgendaItemWithPolls = (typeof agenda)[number] & {
		polls: HydratedPoll[];
		items: AgendaItemWithPolls[];
	};

	async function hydratePollsForItem(item: (typeof agenda)[number]): Promise<AgendaItemWithPolls> {
		const polls = await Promise.all(
			item.pollIds.map(async (pollId) => {
				const poll = await ctx.db.get('polls', pollId);
				if (!poll || poll.meetingId !== meeting._id) {
					return null;
				}

				const votes = await ctx.db
					.query('pollVotes')
					.withIndex('by_poll', (q) => q.eq('pollId', poll._id))
					.collect();
				const votesCount = votes.length;
				const votersCount = new Set(votes.map((vote) => vote.anonID)).size;
				const myVoteOptionIndexes = votes
					.filter((vote) => vote.anonID === me.anonID)
					.map((vote) => vote.optionIndex)
					.sort((a, b) => a - b);
				const hasVoted = myVoteOptionIndexes.length > 0;
				const maxVotesPerVoter = getPollMaxVotesPerVoter(poll);

				const maySeeResults = poll.resultsPublic === true || me.role === 'admin';
				const optionTotals =
					poll.isOpen || !maySeeResults
						? undefined
						: poll.options.map((option, optionIndex) => ({
								optionIndex,
								option,
								votes: votes.filter((vote) => vote.optionIndex === optionIndex).length,
							}));
				const { winnerOptionIndexes, isTie } =
					optionTotals != null
						? computeWinners(poll, optionTotals, votesCount)
						: { winnerOptionIndexes: [], isTie: false };

				return {
					id: poll._id,
					title: poll.title,
					options: poll.options,
					type: poll.type ?? 'single_winner',
					winningCount: poll.winningCount ?? 1,
					majorityRule: poll.majorityRule ?? undefined,
					allowsAbstain: poll.allowsAbstain,
					maxVotesPerVoter,
					resultsPublic: poll.resultsPublic ?? false,
					isOpen: poll.isOpen,
					openedAt: poll.openedAt,
					closedAt: poll.closedAt,
					votesCount,
					votersCount,
					eligibleVoters,
					hasVoted,
					myVoteOptionIndexes,
					optionTotals,
					winnerOptionIndexes,
					isTie,
				};
			}),
		);

		const items: AgendaItemWithPolls[] = await Promise.all(
			item.items.map((child) => hydratePollsForItem(child)),
		);

		return {
			...item,
			polls: polls.filter((p): p is NonNullable<typeof p> => p !== null),
			items,
		};
	}

	const agendaWithPolls = await Promise.all(agenda.map((item) => hydratePollsForItem(item)));

	return {
		meeting: {
			...meeting,
			agenda: agendaWithPolls,
			currentAgendaItemId,
		},
		me,
		hasPendingReturnRequest: !!(me.absentSince && me.returnRequestedAt),
	};
});

export const getNextSpeakers = withMe.query().public(async ({ ctx }) => {
	const { meeting } = ctx;
	const speakerIndex = meeting.speakerIndex ?? -1;

	const nextSpeakersRaw = await ctx.db
		.query('speakerQueueEntries')
		.withIndex('by_meeting_ordinal', (q) =>
			q.eq('meetingId', meeting._id).gt('ordinal', speakerIndex),
		)
		.order('asc')
		.take(10);

	const participantIds = [...new Set(nextSpeakersRaw.map((e) => e.userId))];
	const participants = await Promise.all(
		participantIds.map((id) => ctx.db.get('meetingParticipants', id)),
	);
	const absentByUser = new Map(participantIds.map((id, i) => [id, !!participants[i]?.absentSince]));

	return nextSpeakersRaw.map((e) => ({
		userId: e.userId,
		name: e.name,
		ordinal: e.ordinal,
		isAbsent: absentByUser.get(e.userId) ?? false,
	}));
});

export const placeInSpeakerQueue = withMe.mutation().public(async ({ ctx }) => {
	const { db, meeting, me } = ctx;
	if (
		me.absentSince ||
		me.isInSpeakerQueue ||
		meeting.break?.type === 'accepted' ||
		meeting.pointOfOrder?.type === 'accepted' ||
		meeting.reply?.type === 'accepted'
	) {
		return false;
	}

	const maxOrdinal = meeting.maxOrdinal ?? -1;
	const ordinal = maxOrdinal + 1;

	await db.insert('speakerQueueEntries', {
		meetingId: meeting._id,
		ordinal,
		userId: me._id,
		name: me.name,
		sessions: [],
	});

	await db.patch('meetings', meeting._id, {
		maxOrdinal: ordinal,
	});

	await db.patch('meetingParticipants', me._id, {
		isInSpeakerQueue: true,
	});

	return true;
});

export const recallSpeakerQueueRequest = withMe.mutation().public(async ({ ctx }) => {
	const { db, meeting, me } = ctx;
	const speakerIndex = meeting.speakerIndex ?? -1;

	const entries = await db
		.query('speakerQueueEntries')
		.withIndex('by_meeting_user_ordinal', (q) =>
			q.eq('meetingId', meeting._id).eq('userId', me._id).gt('ordinal', speakerIndex),
		)
		.collect();

	for (const entry of entries) {
		await db.delete('speakerQueueEntries', entry._id);
	}

	if (entries.length > 0) {
		await setNotInSpeakerQueue(db, me._id);
	}
});

export const doneSpeaking = withMe.mutation().public(async ({ ctx }) => {
	const { db, meeting, me } = ctx;
	const { speakerIndex, currentSpeaker, _id } = meeting;
	const now = Date.now();

	if (meeting.reply?.type === 'accepted' && meeting.reply.by.userId === me._id) {
		await logSpeakerSlot(db, _id, 'reply', meeting.reply.by, meeting.reply.startTime ?? now, now);
		await db.patch('meetings', _id, { reply: null });
		return true;
	}

	if (meeting.pointOfOrder?.type === 'accepted' && meeting.pointOfOrder.by.userId === me._id) {
		await logSpeakerSlot(
			db,
			_id,
			'point_of_order',
			meeting.pointOfOrder.by,
			meeting.pointOfOrder.startTime ?? now,
			now,
		);
		await db.patch('meetings', _id, { pointOfOrder: null });
		return true;
	}

	if (currentSpeaker?.userId !== me._id) {
		return false;
	}

	const currentEntry = await getSpeakerQueueEntryByOrdinal(db, _id, speakerIndex);
	if (currentEntry) {
		await closeSpeakerSessionIfOpen(db, currentEntry, now);
	}

	await logSpeakerSlot(db, _id, 'speaker', currentSpeaker, currentSpeaker.startTime, now);
	await setNotInSpeakerQueue(db, currentSpeaker.userId);

	if (meeting.pointOfOrder?.type === 'accepted' || meeting.reply?.type === 'accepted') {
		await db.patch('meetings', _id, {
			currentSpeaker: null,
		});
		return true;
	}

	const nextEntry = await findNextPresentSpeaker(db, _id, speakerIndex);
	if (!nextEntry) {
		await db.patch('meetings', _id, { currentSpeaker: null });
		return true;
	}

	await setCurrentSpeaker(db, _id, nextEntry, now);
	return true;
});

export const requestPointOfOrder = withMe.mutation().public(async ({ ctx }) => {
	const { db, meeting, me } = ctx;

	if (meeting.pointOfOrder) {
		return false;
	}

	await db.patch('meetings', meeting._id, {
		pointOfOrder: {
			type: 'requested',
			by: {
				userId: me._id,
				name: me.name,
			},
		},
	});

	return true;
});

export const recallPointOfOrderRequest = withMe.mutation().public(async ({ ctx }) => {
	const { db, meeting, me } = ctx;

	if (meeting.pointOfOrder?.type !== 'requested' || meeting.pointOfOrder.by.userId !== me._id) {
		return false;
	}

	await db.patch('meetings', meeting._id, {
		pointOfOrder: null,
	});

	return true;
});

export const requestReply = withMe.mutation().public(async ({ ctx }) => {
	const { db, meeting, me } = ctx;

	if (meeting.reply) {
		return false;
	}

	await db.patch('meetings', meeting._id, {
		reply: {
			type: 'requested',
			by: {
				userId: me._id,
				name: me.name,
			},
		},
	});

	return true;
});

export const recallReplyRequest = withMe.mutation().public(async ({ ctx }) => {
	const { db, meeting, me } = ctx;

	if (meeting.reply?.type !== 'requested' || meeting.reply.by.userId !== me._id) {
		return false;
	}

	await db.patch('meetings', meeting._id, {
		reply: null,
	});

	return true;
});

export const requestBreak = withMe.mutation().public(async ({ ctx }) => {
	const { db, meeting, me } = ctx;

	if (meeting.break) {
		return;
	}

	const by = { userId: me._id, name: me.name };
	await db.patch('meetings', meeting._id, {
		break: {
			type: me.role === 'admin' ? 'accepted' : 'requested',
			by,
		},
	});
});

export const recallBreakRequest = withMe.mutation().public(async ({ ctx }) => {
	const { db, meeting, me } = ctx;

	if (meeting.break?.type !== 'requested' || meeting.break.by.userId !== me._id) {
		return false;
	}

	await db.patch('meetings', meeting._id, {
		break: null,
	});

	return true;
});

export const leaveMeeting = withMe.mutation().public(async ({ ctx }) => {
	const { db, me, meeting } = ctx;

	if (me.absentSince) {
		return;
	}

	const isCurrentSpeaker = meeting.currentSpeaker?.userId === me._id;
	const isPointOfOrderSpeaker =
		meeting.pointOfOrder?.type === 'accepted' && meeting.pointOfOrder.by.userId === me._id;
	const isReplySpeaker = meeting.reply?.type === 'accepted' && meeting.reply.by.userId === me._id;

	if (isCurrentSpeaker || isPointOfOrderSpeaker || isReplySpeaker) {
		throw new AppError(errors.cannot_leave_while_speaking());
	}

	const now = Date.now();

	if (me.isInSpeakerQueue) {
		const speakerIndex = meeting.speakerIndex ?? -1;
		const entries = await db
			.query('speakerQueueEntries')
			.withIndex('by_meeting_user_ordinal', (q) =>
				q.eq('meetingId', meeting._id).eq('userId', me._id).gt('ordinal', speakerIndex),
			)
			.collect();
		for (const entry of entries) {
			await db.delete('speakerQueueEntries', entry._id);
		}
		await setNotInSpeakerQueue(db, me._id);
	}

	await db.insert('absenceEntries', {
		meetingId: meeting._id,
		userId: me._id,
		name: me.name,
		startTime: now,
	});

	await db.patch('meetingParticipants', me._id, {
		absentSince: now,
	});

	await db.patch('meetings', meeting._id, {
		absent: (meeting.absent ?? 0) + 1,
	});
});

export const requestReturnToMeeting = withMe.mutation().public(async ({ ctx }) => {
	const { db, me, meeting } = ctx;

	if (!me.absentSince) {
		return false;
	}

	if (me.role === 'admin') {
		await completeReturnToMeeting(db, meeting, me._id);
		return true;
	}

	if (me.returnRequestedAt) {
		return false;
	}

	const now = Date.now();
	await db.patch('meetingParticipants', me._id, { returnRequestedAt: now });
	return true;
});

export const recallReturnRequest = withMe.mutation().public(async ({ ctx }) => {
	const { db, me } = ctx;

	if (!me.returnRequestedAt) {
		return false;
	}

	await db.patch('meetingParticipants', me._id, { returnRequestedAt: 0 });
	return true;
});
