import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';
import { MAJORITY_RULES, POLL_TYPES } from './polls';

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

export const PollDraftSchema = z
	.object({
		title: z.string().min(1),
		options: z.array(z.string().min(1)).min(1),
		type: z.enum(POLL_TYPES),
		winningCount: z.number().min(1).optional(),
		majorityRule: z.enum(MAJORITY_RULES).optional(),
		isResultPublic: z.boolean().default(false),
		allowsAbstain: z.boolean().default(true),
		maxVotesPerVoter: z.number().min(1),
	})
	.superRefine((data, ctx) => {
		if (data.type === 'single_winner') {
			if (data.winningCount !== 1) {
				ctx.addIssue({
					code: 'custom',
					message: 'Winning count must be 1 for single winner polls',
				});
			}

			if (!data.majorityRule) {
				ctx.addIssue({
					code: 'custom',
					message: 'Majority rule is required for single winner polls',
				});
			}
		}
		if (data.type === 'multi_winner') {
			if (!data.winningCount) {
				ctx.addIssue({
					code: 'custom',
					message: 'Winning count is required for multi winner polls',
				});
			} else if (data.winningCount < 1 || data.winningCount > data.options.length) {
				ctx.addIssue({
					code: 'custom',
					message: 'Winning count must be between 1 and the number of options',
				});
			}
		}

		if (data.maxVotesPerVoter > data.options.length) {
			ctx.addIssue({
				code: 'custom',
				message: 'Max votes per voter must be between 1 and the number of options',
			});
		}

		if (data.options.length < 2 && !data.allowsAbstain) {
			ctx.addIssue({
				code: 'custom',
				message: 'At least 2 options are required when vacant option is not included',
			});
		}

		const set = new Set(data.options.map((o) => o.trim().toLocaleLowerCase()));

		if (set.size !== data.options.length) {
			ctx.addIssue({
				code: 'custom',
				message: 'Options must be unique',
			});
		}
	});

export type PollDraft = z.infer<typeof PollDraftSchema>;

export const PollSchema = z
	.object({
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
	})
	.and(
		z.discriminatedUnion('type', [
			z.object({
				type: z.literal('multi_winner'),
				winningCount: z.number().min(1),
			}),
			z.object({
				type: z.literal('single_winner'),
				majorityRule: z.enum(MAJORITY_RULES),
			}),
		]),
	);
