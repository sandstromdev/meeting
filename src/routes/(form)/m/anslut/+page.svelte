<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { isAppErrorCode } from '$convex/helpers/error';
	import { signOut } from '$lib/auth-client';
	import AlertDescription from '$lib/components/ui/alert/alert-description.svelte';
	import AlertTitle from '$lib/components/ui/alert/alert-title.svelte';
	import Alert from '$lib/components/ui/alert/alert.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Field from '$lib/components/ui/field';
	import * as InputOTP from '$lib/components/ui/input-otp';
	import Label from '$lib/components/ui/label/label.svelte';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import { CONTACT_EMAIL } from '$lib/contact';
	import SeoHead from '$lib/components/ui/seo-head.svelte';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import { REGEXP_ONLY_DIGITS_AND_CHARS } from 'bits-ui';
	import { connectForm } from './connect.remote';
	import { ConnectFormSchema } from './schema';

	let { data } = $props();

	let loading = $state(false);

	const { meetingCode } = connectForm.fields;

	$effect(() => {
		if (data.meetingCode) {
			meetingCode.set(data.meetingCode);
		}
	});
</script>

<SeoHead
	title="Anslut till möte"
	description="Ange möteskod för att delta i mötet i samma rum som övriga deltagare."
/>

<div class="flex max-w-[266px] flex-col gap-4">
	<div class="rounded-md border px-6 py-5">
		<form
			{...connectForm.preflight(ConnectFormSchema).enhance(async ({ submit }) => {
				try {
					loading = true;
					await submit();
					if (connectForm.result?.success) {
						await goto(resolve('/m'));
					}
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
		{:else if data.error === 'meeting_archived'}
			<Alert variant="warning">
				<AlertTriangle class="size-4" />
				<AlertTitle>Mötet är arkiverat</AlertTitle>
				<AlertDescription
					><p>
						Detta möte kan inte längre öppnas. Organisatören kan återställa det från möteslistan.
					</p></AlertDescription
				>
			</Alert>
		{:else if data.error === 'meeting_access_denied'}
			<Alert variant="warning">
				<AlertTriangle class="size-4" />
				<AlertTitle>Du kan inte ansluta till mötet</AlertTitle>
				<AlertDescription
					><p>
						Detta möte är stängt för nya deltagare. Be organisatören lägga till dig först.
					</p></AlertDescription
				>
			</Alert>
		{:else}
			<Alert variant="destructive">
				<AlertTriangle class="size-4" />
				<AlertTitle>Hoppsan! Ett fel har inträffat.</AlertTitle>
				<AlertDescription
					><p>
						Kontakta <a href={`mailto:${CONTACT_EMAIL}`} class="font-semibold underline"
							>{CONTACT_EMAIL}</a
						>
						för hjälp. Felkod: <code>{data.error}</code>
					</p></AlertDescription
				>
			</Alert>
		{/if}
	{/if}
</div>
