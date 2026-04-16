import { MeetingStatus } from '$convex/schema/meetings';
import type { BadgeVariant } from './components/ui/badge';

export type MeetingStatus = typeof MeetingStatus.type;

export const STATUS_LABELS: Record<MeetingStatus, string> = {
	draft: 'Utkast',
	scheduled: 'Planerat',
	active: 'Pågående',
	closed: 'Avslutat',
	archived: 'Arkiverat',
};

export const STATUS_VARIANTS: Record<MeetingStatus, BadgeVariant> = {
	draft: 'outline',
	scheduled: 'info',
	active: 'success',
	closed: 'warning',
	archived: 'destructive',
};
