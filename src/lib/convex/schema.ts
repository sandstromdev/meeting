import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export const AgendaItem = v.object({
	title: v.string(),
	poll: v.optional(v.id('polls'))
});

export const QueueEntry = v.object({
	userId: v.id('users'),
	name: v.string()
});

export const Meeting = v.object({
	code: v.string(),
	title: v.string(),
	agenda: v.array(AgendaItem),

	speakerQueue: v.array(QueueEntry),

	break: v.nullable(
		v.object({
			type: v.union(v.literal('requested'), v.literal('accepted')),
			by: v.object({
				userId: v.id('users'),
				name: v.string()
			})
		})
	),

	currentSpeaker: v.nullable(
		v.object({
			userId: v.id('users'),
			name: v.string(),
			startTime: v.number()
		})
	),

	pointOfOrder: v.nullable(
		v.object({
			userId: v.id('users'),
			name: v.string(),
			startTime: v.number()
		})
	),

	anonIdCounter: v.number()
});

export const PollOption = v.object({
	title: v.string(),
	description: v.nullable(v.string()),
	votes: v.number()
});

export const Poll = v.object({
	meetingId: v.id('meetings'),
	title: v.string(),
	options: v.array(PollOption),
	isOpen: v.boolean()
});

export const Vote = v.object({
	pollId: v.id('polls'),
	option: v.number()
});

export const User = v.object({
	_id: v.id('users'),
	meetingId: v.id('meetings'),
	name: v.string(),
	anonID: v.number(),

	admin: v.boolean(),

	isInSpeakerQueue: v.boolean(),
	isAbsent: v.boolean(),

	votes: v.array(Vote)
});

export default defineSchema(
	{
		users: defineTable(User).index('by_anon_id', ['anonID']),

		meetings: defineTable(Meeting).index('by_code', ['code']),

		polls: defineTable(Poll).index('by_meeting', ['meetingId'])
	},
	{ schemaValidation: false }
);
