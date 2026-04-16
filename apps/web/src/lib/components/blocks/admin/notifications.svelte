<script lang="ts">
	import AlertDescription from '$lib/components/ui/alert/alert-description.svelte';
	import AlertTitle from '$lib/components/ui/alert/alert-title.svelte';
	import Alert from '$lib/components/ui/alert/alert.svelte';
	import { Button } from '$lib/components/ui/button';
	import ScrollArea from '$lib/components/ui/scroll-area/scroll-area.svelte';
	import { useNotifications } from '$lib/notifications.svelte';
	import X from '@lucide/svelte/icons/x';

	const notifications = useNotifications();
</script>

<div class="">
	<div class="px-4 pt-4 font-medium">Meddelanden</div>

	<div class="relative">
		<ScrollArea class="my-4 h-auto max-h-64 px-4">
			{#if notifications.all.length === 0}
				<p class="text-sm text-muted-foreground">Inga meddelanden.</p>
			{:else}
				<div class="space-y-2 pb-4">
					{#each notifications.all as notification (notification.id)}
						<Alert variant={notification.variant} class="flex">
							<div class="flex-1">
								<AlertTitle>{notification.title}</AlertTitle>
								<AlertDescription>{notification.description}</AlertDescription>
							</div>
							<Button
								variant="ghost"
								size="icon"
								onclick={() => notifications.dismiss(notification.id)}
								type="button"
								class="-mt-2 -mr-3 shrink-0"
							>
								<X />
							</Button>
						</Alert>
					{/each}
				</div>
			{/if}
		</ScrollArea>
		{#if notifications.all.length > 0}
			<div
				class="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-b from-transparent to-background"
			></div>
		{/if}
	</div>
</div>
