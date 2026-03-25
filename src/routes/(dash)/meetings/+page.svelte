<script lang="ts">
	import { resolve } from '$app/paths';
	import { api } from '$convex/_generated/api';
	import * as Alert from '$lib/components/ui/alert';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { CopyButton } from '$lib/components/ui/copy-button';
	import type { Id } from '$convex/_generated/dataModel';
	import type { FunctionReturnType } from 'convex/server';
	import { useConvexClient, useQuery } from '@mmailaender/convex-svelte';
	import { toast } from 'svelte-sonner';
	import CreateMeeting from './create-meeting.svelte';

	let { data } = $props();

	const convex = useConvexClient();
	const meetingsApi = api.meeting.platform.meetings;
	const meetings = useQuery(meetingsApi.listForCurrentUser);

	const user = $derived(data.currentUser.data);
	const isAdmin = $derived(user?.role === 'admin');

	type MeetingRow = FunctionReturnType<typeof meetingsApi.listForCurrentUser>[number];

	const STATUS_LABELS: Record<MeetingRow['status'], string> = {
		draft: 'Utkast',
		scheduled: 'Planerat',
		active: 'Pågående',
		closed: 'Avslutat',
		archived: 'Arkiverat',
	};

	let actionMeetingId = $state<Id<'meetings'> | null>(null);
	let actionType = $state<'archive' | 'reopen' | null>(null);

	function formatMeetingDate(ms: number, timeZone: string): string {
		return new Date(ms).toLocaleDateString('sv-SE', {
			timeZone,
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		});
	}

	async function archiveMeeting(meetingId: Id<'meetings'>) {
		if (actionMeetingId) {
			return;
		}
		actionMeetingId = meetingId;
		actionType = 'archive';
		try {
			await convex.mutation(meetingsApi.archive, { meetingId });
			toast.success('Mötet arkiverades.');
		} catch (error) {
			console.error(error);
			toast.error('Kunde inte arkivera mötet.');
		} finally {
			actionMeetingId = null;
			actionType = null;
		}
	}

	async function reopenMeeting(meetingId: Id<'meetings'>) {
		if (actionMeetingId) {
			return;
		}
		actionMeetingId = meetingId;
		actionType = 'reopen';
		try {
			const ok = await convex.mutation(meetingsApi.reopen, { meetingId });
			if (ok) {
				toast.success('Mötet återställdes.');
			} else {
				toast.error('Mötet kunde inte återställas.');
			}
		} catch (error) {
			console.error(error);
			toast.error('Kunde inte återställa mötet.');
		} finally {
			actionMeetingId = null;
			actionType = null;
		}
	}
</script>

<div class="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-6">
	<h1 class="text-2xl font-semibold">Möten</h1>

	{#if user === null}
		<Alert.Root>
			Du behöver vara inloggad för att skapa och hantera möten.
			<a href={resolve(`/sign-in?redirect=${encodeURIComponent('/meetings')}`)} class="underline"
				>Logga in</a
			>.
		</Alert.Root>
	{:else if !isAdmin}
		<Alert.Root>
			<Alert.Description>Endast administratörer kan skapa och hantera möten.</Alert.Description>
		</Alert.Root>
	{:else}
		<CreateMeeting />

		<Card.Root>
			<Card.Header class="pb-0">
				<Card.Title class="text-lg font-medium">Mina möten</Card.Title>
			</Card.Header>
			<Card.Content>
				<div class="flex flex-col gap-3">
					{#if meetings.isLoading}
						<p class="text-sm text-muted-foreground">Laddar möten...</p>
					{:else if !meetings.data?.length}
						<p class="text-sm text-muted-foreground">Du har inga möten ännu.</p>
					{:else}
						{#each meetings.data as m (m._id)}
							<Card.Root size="sm" class="border">
								<Card.Content class="pt-4">
									<div class="flex flex-wrap items-start justify-between gap-3">
										<div class="min-w-0 flex-1 space-y-1">
											<h3 class="truncate font-medium">{m.title}</h3>
											<p class="text-sm text-muted-foreground">
												Kod: <span class="font-mono">{m.code}</span>
											</p>
											<p class="text-sm text-muted-foreground">
												{formatMeetingDate(m.date, m.timezone)}
											</p>
											<p class="text-sm text-muted-foreground">Tidszon: {m.timezone}</p>
											<div class="pt-1">
												<Badge variant="outline">
													{STATUS_LABELS[m.status]}
												</Badge>
											</div>
										</div>
										<div class="flex flex-col items-stretch gap-2 sm:items-end">
											<div class="flex flex-wrap gap-2">
												<Button
													variant="outline"
													size="sm"
													href={resolve('/(form)/m/anslut/[code]', { code: m.code })}
												>
													Admin
												</Button>
												<CopyButton
													text={m.code}
													variant="outline"
													size="icon"
													title="Kopiera kod"
												/>
											</div>
											{#if m.status === 'archived'}
												<Button
													type="button"
													variant="outline"
													size="sm"
													disabled={actionMeetingId === m._id}
													onclick={() => reopenMeeting(m._id)}
												>
													{actionMeetingId === m._id && actionType === 'reopen'
														? 'Återställer...'
														: 'Återställ'}
												</Button>
											{:else}
												<div class="flex flex-col items-stretch gap-1">
													<Button
														type="button"
														variant="outline"
														size="sm"
														disabled={actionMeetingId === m._id || m.isOpen}
														onclick={() => archiveMeeting(m._id)}
													>
														{actionMeetingId === m._id && actionType === 'archive'
															? 'Arkiverar...'
															: 'Arkivera'}
													</Button>
													{#if m.isOpen}
														<p class="max-w-[220px] text-xs text-muted-foreground">
															Stäng mötet först innan du kan arkivera.
														</p>
													{/if}
												</div>
											{/if}
										</div>
									</div>
								</Card.Content>
							</Card.Root>
						{/each}
					{/if}
				</div>
			</Card.Content>
		</Card.Root>
	{/if}
</div>
