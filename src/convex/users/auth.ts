import { userQuery } from './helpers';

export const getUserData = userQuery({
	args: {},
	async handler(ctx) {
		const { admin, anonID, isAbsent, isInSpeakerQueue, name, votes } = ctx.user;

		return {
			admin,
			anonID,
			isAbsent,
			isInSpeakerQueue,
			name,
			votes
		};
	}
});
