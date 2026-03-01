import type { Id } from '$convex/_generated/dataModel';
import type { QueryCtx } from '$convex/_generated/server';
import { AppError, errors } from '$convex/helpers/error';

export async function getPoll(ctx: Pick<QueryCtx, 'db'>, pollId: Id<'polls'>, option?: number) {
	const poll = await ctx.db.get('polls', pollId);

	if (!poll) {
		throw new AppError(errors.poll_not_found(pollId));
	}

	if (poll.isOpen) {
		throw new AppError(errors.illegal_poll_action('edit_while_open'));
	}

	if (option) {
		const options = poll.options;

		if (option < 0 || option >= options.length) {
			throw new AppError(errors.invalid_poll_option(option));
		}
	}

	return poll;
}

export async function getEditablePoll(
	ctx: Pick<QueryCtx, 'db'>,
	pollId: Id<'polls'>,
	option?: number,
) {
	const poll = await getPoll(ctx, pollId, option);

	if (poll.isOpen) {
		throw new AppError(errors.illegal_poll_action('edit_while_open'));
	}

	return poll;
}
