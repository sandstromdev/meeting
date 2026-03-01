<script lang="ts">
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Field from '$lib/components/ui/field';
	import Input from '$lib/components/ui/input/input.svelte';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import { signIn } from '../data.remote';
	import { SignInSchema } from '../schema';

	let { data } = $props();

	let loading = $state(false);
	let error = $state<string>();

	const errors = $derived([{ message: error }, ...(signIn.fields.issues() ?? [])]);

	const { email, _password } = signIn.fields;
</script>

<form
	{...signIn.preflight(SignInSchema).enhance(async ({ form, data, submit }) => {
		try {
			error = undefined;
			loading = true;
			await submit();

			/* if (signIn.result?.redirect) {
				window.location.pathname = signIn.result?.redirect;
			} */
		} catch (e) {
			loading = false;
			console.error(e);
			error = 'Ett fel har inträffat.';
		}
	})}
>
	<Field.Set class="w-2xs gap-3">
		<Field.Legend class="!text-xl font-bold">Logga in</Field.Legend>

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

		<Button type="submit" {loading}>Logga in</Button>

		<Separator />

		<Button href={resolve('/sign-up')} variant="outline">Skapa konto</Button>
	</Field.Set>
</form>
