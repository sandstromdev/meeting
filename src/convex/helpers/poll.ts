import type { Doc, Id } from '$convex/_generated/dataModel';
import type { MutationCtx } from '$convex/_generated/server';
import { ABSTAIN_OPTION_LABEL } from '$lib/polls';
import type { StripSystemFields } from '$lib/types';
import type { PollDraft } from '$lib/validation';
import { stripSystemFields } from '.';
import { AppError, appErrors } from './error';
import { PollBaseSchema, PollTypeSchema, refinePollRowTypeConfig } from '$lib/validation';
import { findAgendaItemById, setPollIdsForItem } from './agenda';
import type { Db } from './types';
import { z } from 'zod';
import type { EditablePollDraft } from '$lib/components/blocks/admin/agenda/agenda';

export type OptionTotal = { optionIndex: number; option: string; votes: number };

type PollResultSnapshotData = StripSystemFields<Doc<'pollResults'>>;
type PollResultSnapshotArgs = {
	poll: Doc<'polls'>;
	complete: boolean;
	results: {
		optionTotals: OptionTotal[];
		winners: OptionTotal[];
		isTie: boolean;
		majorityRule: Doc<'pollResults'>['results']['majorityRule'] | null;
		counts: {
			totalVotes: number;
			eligibleVoters: number;
			usableVotes: number;
			abstain: number;
		};
	};
};

export function buildPollResultSnapshot(args: PollResultSnapshotArgs): PollResultSnapshotData {
	const { poll, complete, results } = args;

	return {
		meetingId: poll.meetingId,
		pollId: poll._id,
		closedAt: poll.closedAt ?? Date.now(),
		poll: stripSystemFields(poll),
		complete,
		results,
	} satisfies PollResultSnapshotData;
}

export async function getPollOrThrow(db: Db, pollId?: Id<'polls'>) {
	AppError.assertNotNull(pollId, appErrors.bad_request({ pollId }));

	const poll = await db.get('polls', pollId);

	AppError.assertNotNull(poll, appErrors.poll_not_found(pollId));

	return poll;
}

export async function getLatestPollResultSnapshot(db: Db, pollId: Id<'polls'>) {
	return db
		.query('pollResults')
		.withIndex('by_poll_and_closedAt', (q) => q.eq('pollId', pollId))
		.order('desc')
		.first();
}

export function assertPollInMeeting(
	poll: Pick<Doc<'polls'>, '_id' | 'meetingId'>,
	meetingId: Id<'meetings'>,
) {
	AppError.assert(poll.meetingId === meetingId, appErrors.poll_not_found(poll._id));
}

export function assertPollEditable(poll: Pick<Doc<'polls'>, 'isOpen'>) {
	AppError.assert(!poll.isOpen, appErrors.illegal_poll_action('edit_while_open'));
}
export function stripAbstain(optionTotals: OptionTotal[], allowsAbstain: boolean) {
	return allowsAbstain
		? optionTotals.filter((o) => o.option !== ABSTAIN_OPTION_LABEL)
		: optionTotals;
}
export function optionsWithAbstainLast(options: string[], allowsAbstain: boolean): string[] {
	const withoutAbstain = options.filter((o) => o !== ABSTAIN_OPTION_LABEL);
	return allowsAbstain ? [...withoutAbstain, ABSTAIN_OPTION_LABEL] : withoutAbstain;
}

export async function createPollHelper(
	ctx: MutationCtx & { meeting: Doc<'meetings'> },
	args: {
		draft: PollDraft;
		agendaItemId: string | null;
		updateAgenda: boolean;
	},
) {
	const agenda = ctx.meeting.agenda;

	const found = args.agendaItemId ? findAgendaItemById(agenda, args.agendaItemId) : null;

	if (args.agendaItemId && args.updateAgenda) {
		AppError.assertNotNull(found, appErrors.agenda_item_not_found(args.agendaItemId));
	}

	const draft = {
		...args.draft,
		meetingId: ctx.meeting._id,
		agendaItemId: args.agendaItemId,
		isOpen: false,
		updatedAt: Date.now(),
		openedAt: null,
		closedAt: null,
	};

	draft.options = optionsWithAbstainLast(draft.options, draft.allowsAbstain);

	const validated = PollBaseSchema.omit({ _id: true, _creationTime: true })
		.and(PollTypeSchema)
		.superRefine((data, ctx) => refinePollRowTypeConfig(data, ctx))
		.safeParse(draft);

	AppError.assertZodSuccess(validated, (e) => {
		console.log(z.prettifyError(e));
		return appErrors.invalid_poll_draft(e);
	});

	const pollId = await ctx.db.insert('polls', validated.data);

	if (found) {
		const nextAgenda = setPollIdsForItem(agenda, found.item.id, [...found.item.pollIds, pollId]);

		await ctx.db.patch('meetings', ctx.meeting._id, {
			agenda: nextAgenda,
		});
	}

	return pollId;
}
export function pollDraftChanged(
	draft: EditablePollDraft,
	originalPolls: ReadonlyMap<Id<'polls'>, EditablePollDraft>,
): boolean {
	if (!draft.id) {
		return false;
	}
	const orig = originalPolls.get(draft.id);
	if (!orig) {
		return false;
	}
	return (
		orig.title !== draft.title.trim() ||
		!optionsEqual(orig.options, draft.options) ||
		orig.type !== draft.type ||
		orig.winningCount !== draft.winningCount ||
		orig.majorityRule !== draft.majorityRule ||
		orig.isResultPublic !== draft.isResultPublic ||
		orig.allowsAbstain !== draft.allowsAbstain ||
		orig.maxVotesPerVoter !== draft.maxVotesPerVoter
	);
}
function normalizeOptions(options: string[]): string[] {
	return options.map((x) => x.trim()).filter(Boolean);
}
function optionsEqual(a: string[], b: string[]) {
	const na = normalizeOptions(a);
	const nb = normalizeOptions(b);
	return na.length === nb.length && na.every((x, i) => x === nb[i]);
}
