import type { Id } from '$convex/_generated/dataModel';

export type AgendaItemId = string;

export function createAgendaItemId() {
	return `agenda_${Date.now()}_${Math.random().toString(36).slice(2, 10)}` as AgendaItemId;
}

export type AgendaItem = {
	id: AgendaItemId;
	title: string;
	pollIds: Id<'polls'>[];
	items: AgendaItem[];
};

export type Agenda = AgendaItem[];

/** Pre-order flatten: each item, then its children recursively. */
export function flattenAgenda(agenda: Agenda) {
	const out: AgendaItem[] = [];
	function walk(items: AgendaItem[]) {
		for (const item of items) {
			out.push(item);
			walk(item.items);
		}
	}
	walk(agenda);
	return out;
}

export type FindAgendaItemResult = {
	item: AgendaItem;
	parent: AgendaItem | null;
	indexInParent: number;
};

export function findAgendaItemById(agenda: Agenda, id: AgendaItemId) {
	for (let i = 0; i < agenda.length; i++) {
		if (agenda[i].id === id) {
			return { item: agenda[i], parent: null, indexInParent: i };
		}
		const inChild = findInItems(agenda[i].items, agenda[i], id);
		if (inChild) {
			return inChild;
		}
	}
	return null;
}

function findInItems(
	items: AgendaItem[],
	parent: AgendaItem,
	id: AgendaItemId,
): FindAgendaItemResult | null {
	for (let j = 0; j < items.length; j++) {
		if (items[j].id === id) {
			return { item: items[j], parent, indexInParent: j };
		}
		const inChild = findInItems(items[j].items, items[j], id);
		if (inChild) {
			return inChild;
		}
	}
	return null;
}

/** Returns new agenda with the item at id updated by updater (recursive). */
function updateAgendaItemById(
	agenda: Agenda,
	id: AgendaItemId,
	updater: (item: AgendaItem) => AgendaItem,
) {
	const found = findAgendaItemById(agenda, id);

	if (!found) {
		return agenda;
	}

	const parent = found.parent;

	if (parent === null) {
		return agenda.map((a) => (a.id === id ? updater(a) : a));
	}

	return agenda.map((a) => mapItem(a, parent.id, id, updater));
}

function mapItem(
	item: AgendaItem,
	parentId: string,
	targetId: string,
	updater: (item: AgendaItem) => AgendaItem,
): AgendaItem {
	if (item.id === targetId) {
		return updater(item);
	}
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

/** Returns new agenda with pollIds set for the item at id. */
export function setPollIdsForItem(agenda: Agenda, id: AgendaItemId, pollIds: Id<'polls'>[]) {
	return updateAgendaItemById(agenda, id, (item) => ({ ...item, pollIds }));
}
