import { v } from 'convex/values';
import { internal } from './_generated/api';
import { internalAction, internalMutation, internalQuery } from './_generated/server';
import { appErrors } from './helpers/error';
import { buildMeetingSnapshotPayload } from './helpers/meeting_backup';
import { checksumPayload } from './helpers/snapshot_checksum';

export const listOpenMeetingIds = internalQuery({
	args: {},
	returns: v.array(v.id('meetings')),
	handler: async (ctx) => {
		const rows = await ctx.db
			.query('meetings')
			.withIndex('by_isOpen', (q) => q.eq('isOpen', true))
			.collect();
		return rows.map((m) => m._id);
	},
});

export const getMeetingBackupPayload = internalQuery({
	args: { meetingId: v.id('meetings') },
	returns: v.union(v.any(), v.null()),
	handler: async (ctx, { meetingId }) => {
		const meeting = await ctx.db.get('meetings', meetingId);
		if (!meeting || !meeting.isOpen) {
			return null;
		}
		return await buildMeetingSnapshotPayload(ctx, meeting);
	},
});

export const getMeetingSnapshotForExport = internalQuery({
	args: {
		meetingId: v.id('meetings'),
		tokenIdentifier: v.string(),
	},
	returns: v.union(v.any(), v.null()),
	handler: async (ctx, { meetingId, tokenIdentifier }) => {
		const meeting = await ctx.db.get('meetings', meetingId);
		if (!meeting) {
			return null;
		}
		const participant = await ctx.db
			.query('meetingParticipants')
			.withIndex('by_user_meeting', (q) =>
				q.eq('userId', tokenIdentifier).eq('meetingId', meetingId),
			)
			.first();
		if (!participant || participant.role !== 'admin') {
			throw appErrors.forbidden();
		}
		return await buildMeetingSnapshotPayload(ctx, meeting);
	},
});

export const saveSnapshotIfChanged = internalMutation({
	args: { meetingId: v.id('meetings') },
	returns: v.union(
		v.object({ kind: v.literal('inserted') }),
		v.object({
			kind: v.literal('skipped'),
			reason: v.union(v.literal('not_open'), v.literal('unchanged')),
		}),
	),
	handler: async (ctx, { meetingId }) => {
		const payload = await ctx.runQuery(internal.backup.getMeetingBackupPayload, { meetingId });
		if (payload === null) {
			return { kind: 'skipped' as const, reason: 'not_open' as const };
		}
		const checksum = await checksumPayload(payload);
		const latest = await ctx.db
			.query('meetingSnapshots')
			.withIndex('by_meeting', (q) => q.eq('meetingId', meetingId))
			.order('desc')
			.first();
		if (latest?.checksum === checksum) {
			return { kind: 'skipped' as const, reason: 'unchanged' as const };
		}
		await ctx.db.insert('meetingSnapshots', {
			meetingId,
			checksum,
			payload,
			capturedAt: Date.now(),
		});
		return { kind: 'inserted' as const };
	},
});

export const runOpenMeetingSnapshots = internalAction({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const ids = await ctx.runQuery(internal.backup.listOpenMeetingIds, {});
		for (const meetingId of ids) {
			await ctx.runMutation(internal.backup.saveSnapshotIfChanged, { meetingId });
		}
		return null;
	},
});
