import { useInterval } from 'runed';
import { SvelteDate } from 'svelte/reactivity';

export function useNow() {
	let now = new SvelteDate();

	useInterval(1000, {
		callback: () => now.setTime(Date.now()),
	});

	return {
		get current() {
			return now.getTime();
		},
		get formatted() {
			return now.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
		},
		since(timestamp: number) {
			return now.getTime() - timestamp;
		},
	};
}
