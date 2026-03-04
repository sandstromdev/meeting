import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';

export const AgendaItem = v.object({
	id: v.string(),
	title: v.string(),
	pollIds: v.array(v.id('polls')),
});

export const QueueEntry = v.object({
	userId: v.id('meetingParticipants'),
	name: v.string(),
});

export const SpeakingSession = v.object({
	startTime: v.number(),
	stopTime: v.optional(v.number()),
});

export const SpeakerQueueEntry = v.object({
	meetingId: v.id('meetings'),
	ordinal: v.number(),
	userId: v.id('meetingParticipants'),
	name: v.string(),
	sessions: v.array(SpeakingSession),
});

export const Meeting = v.object({
	code: v.string(),
	title: v.string(),

	/** Meeting date as timestamp (start of day). */
	date: v.number(),

	/** When the meeting was started (for duration). */
	startedAt: v.optional(v.number()),
	agenda: v.array(AgendaItem),
	currentAgendaItemId: v.optional(v.string()),

	isOpen: v.boolean(),

	speakerIndex: v.number(),
	maxOrdinal: v.number(),

	break: v.nullable(
		v.object({
			type: v.union(v.literal('requested'), v.literal('accepted')),
			by: v.object({
				userId: v.id('meetingParticipants'),
				name: v.string(),
			}),
		}),
	),

	currentSpeaker: v.nullable(
		v.object({
			userId: v.id('meetingParticipants'),
			name: v.string(),
			startTime: v.number(),
		}),
	),

	pointOfOrder: v.nullable(
		v.object({
			type: v.union(v.literal('requested'), v.literal('accepted')),
			by: v.object({
				userId: v.id('meetingParticipants'),
				name: v.string(),
			}),
			startTime: v.optional(v.number()),
		}),
	),

	reply: v.optional(
		v.nullable(
			v.object({
				type: v.union(v.literal('requested'), v.literal('accepted')),
				by: v.object({
					userId: v.id('meetingParticipants'),
					name: v.string(),
				}),
				startTime: v.optional(v.number()),
			}),
		),
	),

	participants: v.number(),
	absent: v.number(),

	anonIdCounter: v.number(),
});

export const Poll = v.object({
	meetingId: v.id('meetings'),
	agendaItemId: v.string(),
	title: v.string(),
	options: v.array(v.string()),
	maxVotesPerVoter: v.optional(v.number()),
	isOpen: v.boolean(),
	/** If true, everyone can see results when poll is closed; if false, only admins can. */
	resultsPublic: v.optional(v.boolean()),
	openedAt: v.optional(v.number()),
	closedAt: v.optional(v.number()),
	closedBy: v.optional(v.id('meetingParticipants')),
	createdBy: v.id('meetingParticipants'),
	updatedAt: v.number(),
});

export const PollVote = v.object({
	meetingId: v.id('meetings'),
	pollId: v.id('polls'),
	anonID: v.number(),
	optionIndex: v.number(),
	createdAt: v.number(),
});

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
	userId: v.optional(v.id('meetingParticipants')),
	name: v.string(),
	startTime: v.number(),
	endTime: v.number(),
});

export const AbsenceEntry = v.object({
	meetingId: v.id('meetings'),
	userId: v.id('meetingParticipants'),
	name: v.string(),
	startTime: v.number(),
	endTime: v.optional(v.number()),
});

export const MeetingParticipant = v.object({
	_id: v.id('meetingParticipants'),
	meetingId: v.id('meetings'),
	name: v.string(),
	anonID: v.number(),

	tokenIdentifier: v.string(),

	role: v.union(v.literal('admin'), v.literal('moderator'), v.literal('participant')),

	isInSpeakerQueue: v.boolean(),

	absentSince: v.number(),
	returnRequestedAt: v.number(),
});

/** Tracks participant activity by tokenIdentifier (separate from meetingParticipants). */
export const Heartbeat = v.object({
	tokenIdentifier: v.string(),
	lastSeenAt: v.number(),
});

export default defineSchema(
	{
		meetingParticipants: defineTable(MeetingParticipant)
			.index('by_token', ['tokenIdentifier'])
			.index('by_token_meeting', ['tokenIdentifier', 'meetingId'])
			.index('by_meeting_anon', ['meetingId', 'anonID'])
			.index('by_meeting_absent', ['meetingId', 'absentSince']),

		meetings: defineTable(Meeting).index('by_code', ['code']),

		speakerQueueEntries: defineTable(SpeakerQueueEntry)
			.index('by_meeting_ordinal', ['meetingId', 'ordinal'])
			.index('by_meeting_user', ['meetingId', 'userId'])
			.index('by_meeting_user_ordinal', ['meetingId', 'userId', 'ordinal']),

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
			.index('by_poll_anon', ['pollId', 'anonID']),

		heartbeats: defineTable(Heartbeat)
			.index('by_token', ['tokenIdentifier'])
			.index('by_lastSeenAt', ['lastSeenAt']),
	},
	{ schemaValidation: false },
);
