import type { ButtonElementProps } from '$lib/components/ui/button';
import type { UseClipboard } from '$lib/hooks/use-clipboard.svelte';
import type { WithChildren } from 'bits-ui';
import type { Snippet } from 'svelte';

export type CopyButtonProps = ButtonElementProps &
	WithChildren<{
		text: string;
		icon?: Snippet<[]>;
		animationDuration?: number;
		onCopy?: (status: UseClipboard['status']) => void;
	}>;
