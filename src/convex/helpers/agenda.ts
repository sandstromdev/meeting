import type { Doc } from '$convex/_generated/dataModel';

export function createAgendaItemId() {
	return `agenda_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeAgendaItems(agenda: Doc<'meetings'>['agenda']) {
	return agenda.map((item, index) => {
		return {
			id: item.id.length > 0 ? item.id : createAgendaItemId(),
			title: item.title ?? `Punkt ${index + 1}`,
			pollIds: Array.isArray(item.pollIds) ? item.pollIds : [],
		};
	});
}

export function findAgendaItemIndex(agenda: Doc<'meetings'>['agenda'], agendaItemId: string) {
	return agenda.findIndex((item) => item.id === agendaItemId);
}

export function getCurrentAgendaItemIndex(ctx: { meeting: Doc<'meetings'> }) {
	return Math.max(
		0,
		findAgendaItemIndex(
			normalizeAgendaItems(ctx.meeting.agenda),
			ctx.meeting.currentAgendaItemId ?? '',
		),
	);
}
