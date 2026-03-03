<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import DropdownMenuContent from '$lib/components/ui/dropdown-menu/dropdown-menu-content.svelte';
	import DropdownMenuRadioGroup from '$lib/components/ui/dropdown-menu/dropdown-menu-radio-group.svelte';
	import DropdownMenuRadioItem from '$lib/components/ui/dropdown-menu/dropdown-menu-radio-item.svelte';
	import DropdownMenuTrigger from '$lib/components/ui/dropdown-menu/dropdown-menu-trigger.svelte';
	import DropdownMenu from '$lib/components/ui/dropdown-menu/dropdown-menu.svelte';
	import { useSearchParams } from '$lib/search-params.svelte';
	import { cn } from '$lib/utils';
	import ListOrderedIcon from '@lucide/svelte/icons/list-ordered';
	import MonitorIcon from '@lucide/svelte/icons/monitor';
	import SettingsIcon from '@lucide/svelte/icons/settings';

	let { compact = false }: { compact?: boolean } = $props();

	const params = useSearchParams();

	const options = [
		{ value: 'projector', label: 'Projektor', icon: MonitorIcon },
		{ value: 'queue', label: 'Talarkö', icon: ListOrderedIcon },
		{ value: 'default', label: 'Admin', icon: SettingsIcon },
	] as const;
</script>

{#if compact}
	<DropdownMenu>
		<DropdownMenuTrigger>
			<Button variant="outline" size="icon">
				<MonitorIcon class="size-4" />
			</Button>
		</DropdownMenuTrigger>
		<DropdownMenuContent>
			<DropdownMenuRadioGroup bind:value={params.view}>
				{#each options as { value, label, icon: Icon } (value)}
					<DropdownMenuRadioItem variant="fill" {value}>
						<Icon class="size-4 shrink-0" />
						{label}
					</DropdownMenuRadioItem>
				{/each}
			</DropdownMenuRadioGroup>
		</DropdownMenuContent>
	</DropdownMenu>
{:else}
	<div class={cn('flex gap-2', compact ? 'flex-row' : 'flex-col px-4 py-3')}>
		{#if !compact}
			<h2 class="font-semibold">Vy</h2>
		{/if}
		<div class="grid grid-cols-3 gap-2">
			{#each options as { value, label, icon: Icon } (value)}
				<Button
					type="button"
					variant={params.view === value ? 'default' : 'outline'}
					disabled={params.view === value}
					class={cn(
						'flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors',
						params.view === value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/50',
					)}
					onclick={() => (params.view = value)}
				>
					<Icon class="size-4 shrink-0" />
					{label}
				</Button>
			{/each}
		</div>
	</div>
{/if}
