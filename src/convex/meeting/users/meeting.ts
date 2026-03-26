import { authed, withMe, withMeeting } from '$convex/helpers/auth';
import { AppError, appErrors } from '$convex/helpers/error';
import { getMeetingParticipant } from '$convex/helpers/meeting';
import { assertMeetingNotArchived } from '$convex/helpers/meetingLifecycle';
import { zid } from 'convex-helpers/server/zod4';

// --- Public queries ---

export const getMeeting = withMeeting.query().public(async ({ ctx }) => {
	const { meeting } = ctx;
	return meeting;
});

export const getMe = authed
	.input({ meetingId: zid('meetings') })
	.query()
	.public(async ({ ctx, args }) => {
		const meeting = await ctx.db.get('meetings', args.meetingId);
		AppError.assertNotNull(meeting, appErrors.meeting_not_found(args));
		assertMeetingNotArchived(meeting);
		return getMeetingParticipant(ctx, args.meetingId);
	});

export const getData = withMe.query().public(async ({ ctx }) => {
	const { me, meeting } = ctx;

	if (
		(me.role === 'participant' || me.role === 'adjuster') &&
		meeting.startedAt &&
		meeting.startedAt > Date.now()
	) {
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
	const flat = agenda;

	const hasValidCurrentAgendaItem = flat.some((item) => item.id === meeting.currentAgendaItemId);
	const currentAgendaItemId = hasValidCurrentAgendaItem ? meeting.currentAgendaItemId : flat[0]?.id;

	return {
		meeting: {
			...meeting,
			agenda: agenda,
			currentAgendaItemId,
		},
		me,
		hasPendingReturnRequest: !!(me.absentSince && me.returnRequestedAt),
	};
});
