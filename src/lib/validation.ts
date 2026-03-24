import { zid } from 'convex-helpers/server/zod4';
import * as z from 'zod';
import { ABSTAIN_OPTION_LABEL, MAJORITY_RULES, POLL_TYPES } from './polls';
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
	options: z
		.array(
			z
				.string()
				.min(1)
				.refine((o) => o !== ABSTAIN_OPTION_LABEL),
		)
		.min(1),
	type: z.enum(POLL_TYPES),
	winningCount: z.number().min(1).optional(),
	majorityRule: z.enum(MAJORITY_RULES).optional(),
	isResultPublic: z.boolean().default(false),
	allowsAbstain: z.boolean().default(true),
	maxVotesPerVoter: z.number().min(1),
});
export const StandaloneVisibilitySchema = z.enum(['public', 'account_required']);
export type StandaloneVisibility = z.infer<typeof StandaloneVisibilitySchema>;

export const RefinePollDraftSchema = PollDraftSchema.superRefine((data, ctx) => {
	const { options, allowsAbstain } = data;
	const votableSlots = options.length + (allowsAbstain ? 1 : 0);

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
		} else if (data.winningCount < 1 || data.winningCount > options.length) {
			ctx.addIssue({
				code: 'custom',
				path: ['winningCount'],
				message: 'Antal vinnare måste vara mellan 1 och antal alternativ',
			});
		}
	}

	if (data.maxVotesPerVoter > votableSlots) {
		ctx.addIssue({
			code: 'custom',
			path: ['maxVotesPerVoter'],
			message: 'Max röster per deltagare måste vara mellan 1 och antal alternativ',
		});
	}

	if (options.length < 2 && !allowsAbstain) {
		ctx.addIssue({
			code: 'custom',
			path: ['options'],
			message: 'Minst 2 alternativ är obligatoriskt när avstår-alternativet inte inkluderas',
		});
	}

	const set = new Set(options.map((o) => o.trim().toLocaleLowerCase()));

	if (set.size !== options.length) {
		ctx.addIssue({
			code: 'custom',
			path: ['options'],
			message: 'Alternativ måste vara unika',
		});
	}
});

export type PollDraft = z.infer<typeof PollDraftSchema>;

/** Flat poll type fields; use with `refinePollRowTypeConfig` when `options` is present (stored rows / inserts). */
export const pollTypeConfigZod = z.object({
	type: z.enum(POLL_TYPES),
	winningCount: z.number().min(1).optional(),
	majorityRule: z.enum(MAJORITY_RULES).optional(),
});

export type PollTypeConfig = z.infer<typeof pollTypeConfigZod>;

/** Enforces branch invariants given `options` (same rules as draft refine; allows legacy single_winner without winningCount). */
export function refinePollRowTypeConfig(
	data: PollTypeConfig & { options: readonly string[] },
	ctx: z.RefinementCtx,
) {
	const { options } = data;

	if (data.type === 'single_winner') {
		if (data.winningCount !== undefined && data.winningCount !== 1) {
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
		} else if (data.winningCount < 1 || data.winningCount > options.length) {
			ctx.addIssue({
				code: 'custom',
				path: ['winningCount'],
				message: 'Antal vinnare måste vara mellan 1 och antal alternativ',
			});
		}
	}
}

/** Alias for `pollTypeConfigZod` (use with `refinePollRowTypeConfig` when building insert/row parsers). */
export const PollTypeSchema = pollTypeConfigZod;

export const PollBaseSchema = z.object({
	_id: zid('polls'),
	_creationTime: z.number(),
	title: z.string().trim().min(1),
	options: z.array(z.string().trim().min(1)).min(1),
	isResultPublic: z.boolean(),
	allowsAbstain: z.boolean(),
	maxVotesPerVoter: z.number().min(1),
	meetingId: zid('meetings'),
	agendaItemId: z.string().nullable(),
	isOpen: z.boolean(),
	openedAt: z.number().nullable(),
	closedAt: z.number().nullable(),
	updatedAt: z.number(),
});

export const FullPollSchema = PollBaseSchema.and(pollTypeConfigZod).superRefine((data, ctx) =>
	refinePollRowTypeConfig(data, ctx),
);

/** Poll payload as stored inside `pollResults.poll` (no Convex system fields). */
export const PollEmbeddedSnapshotSchema = PollBaseSchema.omit({ _id: true, _creationTime: true })
	.and(pollTypeConfigZod)
	.superRefine((data, ctx) => refinePollRowTypeConfig(data, ctx));

export const StandalonePollBaseSchema = z.object({
	_id: zid('standalonePolls'),
	_creationTime: z.number(),
	code: z.string().trim().min(4).max(12),
	ownerUserId: z.string().trim().min(1),
	visibilityMode: StandaloneVisibilitySchema,
	title: z.string().trim().min(1),
	options: z.array(z.string().trim().min(1)).min(1),
	isResultPublic: z.boolean(),
	allowsAbstain: z.boolean(),
	maxVotesPerVoter: z.number().min(1),
	isOpen: z.boolean(),
	openedAt: z.number().nullable(),
	closedAt: z.number().nullable(),
	updatedAt: z.number(),
});

export const FullStandalonePollSchema = StandalonePollBaseSchema.and(pollTypeConfigZod).superRefine(
	(data, ctx) => refinePollRowTypeConfig(data, ctx),
);

/** Standalone poll payload as stored inside `standalonePollResults.poll`. */
export const StandalonePollEmbeddedSnapshotSchema = StandalonePollBaseSchema.omit({
	_id: true,
	_creationTime: true,
})
	.and(pollTypeConfigZod)
	.superRefine((data, ctx) => refinePollRowTypeConfig(data, ctx));

export const RoleSchema = z.enum(ROLES);

/** Response shape for `GET /api/meeting/snapshot` (Convex export + SvelteKit proxy). */
export const MeetingSnapshotSpeakerSchema = z.object({
	type: z.enum(['speaker', 'point_of_order', 'reply']),
	name: z.string(),
	startTime: z.number(),
	endTime: z.number(),
});

export const MeetingSnapshotSchema = z.object({
	meeting: z.object({
		_creationTime: z.number(),
		_id: zid('meetings'),
		code: z.string(),
		date: z.number(),
		title: z.string(),
		startedAt: z.number().nullable(),
		agenda: z.array(z.any()),
	}),
	polls: z.array(z.any()),
	participants: z.array(
		z.object({
			name: z.string(),
			role: RoleSchema,
			banned: z.boolean(),
			joinedAt: z.number(),
		}),
	),
	absenceEntries: z.array(
		z.object({
			name: z.string(),
			startTime: z.number(),
			endTime: z.number().nullable(),
		}),
	),
	speakerLog: z.array(MeetingSnapshotSpeakerSchema),
});

export type MeetingSnapshot = z.infer<typeof MeetingSnapshotSchema>;
