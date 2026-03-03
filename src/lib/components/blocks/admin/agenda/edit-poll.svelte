<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import Checkbox from '$lib/components/ui/checkbox/checkbox.svelte';
	import Label from '$lib/components/ui/label/label.svelte';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';

	let {
		pollTitle = $bindable(''),
		pollOptions = $bindable(['', '']),
		resultsPublic = $bindable(false),
	}: {
		pollTitle?: string;
		pollOptions?: string[];
		resultsPublic?: boolean;
	} = $props();

	function addPollOption() {
		pollOptions = [...pollOptions, ''];
	}

	function removePollOption(index: number) {
		if (pollOptions.length <= 2) {
			return;
		}
		pollOptions = pollOptions.filter((_, i) => i !== index);
	}
</script>

<div class="space-y-2 rounded-md border bg-muted/30 p-3">
	<Input bind:value={pollTitle} placeholder="Omröstningens rubrik" class="w-full" />
	<Label class="flex items-center gap-2 text-sm">
		<Checkbox bind:checked={resultsPublic} />
		Visa resultat för alla (annars endast admin)
	</Label>
	<p class="text-xs text-muted-foreground">Alternativ (minst 2)</p>
	<div class="space-y-2">
		{#each pollOptions as _, i (i)}
			<div class="flex gap-2">
				<Input
					value={pollOptions[i]}
					oninput={(e) => {
						pollOptions = pollOptions.with(i, (e.target as HTMLInputElement).value);
					}}
					placeholder="Alternativ {i + 1}"
					class="flex-1"
				/>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					class="shrink-0 text-muted-foreground"
					disabled={pollOptions.length <= 2}
					onclick={() => removePollOption(i)}
					aria-label="Ta bort alternativ"
				>
					<Trash2Icon class="size-4" />
				</Button>
			</div>
		{/each}
		<Button type="button" variant="outline" size="sm" onclick={addPollOption}>
			<PlusIcon class="size-4" />
			Lägg till alternativ
		</Button>
	</div>
</div>
