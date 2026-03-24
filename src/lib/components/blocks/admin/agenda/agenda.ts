import { api } from '$convex/_generated/api';
import type { Doc, Id } from '$convex/_generated/dataModel';
import type { MeetingState } from '$lib/context.svelte';
import { ABSTAIN_OPTION_LABEL } from '$lib/polls';
import { RefinePollDraftSchema, type PollDraft } from '$lib/validation';

export type EditablePollDraft = PollDraft & { id?: Id<'polls'> };

export function newPollDraft(): PollDraft {
	return {
		title: '',
		options: ['', ''],
		type: 'single_winner',
		winningCount: 1,
		majorityRule: 'simple',
		isResultPublic: false,
		allowsAbstain: true,
		maxVotesPerVoter: 1,
	} satisfies PollDraft;
}

export const POLL_PRESETS = [
	{
		name: 'Ja/nej-omröstning',
		preset: () =>
			({
				...newPollDraft(),
				options: ['Ja', 'Nej'],
				type: 'single_winner',
				majorityRule: 'simple',
				allowsAbstain: true,
			}) satisfies PollDraft,
	},
	{
		name: 'Personvalsomröstning',
		preset: () =>
			({
				...newPollDraft(),
				type: 'multi_winner',
				winningCount: 1,
				majorityRule: 'simple',
				allowsAbstain: true,
			}) satisfies PollDraft,
	},
];

export function hydratePollRowToDraft(p: Doc<'polls'>) {
	const opts = [...p.options];
	const options =
		p.allowsAbstain && opts[opts.length - 1] === ABSTAIN_OPTION_LABEL ? opts.slice(0, -1) : opts;

	return {
		id: p._id,
		title: p.title,
		options,
		type: p.type,
		winningCount: p.type === 'multi_winner' ? p.winningCount : 1,
		majorityRule: p.type === 'single_winner' ? p.majorityRule : 'simple',
		isResultPublic: p.isResultPublic,
		allowsAbstain: p.allowsAbstain,
		maxVotesPerVoter: p.maxVotesPerVoter,
	} satisfies EditablePollDraft;
}

export function trimmedPollOptions(draft: Pick<PollDraft, 'options'>): string[] {
	return draft.options.map((o) => o.trim()).filter(Boolean);
}

export async function createAgendaItem(
	meeting: Pick<MeetingState, 'adminMutate'>,
	args: {
		title: string;
		parentId?: string;
		polls: EditablePollDraft[];
	},
) {
	const polls = RefinePollDraftSchema.array().parse(args.polls);

	const data = await meeting.adminMutate(api.admin.agenda.createAgendaItem, {
		title: args.title,
		parentId: args.parentId,
		polls,
	});

	return {
		success: true,
		data,
	};
}

export async function updateAgendaItem(
	meeting: Pick<MeetingState, 'adminMutate'>,
	args: {
		agendaItemId: string;
		title: string;
		polls: EditablePollDraft[];
	},
) {
	const data = await meeting.adminMutate(api.admin.agenda.updateAgendaItem, {
		agendaItemId: args.agendaItemId,
		title: args.title,
		polls: args.polls,
	});

	return data;
}
