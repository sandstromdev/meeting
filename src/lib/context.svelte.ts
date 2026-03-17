import { api } from '$convex/_generated/api';
import type { Id } from '$convex/_generated/dataModel';
import { useConvexClient, useQuery } from '@mmailaender/convex-svelte';
import type { ConvexClient } from 'convex/browser';
import type { Getter } from 'runed';
import { createContext } from 'svelte';
import { AgendaState } from './agenda.svelte';
import { SpeakerQueue } from './speaker-queue.svelte';
import type { DefaultFunctionArgs, FunctionReference } from 'convex/server';
import type { UseQueryOptions, UseQueryReturn } from '$lib/types';
import { env } from '$env/dynamic/public';

export type MeetingData = typeof api.users.meeting.getData._returnType;

const [getContext, setContext] = createContext<MeetingState>();

type ArgsGetter<T extends FunctionReference<'query'>> = () =>
	| Omit<T['_args'], 'meetingId'>
	| 'skip';

type CurrentSpeaker =
	| {
			type: 'point_of_order' | 'reply' | 'speaker';
			startTime: number;
			name: string;
			userId: Id<'meetingParticipants'>;
	  }
	| {
			type: 'empty';
			name?: never;
			startTime?: never;
	  };

type AttendanceState = {
	participants: number;
	absent: number;
};

export class MeetingState {
	#data: MeetingData;
	#attendance: AttendanceState;

	readonly convex: ConvexClient;
	readonly agenda: AgendaState;
	readonly speakerQueue: SpeakerQueue;

	constructor(data: Getter<MeetingData>) {
		this.#data = $state(data());
		this.convex = useConvexClient();

		this.query = this.query.bind(this);
		this.adminQuery = this.adminQuery.bind(this);
		this.moderatorQuery = this.moderatorQuery.bind(this);
		this.mutate = this.mutate.bind(this);
		this.adminMutate = this.adminMutate.bind(this);
		this.moderatorMutate = this.moderatorMutate.bind(this);

		this.agenda = new AgendaState(this);
		this.speakerQueue = new SpeakerQueue(this);

		this.#attendance = $state({
			participants: 0,
			absent: 0,
		});

		const attendance = this.adminQuery(api.admin.meeting.getAttendance);

		$effect(() => {
			this.#data = data();

			this.#attendance = {
				participants: attendance.data?.participants ?? 0,
				absent: attendance.data?.absentees ?? 0,
			};
		});
	}

	async mutate<
		T extends FunctionReference<'mutation', 'public', { meetingId: Id<'meetings'> }, unknown>,
	>(fn: T): Promise<T['_returnType']>;
	async mutate<
		T extends FunctionReference<
			'mutation',
			'public',
			{ meetingId: Id<'meetings'> } & DefaultFunctionArgs,
			unknown
		>,
	>(fn: T, args: Omit<T['_args'], 'meetingId'>): Promise<T['_returnType']>;
	async mutate<
		T extends FunctionReference<
			'mutation',
			'public',
			{ meetingId: Id<'meetings'> } & DefaultFunctionArgs,
			unknown
		>,
	>(fn: T, args: Omit<T['_args'], 'meetingId'> = {} as Omit<T['_args'], 'meetingId'>) {
		return this.convex.mutation(fn, {
			meetingId: this.id,
			...args,
		} as T['_args']);
	}

	async adminMutate<
		T extends FunctionReference<'mutation', 'public', { meetingId: Id<'meetings'> }, unknown>,
	>(fn: T): Promise<T['_returnType']>;
	async adminMutate<
		T extends FunctionReference<
			'mutation',
			'public',
			{ meetingId: Id<'meetings'> } & DefaultFunctionArgs,
			unknown
		>,
	>(fn: T, args: Omit<T['_args'], 'meetingId'>): Promise<T['_returnType']>;
	async adminMutate<
		T extends FunctionReference<'mutation', 'public', { meetingId: Id<'meetings'> }, unknown>,
	>(fn: T, args: Omit<T['_args'], 'meetingId'> = {} as Omit<T['_args'], 'meetingId'>) {
		if (!this.isAdmin) {
			return;
		}
		return this.mutate(fn, args);
	}

	async moderatorMutate<
		T extends FunctionReference<'mutation', 'public', { meetingId: Id<'meetings'> }, unknown>,
	>(fn: T): Promise<T['_returnType']>;
	async moderatorMutate<
		T extends FunctionReference<
			'mutation',
			'public',
			{ meetingId: Id<'meetings'> } & DefaultFunctionArgs,
			unknown
		>,
	>(fn: T, args: Omit<T['_args'], 'meetingId'>): Promise<T['_returnType']>;
	async moderatorMutate<
		T extends FunctionReference<'mutation', 'public', { meetingId: Id<'meetings'> }, unknown>,
	>(fn: T, args: Omit<T['_args'], 'meetingId'> = {} as Omit<T['_args'], 'meetingId'>) {
		if (!this.isModerator) {
			return;
		}
		return this.mutate(fn, args);
	}

	query<T extends FunctionReference<'query', 'public', { meetingId: Id<'meetings'> }, unknown>>(
		fn: T,
	): UseQueryReturn<T>;
	query<T extends FunctionReference<'query', 'public', { meetingId: Id<'meetings'> }, unknown>>(
		fn: T,
		args?: Getter<Omit<T['_args'], 'meetingId'>>,
	): UseQueryReturn<T>;
	query<T extends FunctionReference<'query', 'public', { meetingId: Id<'meetings'> }, unknown>>(
		fn: T,
		args?: Getter<Omit<T['_args'], 'meetingId'>>,
		opts?: UseQueryOptions<T>,
	): UseQueryReturn<T>;
	query<
		T extends FunctionReference<
			'query',
			'public',
			{ meetingId: Id<'meetings'> } & DefaultFunctionArgs,
			unknown
		>,
	>(fn: T, args?: Getter<Omit<T['_args'], 'meetingId'>>, opts?: UseQueryOptions<T>) {
		const getter = () => ({
			meetingId: this.id,
			...args?.(),
		});

		return useQuery(fn, getter, opts);
	}

	adminQuery<
		T extends FunctionReference<'query', 'public', { meetingId: Id<'meetings'> }, unknown>,
	>(fn: T): UseQueryReturn<T>;
	adminQuery<
		T extends FunctionReference<'query', 'public', { meetingId: Id<'meetings'> }, unknown>,
	>(fn: T, args?: ArgsGetter<T>, opts?: UseQueryOptions<T>): UseQueryReturn<T>;
	adminQuery<
		T extends FunctionReference<
			'query',
			'public',
			{ meetingId: Id<'meetings'> } & DefaultFunctionArgs,
			unknown
		>,
	>(fn: T, args?: ArgsGetter<T>, opts?: UseQueryOptions<T>) {
		return useQuery(
			fn,
			() => {
				if (!this.isAdmin) {
					return 'skip';
				}
				const a = args?.();

				if (a === 'skip') {
					return 'skip';
				}

				return {
					meetingId: this.id,
					...a,
				};
			},
			opts,
		);
	}

	moderatorQuery<
		T extends FunctionReference<'query', 'public', { meetingId: Id<'meetings'> }, unknown>,
	>(fn: T): UseQueryReturn<T>;
	moderatorQuery<
		T extends FunctionReference<'query', 'public', { meetingId: Id<'meetings'> }, unknown>,
	>(fn: T, args?: Getter<Omit<T['_args'], 'meetingId'>>): UseQueryReturn<T>;
	moderatorQuery<
		T extends FunctionReference<'query', 'public', { meetingId: Id<'meetings'> }, unknown>,
	>(
		fn: T,
		args?: Getter<Omit<T['_args'], 'meetingId'>>,
		opts?: UseQueryOptions<T>,
	): UseQueryReturn<T>;
	moderatorQuery<
		T extends FunctionReference<
			'query',
			'public',
			{ meetingId: Id<'meetings'> } & DefaultFunctionArgs,
			unknown
		>,
	>(fn: T, args?: Getter<Omit<T['_args'], 'meetingId'>>, opts?: UseQueryOptions<T>) {
		const getter = () =>
			this.isModerator
				? {
						meetingId: this.id,
						...args?.(),
					}
				: 'skip';

		return useQuery(fn, getter, opts);
	}

	get data() {
		return this.#data;
	}

	get meeting() {
		return this.data.meeting;
	}

	get me() {
		return this.data.me;
	}

	get id() {
		return this.meeting?._id;
	}

	get voterRoll() {
		return this.participants - this.absent;
	}
	get participants() {
		return this.#attendance.participants;
	}
	get absent() {
		return this.#attendance.absent;
	}

	get hasPendingReturnRequest() {
		return this.me.absentSince > 0 && this.me.returnRequestedAt > 0;
	}

	get currentSpeaker(): CurrentSpeaker {
		if (!this.meeting) {
			return {
				type: 'empty',
			};
		}

		const po = this.meeting.pointOfOrder;

		if (po?.type === 'accepted') {
			const startTime = po.startTime ?? Date.now();
			return {
				type: 'point_of_order',
				userId: po.by.userId,
				name: po.by.name,
				startTime,
			};
		}

		const reply = this.meeting.reply;

		if (reply?.type === 'accepted') {
			const startTime = reply.startTime ?? Date.now();
			return {
				type: 'reply',
				userId: reply.by.userId,
				name: reply.by.name,
				startTime,
			};
		}

		if (this.meeting.currentSpeaker) {
			return {
				type: 'speaker',
				...this.meeting.currentSpeaker,
			};
		}

		return {
			type: 'empty',
		};
	}

	get isOpen() {
		return this.meeting.isOpen;
	}

	get role() {
		return this.data?.me.role;
	}

	get isAdmin() {
		return this.role === 'admin';
	}

	get isModerator() {
		return this.role === 'admin' || this.role === 'moderator';
	}

	get isParticipant() {
		return this.role === 'participant';
	}

	get isCurrentSpeaker() {
		return this.currentSpeaker.type === 'empty'
			? false
			: this.currentSpeaker.userId === this.me?._id;
	}

	get url() {
		return `${env.PUBLIC_SITE_URL}/m/${this.meeting.code}`;
	}
}

export function setMeetingContext(data: Getter<MeetingData>) {
	const ctx = new MeetingState(data);
	setContext(ctx);
	return ctx;
}

export function getMeetingContext() {
	const ctx = getContext();

	if (!ctx) {
		throw new Error('getMeetingContext must be used under setMeetingContext');
	}

	return ctx;
}
