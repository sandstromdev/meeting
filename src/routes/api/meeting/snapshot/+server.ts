import { api } from '$convex/_generated/api';
import { getConvexClient } from '$lib/server/convex';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ConvexError } from 'convex/values';
import { AppError, errors, getAppError } from '$convex/helpers/error';

export const GET = (async ({ locals }) => {
	if (!locals.meetingId) {
		return new Response('Unauthorized', { status: 401 });
	}

	console.log({
		locals,
	});

	const convex = getConvexClient();
	try {
		const meeting = await convex.query(api.users.meeting.getMeeting, {
			meetingId: locals.meetingId,
		});

		if (!meeting) {
			return new AppError(errors.meeting_not_found({ meetingId: locals.meetingId })).toResponse(
				'json',
			);
		}

		const absenceEntries = await convex
			.query(api.admin.meeting.getAbsenceEntries, { meetingId: locals.meetingId })
			.then((e) =>
				e.map((entry) => ({
					name: entry.name,
					startTime: Math.max(entry.startTime, meeting.startedAt ?? 0),
					endTime: entry.endTime,
				})),
			);

		const participants = await convex
			.query(api.admin.users.getParticipants, {
				meetingId: locals.meetingId,
			})
			.then((r) =>
				r.map((user) => ({
					name: user.name,
					role: user.role,
					banned: user.banned,
					joinedAt: Math.max(user.joinedAt, meeting.startedAt ?? 0),
				})),
			);

		const polls = await convex
			.query(api.admin.poll.getAllPolls, { meetingId: locals.meetingId })
			// oxlint-disable-next-line no-unused-vars
			.then((r) => r.map(({ _creationTime, isOpen, meetingId, updatedAt, ...poll }) => poll));

		const results = await convex.query(api.admin.poll.getAllResults, {
			meetingId: locals.meetingId,
		});

		const speakerLog = await convex.query(api.admin.meeting.getSpeakerLogEntries, {
			meetingId: locals.meetingId,
		});

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
			absenceEntries,
			speakerLog,
		});
	} catch (error) {
		const appError = getAppError(error);
		if (appError) {
			return appError.toResponse('json');
		}
		console.error('Internal error:', error);
		return new AppError(errors.internal_error).toResponse('json');
	}
}) satisfies RequestHandler;
