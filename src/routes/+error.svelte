<script lang="ts">
	import { page } from '$app/state';
	import { CONTACT_EMAIL } from '$lib/contact';
	import MessageLayout from '$lib/components/ui/message-layout.svelte';
	import { Button } from '$lib/components/ui/button';
	import { resolve } from '$app/paths';
</script>

<MessageLayout title="{page.status}: {page.error?.message}">
	<p class="text-muted-foreground">
		Om problemet kvarstår, kontakta <a
			href={`mailto:${CONTACT_EMAIL}`}
			class="text-primary underline">{CONTACT_EMAIL}</a
		>.
	</p>
	<p>
		<Button variant="link" href={resolve('/')}>Tillbaka till startsidan</Button>
	</p>
</MessageLayout>
