<script lang="ts">
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Field from '$lib/components/ui/field';
	import Input from '$lib/components/ui/input/input.svelte';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import { signIn } from '../data.remote';
	import { SignInSchema, validateRedirect } from '../schema';

	let { data } = $props();

	let loading = $state(false);
	let error = $state<string>();

	const errors = $derived([{ message: error }, ...(signIn.fields.issues() ?? [])]);

	const { email, _password } = signIn.fields;

	const signUpUrl = $derived(
		resolve('/sign-up') + (validateRedirect(data.redirect) ? `?redirect=${data.redirect}` : ''),
	);
</script>

<div class="max-w-sm rounded-md border px-6 py-5">
	<form
		{...signIn.preflight(SignInSchema).enhance(async ({ submit }) => {
			try {
				error = undefined;
				loading = true;

				await submit();

				if (signIn.result?.success) {
					if (validateRedirect(data.redirect)) {
						window.location.pathname = data.redirect;
					} else {
						window.location.pathname = '/anslut';
					}
				}
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

			<Button href={signUpUrl} variant="outline">Skapa konto</Button>
		</Field.Set>
	</form>
</div>
