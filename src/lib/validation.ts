import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';

export const MeetingCode = z
	.string()
	.length(6)
	.regex(/[0-9a-zA-Z]{6}/);

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
		type: z.enum(['multi_winner', 'single_winner']),
		winningCount: z.number().min(1),
		majorityRule: z.enum(['simple', 'two_thirds', 'three_quarters', 'unanimous']),
		resultsPublic: z.boolean(),
		includeVacantOption: z.boolean(),
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
		}
		if (data.type === 'multi_winner') {
			if (data.winningCount < 1 || data.winningCount > data.options.length) {
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

		if (data.options.length < 2 && !data.includeVacantOption) {
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
