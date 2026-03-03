export type AdminView = 'projector' | 'queue-control' | 'admin';

export const adminViewState = $state<{ view: AdminView }>({
	view: 'admin',
});
