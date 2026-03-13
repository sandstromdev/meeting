<script lang="ts">
	import { page } from '$app/state';
</script>

<div class="flex h-screen w-screen flex-col items-center bg-muted pt-[20vh]">
	<h1 class="text-2xl font-bold">{page.status}: {page.error?.message}</h1>
	<p class="text-sm text-muted-foreground">
		Om problemet kvarstår, kontakta <a href="mailto:kontakt@lsnd.se" class="text-primary underline"
			>kontakt@lsnd.se</a
		>.
	</p>
</div>
