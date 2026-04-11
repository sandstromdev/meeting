<script lang="ts">
	import { getMeetingContext } from '$lib/context.svelte';
	import { tv, type VariantProps } from 'tailwind-variants';

	let { size = 'default' }: { size?: VariantProps<typeof variants>['size'] } = $props();

	const meeting = getMeetingContext();
	let stats = $derived(
		meeting && {
			topGrid: [
				{ id: 'voterRoll', value: meeting.voterRoll, label: 'Röstlängd' },
				{ id: 'participants', value: meeting.participants, label: 'Mötesdeltagare' },
				{ id: 'absent', value: meeting.absent, label: 'Frånvarande' },
			],
			bottomGrid: [{ id: 'code', value: meeting.code, label: 'Möteskod' }],
		},
	);

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
		{#each stats.topGrid as stat (stat.label)}
			<div>
				<div id="{stat.id}-value" aria-labelledby="{stat.id}-label" class={number()}>
					{stat.value}
				</div>
				<div id="{stat.id}-label" class={label()}>{stat.label}</div>
			</div>
		{/each}
	</div>
</div>

<div class={root()}>
	<div class="mt-4 text-center">
		{#each stats.bottomGrid as stat (stat.label)}
			<div>
				<div id="{stat.id}-value" aria-labelledby="{stat.id}-label" class={number()}>
					{stat.value}
				</div>
				<div id="{stat.id}-label" class={label()}>{stat.label}</div>
			</div>
		{/each}
	</div>
</div>
