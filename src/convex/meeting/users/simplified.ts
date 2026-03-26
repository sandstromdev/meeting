import { withMe } from '$convex/helpers/auth';
import { getMeetingRuntimeVersions } from '$convex/helpers/meetingRuntime';
import type { Id } from '$convex/_generated/dataModel';

export type SimplifiedVersions = {
	simplifiedColdVersion: number;
	simplifiedHotVersion: number;
};

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
		depth: number;
	}>;
};

type SimplifiedRequest = {
	type: 'requested' | 'accepted';
	by: {
		userId: Id<'meetingParticipants'>;
		name: string;
	};
	startTime: number | null;
} | null;

export type SimplifiedHotSnapshot = {
	simplifiedHotVersion: number;
	requests: {
		break: SimplifiedRequest;
		reply: SimplifiedRequest;
		pointOfOrder: SimplifiedRequest;
	};
	poll: {
		id: Id<'meetingPolls'>;
		title: string;
		options: string[];
		type: 'single_winner' | 'multi_winner';
		isOpen: boolean;
		isResultPublic: boolean;
		maxVotesPerVoter: number;
		allowsAbstain: boolean;
	} | null;
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
			agenda: ctx.meeting.agenda.map((item) => ({
				id: item.id,
				title: item.title,
				depth: item.depth,
			})),
		};
	});

export const getHotSnapshot = withMe
	.query()
	.public(async ({ ctx }): Promise<SimplifiedHotSnapshot> => {
		const versionsPromise = getMeetingRuntimeVersions(ctx.db, ctx.meeting._id);

		const pollPromise = (async () => {
			if (!ctx.meeting.currentPollId) {
				return null;
			}

			const poll = await ctx.db.get('meetingPolls', ctx.meeting.currentPollId);

			if (!poll || poll.meetingId !== ctx.meeting._id) {
				return null;
			}

			return {
				id: poll._id,
				title: poll.title,
				options: poll.options,
				type: poll.type,
				isOpen: poll.isOpen,
				isResultPublic: poll.isResultPublic,
				maxVotesPerVoter: poll.maxVotesPerVoter,
				allowsAbstain: poll.allowsAbstain,
			};
		})();

		const [versions, poll] = await Promise.all([versionsPromise, pollPromise]);

		return {
			simplifiedHotVersion: versions.simplifiedHotVersion,
			requests: {
				break: ctx.meeting.break,
				reply: ctx.meeting.reply,
				pointOfOrder: ctx.meeting.pointOfOrder,
			},
			poll,
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
		};
	});
