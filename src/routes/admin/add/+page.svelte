<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { authClient } from '$lib/auth-client';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Field from '$lib/components/ui/field';
	import Input from '$lib/components/ui/input/input.svelte';
	import * as NativeSelect from '$lib/components/ui/native-select';

	let name = $state('');
	let email = $state('');
	let password = $state('');
	let role = $state<'admin' | 'user'>('user');
	let loading = $state(false);
	let error = $state<string>();

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		loading = true;
		error = undefined;

		const { error: err } = await authClient.admin.createUser({
			name,
			email,
			password,
			role,
		});

		if (err) {
			loading = false;
			if (err.code === 'USER_ALREADY_EXISTS') {
				error = 'E-postadressen är redan i bruk.';
			} else {
				console.error(err);
				error = 'Ett fel har inträffat.';
			}
			return;
		}

		await goto(resolve('/admin'));
	}
</script>

<div class="max-w-md">
	<form onsubmit={handleSubmit} class="flex flex-col gap-4">
		<h2 class="text-lg font-semibold">Lägg till användare</h2>

		<Field.Field>
			<Field.Label for="name">Namn</Field.Label>
			<Input id="name" type="text" bind:value={name} required />
		</Field.Field>

		<Field.Field>
			<Field.Label for="email">E-postadress</Field.Label>
			<Input id="email" type="email" bind:value={email} required />
		</Field.Field>

		<Field.Field>
			<Field.Label for="password">Lösenord</Field.Label>
			<Input id="password" type="password" bind:value={password} required minlength={4} />
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

		<div class="flex gap-2">
			<Button type="submit" {loading}>Skapa användare</Button>
			<Button href={resolve('/admin')} variant="outline">Avbryt</Button>
		</div>
	</form>
</div>
