/** Shared shape for per-option vote totals (meeting + standalone polls). */
export type PollOptionTotal = {
	optionIndex: number;
	option: string;
	description?: string | null;
	votes: number;
};
