import { defineTable } from 'convex/server';
import { v } from 'convex/values';

/** Flat agenda item with explicit depth (outline level). */
export const AgendaItem = v.object({
	id: v.string(),
	title: v.string(),
	pollIds: v.array(v.id('meetingPolls')),
	/** Depth in the flat agenda list (0 = top-level, 1 = child, ...). */
	depth: v.number(),
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

export const MeetingStatus = v.union(
	v.literal('draft'),
	v.literal('scheduled'),
	v.literal('active'),
	v.literal('closed'),
	v.literal('archived'),
);

export const MeetingAccessMode = v.union(
	v.literal('open'),
	v.literal('closed'),
	v.literal('invite_only'),
);

export const Meeting = v.object({
	code: v.string(),
	title: v.string(),
	createdByUserId: v.string(),
	status: MeetingStatus,
	// Optional during rollout so existing meetings remain schema-compatible until backfilled.
	accessMode: v.optional(MeetingAccessMode),
	timezone: v.string(),
	location: v.optional(v.string()),
	description: v.optional(v.string()),

	/** Meeting date as timestamp (start of day). */
	date: v.number(),

	/** When the meeting was started (for duration). */
	startedAt: v.nullable(v.number()),
	agenda: v.array(AgendaItem),
	currentAgendaItemId: v.nullable(v.string()),
	currentPollId: v.nullable(v.id('meetingPolls')),

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

	/** Legacy field from earlier reconnect gating; no longer read or written. */
	postOpenAccessAt: v.optional(v.number()),
});

/** Ephemeral lobby heartbeat while meeting.isOpen is false; cleared when the meeting opens. */
export const MeetingLobbyPresence = v.object({
	meetingId: v.id('meetings'),
	userId: v.string(),
	lastSeenAt: v.number(),
});

export const MeetingAccessListEntry = v.object({
	meetingId: v.id('meetings'),
	userId: v.optional(v.string()),
	email: v.optional(v.string()),
	addedByUserId: v.string(),
	addedAt: v.number(),
});

/** Stored backup row for an open meeting (payload shape matches meeting snapshot export). */
export const MeetingSnapshot = v.object({
	meetingId: v.id('meetings'),
	checksum: v.string(),
	payload: v.any(),
	capturedAt: v.number(),
});

export const meetingTables = {
	meetingParticipants: defineTable(MeetingParticipant)
		.index('by_user', ['userId'])
		.index('by_user_meeting', ['userId', 'meetingId'])
		.index('by_meeting', ['meetingId'])
		.index('by_meeting_absent', ['meetingId', 'absentSince']),

	meetingAccessList: defineTable(MeetingAccessListEntry)
		.index('by_meetingId', ['meetingId'])
		.index('by_meetingId_and_userId', ['meetingId', 'userId'])
		.index('by_meetingId_and_email', ['meetingId', 'email']),

	meetings: defineTable(Meeting)
		.index('by_code', ['code'])
		.index('by_isOpen', ['isOpen'])
		.index('by_createdByUserId', ['createdByUserId'])
		.index('by_status_and_date', ['status', 'date']),

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

	meetingLobbyPresence: defineTable(MeetingLobbyPresence)
		.index('by_meeting', ['meetingId'])
		.index('by_meeting_user', ['meetingId', 'userId']),
};
