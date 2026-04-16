import type { Id } from '@lsnd/convex/_generated/dataModel';
import { AppError, appErrors } from './error';
import type { Direction } from './types';

export type AgendaItemId = string;

export function createAgendaItemId() {
	return `agenda_${Date.now()}_${Math.random().toString(36).slice(2, 10)}` as AgendaItemId;
}

export type AgendaItem = {
	id: AgendaItemId;
	title: string;
	description: string | null;
	pollIds: Id<'meetingPolls'>[];
	depth: number;
};

export type Agenda = AgendaItem[];
export type NumberedAgendaItem = AgendaItem & { number: string };

export function hasValidDepthTransitions(agenda: Agenda) {
	for (let i = 1; i < agenda.length; i++) {
		if (agenda[i].depth - agenda[i - 1].depth > 1) {
			return false;
		}
	}
	return true;
}

/** Computes outline numbering for a flat depth-based agenda. */
export function computeAgendaNumbers(agenda: Agenda): NumberedAgendaItem[] {
	const counters: number[] = [];
	const out: NumberedAgendaItem[] = [];

	for (const item of agenda) {
		const depth = item.depth;
		counters.length = depth + 1;
		counters[depth] = (counters[depth] ?? 0) + 1;
		out.push({
			...item,
			number: counters.join('.'),
		});
	}

	return out;
}

export type FindAgendaItemResult = {
	item: AgendaItem;
	indexInAgenda: number;
};

export function findItemIndexById(agenda: Agenda, id: AgendaItemId) {
	return agenda.findIndex((item) => item.id === id);
}

export function findAgendaItemById(agenda: Agenda, id: AgendaItemId): FindAgendaItemResult | null {
	const indexInAgenda = agenda.findIndex((item) => item.id === id);
	if (indexInAgenda < 0) {
		return null;
	}
	return {
		item: agenda[indexInAgenda],
		indexInAgenda,
	};
}

export function findAgendaItemOrThrow(agenda: Agenda, id: AgendaItemId) {
	const found = findAgendaItemById(agenda, id);
	AppError.assertNotNull(found, appErrors.agenda_item_not_found(id));
	return found;
}

export function updateAgendaItemById(
	agenda: Agenda,
	id: AgendaItemId,
	updater: (item: AgendaItem) => AgendaItem,
) {
	return agenda.map((item) => (item.id === id ? updater(item) : item));
}

export function setPollIdsForItem(agenda: Agenda, id: AgendaItemId, pollIds: Id<'meetingPolls'>[]) {
	return updateAgendaItemById(agenda, id, (item) => ({ ...item, pollIds }));
}

export function getSubtreeRange(agenda: Agenda, startIndex: number) {
	const item = agenda[startIndex];
	if (!item) {
		return { start: -1, end: -1 };
	}
	const baseDepth = item.depth;
	let end = startIndex + 1;
	while (end < agenda.length && agenda[end].depth > baseDepth) {
		end += 1;
	}
	return { start: startIndex, end };
}

function findPreviousSiblingStart(agenda: Agenda, startIndex: number) {
	const item = agenda[startIndex];
	if (!item) {
		return -1;
	}
	for (let i = startIndex - 1; i >= 0; i--) {
		if (agenda[i].depth < item.depth) {
			return -1;
		}
		if (agenda[i].depth === item.depth) {
			return i;
		}
	}
	return -1;
}

function findNextSiblingStart(agenda: Agenda, startIndex: number) {
	const item = agenda[startIndex];
	if (!item) {
		return -1;
	}
	const { end } = getSubtreeRange(agenda, startIndex);
	if (end < 0 || end >= agenda.length) {
		return -1;
	}
	if (agenda[end].depth !== item.depth) {
		return -1;
	}
	return end;
}

export function canMoveSubtree(agenda: Agenda, itemId: AgendaItemId, direction: Direction) {
	const startIndex = findItemIndexById(agenda, itemId);

	if (startIndex < 0) {
		return false;
	}
	if (direction === 'in') {
		if (startIndex === 0) {
			return false;
		}
		const previous = agenda[startIndex - 1];
		const baseDepth = agenda[startIndex].depth;
		return previous.depth >= baseDepth;
	}
	if (direction === 'out') {
		const baseDepth = agenda[startIndex].depth;
		return baseDepth > 0;
	}
	return direction === 'up'
		? findPreviousSiblingStart(agenda, startIndex) >= 0
		: findNextSiblingStart(agenda, startIndex) >= 0;
}

export function moveSubtree(agenda: Agenda, itemId: AgendaItemId, direction: Direction) {
	const startIndex = findItemIndexById(agenda, itemId);
	if (startIndex < 0) {
		return agenda;
	}

	const { end } = getSubtreeRange(agenda, startIndex);
	if (end <= startIndex) {
		return agenda;
	}

	if (direction === 'up') {
		const previousStart = findPreviousSiblingStart(agenda, startIndex);
		if (previousStart < 0) {
			return agenda;
		}
		const currentBlock = agenda.slice(startIndex, end);
		const previousBlock = agenda.slice(previousStart, startIndex);
		const result = [
			...agenda.slice(0, previousStart),
			...currentBlock,
			...previousBlock,
			...agenda.slice(end),
		];
		return hasValidDepthTransitions(result) ? result : agenda;
	} else if (direction === 'down') {
		const nextStart = findNextSiblingStart(agenda, startIndex);
		if (nextStart < 0) {
			return agenda;
		}
		const nextEnd = getSubtreeRange(agenda, nextStart).end;
		const currentBlock = agenda.slice(startIndex, end);
		const nextBlock = agenda.slice(nextStart, nextEnd);
		const result = [
			...agenda.slice(0, startIndex),
			...nextBlock,
			...currentBlock,
			...agenda.slice(nextEnd),
		];
		return hasValidDepthTransitions(result) ? result : agenda;
	} else if (direction === 'in') {
		const previous = agenda[startIndex - 1];
		if (!previous) {
			return agenda;
		}

		const baseDepth = agenda[startIndex].depth;
		const targetDepth = previous.depth === baseDepth ? baseDepth + 1 : previous.depth;

		if (targetDepth <= baseDepth) {
			return agenda;
		}

		const delta = targetDepth - baseDepth;
		const adjustedBlock = agenda.slice(startIndex, end).map((item) => {
			const next = Object.assign({}, item);
			next.depth = item.depth + delta;
			return next;
		});

		const result = [...agenda.slice(0, startIndex), ...adjustedBlock, ...agenda.slice(end)];
		return hasValidDepthTransitions(result) ? result : agenda;
	} else if (direction === 'out') {
		const baseDepth = agenda[startIndex].depth;
		if (baseDepth <= 0) {
			return agenda;
		}

		const adjustedBlock = agenda.slice(startIndex, end).map((item) => {
			const next = Object.assign({}, item);
			next.depth = Math.max(0, item.depth - 1);
			return next;
		});

		const result = [...agenda.slice(0, startIndex), ...adjustedBlock, ...agenda.slice(end)];
		return hasValidDepthTransitions(result) ? result : agenda;
	}
	return agenda;
}

export function getDirectChildren(agenda: Agenda, parentId: AgendaItemId): Agenda {
	const parent = findAgendaItemById(agenda, parentId);
	if (!parent) {
		return [];
	}
	const children: Agenda = [];
	const { end } = getSubtreeRange(agenda, parent.indexInAgenda);
	for (let i = parent.indexInAgenda + 1; i < end; i++) {
		if (agenda[i].depth === parent.item.depth + 1) {
			children.push(agenda[i]);
		}
	}
	return children;
}

export function insertChildAfterSubtree(
	agenda: Agenda,
	parentId: AgendaItemId,
	newItem: AgendaItem,
) {
	const parent = findAgendaItemById(agenda, parentId);
	if (!parent) {
		return agenda;
	}
	const insertIndex = getSubtreeRange(agenda, parent.indexInAgenda).end;
	const child = {
		...newItem,
		depth: parent.item.depth + 1,
	} satisfies AgendaItem;
	const result = [...agenda.slice(0, insertIndex), child, ...agenda.slice(insertIndex)];
	return hasValidDepthTransitions(result) ? result : agenda;
}

export function removeSubtree(agenda: Agenda, id: AgendaItemId) {
	const startIndex = findItemIndexById(agenda, id);
	if (startIndex < 0) {
		return {
			agenda,
			removed: [] as Agenda,
			startIndex,
		};
	}
	const { end } = getSubtreeRange(agenda, startIndex);
	return {
		agenda: [...agenda.slice(0, startIndex), ...agenda.slice(end)],
		removed: agenda.slice(startIndex, end),
		startIndex,
	};
}

export function removeItemKeepChildren(agenda: Agenda, id: AgendaItemId) {
	const index = findItemIndexById(agenda, id);
	if (index < 0) {
		return {
			agenda,
			removed: null as AgendaItem | null,
			index,
		};
	}
	const { end } = getSubtreeRange(agenda, index);
	const removed = agenda[index];
	const descendants = agenda.slice(index + 1, end).map((item) => {
		const next = Object.assign({}, item);
		next.depth = Math.max(0, item.depth - 1);
		return next;
	});
	const nextAgenda = [...agenda.slice(0, index), ...descendants, ...agenda.slice(end)];

	return {
		agenda: hasValidDepthTransitions(nextAgenda) ? nextAgenda : agenda,
		removed,
		index,
	};
}

export function getNextAgendaItem(agenda: Agenda, currentId: AgendaItemId | null) {
	if (!currentId) {
		return agenda.at(0);
	}
	const index = findItemIndexById(agenda, currentId);
	if (index < 0 || index >= agenda.length - 1) {
		return agenda.at(0);
	}
	return agenda[index + 1];
}

export function getPreviousAgendaItem(agenda: Agenda, currentId: AgendaItemId | null) {
	if (!currentId) {
		return agenda.at(0);
	}
	const index = findItemIndexById(agenda, currentId);
	if (index <= 0 || index >= agenda.length) {
		return agenda.at(0);
	}
	return agenda[index - 1];
}

export function createNewAgendaItem(title: string, depth = 0) {
	return {
		id: createAgendaItemId(),
		title,
		description: null,
		pollIds: [],
		depth,
	} satisfies AgendaItem;
}

export function appendToAgenda(agenda: Agenda, newItem: AgendaItem, parentId?: string) {
	return parentId ? insertChildAfterSubtree(agenda, parentId, newItem) : [...agenda, newItem];
}
