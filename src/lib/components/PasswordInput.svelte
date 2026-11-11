<script lang="ts">
	import { Eye, EyeOff } from '@lucide/svelte';
	import { Input } from '#lib/components/ui/input/index.js';
	import { cn } from '#lib/utils.js';
	import type { HTMLInputAttributes } from 'svelte/elements';

	type Props = Omit<HTMLInputAttributes, 'type' | 'value' | 'files'> & { value?: string };

	let { value = $bindable(''), class: className, disabled, ...restProps }: Props = $props();
	let isVisible = $state(false);
</script>

<div class="relative">
	<Input
		{...restProps}
		type={isVisible ? 'text' : 'password'}
		bind:value
		{disabled}
		class={cn('pr-14', className)}
	/>
	<button
		type="button"
		class="absolute inset-y-0 right-0 flex w-12 cursor-pointer items-center justify-center rounded-r-lg text-stone-600 transition-colors hover:text-stone-950 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-800 disabled:cursor-not-allowed disabled:text-muted-foreground"
		aria-label={isVisible ? 'Hide password' : 'Show password'}
		aria-pressed={isVisible}
		{disabled}
		onclick={() => (isVisible = !isVisible)}
	>
		{#if isVisible}
			<EyeOff size={22} aria-hidden="true" />
		{:else}
			<Eye size={22} aria-hidden="true" />
		{/if}
	</button>
</div>
