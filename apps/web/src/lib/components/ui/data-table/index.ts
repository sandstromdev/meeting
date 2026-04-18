export { default as FlexRender } from './flex-render.svelte';
export { renderComponent, renderSnippet } from './render-helpers.js';
export { createSvelteTable } from './data-table.svelte.js';

type Updater<T> = T extends Function ? never : T | ((old: T) => T);

export function runUpdater<T>(updater: Updater<T>, value: T) {
	return typeof updater === 'function' ? updater(value) : updater;
}
