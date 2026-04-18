<script lang="ts">
	import { page } from '$app/state';
</script>

<div class="mx-auto max-w-lg p-8">
	<h1 class="text-2xl font-semibold">{page.status}</h1>
	<p class="mt-2 text-muted-foreground">{page.error?.message}</p>
</div>
