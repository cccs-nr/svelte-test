<script lang="ts">
	import { onMount } from 'svelte';
	import { Contrast, Type } from '@lucide/svelte';
	import { Button } from '#lib/components/ui/button/index.js';

	type Props = { menuItem?: boolean };

	let { menuItem = false }: Props = $props();
	const textKey = 'secret-santa-text';
	const contrastKey = 'secret-santa-contrast';
	let isLargeText = $state(true);
	let isHighContrast = $state(false);

	onMount(() => {
		isLargeText = document.documentElement.dataset.text !== 'standard';
		isHighContrast = document.documentElement.dataset.contrast === 'high';
	});

	function save(key: string, value: string): void {
		try {
			window.localStorage.setItem(key, value);
		} catch (error) {
			console.warn('Could not save the display preference.', error);
		}
	}

	function toggleText(): void {
		isLargeText = !isLargeText;
		document.documentElement.dataset.text = isLargeText ? 'large' : 'standard';
		save(textKey, isLargeText ? 'large' : 'standard');
	}

	function toggleContrast(): void {
		isHighContrast = !isHighContrast;
		document.documentElement.dataset.contrast = isHighContrast ? 'high' : 'normal';
		save(contrastKey, isHighContrast ? 'high' : 'normal');
	}

	const menuClass =
		'w-full cursor-pointer justify-start gap-3 rounded-xl px-3 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary hover:text-foreground';
</script>

{#if menuItem}
	<Button
		type="button"
		variant="ghost"
		size="lg"
		class={menuClass}
		role="menuitemcheckbox"
		aria-checked={isLargeText}
		tabindex={-1}
		onclick={toggleText}
	>
		<Type size={18} aria-hidden="true" />
		<span>Large text: {isLargeText ? 'On' : 'Off'}</span>
	</Button>
	<Button
		type="button"
		variant="ghost"
		size="lg"
		class={menuClass}
		role="menuitemcheckbox"
		aria-checked={isHighContrast}
		tabindex={-1}
		onclick={toggleContrast}
	>
		<Contrast size={18} aria-hidden="true" />
		<span>High contrast: {isHighContrast ? 'On' : 'Off'}</span>
	</Button>
{:else}
	<div class="flex gap-2" role="group" aria-label="Display settings">
		<Button
			type="button"
			variant="outline"
			class="max-sm:size-10 max-sm:p-0"
			aria-pressed={isLargeText}
			onclick={toggleText}
		>
			<Type size={18} aria-hidden="true" />
			<span class="max-sm:sr-only">Large text: {isLargeText ? 'On' : 'Off'}</span>
		</Button>
		<Button
			type="button"
			variant="outline"
			class="max-sm:size-10 max-sm:p-0"
			aria-pressed={isHighContrast}
			onclick={toggleContrast}
		>
			<Contrast size={18} aria-hidden="true" />
			<span class="max-sm:sr-only">High contrast: {isHighContrast ? 'On' : 'Off'}</span>
		</Button>
	</div>
{/if}
