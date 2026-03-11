<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import DropdownMenuContent from '$lib/components/ui/dropdown-menu/dropdown-menu-content.svelte';
	import DropdownMenuGroup from '$lib/components/ui/dropdown-menu/dropdown-menu-group.svelte';
	import DropdownMenuLabel from '$lib/components/ui/dropdown-menu/dropdown-menu-label.svelte';
	import DropdownMenuRadioGroup from '$lib/components/ui/dropdown-menu/dropdown-menu-radio-group.svelte';
	import DropdownMenuRadioItem from '$lib/components/ui/dropdown-menu/dropdown-menu-radio-item.svelte';
	import DropdownMenuSeparator from '$lib/components/ui/dropdown-menu/dropdown-menu-separator.svelte';
	import DropdownMenuTrigger from '$lib/components/ui/dropdown-menu/dropdown-menu-trigger.svelte';
	import DropdownMenu from '$lib/components/ui/dropdown-menu/dropdown-menu.svelte';
	import { usePageState } from '$lib/page-state.svelte';
	import type { View } from '$lib/page-state.svelte';
	import { cn } from '$lib/utils';
	import ListOrderedIcon from '@lucide/svelte/icons/list-ordered';
	import MonitorIcon from '@lucide/svelte/icons/monitor';
	import PresentationIcon from '@lucide/svelte/icons/presentation';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import UsersIcon from '@lucide/svelte/icons/users';

	let {
		compact = false,
		triggerClass = 'absolute top-8 right-8',
	}: { compact?: boolean; triggerClass?: string } = $props();

	const ps = usePageState();

	type MenuItem = { value: string; label: string; icon: typeof MonitorIcon };
	type MenuGroup = {
		condition?: () => boolean;
		label?: string;
		bindKey: 'view' | 'projectorMode';
		items: MenuItem[];
	};

	const menuGroups = [
		{
			label: 'View',
			bindKey: 'view',
			items: [
				{ value: 'projector', label: 'Projektor', icon: MonitorIcon },
				{ value: 'queue', label: 'Talarkö', icon: ListOrderedIcon },
				{ value: 'default', label: 'Admin', icon: SettingsIcon },
			],
		},
		{
			condition: () => ps.isProjector,
			label: 'Projector',
			bindKey: 'projectorMode',
			items: [
				{ value: 'intro', label: 'Intro mode', icon: PresentationIcon },
				{ value: 'meeting', label: 'Meeting mode', icon: UsersIcon },
			],
		},
	] satisfies MenuGroup[];

	const shownMenuGroups = $derived(menuGroups.filter((group) => group.condition?.() !== false));
</script>

{#snippet radioGroup(group: MenuGroup)}
	<DropdownMenuRadioGroup bind:value={ps[group.bindKey]}>
		{#each group.items as { value, label, icon: Icon } (value)}
			<DropdownMenuRadioItem variant="fill" {value}>
				<Icon class="size-4 shrink-0" />
				{label}
			</DropdownMenuRadioItem>
		{/each}
	</DropdownMenuRadioGroup>
{/snippet}

{#if compact}
	<DropdownMenu>
		<DropdownMenuTrigger class={triggerClass}>
			{#snippet child({ props })}
				<Button variant="outline" size="icon" {...props}>
					<MonitorIcon class="size-4" />
				</Button>
			{/snippet}
		</DropdownMenuTrigger>
		<DropdownMenuContent align="end">
			{#each shownMenuGroups as group, i (group.bindKey)}
				{#if i > 0}
					<DropdownMenuSeparator />
				{/if}
				{#if group.label}
					<DropdownMenuGroup>
						<DropdownMenuLabel>{group.label}</DropdownMenuLabel>
						{@render radioGroup(group)}
					</DropdownMenuGroup>
				{:else}
					{@render radioGroup(group)}
				{/if}
			{/each}
		</DropdownMenuContent>
	</DropdownMenu>
{:else}
	<div class={cn('flex gap-2', compact ? 'flex-row' : 'flex-col px-4 py-3')}>
		{#if !compact}
			<h2 class="font-semibold">Vy</h2>
		{/if}
		<div class="grid grid-cols-3 gap-2">
			{#each menuGroups[0].items as { value, label, icon: Icon } (value)}
				<Button
					type="button"
					variant={ps.view === value ? 'default' : 'outline'}
					disabled={ps.view === value}
					class={cn(
						'flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors',
						ps.view === value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/50',
					)}
					onclick={() => (ps.view = value as View)}
				>
					<Icon class="size-4 shrink-0" />
					{label}
				</Button>
			{/each}
		</div>
	</div>
{/if}
