import { api } from '@lsnd/convex/_generated/api';
import type { AgendaItem, Agenda } from '@lsnd/convex/helpers/agenda';
import { notifyMutation } from '$lib/admin-toast';
import { confirm } from '$lib/components/ui/confirm-dialog/confirm-dialog.svelte';
import type { MeetingState } from '$lib/context.svelte';

export function hasChildren(flatAgenda: AgendaItem[], itemId: string) {
	const index = flatAgenda.findIndex((item) => item.id === itemId);
	if (index < 0) {
		return false;
	}
	const current = flatAgenda[index];
	const next = flatAgenda[index + 1];
	return !!next && next.depth > current.depth;
}

export function removeAgendaItemWithChoice(meeting: MeetingState, itemId: string) {
	if (!hasChildren(meeting.agenda.flat, itemId)) {
		confirm({
			title: 'Ta bort underpunkt?',
			description: 'Är du säker på att du vill ta bort denna underpunkt?',
			onConfirm: () =>
				notifyMutation(
					'Underpunkt borttagen.',
					() =>
						meeting.adminMutate(api.meeting.admin.agenda.removeAgendaItem, {
							agendaItemId: itemId,
							deletionMode: 'delete_subtree',
						}),
					{ rethrow: true },
				),
		});
		return;
	}

	confirm({
		title: 'Underpunkten har egna underpunkter',
		description: 'Vill du behålla dessa underpunkter och bara ta bort den valda raden?',
		cancel: {
			text: 'Avbryt',
			variant: 'outline',
		},
		actions: [
			{
				value: 'keep_children',
				text: 'Behåll underpunkter',
				variant: 'secondary',
				onClick: () => {
					notifyMutation(
						'Underpunkt borttagen (djupare nivåer behölls).',
						() =>
							meeting.adminMutate(api.meeting.admin.agenda.removeAgendaItem, {
								agendaItemId: itemId,
								deletionMode: 'keep_children',
							}),
						{ rethrow: true },
					);
				},
			},
			{
				value: 'delete_subtree',
				text: 'Ta bort alla',
				variant: 'destructive',
				onClick: () => {
					notifyMutation('Underpunkt borttagen (djupare nivåer behölls).', () =>
						meeting.adminMutate(api.meeting.admin.agenda.removeAgendaItem, {
							agendaItemId: itemId,
							deletionMode: 'delete_subtree',
						}),
					);
				},
			},
		],
	});
}

export function getChildren(agenda: Agenda, itemId: string) {
	const parentIndex = agenda.findIndex((item) => item.id === itemId);

	if (parentIndex < 0) {
		return [];
	}

	const parent = agenda[parentIndex];
	const baseDepth = parent.depth;
	const directChildDepth = baseDepth + 1;

	let subtreeEnd = parentIndex + 1;
	while (subtreeEnd < agenda.length && agenda[subtreeEnd].depth > baseDepth) {
		subtreeEnd += 1;
	}

	const children: Agenda = [];
	for (let i = parentIndex + 1; i < subtreeEnd; i++) {
		if (agenda[i].depth === directChildDepth) {
			children.push(agenda[i]);
		}
	}

	return children;
}
