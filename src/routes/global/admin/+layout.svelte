<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Button from '$lib/components/ui/button/button.svelte';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	const navItems = [
		{ href: resolve('/global/admin'), label: 'Användare' },
		{ href: resolve('/global/admin/add'), label: 'Lägg till' },
	];
</script>

<div class="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-8">
	<header class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">Admin</h1>
		<p class="text-sm text-muted-foreground">{data.currentUser.email}</p>
	</header>

	<nav class="flex gap-2 border-b pb-3">
		{#each navItems as item (item.href)}
			<Button
				href={item.href}
				variant={page.url.pathname === item.href ? 'default' : 'outline'}
				size="sm"
			>
				{item.label}
			</Button>
		{/each}
	</nav>

	{@render children()}
</div>
