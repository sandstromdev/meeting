<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Field from '$lib/components/ui/field';
	import * as InputOTP from '$lib/components/ui/input-otp';
	import Input from '$lib/components/ui/input/input.svelte';
	import Label from '$lib/components/ui/label/label.svelte';
	import { REGEXP_ONLY_DIGITS_AND_CHARS } from 'bits-ui';
	import { connectForm } from './connect.remote';
	import { ConnectFormSchema } from './schema';

	const { meetingCode, name } = connectForm.fields;
</script>

<div class="grid h-screen w-screen place-items-center">
	<form
		class="max-w-[266px] rounded-md border px-6 py-5"
		{...connectForm.preflight(ConnectFormSchema)}
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

			<Field.Field>
				<Label for="name">För- och Efternamn</Label>
				<Input required id="name" {...name.as('text')} />
				<Field.Error errors={name.issues()} />
			</Field.Field>

			<Field.Error errors={connectForm.fields.issues()} />

			<Button type="submit">Anslut till mötet</Button>
		</Field.Set>
	</form>
</div>
