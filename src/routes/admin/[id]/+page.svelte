<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { authClient } from '$lib/auth-client';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Field from '$lib/components/ui/field';
	import Input from '$lib/components/ui/input/input.svelte';
	import * as NativeSelect from '$lib/components/ui/native-select';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import { toast } from 'svelte-sonner';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	let name = $state(data.user.name);
	// svelte-ignore state_referenced_locally
	let role = $state<'admin' | 'user'>((data.user.role as 'admin' | 'user') ?? 'user');
	let loading = $state(false);
	let error = $state<string>();
	let success = $state(false);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		loading = true;
		error = undefined;
		success = false;

		const results = await Promise.all([
			role !== (data.user.role ?? 'user')
				? authClient.admin.setRole({ userId: data.user.id, role })
				: null,
			name !== data.user.name
				? authClient.admin.updateUser({ userId: data.user.id, data: { name } })
				: null,
		]);

		const failed = results.find((r) => r?.error);

		if (failed?.error) {
			loading = false;
			console.error(failed.error);
			error = 'Ett fel har inträffat.';
			toast.error('Kunde inte spara ändringarna.');
			return;
		}

		await invalidateAll();
		loading = false;
		success = true;
		toast.success('Ändringar sparade.');
	}

	async function handleRemove() {
		if (!confirm('Är du säker på att du vill ta bort denna användare?')) {
			return;
		}

		loading = true;
		error = undefined;

		const { error: err } = await authClient.admin.removeUser({
			userId: data.user.id,
		});

		if (err) {
			loading = false;
			console.error(err);
			error = 'Kunde inte ta bort användaren.';
			toast.error('Kunde inte ta bort användaren.');
			return;
		}

		toast.success('Användaren togs bort.');
		await goto(resolve('/admin'));
	}
</script>

<div class="max-w-md">
	<form onsubmit={handleSubmit} class="flex flex-col gap-4">
		<h2 class="text-lg font-semibold">Redigera användare</h2>

		<Field.Field>
			<Field.Label for="name">Namn</Field.Label>
			<Input id="name" type="text" bind:value={name} required />
		</Field.Field>

		<Field.Field>
			<Field.Label for="email">E-postadress</Field.Label>
			<Input id="email" type="email" value={data.user.email} disabled />
			<Field.Description>E-postadressen kan inte ändras.</Field.Description>
		</Field.Field>

		<Field.Field>
			<Field.Label for="role">Roll</Field.Label>
			<NativeSelect.Root id="role" bind:value={role}>
				<option value="user">Användare</option>
				<option value="admin">Admin</option>
			</NativeSelect.Root>
		</Field.Field>

		{#if error}
			<Field.Error errors={[{ message: error }]} />
		{/if}

		{#if success}
			<p class="text-sm text-green-600">Ändringar sparade.</p>
		{/if}

		<div class="flex gap-2">
			<Button type="submit" {loading}>Spara</Button>
			<Button href={resolve('/admin')} variant="outline">Tillbaka</Button>
		</div>
	</form>

	<Separator class="my-6" />

	<div class="flex flex-col gap-2">
		<h3 class="text-sm font-semibold text-destructive">Ta bort användare</h3>
		<Button variant="destructive" size="sm" onclick={handleRemove} disabled={loading}>
			Ta bort {data.user.name}
		</Button>
	</div>
</div>
