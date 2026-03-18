<script lang="ts">
	import { getMeetingContext } from '$lib/context.svelte';
	import { tv, type VariantProps } from 'tailwind-variants';

	let { size = 'default' }: { size?: VariantProps<typeof variants>['size'] } = $props();

	const meeting = getMeetingContext();
	const stats = $derived([
		{ value: meeting.voterRoll, label: 'Röstlängd' },
		{ value: meeting.participants, label: 'Mötesdeltagare' },
		{ value: meeting.absent, label: 'Frånvarande' },
	]);

	const variants = tv({
		base: 'px-4 py-3',
		slots: {
			root: 'px-4 py-3',
			number: 'text-2xl font-semibold tabular-nums',
			label: 'mt-0.5 text-xs text-muted-foreground',
		},
		variants: {
			size: {
				default: {},
				lg: {
					root: 'px-6 py-4',
					number: 'text-4xl font-semibold tabular-nums',
					label: 'mt-0.5 text-sm text-muted-foreground',
				},
			},
		},
	});

	const { root, number, label } = $derived(variants({ size }));
</script>

<div class={root()}>
	<div class="grid grid-cols-3 gap-4 text-center">
		{#each stats as stat (stat.label)}
			<div>
				<span class={number()}>{stat.value}</span>
				<span class={label()}>{stat.label}</span>
			</div>
		{/each}
	</div>
</div>
