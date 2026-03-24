import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

/** Flat agenda item with explicit depth (outline level). */
export const AgendaItem = v.object({
	id: v.string(),
	title: v.string(),
	pollIds: v.array(v.id('polls')),
	/** Depth in the flat agenda list (0 = top-level, 1 = child, ...). */
	depth: v.number(),
});

export const QueueEntry = v.object({
	userId: v.id('meetingParticipants'),
	name: v.string(),
});

export const SpeakerQueueEntry = v.object({
	meetingId: v.id('meetings'),
	userId: v.id('meetingParticipants'),
	name: v.string(),
});

export const Request = v.object({
	type: v.union(v.literal('requested'), v.literal('accepted')),
	by: v.object({
		userId: v.id('meetingParticipants'),
		name: v.string(),
	}),
	startTime: v.nullable(v.number()),
});

export const Meeting = v.object({
	code: v.string(),
	title: v.string(),

	/** Meeting date as timestamp (start of day). */
	date: v.number(),

	/** When the meeting was started (for duration). */
	startedAt: v.nullable(v.number()),
	agenda: v.array(AgendaItem),
	currentAgendaItemId: v.nullable(v.string()),
	currentPollId: v.nullable(v.id('polls')),

	isOpen: v.boolean(),

	lastConsumedCt: v.number(),

	currentSpeaker: v.nullable(
		v.object({
			entryId: v.nullable(v.id('speakerQueueEntries')),
			ct: v.number(),
			userId: v.id('meetingParticipants'),
			name: v.string(),
			startTime: v.number(),
		}),
	),

	/** Last main speaker (for undo/step back). Not set for point of order, reply, break. */
	previousSpeaker: v.nullable(
		v.object({
			ct: v.number(),
			userId: v.id('meetingParticipants'),
			name: v.string(),
			startTime: v.number(),
		}),
	),

	break: v.nullable(Request),
	pointOfOrder: v.nullable(Request),
	reply: v.nullable(Request),
});

export const pollType = v.union(v.literal('multi_winner'), v.literal('single_winner'));
export const majorityRule = v.union(
	v.literal('simple'),
	v.literal('two_thirds'),
	v.literal('three_quarters'),
	v.literal('unanimous'),
);
export const standaloneVisibilityMode = v.union(v.literal('public'), v.literal('account_required'));

export type PollType = typeof pollType.type;
export type MajorityRule = typeof majorityRule.type;
export type StandaloneVisibilityMode = typeof standaloneVisibilityMode.type;

const pollBaseFields = {
	meetingId: v.id('meetings'),
	agendaItemId: v.nullable(v.string()),
	title: v.string(),
	options: v.array(v.string()),
	allowsAbstain: v.boolean(),
	isOpen: v.boolean(),
	maxVotesPerVoter: v.number(),
	/** If true, everyone can see results when poll is closed; if false, only admins can. */
	isResultPublic: v.boolean(),
	openedAt: v.nullable(v.number()),
	closedAt: v.nullable(v.number()),
	updatedAt: v.number(),
};

/** `type` is source of truth; branch-specific fields are optional at rest (Zod enforces on write). */
const pollTypeConfigFields = {
	type: pollType,
	winningCount: v.optional(v.number()),
	majorityRule: v.optional(majorityRule),
};

export const Poll = v.object({
	...pollBaseFields,
	...pollTypeConfigFields,
});
export type Poll = typeof Poll.type;

const standalonePollBaseFields = {
	code: v.string(),
	ownerUserId: v.string(),
	visibilityMode: standaloneVisibilityMode,
	title: v.string(),
	options: v.array(v.string()),
	allowsAbstain: v.boolean(),
	isOpen: v.boolean(),
	maxVotesPerVoter: v.number(),
	isResultPublic: v.boolean(),
	openedAt: v.nullable(v.number()),
	closedAt: v.nullable(v.number()),
	updatedAt: v.number(),
};

export const StandalonePoll = v.object({
	...standalonePollBaseFields,
	...pollTypeConfigFields,
});

export const StandalonePollVote = v.object({
	pollId: v.id('standalonePolls'),
	voterKey: v.string(),
	optionIndex: v.number(),
});

export const StandalonePollResultOptionTotal = v.object({
	optionIndex: v.number(),
	option: v.string(),
	votes: v.number(),
});

export const StandalonePollResult = {
	pollId: v.id('standalonePolls'),
	closedAt: v.number(),
	poll: StandalonePoll,
	complete: v.boolean(),
	results: v.object({
		optionTotals: v.array(StandalonePollResultOptionTotal),
		winners: v.array(
			v.object({
				optionIndex: v.number(),
				option: v.string(),
				votes: v.number(),
			}),
		),
		isTie: v.boolean(),
		majorityRule: v.nullable(majorityRule),
		counts: v.object({
			totalVotes: v.number(),
			usableVotes: v.number(),
			abstain: v.number(),
		}),
	}),
};

export const PollVote = v.object({
	meetingId: v.id('meetings'),
	pollId: v.id('polls'),
	userId: v.id('meetingParticipants'),
	optionIndex: v.number(),
});

export const PollResultOptionTotal = v.object({
	optionIndex: v.number(),
	option: v.string(),
	votes: v.number(),
});

export const PollResult = {
	meetingId: v.id('meetings'),
	pollId: v.id('polls'),
	closedAt: v.number(),
	poll: Poll,
	complete: v.boolean(),
	results: v.object({
		optionTotals: v.array(PollResultOptionTotal),
		winners: v.array(
			v.object({
				optionIndex: v.number(),
				option: v.string(),
				votes: v.number(),
			}),
		),
		isTie: v.boolean(),
		majorityRule: v.nullable(majorityRule),
		counts: v.object({
			totalVotes: v.number(),
			eligibleVoters: v.number(),
			usableVotes: v.number(),
			abstain: v.number(),
		}),
	}),
};

export const PointOfOrderEntry = v.object({
	meetingId: v.id('meetings'),
	userId: v.id('meetingParticipants'),
	name: v.string(),
	startTime: v.number(),
	endTime: v.number(),
});

export const SpeakerLogEntry = v.object({
	meetingId: v.id('meetings'),
	type: v.union(v.literal('speaker'), v.literal('point_of_order'), v.literal('reply')),
	userId: v.nullable(v.id('meetingParticipants')),
	name: v.string(),
	startTime: v.number(),
	endTime: v.number(),
});

export const AbsenceEntry = v.object({
	meetingId: v.id('meetings'),
	userId: v.id('meetingParticipants'),
	name: v.string(),
	startTime: v.number(),
	endTime: v.nullable(v.number()),
});

export const MeetingParticipant = v.object({
	meetingId: v.id('meetings'),
	name: v.string(),

	userId: v.string(),

	role: v.union(
		v.literal('admin'),
		v.literal('moderator'),
		v.literal('participant'),
		v.literal('adjuster'),
	),

	isInSpeakerQueue: v.boolean(),

	/** When the participant first joined this meeting (ms).  */
	joinedAt: v.number(),

	absentSince: v.number(),
	returnRequestedAt: v.number(),

	/** When true, participant cannot connect or access the meeting. */
	banned: v.boolean(),
});

export const User = v.object({
	email: v.string(),
	role: v.union(v.literal('admin'), v.literal('user')),
	userId: v.string(),
});

/** Stored backup row for an open meeting (payload shape matches meeting snapshot export). */
export const MeetingSnapshot = v.object({
	meetingId: v.id('meetings'),
	checksum: v.string(),
	payload: v.any(),
	capturedAt: v.number(),
});

export default defineSchema(
	{
		meetingParticipants: defineTable(MeetingParticipant)
			.index('by_user', ['userId'])
			.index('by_user_meeting', ['userId', 'meetingId'])
			.index('by_meeting', ['meetingId'])
			.index('by_meeting_absent', ['meetingId', 'absentSince']),

		meetings: defineTable(Meeting).index('by_code', ['code']).index('by_isOpen', ['isOpen']),

		meetingSnapshots: defineTable(MeetingSnapshot).index('by_meeting', ['meetingId']),

		speakerQueueEntries: defineTable(SpeakerQueueEntry)
			.index('by_meeting', ['meetingId'])
			.index('by_meeting_user', ['meetingId', 'userId']),

		pointOfOrderEntries: defineTable(PointOfOrderEntry)
			.index('by_meeting', ['meetingId'])
			.index('by_meeting_endTime', ['meetingId', 'endTime']),

		speakerLogEntries: defineTable(SpeakerLogEntry)
			.index('by_meeting', ['meetingId'])
			.index('by_meeting_endTime', ['meetingId', 'endTime']),

		absenceEntries: defineTable(AbsenceEntry)
			.index('by_meeting', ['meetingId'])
			.index('by_meeting_user', ['meetingId', 'userId'])
			.index('by_meeting_startTime', ['meetingId', 'startTime']),

		polls: defineTable(Poll)
			.index('by_meeting', ['meetingId'])
			.index('by_meeting_agendaItem', ['meetingId', 'agendaItemId']),

		pollVotes: defineTable(PollVote)
			.index('by_poll', ['pollId'])
			.index('by_poll_user', ['pollId', 'userId']),

		pollResults: defineTable(PollResult)
			.index('by_poll_and_closedAt', ['pollId', 'closedAt'])
			.index('by_meeting_and_poll_and_closedAt', ['meetingId', 'pollId', 'closedAt']),

		standalonePolls: defineTable(StandalonePoll)
			.index('by_code', ['code'])
			.index('by_ownerUserId_and_updatedAt', ['ownerUserId', 'updatedAt']),

		standalonePollVotes: defineTable(StandalonePollVote)
			.index('by_poll', ['pollId'])
			.index('by_poll_and_voterKey', ['pollId', 'voterKey']),

		standalonePollResults: defineTable(StandalonePollResult).index('by_poll_and_closedAt', [
			'pollId',
			'closedAt',
		]),
	},
	{ schemaValidation: true },
);
