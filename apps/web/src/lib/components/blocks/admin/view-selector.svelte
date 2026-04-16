<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Pathname } from '$app/types';
	import Button from '$lib/components/ui/button/button.svelte';
	import DropdownMenuContent from '$lib/components/ui/dropdown-menu/dropdown-menu-content.svelte';
	import DropdownMenuGroup from '$lib/components/ui/dropdown-menu/dropdown-menu-group.svelte';
	import DropdownMenuItem from '$lib/components/ui/dropdown-menu/dropdown-menu-item.svelte';
	import DropdownMenuLabel from '$lib/components/ui/dropdown-menu/dropdown-menu-label.svelte';
	import DropdownMenuSeparator from '$lib/components/ui/dropdown-menu/dropdown-menu-separator.svelte';
	import DropdownMenuTrigger from '$lib/components/ui/dropdown-menu/dropdown-menu-trigger.svelte';
	import DropdownMenu from '$lib/components/ui/dropdown-menu/dropdown-menu.svelte';
	import { cn } from '$lib/utils';
	import ListOrderedIcon from '@lucide/svelte/icons/list-ordered';
	import MonitorIcon from '@lucide/svelte/icons/monitor';
	import PresentationIcon from '@lucide/svelte/icons/presentation';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import UsersIcon from '@lucide/svelte/icons/users';

	let { triggerClass = 'absolute top-8 right-8' }: { triggerClass?: string } = $props();

	const routes = {
		admin: resolve('/m/admin'),
		queue: resolve('/m/admin/queue'),
		projector: resolve('/m/admin/projector'),
		projectorIntro: resolve('/m/admin/projector/intro'),
	};

	type MenuItem = {
		href: Pathname;
		label: string;
		icon: typeof MonitorIcon;
		isSelected?: () => boolean;
	};
	type MenuGroup = {
		condition?: () => boolean;
		label: string;
		items: MenuItem[];
	};

	const menuGroups: MenuGroup[] = [
		{
			label: 'View',
			items: [
				{
					href: '/m/admin/projector',
					label: 'Projektor',
					icon: MonitorIcon,
					isSelected: () => page.url.pathname.startsWith('/m/admin/projector'),
				},
				{ href: '/m/admin/queue', label: 'Talarkö', icon: ListOrderedIcon },
				{ href: '/m/admin', label: 'Admin', icon: SettingsIcon },
			],
		},
		{
			condition: () => isProjector,
			label: 'Projector',
			items: [
				{
					href: '/m/admin/projector/intro',
					label: 'Intro mode',
					icon: PresentationIcon,
				},
				{
					href: '/m/admin/projector',
					label: 'Meeting mode',
					icon: UsersIcon,
				},
			],
		},
	];

	const isProjector = $derived(page.url.pathname.startsWith(routes.projector));

	const shownMenuGroups = $derived(menuGroups.filter((group) => group.condition?.() !== false));
</script>

<DropdownMenu>
	<DropdownMenuTrigger class={triggerClass}>
		{#snippet child({ props })}
			<Button variant="outline" size="icon" {...props}>
				<MonitorIcon class="size-4" />
			</Button>
		{/snippet}
	</DropdownMenuTrigger>
	<DropdownMenuContent align="end">
		{#each shownMenuGroups as group, i (i)}
			{#if i > 0}
				<DropdownMenuSeparator />
			{/if}
			<DropdownMenuGroup>
				<DropdownMenuLabel>{group.label}</DropdownMenuLabel>
				{#each group.items as { href, label, icon: Icon, isSelected } (href)}
					<DropdownMenuItem>
						{#snippet child({ props })}
							<a
								href={resolve(href)}
								aria-current={isSelected?.() ?? page.url.pathname === href}
								{...props}
								class={cn(
									props.class as string,
									(isSelected?.() ?? page.url.pathname === href) &&
										'bg-muted text-muted-foreground',
								)}
							>
								<Icon class="size-4 shrink-0" />
								{label}
							</a>
						{/snippet}
					</DropdownMenuItem>
				{/each}
			</DropdownMenuGroup>
		{/each}
	</DropdownMenuContent>
</DropdownMenu>
