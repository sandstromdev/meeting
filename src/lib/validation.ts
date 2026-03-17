import { zid } from 'convex-helpers/server/zod4';
import * as z from 'zod';
import { MAJORITY_RULES, POLL_TYPES } from './polls';
import { ROLES } from './roles';
import { sv } from 'zod/v4/locales';

z.config(sv());

export const MeetingCode = z
	.string()
	.length(6)
	.regex(/^[0-9]{6}$/);

export const AuthSchema = z.object({
	userId: zid('meetingParticipants'),
	meetingId: zid('meetings'),
});

export const AdminNotificationSchema = z.object({
	meetingId: zid('meetings'),
	type: z.union([
		z.literal('absence'),
		z.literal('break'),
		z.literal('point_of_order'),
		z.literal('reply'),
		z.literal('return_request'),
		z.literal('generic'),
	]),
	title: z.string(),
	description: z.string(),
	variant: z.union([z.literal('default'), z.literal('destructive'), z.literal('warning')]),
	endTime: z.optional(z.number()),
});

export const PollDraftSchema = z.object({
	title: z.string().min(1),
	options: z.array(z.string().min(1)).min(1),
	type: z.enum(POLL_TYPES),
	winningCount: z.number().min(1).optional(),
	majorityRule: z.enum(MAJORITY_RULES).optional(),
	isResultPublic: z.boolean().default(false),
	allowsAbstain: z.boolean().default(true),
	maxVotesPerVoter: z.number().min(1),
});

export const RefinePollDraftSchema = PollDraftSchema.superRefine((data, ctx) => {
	if (data.type === 'single_winner') {
		if (data.winningCount !== 1) {
			ctx.addIssue({
				code: 'custom',
				path: ['winningCount'],
				message: 'Antal vinnare måste vara 1 för omröstningar med endast en vinnare',
			});
		}

		if (!data.majorityRule) {
			ctx.addIssue({
				code: 'custom',
				path: ['majorityRule'],
				message: 'Majoritetsregel är obligatorisk för omröstningar med endast en vinnare',
			});
		}
	}
	if (data.type === 'multi_winner') {
		if (!data.winningCount) {
			ctx.addIssue({
				code: 'custom',
				path: ['winningCount'],
				message: 'Antal vinnare är obligatoriskt för omröstningar med flera vinnare',
			});
		} else if (data.winningCount < 1 || data.winningCount > data.options.length) {
			ctx.addIssue({
				code: 'custom',
				path: ['winningCount'],
				message: 'Antal vinnare måste vara mellan 1 och antal alternativ',
			});
		}
	}

	if (data.maxVotesPerVoter > data.options.length) {
		ctx.addIssue({
			code: 'custom',
			path: ['maxVotesPerVoter'],
			message: 'Max röster per deltagare måste vara mellan 1 och antal alternativ',
		});
	}

	if (data.options.length < 2 && !data.allowsAbstain) {
		ctx.addIssue({
			code: 'custom',
			path: ['options'],
			message: 'Minst 2 alternativ är obligatoriskt när avstår-alternativet inte inkluderas',
		});
	}

	const set = new Set(data.options.map((o) => o.trim().toLocaleLowerCase()));

	if (set.size !== data.options.length) {
		ctx.addIssue({
			code: 'custom',
			path: ['options'],
			message: 'Alternativ måste vara unika',
		});
	}
});

export type PollDraft = z.infer<typeof PollDraftSchema>;

export const PollBaseSchema = z.object({
	_id: zid('polls'),
	_creationTime: z.number(),
	title: z.string().trim().min(1),
	options: z.array(z.string().trim().min(1)).min(1),
	isResultPublic: z.boolean(),
	allowsAbstain: z.boolean(),
	maxVotesPerVoter: z.number().min(1),
	meetingId: zid('meetings'),
	agendaItemId: z.string().optional(),
	isOpen: z.boolean(),
	openedAt: z.number().optional(),
	closedAt: z.number().optional(),
	updatedAt: z.number(),
});

export const PollTypeSchema = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('multi_winner'),
		winningCount: z.number().min(1),
	}),
	z.object({
		type: z.literal('single_winner'),
		majorityRule: z.enum(MAJORITY_RULES),
	}),
]);

export const FullPollSchema = PollBaseSchema.and(PollTypeSchema);

export const RoleSchema = z.enum(ROLES);
