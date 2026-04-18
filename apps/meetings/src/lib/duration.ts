export function formatDurationMs(ms: number | undefined): string {
	if (ms == null) {
		return '00:00';
	}

	const totalSeconds = Math.max(0, Math.floor(ms / 1000));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
	const seconds = String(totalSeconds % 60).padStart(2, '0');

	if (hours > 0) {
		return `${String(hours).padStart(2, '0')}:${minutes}:${seconds}`;
	}

	return `${minutes}:${seconds}`;
}

// oxlint-disable-next-line typescript/no-explicit-any
const durationFormat = new (Intl as any).DurationFormat('sv-SE', {
	style: 'short',
});

export function splitDuration(
	ms: number,
	parts: { hours?: boolean; minutes?: boolean; seconds?: boolean } = {
		hours: true,
		minutes: true,
		seconds: true,
	},
) {
	const out = {} as { hours?: number; minutes?: number; seconds?: number };

	if (parts.hours) {
		out.hours = Math.floor(ms / 3600000);
	}
	if (parts.minutes) {
		out.minutes = Math.floor((ms % 3600000) / 60000);
	}
	if (parts.seconds) {
		out.seconds = Math.floor((ms % 60000) / 1000);
	}

	return out;
}

export function formatDurationParts(parts: { hours?: number; minutes?: number; seconds?: number }) {
	return durationFormat.format(parts);
}

export function formatDuration(
	ms?: number | { hours?: number; minutes?: number; seconds?: number } | undefined,
	parts: { hours?: boolean; minutes?: boolean; seconds?: boolean } = {
		hours: true,
		minutes: true,
		seconds: true,
	},
) {
	return formatDurationParts(
		typeof ms === 'number' ? splitDuration(ms, parts) : (ms ?? splitDuration(0, parts)),
	);
}
