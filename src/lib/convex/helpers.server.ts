import type { QueryCtx } from './_generated/server';
import { AppError, Err } from './error';
import type { Id } from './_generated/dataModel';

export async function getPoll(ctx: Pick<QueryCtx, 'db'>, pollId: Id<'polls'>, option?: number) {
	const poll = await ctx.db.get('polls', pollId);

	if (!poll) {
		throw new AppError(Err.poll_not_found(pollId));
	}

	if (poll.isOpen) {
		throw new AppError(Err.illegal_poll_action('edit_while_open'));
	}

	if (option) {
		const options = poll.options;

		if (option < 0 || option >= options.length) {
			throw new AppError(Err.invalid_poll_option(option));
		}
	}

	return poll;
}

export async function getEditablePoll(
	ctx: Pick<QueryCtx, 'db'>,
	pollId: Id<'polls'>,
	option?: number
) {
	const poll = await getPoll(ctx, pollId, option);

	if (poll.isOpen) {
		throw new AppError(Err.illegal_poll_action('edit_while_open'));
	}

	return poll;
}
