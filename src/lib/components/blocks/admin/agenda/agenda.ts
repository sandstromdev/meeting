import { api } from '$convex/_generated/api';
import type { MeetingState } from '$lib/context.svelte';
import { type MeetingPollDraft } from '$lib/polls';
import { RefinePollDraftSchema } from '$lib/validation';

export async function createAgendaItem(
	meeting: Pick<MeetingState, 'adminMutate'>,
	args: {
		title: string;
		description?: string;
		parentId?: string;
		polls: MeetingPollDraft[];
	},
) {
	const polls = RefinePollDraftSchema.array().parse(args.polls);

	const data = await meeting.adminMutate(api.meeting.admin.agenda.createAgendaItem, {
		title: args.title,
		description: args.description,
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
		description?: string;
		allowMotions?: boolean;
		motionSubmissionMode?: 'open' | 'amendments_only';
		polls: MeetingPollDraft[];
	},
) {
	const data = await meeting.adminMutate(api.meeting.admin.agenda.updateAgendaItem, {
		agendaItemId: args.agendaItemId,
		title: args.title,
		description: args.description,
		allowMotions: args.allowMotions,
		motionSubmissionMode: args.motionSubmissionMode,
		polls: args.polls,
	});

	return data;
}
