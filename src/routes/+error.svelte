<script lang="ts">
	import { page } from '$app/state';
	import { CONTACT_EMAIL } from '$lib/contact';
	import MessageLayout from '$lib/components/ui/message-layout.svelte';
</script>

<MessageLayout title="{page.status}: {page.error?.message}">
	<p class="text-muted-foreground">
		Om problemet kvarstår, kontakta <a
			href={`mailto:${CONTACT_EMAIL}`}
			class="text-primary underline">{CONTACT_EMAIL}</a
		>.
	</p>
</MessageLayout>
