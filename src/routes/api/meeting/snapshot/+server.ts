import { api } from '$convex/_generated/api';
import { getConvexClient } from '$lib/server/convex';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET = (async ({ locals }) => {
	if (!locals.meetingId) {
		return new Response('Unauthorized', { status: 401 });
	}

	const convex = getConvexClient();

	const meeting = await convex.query(api.users.meeting.getMeeting, { meetingId: locals.meetingId });

	if (!meeting) {
		return new Response('Meeting not found', { status: 404 });
	}

	const participants = await convex
		.query(api.admin.users.getParticipants, {
			meetingId: locals.meetingId,
		})
		.then((r) =>
			r.map((user) => ({
				name: user.name,
				role: user.role,
				banned: user.banned,
			})),
		);

	const polls = await convex.query(api.admin.poll.getAllResults, { meetingId: locals.meetingId });

	const agenda = meeting.agenda.map((item) =>
		Object.assign(item, {
			polls: polls.filter(
				(poll) => poll.poll.agendaItemId === item.id || item.pollIds.includes(poll.pollId),
			),
		}),
	);

	return json({
		meeting: {
			_creationTime: meeting._creationTime,
			_id: meeting._id,
			code: meeting.code,
			date: meeting.date,
			title: meeting.title,
			startedAt: meeting.startedAt,
			agenda,
		},
		participants,
	});
}) satisfies RequestHandler;
