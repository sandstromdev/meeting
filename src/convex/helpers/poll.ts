import type { Doc, Id } from '$convex/_generated/dataModel';
import type { MutationCtx, QueryCtx } from '$convex/_generated/server';
import { AppError, errors } from './error';

type Db = QueryCtx['db'];

export function createAgendaItemId() {
	return `agenda_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeAgendaItems(agenda: Doc<'meetings'>['agenda']) {
	return agenda.map((item, index) => {
		const raw = item as Partial<{
			id: string;
			number: number;
			title: string;
			pollIds: Id<'polls'>[];
		}>;

		return {
			id: raw.id && raw.id.length > 0 ? raw.id : createAgendaItemId(),
			number: index + 1,
			title: raw.title ?? `Punkt ${index + 1}`,
			pollIds: Array.isArray(raw.pollIds) ? raw.pollIds : [],
		};
	});
}

export function findAgendaItemIndex(agenda: Doc<'meetings'>['agenda'], agendaItemId: string) {
	return agenda.findIndex((item) => item.id === agendaItemId);
}

export async function getPollOrThrow(db: Db, pollId: Id<'polls'>) {
	const poll = await db.get('polls', pollId);
	if (!poll) {
		throw new AppError(errors.poll_not_found(pollId));
	}
	return poll;
}

export function assertPollInMeeting(
	poll: Pick<Doc<'polls'>, '_id' | 'meetingId'>,
	meetingId: Id<'meetings'>,
) {
	if (poll.meetingId !== meetingId) {
		throw new AppError(errors.poll_not_found(poll._id));
	}
}

export function assertPollOptionIndex(poll: Pick<Doc<'polls'>, 'options'>, optionIndex: number) {
	if (optionIndex < 0 || optionIndex >= poll.options.length) {
		throw new AppError(errors.invalid_poll_option(optionIndex));
	}
}

export function assertPollEditable(poll: Pick<Doc<'polls'>, 'isOpen'>) {
	if (poll.isOpen) {
		throw new AppError(errors.illegal_poll_action('edit_while_open'));
	}
}

export function getEligibleVoterCount(meeting: Pick<Doc<'meetings'>, 'participants' | 'absent'>) {
	return Math.max(0, (meeting.participants ?? 0) - (meeting.absent ?? 0));
}

export async function countVotesForPoll(db: Db, pollId: Id<'polls'>) {
	const votes = await db
		.query('pollVotes')
		.withIndex('by_poll', (q) => q.eq('pollId', pollId))
		.collect();
	return votes.length;
}

export async function getVoteByAnonId(db: Db, pollId: Id<'polls'>, anonID: number) {
	return db
		.query('pollVotes')
		.withIndex('by_poll_anon', (q) => q.eq('pollId', pollId).eq('anonID', anonID))
		.first();
}

export async function closePoll(
	db: MutationCtx['db'],
	pollId: Id<'polls'>,
	opts?: { closedBy?: Id<'meetingParticipants'> },
) {
	await db.patch('polls', pollId, {
		isOpen: false,
		closedAt: Date.now(),
		closedBy: opts?.closedBy,
		updatedAt: Date.now(),
	});
}

export async function closePollIfAllEligibleHaveVoted(
	db: MutationCtx['db'],
	meeting: Pick<Doc<'meetings'>, 'participants' | 'absent'>,
	pollId: Id<'polls'>,
) {
	const eligibleVoters = getEligibleVoterCount(meeting);
	const votesCount = await countVotesForPoll(db, pollId);

	if (eligibleVoters > 0 && votesCount >= eligibleVoters) {
		await closePoll(db, pollId);
		return true;
	}

	return false;
}
