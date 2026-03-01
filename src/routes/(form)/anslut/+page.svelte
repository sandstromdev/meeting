<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Field from '$lib/components/ui/field';
	import * as InputOTP from '$lib/components/ui/input-otp';
	import Input from '$lib/components/ui/input/input.svelte';
	import Label from '$lib/components/ui/label/label.svelte';
	import { REGEXP_ONLY_DIGITS_AND_CHARS } from 'bits-ui';
	import { connectForm } from './connect.remote';
	import { ConnectFormSchema } from './schema';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import { resolve } from '$app/paths';

	let { data } = $props();

	const { meetingCode } = connectForm.fields;
</script>

<form {...connectForm.preflight(ConnectFormSchema)} class="max-w-[266px]">
	<Field.Set class="gap-4">
		<Field.Legend class="text-xl font-semibold">Anslut till möte</Field.Legend>

		<Field.Field>
			<Label for="meeting-code">Möteskod</Label>
			<InputOTP.Root
				maxlength={6}
				id="meeting-code"
				pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
				{...meetingCode.as('text') as {
					value: string;
				}}
			>
				{#snippet children({ cells })}
					<InputOTP.Group>
						{#each cells as cell (cell)}
							<InputOTP.Slot {cell} />
						{/each}
					</InputOTP.Group>
				{/snippet}
			</InputOTP.Root>
			<Field.Error errors={meetingCode.issues()} />
		</Field.Field>

		<Field.Error errors={connectForm.fields.issues()} />

		<Button type="submit">Anslut till mötet</Button>

		<Separator />

		{#if data.currentUser}
			<p class="text-center text-sm text-muted-foreground">
				Inloggad som <span class="font-semibold text-foreground">{data.currentUser.email}</span>.<br
				/>
				Inte du?
				<a class="text-primary underline" href={resolve('/api/sign-out')} data-sveltekit-reload
					>Byt konto</a
				>.
			</p>
		{/if}
	</Field.Set>
</form>
