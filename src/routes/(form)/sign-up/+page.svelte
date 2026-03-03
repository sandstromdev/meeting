<script lang="ts">
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Field from '$lib/components/ui/field';
	import Input from '$lib/components/ui/input/input.svelte';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import { signUp } from '../data.remote';
	import { SignUpSchema } from '../schema';

	let { data } = $props();

	let loading = $state(false);
	let error = $state<string>();

	const errors = $derived([{ message: error }, ...(signUp.fields.issues() ?? [])]);

	const { name, email, _password } = signUp.fields;
</script>

<form
	{...signUp.preflight(SignUpSchema).enhance(async ({ form, data, submit }) => {
		try {
			error = undefined;
			loading = true;

			await submit();

			window.location.pathname = '/';
		} catch (e) {
			loading = false;
			console.error(e);
			error = 'Ett fel har inträffat.';
		}
	})}
>
	<Field.Set class="w-2xs gap-3">
		<Field.Legend class="!text-xl font-bold">Skapa konto</Field.Legend>

		<Field.Field>
			<Field.Label for="name">För- och Efternamn</Field.Label>
			<Input id="name" {...name.as('text')} />
			<Field.Error errors={name.issues()} />
		</Field.Field>

		<Field.Field>
			<Field.Label for="email">E-postadress</Field.Label>
			<Input id="email" {...email.as('email')} />
			<Field.Error errors={email.issues()} />
		</Field.Field>

		<Field.Field>
			<Field.Label for="password">Lösenord</Field.Label>
			<Input id="password" {..._password.as('password')} />
			<Field.Error errors={_password.issues()} />
		</Field.Field>

		<Field.Error {errors} />

		<Button type="submit">Skapa konto</Button>

		<Separator />

		<Button href={resolve('/sign-in')} variant="outline">Logga in</Button>
	</Field.Set>
</form>
