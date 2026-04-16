import type { Doc, Id } from '$convex/_generated/dataModel';
import type { MutationCtx } from '$convex/_generated/server';
import { optionsWithAbstainLastRows, type PollOptionRow } from '$lib/pollOptions';
import { getEligibleVotes, type MajorityRule, type MeetingPollDraft } from '$lib/polls';
import type { StripSystemFields } from '$lib/types';
import type { PollDraft } from '$lib/validation';
import { PollBaseSchema, PollTypeSchema, refinePollRowTypeConfig } from '$lib/validation';
import { z } from 'zod';
import { stripSystemFields } from '.';
import { findAgendaItemById, setPollIdsForItem } from './agenda';
import { AppError, appErrors } from './error';
import type { PollOptionTotal } from './poll';
import type { Db } from './types';

export type OptionTotal = PollOptionTotal;

type MeetingPollResultSnapshotData = StripSystemFields<Doc<'meetingPollResults'>>;
type MeetingPollResultSnapshotArgs = {
	poll: Doc<'meetingPolls'>;
	complete: boolean;
	results: {
		optionTotals: OptionTotal[];
		winners: OptionTotal[];
		isTie: boolean;
		majorityRule: MajorityRule | null;
		counts: {
			totalVotes: number;
			eligibleVoters: number;
			usableVotes: number;
			abstain: number;
		};
	};
};

export function buildMeetingPollResultSnapshot(
	args: MeetingPollResultSnapshotArgs,
): MeetingPollResultSnapshotData {
	const { poll, complete, results } = args;

	return {
		meetingId: poll.meetingId,
		pollId: poll._id,
		closedAt: poll.closedAt ?? Date.now(),
		poll: stripSystemFields(poll),
		complete,
		results,
	} satisfies MeetingPollResultSnapshotData;
}

export async function getMeetingPollOrThrow(db: Db, pollId?: Id<'meetingPolls'>) {
	AppError.assertNotNull(pollId, appErrors.bad_request({ pollId }));

	const poll = await db.get('meetingPolls', pollId);

	AppError.assertNotNull(poll, appErrors.meeting_poll_not_found(pollId));

	return poll;
}

export async function getLatestMeetingPollResultSnapshot(db: Db, pollId: Id<'meetingPolls'>) {
	return db
		.query('meetingPollResults')
		.withIndex('by_poll_and_closedAt', (q) => q.eq('pollId', pollId))
		.order('desc')
		.first();
}

export function assertMeetingPollInMeeting(
	poll: Pick<Doc<'meetingPolls'>, '_id' | 'meetingId'>,
	meetingId: Id<'meetings'>,
) {
	AppError.assert(poll.meetingId === meetingId, appErrors.meeting_poll_not_found(poll._id));
}

export function assertMeetingPollEditable(poll: Pick<Doc<'meetingPolls'>, 'isOpen'>) {
	AppError.assert(!poll.isOpen, appErrors.illegal_meeting_poll_action('edit_while_open'));
}
export function stripAbstain(optionTotals: OptionTotal[], allowsAbstain: boolean) {
	return getEligibleVotes(optionTotals, allowsAbstain);
}
/** @deprecated Prefer `optionsWithAbstainLastRows` from `$lib/pollOptions`. */
export function optionsWithAbstainLast(
	options: PollOptionRow[],
	allowsAbstain: boolean,
): PollOptionRow[] {
	return optionsWithAbstainLastRows(options, allowsAbstain);
}

export async function createMeetingPollHelper(
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

	draft.options = optionsWithAbstainLastRows(draft.options, draft.allowsAbstain);

	const validated = PollBaseSchema.omit({ _id: true, _creationTime: true })
		.and(PollTypeSchema)
		.superRefine((data, ctx) => refinePollRowTypeConfig(data, ctx))
		.safeParse(draft);

	AppError.assertZodSuccess(validated, (e) => {
		console.log(z.prettifyError(e));
		return appErrors.invalid_poll_draft(e);
	});

	const pollId = await ctx.db.insert('meetingPolls', validated.data);

	if (found) {
		const nextAgenda = setPollIdsForItem(agenda, found.item.id, [...found.item.pollIds, pollId]);

		await ctx.db.patch('meetings', ctx.meeting._id, {
			agenda: nextAgenda,
		});
	}

	return pollId;
}
export function meetingPollDraftChanged(
	draft: MeetingPollDraft,
	originalPolls: ReadonlyMap<Id<'meetingPolls'>, MeetingPollDraft>,
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
function normalizeOptionRows(rows: PollOptionRow[]): PollOptionRow[] {
	return rows
		.map((x) => ({
			title: x.title.trim(),
			description:
				x.description == null || x.description.trim() === '' ? null : x.description.trim(),
		}))
		.filter((x) => x.title.length > 0);
}
function optionsEqual(a: PollOptionRow[], b: PollOptionRow[]) {
	const na = normalizeOptionRows(a);
	const nb = normalizeOptionRows(b);
	return (
		na.length === nb.length &&
		na.every(
			(x, i) => x.title === nb[i].title && (x.description ?? null) === (nb[i].description ?? null),
		)
	);
}
