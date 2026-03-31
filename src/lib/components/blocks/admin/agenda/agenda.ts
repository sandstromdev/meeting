import { api } from '$convex/_generated/api';
import type { Doc, TableNames } from '$convex/_generated/dataModel';
import type { MeetingState } from '$lib/context.svelte';
import { ABSTAIN_OPTION_LABEL, type MeetingPollDraft } from '$lib/polls';
import { RefinePollDraftSchema, type PollDraft } from '$lib/validation';

export async function createAgendaItem(
	meeting: Pick<MeetingState, 'adminMutate'>,
	args: {
		title: string;
		parentId?: string;
		polls: MeetingPollDraft[];
	},
) {
	const polls = RefinePollDraftSchema.array().parse(args.polls);

	const data = await meeting.adminMutate(api.meeting.admin.agenda.createAgendaItem, {
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
		polls: MeetingPollDraft[];
	},
) {
	const data = await meeting.adminMutate(api.meeting.admin.agenda.updateAgendaItem, {
		agendaItemId: args.agendaItemId,
		title: args.title,
		polls: args.polls,
	});

	return data;
}
