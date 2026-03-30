import { describe, expect, it } from 'vitest';

import {
	canUserJoinMeeting,
	getMeetingAccessMode,
	grantMeetingAccess,
	normalizeEmail,
} from './meetingAccess';
import { assertMeetingNotArchived } from './meetingLifecycle';

type FakeParticipant = {
	meetingId: string;
	userId: string;
	banned?: boolean;
};

type FakeAccessEntry = {
	meetingId: string;
	userId?: string;
	email?: string;
};

function createQueryChain<T extends Record<string, unknown>>(rows: T[]) {
	return {
		withIndex: (
			_indexName: string,
			callback: (query: { eq: (field: keyof T, value: unknown) => unknown }) => unknown,
		) => {
			const predicates: Array<[keyof T, unknown]> = [];
			const query = {
				eq(field: keyof T, value: unknown) {
					predicates.push([field, value]);
					return query;
				},
			};
			callback(query);
			const matches = rows.filter((row) =>
				predicates.every(([field, value]) => row[field] === value),
			);
			return {
				first: async () => matches[0] ?? null,
				collect: async () => matches,
			};
		},
	};
}

function createAccessCtx(args: {
	participants?: FakeParticipant[];
	accessList?: FakeAccessEntry[];
}) {
	return {
		db: {
			query(table: 'meetingParticipants' | 'meetingAccessList') {
				if (table === 'meetingParticipants') {
					return createQueryChain(args.participants ?? []);
				}
				return createQueryChain(args.accessList ?? []);
			},
		},
	};
}

function createAccessMutationCtx(initialAccessList: Array<FakeAccessEntry & { _id: string }>) {
	const accessList = [...initialAccessList];
	let nextId = accessList.length + 1;

	return {
		db: {
			query(table: 'meetingAccessList') {
				if (table !== 'meetingAccessList') {
					throw new Error(`Unexpected table ${table}`);
				}
				return createQueryChain(accessList);
			},
			async insert(table: 'meetingAccessList', value: Omit<(typeof accessList)[number], '_id'>) {
				if (table !== 'meetingAccessList') {
					throw new Error(`Unexpected table ${table}`);
				}
				const id = `access-${nextId++}`;
				accessList.push({ _id: id, ...value });
				return id as never;
			},
			async patch(id: string, value: Partial<(typeof accessList)[number]>) {
				const row = accessList.find((entry) => entry._id === id);
				if (row) {
					Object.assign(row, value);
				}
			},
			async delete(id: string) {
				const index = accessList.findIndex((entry) => entry._id === id);
				if (index >= 0) {
					accessList.splice(index, 1);
				}
			},
		},
		get rows() {
			return accessList;
		},
	};
}

describe('meeting access helpers', () => {
	it('defaults missing accessMode to open', () => {
		expect(getMeetingAccessMode({ accessMode: undefined })).toBe('open');
	});

	it('normalizes email casing and whitespace', () => {
		expect(normalizeEmail('  Test@Example.com ')).toBe('test@example.com');
	});

	it('allows anyone to join open meetings', async () => {
		const result = await canUserJoinMeeting(createAccessCtx({}) as never, {
			meeting: { _id: 'meeting-1' as never, accessMode: 'open' },
			userId: 'user-1',
			email: 'person@example.com',
		});

		expect(result).toEqual({ allowed: true, mode: 'open', via: 'open' });
	});

	it('allows closed meetings for existing participants', async () => {
		const result = await canUserJoinMeeting(
			createAccessCtx({
				participants: [{ meetingId: 'meeting-1', userId: 'user-1' }],
			}) as never,
			{
				meeting: { _id: 'meeting-1' as never, accessMode: 'closed' },
				userId: 'user-1',
				email: 'person@example.com',
			},
		);

		expect(result).toEqual({ allowed: true, mode: 'closed', via: 'participant' });
	});

	it('allows closed meetings for allowlisted email addresses', async () => {
		const result = await canUserJoinMeeting(
			createAccessCtx({
				accessList: [{ meetingId: 'meeting-1', email: 'person@example.com' }],
			}) as never,
			{
				meeting: { _id: 'meeting-1' as never, accessMode: 'closed' },
				userId: 'user-2',
				email: 'person@example.com',
			},
		);

		expect(result).toEqual({ allowed: true, mode: 'closed', via: 'access_list' });
	});

	it('denies closed meetings when the user is neither participant nor allowlisted', async () => {
		const result = await canUserJoinMeeting(createAccessCtx({}) as never, {
			meeting: { _id: 'meeting-1' as never, accessMode: 'closed' },
			userId: 'user-3',
			email: 'person@example.com',
		});

		expect(result).toEqual({ allowed: false, mode: 'closed', via: 'denied' });
	});

	it('upserts meeting access idempotently on repeated imports', async () => {
		const ctx = createAccessMutationCtx([
			{
				_id: 'access-1',
				meetingId: 'meeting-1',
				email: 'person@example.com',
			},
		]);

		await grantMeetingAccess(ctx as never, {
			meetingId: 'meeting-1' as never,
			userId: 'user-1',
			email: 'person@example.com',
			addedByUserId: 'admin-1',
		});
		await grantMeetingAccess(ctx as never, {
			meetingId: 'meeting-1' as never,
			userId: 'user-1',
			email: 'person@example.com',
			addedByUserId: 'admin-1',
		});

		expect(ctx.rows).toHaveLength(1);
		expect(ctx.rows[0]).toMatchObject({
			meetingId: 'meeting-1',
			userId: 'user-1',
			email: 'person@example.com',
		});
	});

	it('throws for archived meetings regardless of access mode', () => {
		expect(() =>
			assertMeetingNotArchived({
				_id: 'meeting-1' as never,
				code: '123456',
				status: 'archived',
			} as never),
		).toThrow();
	});
});
