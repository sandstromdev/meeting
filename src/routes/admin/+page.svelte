<script lang="ts">
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/button/button.svelte';
	import SeoHead from '$lib/components/ui/seo-head.svelte';

	let { data } = $props();
</script>

<SeoHead title="Användare" description="Hantera plattformsanvändare och roller." />
<div class="flex flex-col gap-4">
	<div class="flex items-center justify-between">
		<h2 class="text-lg font-semibold">Användare ({data.total})</h2>
		<Button href={resolve('/admin/add')} size="sm">Lägg till användare</Button>
	</div>

	<div class="rounded-md border">
		<table class="w-full text-sm">
			<thead>
				<tr class="border-b text-left text-muted-foreground">
					<th class="px-4 py-3 font-medium">Namn</th>
					<th class="px-4 py-3 font-medium">E-post</th>
					<th class="px-4 py-3 font-medium">Roll</th>
					<th class="px-4 py-3 font-medium"></th>
				</tr>
			</thead>
			<tbody>
				{#each data.users as user (user.id)}
					<tr class="border-b last:border-b-0 hover:bg-muted/50">
						<td class="px-4 py-3">{user.name}</td>
						<td class="px-4 py-3 text-muted-foreground">{user.email}</td>
						<td class="px-4 py-3">
							<span
								class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium {user.role ===
								'admin'
									? 'bg-primary/10 text-primary'
									: 'bg-muted text-muted-foreground'}"
							>
								{user.role ?? 'user'}
							</span>
						</td>
						<td class="px-4 py-3 text-right">
							<Button href={resolve(`/admin/${user.id}`)} variant="outline" size="sm">
								Redigera
							</Button>
						</td>
					</tr>
				{:else}
					<tr>
						<td colspan="4" class="px-4 py-8 text-center text-muted-foreground">
							Inga användare hittades.
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
