import { authed, withMe, withMeeting } from '$convex/helpers/auth';
import { type AgendaItem, flattenAgenda } from '$convex/helpers/agenda';
import { getMeetingParticipant } from '$convex/helpers/meeting';
import { zid } from 'convex-helpers/server/zod4';

type HydratedPoll = {
	id: string;
	title: string;
	options: string[];
	type: string;
	winningCount: number;
	majorityRule?: string;
	allowsAbstain: boolean;
	maxVotesPerVoter: number;
	resultsPublic: boolean;
	isOpen: boolean;
	openedAt?: number;
	closedAt?: number;
	votesCount: number;
	votersCount: number;
	eligibleVoters: number;
	hasVoted: boolean;
	myVoteOptionIndexes: number[];
	optionTotals?: { optionIndex: number; option: string; votes: number }[];
	winnerOptionIndexes: number[];
	isTie: boolean;
};

type AgendaItemWithPolls = AgendaItem & {
	polls: HydratedPoll[];
	items: AgendaItemWithPolls[];
};

function getPollMaxVotesPerVoter(poll: {
	type: 'single_winner' | 'multi_winner';
	maxVotesPerVoter: number;
	options: string[];
}): number {
	if (poll.type === 'single_winner') {
		return 1;
	}
	const configured = Math.floor(poll.maxVotesPerVoter);
	return Math.max(1, Math.min(configured, poll.options.length));
}

function computeWinners(
	poll: {
		type: 'single_winner' | 'multi_winner';
		winningCount: number;
		majorityRule: 'simple' | 'two_thirds' | 'three_quarters' | 'unanimous';
	},
	optionTotals: { optionIndex: number; option: string; votes: number }[],
	votesCast: number,
): { winnerOptionIndexes: number[]; isTie: boolean } {
	if (optionTotals.length === 0 || votesCast === 0) {
		return { winnerOptionIndexes: [], isTie: false };
	}
	if (poll.type === 'multi_winner') {
		const count = Math.max(1, Math.min(poll.winningCount, optionTotals.length));
		const sorted = [...optionTotals].toSorted((a, b) => b.votes - a.votes);
		const thresholdVotes = sorted[count - 1]?.votes ?? 0;
		const winners = sorted.filter((o) => o.votes >= thresholdVotes).map((o) => o.optionIndex);
		const lastWinnerVotes = sorted[count - 1]?.votes;
		const isTie =
			lastWinnerVotes != null && sorted.filter((o) => o.votes === lastWinnerVotes).length > 1;
		return { winnerOptionIndexes: winners, isTie };
	}
	const threshold =
		poll.majorityRule === 'simple'
			? 0.5
			: poll.majorityRule === 'two_thirds'
				? 2 / 3
				: poll.majorityRule === 'three_quarters'
					? 0.75
					: 1;
	const minVotes =
		poll.majorityRule === 'simple'
			? Math.floor(votesCast * threshold) + 1
			: Math.ceil(votesCast * threshold);
	const meetingThreshold = optionTotals.filter((o) => o.votes >= minVotes);
	const sorted = [...meetingThreshold].toSorted((a, b) => b.votes - a.votes);
	const topVotes = sorted[0]?.votes;
	if (topVotes == null) {
		return { winnerOptionIndexes: [], isTie: false };
	}
	const winners = sorted.filter((o) => o.votes === topVotes).map((o) => o.optionIndex);
	return {
		winnerOptionIndexes: winners,
		isTie: winners.length > 1,
	};
}

export const getMeeting = withMeeting.query().public(async ({ ctx }) => {
	const { meeting } = ctx;
	return meeting;
});

export const getMe = authed
	.input({ meetingId: zid('meetings') })
	.query()
	.public(async ({ ctx, args }) => {
		return getMeetingParticipant(ctx, args.meetingId);
	});

export const getData = withMe.query().public(async ({ ctx }) => {
	const { me, meeting } = ctx;

	if (me.role === 'participant' && meeting.startedAt && meeting.startedAt > Date.now()) {
		return {
			meeting: {
				...meeting,
				agenda: [],
			},
			me,
			hasPendingReturnRequest: false,
		};
	}

	const agenda = meeting.agenda;
	const flat = flattenAgenda(agenda);
	const hasValidCurrentAgendaItem = flat.some((item) => item.id === meeting.currentAgendaItemId);
	const currentAgendaItemId = hasValidCurrentAgendaItem ? meeting.currentAgendaItemId : flat[0]?.id;

	const eligibleVoters = Math.max(0, (meeting.participants ?? 0) - (meeting.absent ?? 0));

	async function hydratePollsForItem(item: AgendaItem): Promise<AgendaItemWithPolls> {
		const isCurrentItem = currentAgendaItemId != null && item.id === currentAgendaItemId;

		const polls = await Promise.all(
			item.pollIds.map(async (pollId) => {
				const poll = await ctx.db.get('polls', pollId);
				if (!poll || poll.meetingId !== meeting._id) {
					return null;
				}

				const maxVotesPerVoter = getPollMaxVotesPerVoter(poll);

				if (!isCurrentItem) {
					return {
						id: poll._id,
						title: poll.title,
						options: poll.options,
						type: poll.type,
						winningCount: poll.type === 'multi_winner' ? poll.winningCount : 1,
						majorityRule: poll.type === 'single_winner' ? poll.majorityRule : undefined,
						allowsAbstain: poll.allowsAbstain,
						maxVotesPerVoter,
						resultsPublic: poll.isResultPublic,
						isOpen: poll.isOpen,
						openedAt: poll.openedAt,
						closedAt: poll.closedAt,
						votesCount: 0,
						votersCount: 0,
						eligibleVoters,
						hasVoted: false,
						myVoteOptionIndexes: [],
						optionTotals: undefined,
						winnerOptionIndexes: [],
						isTie: false,
					};
				}

				const votes = await ctx.db
					.query('pollVotes')
					.withIndex('by_poll', (q) => q.eq('pollId', poll._id))
					.collect();
				const votesCount = votes.length;
				const votersCount = new Set(votes.map((vote) => vote.userId)).size;
				const myVoteOptionIndexes = votes
					.filter((vote) => vote.userId === me._id)
					.map((vote) => vote.optionIndex)
					.toSorted((a, b) => a - b);
				const hasVoted = myVoteOptionIndexes.length > 0;

				const maySeeResults = poll.isResultPublic === true || me.role === 'admin';
				const optionTotals =
					poll.isOpen || !maySeeResults
						? undefined
						: poll.options.map((option, optionIndex) => ({
								optionIndex,
								option,
								votes: votes.filter((vote) => vote.optionIndex === optionIndex).length,
							}));
				const { winnerOptionIndexes, isTie } =
					optionTotals != null
						? computeWinners(poll, optionTotals, votesCount)
						: { winnerOptionIndexes: [] as number[], isTie: false };

				return {
					id: poll._id,
					title: poll.title,
					options: poll.options,
					type: poll.type,
					winningCount: poll.type === 'multi_winner' ? poll.winningCount : 1,
					majorityRule: poll.type === 'single_winner' ? poll.majorityRule : undefined,
					allowsAbstain: poll.allowsAbstain,
					maxVotesPerVoter,
					resultsPublic: poll.isResultPublic,
					isOpen: poll.isOpen,
					openedAt: poll.openedAt,
					closedAt: poll.closedAt,
					votesCount,
					votersCount,
					eligibleVoters,
					hasVoted,
					myVoteOptionIndexes,
					optionTotals,
					winnerOptionIndexes,
					isTie,
				};
			}),
		);

		const items: AgendaItemWithPolls[] = await Promise.all(
			item.items.map((child) => hydratePollsForItem(child)),
		);

		return {
			...item,
			polls: polls.filter((p): p is NonNullable<typeof p> => p !== null),
			items,
		};
	}

	const agendaWithPolls = await Promise.all(agenda.map((item) => hydratePollsForItem(item)));

	return {
		meeting: {
			...meeting,
			agenda: agendaWithPolls,
			currentAgendaItemId,
		},
		me,
		hasPendingReturnRequest: !!(me.absentSince && me.returnRequestedAt),
	};
});
