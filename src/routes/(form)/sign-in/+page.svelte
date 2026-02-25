<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Field from '$lib/components/ui/field';
	import * as InputOTP from '$lib/components/ui/input-otp';
	import Input from '$lib/components/ui/input/input.svelte';
	import Label from '$lib/components/ui/label/label.svelte';
	import { REGEXP_ONLY_DIGITS_AND_CHARS } from 'bits-ui';
	import { authClient } from '$lib/auth-client';
	import { api } from '$convex/_generated/api';
	import { useQuery } from 'convex-svelte';
	import { useAuth } from '@mmailaender/convex-better-auth-svelte/svelte';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import { resolve } from '$app/paths';
	import { signIn } from '../data.remote';
	import { SignInSchema } from '../schema';

	let { data } = $props();

	const { email, _password } = signIn.fields;
</script>

<form
	{...signIn.preflight(SignInSchema).enhance(async ({ form, data, submit }) => {
		try {
			await submit();

			if (signIn.result?.redirect) {
				window.location.pathname = signIn.result?.redirect;
			}
		} catch (e) {
			console.error(e);
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

		<Field.Error errors={signIn.fields.issues()} />

		<Button type="submit">Logga in</Button>

		<Separator />

		<Button href={resolve('/sign-up')} variant="outline">Skapa konto</Button>
	</Field.Set>
</form>
