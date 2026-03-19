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
	import { isAppError, isAppErrorCode } from '$convex/helpers/error';
	import Alert from '$lib/components/ui/alert/alert.svelte';
	import AlertTitle from '$lib/components/ui/alert/alert-title.svelte';
	import AlertDescription from '$lib/components/ui/alert/alert-description.svelte';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import { signOut } from '$lib/auth-client';
	import { goto } from '$app/navigation';

	let { data } = $props();

	let loading = $state(false);

	const { meetingCode } = connectForm.fields;

	$effect(() => {
		if (data.meetingCode) {
			meetingCode.set(data.meetingCode);
		}
	});
</script>

<div class="flex max-w-[266px] flex-col gap-4">
	<div class="rounded-md border px-6 py-5">
		<form
			{...connectForm.preflight(ConnectFormSchema).enhance(async ({ submit }) => {
				try {
					loading = true;
					await submit();
				} catch (e) {
					console.error(e);
				} finally {
					loading = false;
				}
			})}
		>
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

				<Button type="submit" {loading}>Anslut till mötet</Button>

				<Separator />

				{#if data.currentUser}
					<p class="text-center text-sm text-muted-foreground">
						Inloggad som <span class="font-semibold text-foreground">{data.currentUser.email}</span
						>.<br />
						Inte du?
						<a
							class="text-primary underline"
							href={resolve('/sign-in')}
							onclick={async (e) => {
								e.preventDefault();
								await signOut();
								goto(resolve('/sign-in'));
							}}
							data-sveltekit-reload>Byt konto</a
						>.
					</p>
				{/if}
			</Field.Set>
		</form>
	</div>

	{#if data.error && isAppErrorCode(data.error)}
		{#if data.error === 'invalid_meeting_code'}
			<Alert variant="destructive">
				<AlertTriangle class="size-4" />
				<AlertTitle>Ogiltig möteskod.</AlertTitle>
				<AlertDescription><p>Möteskoden måste bestå utav 6 siffror.</p></AlertDescription>
			</Alert>
		{:else if data.error === 'meeting_not_found'}
			<Alert variant="warning">
				<AlertTriangle class="size-4" />
				<AlertTitle>Hoppsan!</AlertTitle>
				<AlertDescription
					><p>Mötet med möteskoden '{data.meetingCode}' hittades inte.</p></AlertDescription
				>
			</Alert>
		{:else if data.error === 'participant_banned'}
			<Alert variant="destructive">
				<AlertTriangle class="size-4" />
				<AlertTitle>Avstängd från mötet</AlertTitle>
				<AlertDescription
					><p>
						Du har blivit avstängd från detta möte och kan inte ansluta igen.
					</p></AlertDescription
				>
			</Alert>
		{:else}
			<Alert variant="destructive">
				<AlertTriangle class="size-4" />
				<AlertTitle>Hoppsan! Ett fel har inträffat.</AlertTitle>
				<AlertDescription
					><p>
						Kontakta <a href="mailto:contact@lsnd.se" class="font-semibold underline"
							>kontakt@lsnd.se</a
						>
						för hjälp. Felkod: <code>{data.error}</code>
					</p></AlertDescription
				>
			</Alert>
		{/if}
	{/if}
</div>
