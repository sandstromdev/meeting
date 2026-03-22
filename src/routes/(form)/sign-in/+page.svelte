<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { PUBLIC_ENABLE_SIGNUP } from '$env/static/public';
	import { authClient } from '$lib/auth-client';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Field from '$lib/components/ui/field';
	import Input from '$lib/components/ui/input/input.svelte';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import { CONTACT_EMAIL } from '$lib/contact';
	import { ErrorMessages } from '$lib/errors';
	import { signIn } from '../data.remote';
	import { SignInSchema, validateRedirect } from '../schema';

	let { data } = $props();

	let loading = $state(false);
	let error = $state<string>();

	$effect(() => {
		if (data.email) {
			email.set(data.email);
		}
	});

	const errors = $derived([{ message: error }, ...(signIn.fields.issues() ?? [])]);

	const { email, _password } = signIn.fields;

	const signUpUrl = $derived(
		validateRedirect(data.redirect)
			? resolve(`/sign-up?redirect=${encodeURIComponent(data.redirect)}`)
			: resolve('/sign-up'),
	);

	const isSignUpDisabled = $derived(PUBLIC_ENABLE_SIGNUP !== 'true');
</script>

<div class="max-w-sm rounded-md border px-6 py-5">
	<form
		{...signIn.preflight(SignInSchema).enhance(async ({ data: fd }) => {
			try {
				error = undefined;
				loading = true;

				const { error: err } = await authClient.signIn.email({
					email: fd.email,
					password: fd._password,
				});

				if (err?.code === 'INVALID_EMAIL_OR_PASSWORD') {
					error = ErrorMessages.invalid_credentials();
				} else if (err?.message) {
					error = err.message;
				} else {
					const redirect = validateRedirect(data.redirect) ? data.redirect : '/anslut';
					// eslint-disable-next-line svelte/no-navigation-without-resolve
					await goto(redirect);
				}
			} catch (e) {
				console.error(e);
				error = 'Ett fel har inträffat.';
			} finally {
				loading = false;
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

			{#if !isSignUpDisabled}
				<Button href={signUpUrl} variant="outline">Skapa konto</Button>
			{:else}
				<p class="text-center text-sm text-muted-foreground">
					Registrering är inaktiverad för tillfället.<br />
					Kontakta
					<a href={`mailto:${CONTACT_EMAIL}`} class="text-primary underline">{CONTACT_EMAIL}</a> för att
					få hjälp.
				</p>
			{/if}
		</Field.Set>
	</form>
</div>
