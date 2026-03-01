export type Notification = {
	id: number;
	title: string;
	description: string;
	variant: 'default' | 'destructive' | 'warning';
};

let notifications = $state<Notification[]>([]);
let nextId = $state(0);
let timeoutIds = $state<NodeJS.Timeout[]>([]);

export function useNotifications() {
	function clear() {
		notifications = [];
	}

	function dismiss(id: number) {
		notifications = notifications.filter((n) => n.id !== id);
	}

	function add(notification: Omit<Notification, 'id'>, duration?: number) {
		const id = nextId++;

		notifications.push({
			id,
			...notification,
		});

		if (duration) {
			const timeoutId = setTimeout(() => {
				dismiss(id);
			}, duration);

			timeoutIds.push(timeoutId);
		}

		return id;
	}

	return {
		get all() {
			return notifications;
		},
		dismiss,
		add,
		clear,
	};
}
