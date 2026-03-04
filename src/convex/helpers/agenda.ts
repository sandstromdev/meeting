import type { Doc, Id } from '$convex/_generated/dataModel';

export function createAgendaItemId() {
	return `agenda_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Recursive normalized agenda item (any depth). */
export type NormalizedAgendaItem = {
	id: string;
	title: string;
	pollIds: Id<'polls'>[];
	items: NormalizedAgendaItem[];
};

export type NormalizedAgenda = NormalizedAgendaItem[];

/** Stored item shape (from DB); items may be raw. */
type StoredItem = {
	id?: string;
	title?: string;
	pollIds?: unknown;
	items?: unknown[];
};

function normalizeOne(item: StoredItem, index: number, depth: number): NormalizedAgendaItem {
	const items = Array.isArray(item.items) ? item.items : [];
	const defaultTitle = depth === 0 ? `Punkt ${index + 1}` : `Underpunkt ${index + 1}`;
	return {
		id: item.id?.length ? item.id : createAgendaItemId(),
		title: item.title ?? defaultTitle,
		pollIds: Array.isArray(item.pollIds) ? (item.pollIds as Id<'polls'>[]) : [],
		items: items.map((sub, i) => normalizeOne(sub as StoredItem, i, depth + 1)),
	};
}

export function normalizeAgendaItems(agenda: Doc<'meetings'>['agenda']): NormalizedAgenda {
	return (agenda ?? []).map((item, index) => normalizeOne(item as StoredItem, index, 0));
}

/** Pre-order flatten: each item, then its children recursively. */
export function flattenAgenda(agenda: NormalizedAgenda): NormalizedAgendaItem[] {
	const out: NormalizedAgendaItem[] = [];
	function walk(items: NormalizedAgendaItem[]) {
		for (const item of items) {
			out.push(item);
			walk(item.items);
		}
	}
	walk(agenda);
	return out;
}

export function findAgendaItemIndex(agenda: NormalizedAgenda, agendaItemId: string): number {
	return flattenAgenda(agenda).findIndex((item) => item.id === agendaItemId);
}

export type FindAgendaItemResult = {
	item: NormalizedAgendaItem;
	parent: NormalizedAgendaItem | null;
	indexInParent: number;
};

export function findAgendaItemById(agenda: NormalizedAgenda, id: string): FindAgendaItemResult | null {
	for (let i = 0; i < agenda.length; i++) {
		if (agenda[i].id === id) {
			return { item: agenda[i], parent: null, indexInParent: i };
		}
		const inChild = findInItems(agenda[i].items, agenda[i], id);
		if (inChild) return inChild;
	}
	return null;
}

function findInItems(
	items: NormalizedAgendaItem[],
	parent: NormalizedAgendaItem,
	id: string,
): FindAgendaItemResult | null {
	for (let j = 0; j < items.length; j++) {
		if (items[j].id === id) {
			return { item: items[j], parent, indexInParent: j };
		}
		const inChild = findInItems(items[j].items, items[j], id);
		if (inChild) return inChild;
	}
	return null;
}

export function getCurrentAgendaItemIndex(ctx: { meeting: Doc<'meetings'> }): number {
	const agenda = normalizeAgendaItems(ctx.meeting.agenda);
	return Math.max(0, findAgendaItemIndex(agenda, ctx.meeting.currentAgendaItemId ?? ''));
}

/** Returns new agenda with the item at id updated by updater (recursive). */
export function updateAgendaItemById(
	agenda: NormalizedAgenda,
	id: string,
	updater: (item: NormalizedAgendaItem) => NormalizedAgendaItem,
): NormalizedAgenda {
	const found = findAgendaItemById(agenda, id);
	if (!found) return agenda;

	if (found.parent === null) {
		return agenda.map((a) => (a.id === id ? updater(a) : a));
	}

	return agenda.map((a) => mapItem(a, found.parent!.id, id, updater));
}

function mapItem(
	item: NormalizedAgendaItem,
	parentId: string,
	targetId: string,
	updater: (item: NormalizedAgendaItem) => NormalizedAgendaItem,
): NormalizedAgendaItem {
	if (item.id === targetId) return updater(item);
	if (item.id === parentId) {
		return {
			...item,
			items: item.items.map((child) => (child.id === targetId ? updater(child) : child)),
		};
	}
	return {
		...item,
		items: item.items.map((child) => mapItem(child, parentId, targetId, updater)),
	};
}

/** Returns new agenda with the item (and all descendants) removed. */
export function removeAgendaItemById(agenda: NormalizedAgenda, id: string): NormalizedAgenda {
	const found = findAgendaItemById(agenda, id);
	if (!found) return agenda;

	if (found.parent === null) {
		return agenda.filter((a) => a.id !== id);
	}

	return agenda.map((a) => removeFromItem(a, found.parent!.id, id));
}

function removeFromItem(
	item: NormalizedAgendaItem,
	parentId: string,
	targetId: string,
): NormalizedAgendaItem {
	if (item.id === parentId) {
		return {
			...item,
			items: item.items.filter((child) => child.id !== targetId),
		};
	}
	return {
		...item,
		items: item.items.map((child) => removeFromItem(child, parentId, targetId)),
	};
}

/** Returns new agenda with newChild appended to parent's items (parent at any depth). */
export function appendSubItem(
	agenda: NormalizedAgenda,
	parentId: string,
	newChild: NormalizedAgendaItem,
): NormalizedAgenda {
	return agenda.map((a) => appendToItem(a, parentId, newChild));
}

function appendToItem(
	item: NormalizedAgendaItem,
	parentId: string,
	newChild: NormalizedAgendaItem,
): NormalizedAgendaItem {
	if (item.id === parentId) {
		return { ...item, items: [...item.items, newChild] };
	}
	return {
		...item,
		items: item.items.map((child) => appendToItem(child, parentId, newChild)),
	};
}

/** Returns new agenda with pollIds set for the item at id. */
export function setPollIdsForItem(
	agenda: NormalizedAgenda,
	id: string,
	pollIds: Id<'polls'>[],
): NormalizedAgenda {
	return updateAgendaItemById(agenda, id, (item) => ({ ...item, pollIds }));
}

/** Swap item with sibling at index + direction. Returns new agenda and true if swapped. */
export function moveAgendaItemAmongSiblings(
	agenda: NormalizedAgenda,
	id: string,
	direction: 1 | -1,
): { agenda: NormalizedAgenda; moved: boolean } {
	const found = findAgendaItemById(agenda, id);
	if (!found) return { agenda, moved: false };

	if (found.parent === null) {
		const idx = found.indexInParent;
		const nextIdx = idx + direction;
		if (nextIdx < 0 || nextIdx >= agenda.length) return { agenda, moved: false };
		const next = [...agenda];
		[next[idx], next[nextIdx]] = [next[nextIdx], next[idx]];
		return { agenda: next, moved: true };
	}

	const { parent, indexInParent } = found;
	const items = parent.items;
	const nextIdx = indexInParent + direction;
	if (nextIdx < 0 || nextIdx >= items.length) return { agenda, moved: false };

	return {
		agenda: agenda.map((a) => {
			if (a.id !== parent.id) return a;
			const nextItems = [...a.items];
			[nextItems[indexInParent], nextItems[nextIdx]] = [nextItems[nextIdx], nextItems[indexInParent]];
			return { ...a, items: nextItems };
		}),
		moved: true,
	};
}
