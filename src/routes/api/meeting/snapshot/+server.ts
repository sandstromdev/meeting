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

	const polls = await convex
		.query(api.admin.poll.getAllPolls, { meetingId: locals.meetingId })
		// oxlint-disable-next-line no-unused-vars
		.then((r) => r.map(({ _creationTime, isOpen, meetingId, updatedAt, ...poll }) => poll));

	const results = await convex.query(api.admin.poll.getAllResults, { meetingId: locals.meetingId });

	const agenda = meeting.agenda.map((item) =>
		Object.assign(item, {
			pollIds: undefined,
			polls: polls
				.filter((poll) => poll.agendaItemId === item.id || item.pollIds.includes(poll._id))
				.map((poll) =>
					Object.assign(poll, {
						result: results.find((result) => result.pollId === poll._id) ?? null,
					}),
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
		polls,
		participants,
	});
}) satisfies RequestHandler;
