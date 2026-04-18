import { zid } from 'convex-helpers/server/zod4';
import * as z from 'zod';
import { type StoredPollOptions } from './pollOptions';
import { POLL_RESULT_VISIBILITIES, type PollResultVisibility } from './pollResultVisibility';
import { ABSTAIN_OPTION_LABEL, MAJORITY_RULES, POLL_TYPES } from './pollConstants';
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

export const UserPollVisibilitySchema = z.enum(['public', 'account_required']);
export type UserPollVisibility = z.infer<typeof UserPollVisibilitySchema>;

/** URL path segment for `/p/[code]`: 4–24 chars, letters/digits/internal dashes; must start/end alphanumeric. Case-sensitive. */
export const USER_POLL_CODE_REGEX = /^[A-Za-z0-9](?:[A-Za-z0-9-]{2,22})[A-Za-z0-9]$/;

export const UserPollCodeSchema = z.string().trim().regex(USER_POLL_CODE_REGEX, {
	message:
		'Koden ska vara 4–24 tecken. Tillåtet: bokstäver, siffror och bindestreck. Får inte börja eller sluta med bindestreck.',
});

export const PollResultVisibilitySchema = z.enum(POLL_RESULT_VISIBILITIES);
export type { PollResultVisibility } from './pollResultVisibility';

export const PollDraftOptionSchema = z
	.object({
		title: z.string(),
		description: z.union([z.string(), z.null()]).optional(),
	})
	.superRefine((o, ctx) => {
		if (o.title.trim() === ABSTAIN_OPTION_LABEL) {
			ctx.addIssue({
				code: 'custom',
				path: ['title'],
				message: `Alternativ får inte ha samma namn som avstår-alternativet (${ABSTAIN_OPTION_LABEL})`,
			});
		}
	})
	.transform((o) => ({
		title: o.title,
		description: o.description == null || o.description.trim() === '' ? null : o.description,
	}));

/** Raw poll draft fields (no visibility normalization). Use with superforms `zod4()`, `.extend()` for agenda, and `RefinePollDraftObjectSchema`. */
export const pollDraftObjectSchema = z.object({
	title: z.string().min(1),
	options: z.array(PollDraftOptionSchema).min(1),
	type: z.enum(POLL_TYPES),
	winningCount: z.number().min(1).optional(),
	majorityRule: z.enum(MAJORITY_RULES).optional(),
	resultVisibility: PollResultVisibilitySchema.optional(),
	isResultPublic: z.boolean().optional(),
	allowsAbstain: z.boolean().default(true),
	maxVotesPerVoter: z.number().min(1),
	visibilityMode: UserPollVisibilitySchema.optional(),
});

export type PollDraftInput = z.infer<typeof pollDraftObjectSchema>;

/**
 * Sync `resultVisibility` + `isResultPublic`. Superforms cannot derive a JSON shape from a top-level
 * Zod `.transform()` — use `pollDraftObjectSchema` with `zod4()` and call this after validation (or use `RefinePollDraftSchema` server-side).
 */
export function normalizePollDraftVisibility<T extends PollDraftInput>(
	data: T,
): T & { resultVisibility: PollResultVisibility; isResultPublic: boolean } {
	let visibility: PollResultVisibility | undefined = data.resultVisibility;
	if (visibility === undefined) {
		if (data.isResultPublic !== undefined) {
			visibility = data.isResultPublic ? 'full' : 'none';
		} else {
			visibility = 'none';
		}
	}
	return {
		...data,
		resultVisibility: visibility,
		isResultPublic: visibility === 'full',
	};
}

/** For partial poll edits (no visibility normalization). */
export const PollDraftPartialSchema = pollDraftObjectSchema.partial();

/** Flat poll type fields; use with `refinePollRowTypeConfig` when `options` is present (stored rows / inserts). */
export const pollTypeConfigZod = z.object({
	type: z.enum(POLL_TYPES),
	winningCount: z.number().min(1).optional(),
	majorityRule: z.enum(MAJORITY_RULES).optional(),
});

export type PollTypeConfig = z.infer<typeof pollTypeConfigZod>;

/** Shared `single_winner` / `multi_winner` checks for drafts vs stored rows (winningCount strictness differs). */
function refinePollTypeConfigCore(
	data: PollTypeConfig & { options: readonly { title: string }[] },
	ctx: z.RefinementCtx,
	mode: 'draftStrict' | 'rowLegacy',
) {
	const optionsCount = data.options.length;

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
		} else if (data.winningCount < 1 || data.winningCount > optionsCount) {
			ctx.addIssue({
				code: 'custom',
				path: ['winningCount'],
				message: 'Antal vinnare måste vara mellan 1 och antal alternativ',
			});
		}
	}
}

/** Shape-safe refinement for superforms (`zod4`) and agenda `.extend()`. */
function refinePollDraftObjectData(
	data: PollDraftInput & Record<string, unknown>,
	ctx: z.RefinementCtx,
) {
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

	for (const [i, o] of options.entries()) {
		if (o.title.trim().length < 1) {
			ctx.addIssue({
				code: 'custom',
				path: ['options', i, 'title'],
				message: 'Alternativtext krävs',
			});
		}
	}

	const titles = options.map((o) => o.title.trim());
	const set = new Set(titles.map((t) => t.toLocaleLowerCase()));

	if (set.size !== titles.length) {
		ctx.addIssue({
			code: 'custom',
			path: ['options'],
			message: 'Alternativ måste vara unika',
		});
	}
}

export const RefinePollDraftObjectSchema =
	pollDraftObjectSchema.superRefine(refinePollDraftObjectData);

function refineStandalonePollDraftCode(data: { code: string }, ctx: z.RefinementCtx) {
	const trimmed = data.code.trim();
	if (trimmed === '') {
		return;
	}
	const parsed = UserPollCodeSchema.safeParse(trimmed);
	if (!parsed.success) {
		for (const issue of parsed.error.issues) {
			ctx.addIssue({ ...issue, path: ['code'] });
		}
	}
}

/** Standalone `userPolls` draft: adds infosida flags (not used on meeting polls). */
export const standalonePollDraftObjectSchema = pollDraftObjectSchema.extend({
	infoPageEnabled: z.boolean().default(false),
	infoPageShowLiveVoteCounts: z.boolean().default(false),
	/** Empty → auto-generate on create. */
	code: z.string().default(''),
});

export const RefineStandalonePollDraftObjectSchema = standalonePollDraftObjectSchema.superRefine(
	(data, ctx) => {
		refinePollDraftObjectData(data, ctx);
		refineStandalonePollDraftCode(data, ctx);
	},
);

/** Partial edits for standalone polls (includes infosida fields). */
export const UserPollDraftPartialSchema = standalonePollDraftObjectSchema
	.partial()
	.superRefine((data, ctx) => {
		if (data.code === undefined) {
			return;
		}
		const trimmed = data.code.trim();
		if (trimmed === '') {
			return;
		}
		const parsed = UserPollCodeSchema.safeParse(trimmed);
		if (!parsed.success) {
			for (const issue of parsed.error.issues) {
				ctx.addIssue({ ...issue, path: ['code'] });
			}
		}
	});

/** Full draft parse for Convex / server (includes visibility normalization). */
export const RefinePollDraftSchema = RefinePollDraftObjectSchema.transform((d) =>
	normalizePollDraftVisibility(d),
);

/** Standalone user poll create payload (includes visibility normalization + infosida flags). */
export const RefineStandalonePollDraftSchema = RefineStandalonePollDraftObjectSchema.transform(
	(d) => {
		const normalized = normalizePollDraftVisibility(d);
		const trimmedCode = d.code.trim();
		if (trimmedCode === '') {
			const { code: _omit, ...rest } = normalized;
			return rest;
		}
		return { ...normalized, code: trimmedCode };
	},
);

export type PollDraft = z.infer<typeof RefinePollDraftSchema>;

type StandalonePollDraftConvex = z.infer<typeof RefineStandalonePollDraftSchema>;
/** Convex create/update payload; `code` only when set (otherwise auto-generated). Editor may always include optional `code`. */
export type StandalonePollDraft = Omit<StandalonePollDraftConvex, 'code'> & { code?: string };

/** Shape used by standalone `EditPoll` superform (includes `code: string`). */
export type StandalonePollDraftFormValues = z.infer<typeof standalonePollDraftObjectSchema>;

/** Enforces branch invariants given `options` (same rules as draft refine; allows stored single_winner without winningCount). */
export function refinePollRowTypeConfig(
	data: PollTypeConfig & { options: StoredPollOptions },
	ctx: z.RefinementCtx,
) {
	refinePollTypeConfigCore(data, ctx, 'rowLegacy');
}

/** Alias for `pollTypeConfigZod` (use with `refinePollRowTypeConfig` when building insert/row parsers). */
export const PollTypeSchema = pollTypeConfigZod;

const pollOptionRowZod = z
	.object({
		title: z.string().trim().min(1),
		description: z.union([z.string(), z.null()]).optional(),
	})
	.transform((o) => ({
		title: o.title,
		description: o.description == null || o.description.trim() === '' ? null : o.description,
	}));

/** Shared tail of meeting vs user poll rows (matches `pollRowSharedFields` in Convex). */
export const pollRowSharedZod = z.object({
	title: z.string().trim().min(1),
	options: z.array(pollOptionRowZod).min(1),
	/** @deprecated Prefer `resultVisibility`. Omitted on new rows when only `resultVisibility` is stored. */
	isResultPublic: z.boolean().optional(),
	resultVisibility: PollResultVisibilitySchema.optional(),
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
			refinePollRowTypeConfig(data as PollTypeConfig & { options: StoredPollOptions }, ctx),
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
		code: UserPollCodeSchema,
		ownerUserId: z.string().trim().min(1),
		visibilityMode: UserPollVisibilitySchema,
		infoPageEnabled: z.boolean().optional(),
		infoPageShowLiveVoteCounts: z.boolean().optional(),
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
	description: z.string().nullable().optional(),
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
