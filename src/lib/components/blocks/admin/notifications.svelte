<script lang="ts">
	import Alert from '$lib/components/ui/alert/alert.svelte';
	import AlertDescription from '$lib/components/ui/alert/alert-description.svelte';
	import AlertTitle from '$lib/components/ui/alert/alert-title.svelte';
	import { Button } from '$lib/components/ui/button';
	import { useNotifications } from '$lib/notifications.svelte';
	import X from '@lucide/svelte/icons/x';
	import { getMeetingContext } from '$lib/context.svelte';

	const notifications = useNotifications();

	const meeting = getMeetingContext();
	const queue = meeting.speakerQueue;
</script>

<div class="space-y-2 p-4">
	<div class="font-medium">Meddelanden</div>

	{#if notifications.all.length === 0}
		<p class="text-sm text-muted-foreground">Inga meddelanden.</p>
	{:else}
		<div class="space-y-2">
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
</div>
