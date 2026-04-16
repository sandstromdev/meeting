import type { Doc, Id } from '@lsnd/convex/_generated/dataModel';
import type { QueryCtx } from '@lsnd/convex/_generated/server';

type PollDoc = Doc<'meetingPolls'>;
type PollResultDoc = Doc<'meetingPollResults'>;

function stripPollForSnapshot(poll: PollDoc) {
	// oxlint-disable-next-line no-unused-vars
	const { _creationTime, isOpen, meetingId, updatedAt, ...rest } = poll;
	return rest;
}

/** Same JSON shape as `GET /api/meeting/snapshot` (SvelteKit). */
export async function buildMeetingSnapshotPayload(
	ctx: QueryCtx,
	meeting: Doc<'meetings'>,
): Promise<{
	meeting: {
		_creationTime: number;
		_id: Id<'meetings'>;
		code: string;
		date: number;
		title: string;
		startedAt: number | null;
		agenda: Array<
			Doc<'meetings'>['agenda'][number] & {
				pollIds: undefined;
				polls: Array<
					ReturnType<typeof stripPollForSnapshot> & {
						result: PollResultDoc | null;
					}
				>;
			}
		>;
	};
	polls: ReturnType<typeof stripPollForSnapshot>[];
	participants: Array<{
		name: string;
		role: Doc<'meetingParticipants'>['role'];
		banned: boolean;
		joinedAt: number;
	}>;
	absenceEntries: Array<{ name: string; startTime: number; endTime: number | null }>;
	speakerLog: Array<{
		type: Doc<'speakerLogEntries'>['type'];
		name: string;
		startTime: number;
		endTime: number;
	}>;
}> {
	const meetingId = meeting._id;
	const startedFloor = meeting.startedAt ?? 0;

	const [absenceRows, participantsRows, polls, results, speakerRows] = await Promise.all([
		ctx.db
			.query('absenceEntries')
			.withIndex('by_meeting_startTime', (q) => q.eq('meetingId', meetingId))
			.order('desc')
			.take(100),
		ctx.db
			.query('meetingParticipants')
			.withIndex('by_meeting', (q) => q.eq('meetingId', meetingId))
			.take(500),
		ctx.db
			.query('meetingPolls')
			.withIndex('by_meeting', (q) => q.eq('meetingId', meetingId))
			.collect(),
		ctx.db
			.query('meetingPollResults')
			.withIndex('by_meeting_and_poll_and_closedAt', (q) => q.eq('meetingId', meetingId))
			.collect(),
		ctx.db
			.query('speakerLogEntries')
			.withIndex('by_meeting_endTime', (q) => q.eq('meetingId', meetingId))
			.order('desc')
			.collect(),
	]);

	const absenceEntries = absenceRows.map((entry) => ({
		name: entry.name,
		startTime: Math.max(entry.startTime, startedFloor),
		endTime: entry.endTime,
	}));

	const participants = participantsRows.map((user) => ({
		name: user.name,
		role: user.role,
		banned: user.banned ?? false,
		joinedAt: Math.max(user.joinedAt ?? user._creationTime, startedFloor),
	}));

	const pollsStripped = polls.map(stripPollForSnapshot);

	const speakerLog = speakerRows.map((e) => ({
		type: e.type,
		name: e.name,
		startTime: e.startTime,
		endTime: e.endTime,
	}));

	const agenda = meeting.agenda.map((item) =>
		Object.assign(item, {
			pollIds: undefined,
			polls: pollsStripped
				.filter((poll) => poll.agendaItemId === item.id || item.pollIds.includes(poll._id))
				.map((poll) =>
					Object.assign(poll, {
						result: results.find((result) => result.pollId === poll._id) ?? null,
					}),
				),
		}),
	);

	return {
		meeting: {
			_creationTime: meeting._creationTime,
			_id: meeting._id,
			code: meeting.code,
			date: meeting.date,
			title: meeting.title,
			startedAt: meeting.startedAt,
			agenda,
		},
		polls: pollsStripped,
		participants,
		absenceEntries,
		speakerLog,
	};
}
