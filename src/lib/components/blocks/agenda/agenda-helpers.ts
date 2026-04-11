/** Flat agenda line with outline number (any source: Convex meeting, simplified snapshot, etc.). */
export type AgendaViewItem = {
	id: string;
	title: string;
	depth: number;
	number: string;
};

export type FlatAgendaItem = AgendaViewItem;

export function hasBeenCompleted(currentIndex: number, idx: number): boolean {
	return currentIndex >= 0 && currentIndex > idx;
}

export function getSubtreeEnd(agenda: AgendaViewItem[], index: number): number {
	const current = agenda[index];
	if (!current) {
		return index + 1;
	}
	let cursor = index + 1;
	while (cursor < agenda.length && agenda[cursor].depth > current.depth) {
		cursor += 1;
	}
	return cursor;
}

export function canMoveUp(agenda: AgendaViewItem[], index: number): boolean {
	const current = agenda[index];
	if (!current) {
		return false;
	}
	for (let i = index - 1; i >= 0; i--) {
		if (agenda[i].depth < current.depth) {
			return false;
		}
		if (agenda[i].depth === current.depth) {
			return true;
		}
	}
	return false;
}

export function canMoveDown(agenda: AgendaViewItem[], index: number): boolean {
	const current = agenda[index];
	if (!current) {
		return false;
	}
	const nextSiblingIndex = getSubtreeEnd(agenda, index);
	if (nextSiblingIndex >= agenda.length) {
		return false;
	}
	return agenda[nextSiblingIndex].depth === current.depth;
}
