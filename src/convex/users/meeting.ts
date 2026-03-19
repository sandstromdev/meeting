import { authed, withMe, withMeeting } from '$convex/helpers/auth';
import { getMeetingParticipant } from '$convex/helpers/meeting';
import { zid } from 'convex-helpers/server/zod4';

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
