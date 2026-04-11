import type { Doc, Id } from '$convex/_generated/dataModel';
import type { MutationCtx } from '$convex/_generated/server';
import {
	agendaItemMotionSettings,
	findAgendaItemById,
	type AgendaItemId,
} from '$convex/helpers/agenda';
import { AppError, appErrors } from '$convex/helpers/error';
import { createMeetingPollHelper } from '$convex/helpers/meetingPoll';
import { POLL_PRESETS } from '$lib/polls';
import type { PollDraft } from '$lib/validation';

export function resolveCurrentAgendaItemId(meeting: Doc<'meetings'>): AgendaItemId | null {
	const flat = meeting.agenda;
	if (flat.length === 0) {
		return null;
	}
	const hasValid =
		meeting.currentAgendaItemId != null && flat.some((i) => i.id === meeting.currentAgendaItemId);
	if (hasValid && meeting.currentAgendaItemId != null) {
		return meeting.currentAgendaItemId;
	}
	const head = flat[0];
	return head?.id ?? null;
}

export function buildMotionVotePollDraft(motionTitle: string): PollDraft {
	const preset = POLL_PRESETS[0];
	if (!preset) {
		throw new Error('POLL_PRESETS is empty');
	}
	const base = preset.preset();
	const title = motionTitle.trim().slice(0, 200);
	return {
		...base,
		title: title.length > 0 ? title : 'Yrkande',
	};
}

export async function createPollForApprovedMotion(
	ctx: MutationCtx & { meeting: Doc<'meetings'> },
	args: { agendaItemId: string; motionTitle: string },
): Promise<Id<'meetingPolls'>> {
	const draft = buildMotionVotePollDraft(args.motionTitle);
	return await createMeetingPollHelper(ctx, {
		draft,
		agendaItemId: args.agendaItemId,
		updateAgenda: true,
	});
}

export async function getValidAmendmentParent(
	ctx: MutationCtx,
	meetingId: Id<'meetings'>,
	currentAgendaItemId: AgendaItemId,
	amendsMotionId: Id<'meetingMotions'>,
): Promise<Doc<'meetingMotions'> | null> {
	const parent = await ctx.db.get('meetingMotions', amendsMotionId);
	if (!parent) {
		return null;
	}
	if (parent.meetingId !== meetingId) {
		return null;
	}
	if (parent.agendaItemId !== currentAgendaItemId) {
		return null;
	}
	if (parent.status !== 'approved') {
		return null;
	}
	return parent;
}

export async function ensureMotionParentForAmendment(
	ctx: MutationCtx,
	meetingId: Id<'meetings'>,
	currentAgendaItemId: AgendaItemId,
	amendsMotionId: Id<'meetingMotions'>,
) {
	const parent = await getValidAmendmentParent(ctx, meetingId, currentAgendaItemId, amendsMotionId);
	AppError.assertNotNull(parent, appErrors.bad_request({ reason: 'motion_parent_invalid' }));
	return parent;
}

export type PreparedParticipantMotion = {
	agendaItemId: AgendaItemId;
	title: string;
	text: string;
	amendsMotionId?: Id<'meetingMotions'>;
};

export async function prepareParticipantMotionSubmission(
	ctx: MutationCtx,
	args: {
		meeting: Doc<'meetings'>;
		me: Doc<'meetingParticipants'>;
		title?: string;
		text: string;
		amendsMotionId?: Id<'meetingMotions'>;
	},
): Promise<PreparedParticipantMotion | null> {
	const { meeting, me } = args;

	if (!meeting.isOpen) {
		return null;
	}
	if (me.absentSince) {
		return null;
	}

	const currentId = resolveCurrentAgendaItemId(meeting);
	if (!currentId) {
		return null;
	}

	const found = findAgendaItemById(meeting.agenda, currentId);
	if (!found) {
		return null;
	}

	const settings = agendaItemMotionSettings(found.item);
	if (!settings.allowMotions) {
		return null;
	}

	const text = args.text.trim();
	if (!text) {
		return null;
	}

	const amendId = args.amendsMotionId;
	const hasAmend = amendId != null;

	if (settings.motionSubmissionMode === 'amendments_only' && !hasAmend) {
		return null;
	}

	if (!hasAmend) {
		const title = (args.title ?? '').trim();
		if (!title) {
			return null;
		}
		return {
			agendaItemId: currentId,
			title,
			text,
		};
	}

	const parent = await getValidAmendmentParent(ctx, meeting._id, currentId, amendId);
	if (!parent) {
		return null;
	}

	const title = (args.title ?? '').trim() || `Tillägg till ${parent.title.trim() || 'yrkande'}`;

	return {
		agendaItemId: currentId,
		title,
		text,
		amendsMotionId: amendId,
	};
}
