import { adminMutation } from './helpers';

export const nextSpeaker = adminMutation({
	args: {},
	async handler({ db, meeting }) {
		const { speakerQueue } = meeting;

		const queued = speakerQueue.shift();
		const previous = meeting.currentSpeaker;

		let speaker = null;

		if (queued) {
			speaker = {
				...queued,
				startTime: Date.now()
			};
		}

		if (previous) {
			await db.patch('users', previous.userId, {
				isInSpeakerQueue: false
			});
		}

		await db.patch('meetings', meeting._id, {
			currentSpeaker: speaker,
			speakerQueue
		});
	}
});

export const clearPointOfOrder = adminMutation({
	args: {},
	async handler({ db, meeting }) {
		if (!meeting.pointOfOrder) {
			return false;
		}

		await db.patch('meetings', meeting._id, {
			pointOfOrder: null
		});

		return true;
	}
});
