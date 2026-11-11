<script lang="ts">
	import { cn, type WithElementRef } from '#lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		class: className,
		children,
		essential = false,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLParagraphElement>> & {
		/** Information the user needs (prices, status); stays visible when Page guidance is Simple or Off. */
		essential?: boolean;
	} = $props();
</script>

<p
	bind:this={ref}
	data-slot="card-description"
	class={cn(!essential && 'app-description', 'text-sm text-muted-foreground', className)}
	{...restProps}
>
	{@render children?.()}
</p>
