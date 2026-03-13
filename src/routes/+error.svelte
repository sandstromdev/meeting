<script lang="ts">
	import { page } from '$app/state';
	import MessageLayout from '$lib/components/ui/message-layout.svelte';
</script>

<MessageLayout title="{page.status}: {page.error?.message}">
	<p class="text-muted-foreground">
		Om problemet kvarstår, kontakta <a href="mailto:kontakt@lsnd.se" class="text-primary underline"
			>kontakt@lsnd.se</a
		>.
	</p>
</MessageLayout>
