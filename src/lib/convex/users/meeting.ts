import { userMutation } from './helpers';

export const placeInSpeakerQueue = userMutation({
	args: {},
	async handler({ db, meeting, user }) {
		if (user.isInSpeakerQueue || meeting.break?.type === 'accepted') {
			return false;
		}

		await db.patch('meetings', meeting._id, {
			speakerQueue: [
				...meeting.speakerQueue,
				{
					name: user.name,
					userId: user._id
				}
			]
		});

		await db.patch('users', user._id, {
			isInSpeakerQueue: true
		});

		return true;
	}
});

export const recallSpeakerQueueRequest = userMutation({
	args: {},
	async handler({ db, meeting, user }) {
		const filtered = meeting.speakerQueue.filter((p) => p.userId !== user._id);

		if (filtered.length !== meeting.speakerQueue.length) {
			await db.patch('meetings', meeting._id, {
				speakerQueue: filtered
			});
		}

		if (user.isInSpeakerQueue) {
			await db.patch('users', user._id, {
				isInSpeakerQueue: false
			});
		}
	}
});

export const requestPointOfOrder = userMutation({
	args: {},
	async handler({ db, meeting, user }) {
		if (meeting.pointOfOrder) {
			return false;
		}

		await db.patch('meetings', meeting._id, {
			pointOfOrder: {
				name: user.name,
				userId: user._id,
				startTime: Date.now()
			}
		});

		return true;
	}
});

export const recallPointOfOrderRequest = userMutation({
	args: {},
	async handler({ db, meeting, user }) {
		if (meeting.pointOfOrder?.userId !== user._id) {
			return false;
		}

		await db.patch('meetings', meeting._id, {
			pointOfOrder: null
		});

		return true;
	}
});

export const requestBreak = userMutation({
	args: {},
	async handler({ db, meeting, user }) {
		if (!meeting.break) {
			return;
		}

		await db.patch('meetings', meeting._id, {
			break: {
				type: 'requested',
				by: {
					userId: user._id,
					name: user.name
				}
			}
		});
	}
});

export const leaveMeeting = userMutation({
	args: {},
	async handler({ db, user }) {
		if (user.isAbsent) {
			return;
		}

		await db.patch('users', user._id, {
			isAbsent: true
		});
	}
});

export const returnToMeeting = userMutation({
	args: {},
	async handler({ db, user }) {
		if (!user.isAbsent) {
			return;
		}

		await db.patch('users', user._id, {
			isAbsent: false
		});
	}
});
