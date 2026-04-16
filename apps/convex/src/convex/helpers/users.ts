import { pick } from 'convex-helpers';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { getAbsentCounter, getParticipantCounter } from './counters';

export function pickParticipantData(doc: Doc<'meetingParticipants'>) {
	return {
		...pick(doc, ['_id', 'role', 'absentSince', 'isInSpeakerQueue', 'name']),
		joinedAt: doc.joinedAt ?? doc._creationTime,
	};
}

export type StrippedMeetingParticipant = ReturnType<typeof pickParticipantData>;

export type InsertMeetingParticipantArgs = {
	meetingId: Id<'meetings'>;
	userId: string;
	name: string;
	role: 'admin' | 'moderator' | 'participant' | 'adjuster';
	absentSince: number;
	/** Defaults to Date.now(). */
	joinedAt?: number;
};

/** Insert a new meeting participant. Caller is responsible for counters and absence entries if needed. */
export async function insertMeetingParticipant(
	ctx: MutationCtx,
	args: InsertMeetingParticipantArgs,
): Promise<Id<'meetingParticipants'>> {
	const joinedAt = args.joinedAt ?? Date.now();
	return await ctx.db.insert('meetingParticipants', {
		meetingId: args.meetingId,
		userId: args.userId,
		name: args.name,
		role: args.role,
		isInSpeakerQueue: false,
		joinedAt,
		absentSince: args.absentSince,
		returnRequestedAt: 0,
		banned: false,
	});
}

export type ApplyNewParticipantSideEffectsArgs = {
	meetingId: Id<'meetings'>;
	participantId: Id<'meetingParticipants'>;
	name: string;
	/** If true, increments absent counter and inserts an open absence entry. */
	isMeetingOpen: boolean;
	/** Start time for absence entry; defaults to Date.now(). */
	now?: number;
};

/** Increment participant counter and, when meeting is open, absent counter + absence entry. Call after inserting a new participant. */
export async function applyNewParticipantSideEffects(
	ctx: MutationCtx,
	args: ApplyNewParticipantSideEffectsArgs,
): Promise<void> {
	const now = args.now ?? Date.now();
	await getParticipantCounter(args.meetingId).inc(ctx);
	if (args.isMeetingOpen) {
		await getAbsentCounter(args.meetingId).inc(ctx);
		await ctx.db.insert('absenceEntries', {
			meetingId: args.meetingId,
			userId: args.participantId,
			name: args.name,
			startTime: now,
			endTime: null,
		});
	}
}

export type EnsureParticipantInMeetingArgs = {
	meeting: Pick<Doc<'meetings'>, '_id' | 'isOpen'>;
	userId: string;
	name: string;
	role: 'admin' | 'moderator' | 'participant' | 'adjuster';
	requestReturnIfAbsent?: boolean;
	syncExistingName?: boolean;
	syncExistingRole?: boolean;
};

export type EnsureParticipantInMeetingResult =
	| { ok: true; meetingId: Id<'meetings'> }
	| { ok: false; banned: true };

/**
 * Look up participant by token+meeting; if banned return failure. If missing, insert and apply side effects.
 * If existing and absent (non-admin), set returnRequestedAt. Shared by connect and addParticipant.
 */
export async function ensureParticipantInMeeting(
	ctx: MutationCtx,
	args: EnsureParticipantInMeetingArgs,
): Promise<EnsureParticipantInMeetingResult> {
	const p = await ctx.db
		.query('meetingParticipants')
		.withIndex('by_user_meeting', (q) =>
			q.eq('userId', args.userId).eq('meetingId', args.meeting._id),
		)
		.first();

	if (p?.banned) {
		return { ok: false, banned: true };
	}

	const now = Date.now();

	if (!p) {
		const id = await insertMeetingParticipant(ctx, {
			meetingId: args.meeting._id,
			userId: args.userId,
			name: args.name,
			role: args.role,
			absentSince: args.meeting.isOpen ? now : 0,
			joinedAt: now,
		});

		await applyNewParticipantSideEffects(ctx, {
			meetingId: args.meeting._id,
			participantId: id,
			name: args.name,
			isMeetingOpen: args.meeting.isOpen,
			now,
		});
	}

	if (!p) {
		return { ok: true, meetingId: args.meeting._id };
	}

	const patch: Partial<Doc<'meetingParticipants'>> = {};
	if (args.syncExistingName && p.name !== args.name) {
		patch.name = args.name;
	}
	if (args.syncExistingRole && p.role !== args.role) {
		patch.role = args.role;
	}
	if ((args.requestReturnIfAbsent ?? true) && p.absentSince > 0 && p.role !== 'admin') {
		patch.returnRequestedAt = now;
	}

	if (Object.keys(patch).length > 0) {
		await ctx.db.patch('meetingParticipants', p._id, patch);
	}

	return { ok: true, meetingId: args.meeting._id };
}
