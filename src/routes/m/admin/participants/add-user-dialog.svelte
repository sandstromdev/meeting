<script lang="ts">
	import { api } from '$convex/_generated/api';
	import { authClient } from '$lib/auth-client';
	import Button from '$lib/components/ui/button/button.svelte';
	import Checkbox from '$lib/components/ui/checkbox/checkbox.svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Field from '$lib/components/ui/field';
	import { Input } from '$lib/components/ui/input';
	import * as InputGroup from '$lib/components/ui/input-group/index.js';
	import * as NativeSelect from '$lib/components/ui/native-select';
	import { getMeetingContext } from '$lib/context.svelte';
	import { useParticipantsContext } from './context.svelte';

	let manualEmail = $state('');
	let name = $state('');
	let password = $state('');
	let loading = $state(false);
	let error = $state<string | null>(null);
	let temporary = $state(true);

	let addToMeeting = $state(false);
	let role = $state<'admin' | 'moderator' | 'participant' | 'adjuster'>('participant');

	const ctx = useParticipantsContext();
	const meeting = getMeetingContext();

	const tempEmailSuffix = $derived(`+m${meeting.meeting.code}@m.lsnd.se`);
	const tempEmailPrefix = $derived(
		name
			.toLowerCase()
			.replaceAll(' ', '.')
			.replace(/[^.\w]+/g, ''),
	);

	const email = $derived(temporary ? `${tempEmailPrefix}${tempEmailSuffix}` : manualEmail);

	$effect(() => {
		if (ctx.addUserDialogOpen) {
			reset();
		}
	});

	function reset() {
		manualEmail = '';
		name = '';
		password = '';
		error = null;
	}

	function handleClose() {
		ctx.addUserDialogOpen = false;
		reset();
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();

		loading = true;

		if (email.length === 0) {
			error = 'E-postadressen är obligatorisk';
			return;
		}

		if (name.length === 0) {
			error = 'Namnet är obligatoriskt';
			return;
		}

		if (password.length === 0) {
			error = 'Lösenordet är obligatoriskt';
			return;
		}

		const { data, error: err } = await authClient.admin.createUser({
			email,
			name,
			password,
		});

		if (err) {
			error = JSON.stringify(err, null, 2) ?? 'Något gick fel';
			return;
		}

		if (addToMeeting && data?.user.id) {
			await meeting.adminMutate(api.admin.users.addParticipant, {
				userId: data.user.id,
				name,
				role,
			});
		}

		loading = false;

		handleClose();
	}
</script>

<Dialog.Root bind:open={ctx.addUserDialogOpen}>
	<Dialog.Content>
		<form onsubmit={handleSubmit} class="flex flex-col gap-4">
			<Dialog.Header>
				<Dialog.Title>Lägg till deltagare</Dialog.Title>
				<Dialog.Description>Skapa ett nytt konto med e-post, namn och lösenord.</Dialog.Description>
			</Dialog.Header>

			<Field.Set class="gap-4">
				<Field.Field>
					<Field.Label for="add-user-email">E-post</Field.Label>
					{#if !temporary}
						<Input
							id="add-user-email"
							type="email"
							bind:value={manualEmail}
							placeholder="namn@exempel.se"
							required
							autocomplete="email"
							disabled={loading}
						/>
					{:else}
						<InputGroup.Root class="has-disabled:opacity-100">
							<InputGroup.Input
								id="add-user-email"
								value={tempEmailPrefix}
								required
								autocomplete="email"
								disabled
							/>
							<InputGroup.Addon align="inline-end">
								<InputGroup.Text>
									{tempEmailSuffix}
								</InputGroup.Text>
							</InputGroup.Addon>
						</InputGroup.Root>
					{/if}
					<Field.Field orientation="horizontal">
						<Checkbox id="add-user-temporary" bind:checked={temporary} />
						<Field.Label for="add-user-temporary">Temporär användare</Field.Label>
					</Field.Field>
				</Field.Field>
				<Field.Field>
					<Field.Label for="add-user-name">Namn</Field.Label>
					<Input
						id="add-user-name"
						type="text"
						bind:value={name}
						placeholder="För- och efternamn"
						required
						autocomplete="name"
						disabled={loading}
					/>
				</Field.Field>
				<Field.Field>
					<Field.Label for="add-user-password">Lösenord</Field.Label>
					<Input
						id="add-user-password"
						type="password"
						bind:value={password}
						placeholder="Minst 4 tecken"
						required
						autocomplete="new-password"
						disabled={loading}
					/>
				</Field.Field>
				<Field.Field orientation="horizontal">
					<Checkbox id="add-user-add-to-meeting" bind:checked={addToMeeting} />
					<Field.Label for="add-user-add-to-meeting">Lägg till i möte</Field.Label>
				</Field.Field>
				{#if addToMeeting}
					<Field.Field>
						<Field.Label for="add-user-role">Roll</Field.Label>
						<NativeSelect.Root id="add-user-role" bind:value={role}>
							<NativeSelect.Option value="admin">Admin</NativeSelect.Option>
							<NativeSelect.Option value="moderator">Moderator</NativeSelect.Option>
							<NativeSelect.Option value="participant">Deltagare</NativeSelect.Option>
							<NativeSelect.Option value="adjuster">Justerare</NativeSelect.Option>
						</NativeSelect.Root>
					</Field.Field>
				{/if}
				{#if error}
					<p class="text-sm text-destructive">{error}</p>
				{/if}
			</Field.Set>

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={handleClose} disabled={loading}>
					Avbryt
				</Button>
				<Button type="submit" {loading} disabled={loading}>Lägg till</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
