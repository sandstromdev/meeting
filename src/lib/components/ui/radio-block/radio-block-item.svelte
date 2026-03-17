<script lang="ts">
	import { RadioGroup as RadioGroupPrimitive } from 'bits-ui';
	import * as RadioGroup from '$lib/components/ui/radio-group';
	import { type WithoutChildrenOrChild } from '$lib/utils';

	let { class: className, ...restProps }: WithoutChildrenOrChild<RadioGroupPrimitive.ItemProps> & { class?: string } =
		$props();
</script>

<RadioGroup.Item class={className} {...restProps} />
