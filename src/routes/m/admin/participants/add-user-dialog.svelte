<script lang="ts">
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import Button from '$lib/components/ui/button/button.svelte';
	import Checkbox from '$lib/components/ui/checkbox/checkbox.svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Field from '$lib/components/ui/field';
	import { Input } from '$lib/components/ui/input';
	import * as InputGroup from '$lib/components/ui/input-group/index.js';
	import * as NativeSelect from '$lib/components/ui/native-select';
	import { getMeetingContext } from '$lib/context.svelte';
	import type { FunctionReference } from 'convex/server';
	import { useParticipantsContext } from './context.svelte';
	import { toast } from 'svelte-sonner';

	let manualEmail = $state('');
	let name = $state('');
	let password = $state('');
	let loading = $state(false);
	let error = $state<string | null>(null);
	let temporary = $state(true);

	let role = $state<'admin' | 'moderator' | 'participant' | 'adjuster'>('participant');
	type CreateAndAddUserResult =
		| {
				ok: false;
				email: string;
				name: string;
				role: typeof role;
				userId: string;
				outcome: 'participant_banned';
				createdUser: boolean;
				passwordUpdated: boolean;
				participantCreated: boolean;
				accessGranted: boolean;
				message: string;
		  }
		| {
				ok: true;
				email: string;
				name: string;
				role: typeof role;
				userId: string;
				outcome: 'already_in_meeting' | 'added_to_meeting';
				createdUser: boolean;
				passwordUpdated: boolean;
				participantCreated: boolean;
				accessGranted: boolean;
				message: string;
		  };

	const ctx = useParticipantsContext();
	const meeting = getMeetingContext();
	const participantAdminApi = api as typeof api & {
		meeting: {
			admin: {
				access: {
					createAndAddUser: FunctionReference<
						'mutation',
						'public',
						{
							meetingId: Id<'meetings'>;
							email: string;
							name: string;
							role: 'admin' | 'moderator' | 'participant' | 'adjuster';
							password?: string;
						},
						CreateAndAddUserResult
					>;
				};
			};
		};
	};

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
		temporary = true;
		role = 'participant';
	}

	function handleClose() {
		ctx.addUserDialogOpen = false;
		reset();
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();

		if (email.length === 0) {
			error = 'E-postadressen är obligatorisk';
			toast.warning(error);
			return;
		}

		if (name.length === 0) {
			error = 'Namnet är obligatoriskt';
			toast.warning(error);
			return;
		}

		const trimmedPassword = password.trim();
		if (trimmedPassword.length > 0 && trimmedPassword.length < 4) {
			error = 'Lösenordet måste vara minst 4 tecken om du anger ett';
			toast.warning(error);
			return;
		}

		loading = true;
		error = null;

		try {
			const result = await meeting.adminMutate(
				participantAdminApi.meeting.admin.access.createAndAddUser,
				{
					email,
					name: name.trim(),
					role,
					...(trimmedPassword.length > 0 ? { password: trimmedPassword } : {}),
				},
			);

			if (result === undefined) {
				toast.error('Du har inte behörighet att lägga till användare.');
				return;
			}

			if (!result.ok) {
				error = result.message ?? 'Kunde inte lägga till användaren';
				toast.error(error ?? 'Kunde inte lägga till användaren');
				return;
			}

			toast.success(
				result.message ?? 'Användaren skapades eller uppdaterades och har lagts till i mötet.',
			);
			handleClose();
		} catch (e) {
			console.error(e);
			toast.error('Kunde inte lägga till användaren.');
		} finally {
			loading = false;
		}
	}
</script>

<Dialog.Root bind:open={ctx.addUserDialogOpen}>
	<Dialog.Content>
		<form onsubmit={handleSubmit} class="flex flex-col gap-4">
			<Dialog.Header>
				<Dialog.Title>Lägg till deltagare</Dialog.Title>
				<Dialog.Description>
					Skapar eller uppdaterar kontot och lägger alltid till personen i detta möte med vald roll.
					Lösenord kan utelämnas — då genereras ett slumpmässigt lösenord (användaren kan sätta nytt
					via återställning).
				</Dialog.Description>
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
					<Field.Label for="add-user-password">Lösenord (valfritt)</Field.Label>
					<Input
						id="add-user-password"
						type="password"
						bind:value={password}
						placeholder="Lämna tomt för auto-genererat lösenord"
						autocomplete="new-password"
						disabled={loading}
					/>
					<p class="text-xs text-muted-foreground">
						Minst 4 tecken om du anger lösenord. Tomt fält ger ett internt genererat lösenord.
					</p>
				</Field.Field>
				<Field.Field>
					<Field.Label for="add-user-role">Roll i mötet</Field.Label>
					<NativeSelect.Root id="add-user-role" bind:value={role}>
						<NativeSelect.Option value="admin">Admin</NativeSelect.Option>
						<NativeSelect.Option value="moderator">Moderator</NativeSelect.Option>
						<NativeSelect.Option value="participant">Deltagare</NativeSelect.Option>
						<NativeSelect.Option value="adjuster">Justerare</NativeSelect.Option>
					</NativeSelect.Root>
				</Field.Field>
				{#if error}
					<p class="text-sm text-destructive">{error}</p>
				{/if}
			</Field.Set>

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={handleClose} disabled={loading}>
					Avbryt
				</Button>
				<Button type="submit" {loading} disabled={loading}>Lägg till i möte</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
