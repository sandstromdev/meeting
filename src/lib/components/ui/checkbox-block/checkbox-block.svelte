<script lang="ts">
	import Label from '$lib/components/ui/label/label.svelte';
	import { cn } from '$lib/utils';

	let { class: className, children }: { class?: string; children: import('svelte').Snippet } =
		$props();
</script>

<Label
	slot="group"
	class={cn(
		'group flex items-start gap-3 rounded-lg border bg-white p-3 hover:bg-muted/50 has-[[aria-checked=true]]:border-primary/20 has-[[aria-checked=true]]:bg-muted has-[[aria-invalid=true]]:border-destructive has-[[aria-invalid=true]]:bg-destructive/5 has-[[disabled]]:pointer-events-none has-[[disabled]]:opacity-50',
		className,
	)}
>
	{@render children()}
</Label>
