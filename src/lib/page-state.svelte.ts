import { resolve } from '$app/paths';
import { page } from '$app/state';

export type View = 'projector' | 'queue' | 'default';
export type ProjectorMode = 'intro' | 'meeting';

export function usePageState() {
	const projectorBase = resolve('/admin/projector');
	const projectorIntroPath = resolve('/admin/projector/intro');
	const adminQueuePath = resolve('/admin/queue');
	const moderatorPath = resolve('/moderator');

	return {
		get view(): View {
			const p = page.url.pathname;
			if (p.startsWith(projectorBase)) {
				return 'projector';
			}
			if (p === adminQueuePath || p === moderatorPath) {
				return 'queue';
			}
			return 'default';
		},

		get projectorMode(): ProjectorMode {
			return page.url.pathname === projectorIntroPath ? 'intro' : 'meeting';
		},

		get isProjector() {
			return page.url.pathname.startsWith(projectorBase);
		},
		get isQueue() {
			const p = page.url.pathname;
			return p === adminQueuePath || p === moderatorPath;
		},
		get isDefault() {
			return !this.isProjector && !this.isQueue;
		},
	};
}
