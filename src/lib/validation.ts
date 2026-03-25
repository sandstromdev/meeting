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
export const UserPollVisibilitySchema = z.enum(['public', 'account_required']);
export type UserPollVisibility = z.infer<typeof UserPollVisibilitySchema>;
/** @deprecated Use `UserPollVisibilitySchema` */
export const StandaloneVisibilitySchema = UserPollVisibilitySchema;
/** @deprecated Use `UserPollVisibility` */
export type StandaloneVisibility = UserPollVisibility;

/** Flat poll type fields; use with `refinePollRowTypeConfig` when `options` is present (stored rows / inserts). */
export const pollTypeConfigZod = z.object({
	type: z.enum(POLL_TYPES),
	winningCount: z.number().min(1).optional(),
	majorityRule: z.enum(MAJORITY_RULES).optional(),
});

export type PollTypeConfig = z.infer<typeof pollTypeConfigZod>;

/** Shared `single_winner` / `multi_winner` checks for drafts vs stored rows (winningCount strictness differs). */
function refinePollTypeConfigCore(
	data: PollTypeConfig & { options: readonly string[] },
	ctx: z.RefinementCtx,
	mode: 'draftStrict' | 'rowLegacy',
) {
	const { options } = data;

	if (data.type === 'single_winner') {
		if (mode === 'draftStrict') {
			if (data.winningCount !== 1) {
				ctx.addIssue({
					code: 'custom',
					path: ['winningCount'],
					message: 'Antal vinnare måste vara 1 för omröstningar med endast en vinnare',
				});
			}
		} else if (data.winningCount !== undefined && data.winningCount !== 1) {
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

export const RefinePollDraftSchema = PollDraftSchema.superRefine((data, ctx) => {
	const { options, allowsAbstain } = data;
	const votableSlots = options.length + (allowsAbstain ? 1 : 0);

	refinePollTypeConfigCore(data, ctx, 'draftStrict');

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

/** Enforces branch invariants given `options` (same rules as draft refine; allows legacy single_winner without winningCount). */
export function refinePollRowTypeConfig(
	data: PollTypeConfig & { options: readonly string[] },
	ctx: z.RefinementCtx,
) {
	refinePollTypeConfigCore(data, ctx, 'rowLegacy');
}

/** Alias for `pollTypeConfigZod` (use with `refinePollRowTypeConfig` when building insert/row parsers). */
export const PollTypeSchema = pollTypeConfigZod;

/** Shared tail of meeting vs user poll rows (matches `pollRowSharedFields` in Convex). */
export const pollRowSharedZod = z.object({
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

function andPollTypeConfigWithRowRefine<O extends z.ZodRawShape>(base: z.ZodObject<O>) {
	return base
		.and(pollTypeConfigZod)
		.superRefine((data, ctx) =>
			refinePollRowTypeConfig(data as PollTypeConfig & { options: readonly string[] }, ctx),
		);
}

export const PollBaseSchema = z
	.object({
		_id: zid('meetingPolls'),
		_creationTime: z.number(),
		meetingId: zid('meetings'),
		agendaItemId: z.string().nullable(),
	})
	.merge(pollRowSharedZod);

export const FullPollSchema = andPollTypeConfigWithRowRefine(PollBaseSchema);

/** Poll payload as stored inside `pollResults.poll` (no Convex system fields). */
export const PollEmbeddedSnapshotSchema = andPollTypeConfigWithRowRefine(
	PollBaseSchema.omit({ _id: true, _creationTime: true }),
);

export const UserPollBaseSchema = z
	.object({
		_id: zid('userPolls'),
		_creationTime: z.number(),
		code: z.string().trim().min(4).max(12),
		ownerUserId: z.string().trim().min(1),
		visibilityMode: UserPollVisibilitySchema,
	})
	.extend(pollRowSharedZod.shape);

export const FullUserPollSchema = andPollTypeConfigWithRowRefine(UserPollBaseSchema);

/** User poll payload as stored inside `userPollResults.poll`. */
export const UserPollEmbeddedSnapshotSchema = andPollTypeConfigWithRowRefine(
	UserPollBaseSchema.omit({
		_id: true,
		_creationTime: true,
	}),
);

/** Shared nested `results` shape for `insertPollResultSnapshot` (user vs meeting differ only in `counts`). */
export const pollSnapshotOptionVotesRowZod = z.object({
	optionIndex: z.number(),
	option: z.string(),
	votes: z.number(),
});

export const pollSnapshotResultsCoreZod = z.object({
	optionTotals: z.array(pollSnapshotOptionVotesRowZod),
	winners: z.array(pollSnapshotOptionVotesRowZod),
	isTie: z.boolean(),
	majorityRule: z.enum(MAJORITY_RULES).nullable(),
});

export const pollSnapshotCountsUserZod = z.object({
	totalVotes: z.number(),
	usableVotes: z.number(),
	abstain: z.number(),
});

export const pollSnapshotCountsMeetingZod = z.object({
	totalVotes: z.number(),
	eligibleVoters: z.number(),
	usableVotes: z.number(),
	abstain: z.number(),
});

/** @deprecated Use `UserPollBaseSchema` */
export const StandalonePollBaseSchema = UserPollBaseSchema;
/** @deprecated Use `FullUserPollSchema` */
export const FullStandalonePollSchema = FullUserPollSchema;
/** @deprecated Use `UserPollEmbeddedSnapshotSchema` */
export const StandalonePollEmbeddedSnapshotSchema = UserPollEmbeddedSnapshotSchema;

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
