<script lang="ts">
	import type { Component } from 'svelte';

	let {
		label,
		compactLabel,
		checked,
		onchange,
		icon: Icon
	}: {
		label: string;
		/** Shorter text for narrow screens. */
		compactLabel?: string;
		checked: boolean;
		onchange: (checked: boolean) => void;
		icon?: Component<{ size?: number; class?: string; 'aria-hidden'?: 'true' | boolean | 'false' }>;
	} = $props();
</script>

<button
	type="button"
	role="switch"
	aria-checked={checked}
	class="app-switch w-full"
	onclick={() => onchange(!checked)}
>
	{#if Icon}<Icon size={20} aria-hidden="true" class="max-sm:hidden" />{/if}
	<span class="app-switch__label flex-1 text-left">
		<span class="max-sm:hidden">{label}</span>
		<span class="sm:hidden">{compactLabel ?? label}</span>
	</span>
	<span class="app-switch__track" aria-hidden="true">
		<span class="app-switch__thumb"></span>
	</span>
	<span class="app-switch__state">{checked ? 'On' : 'Off'}</span>
</button>
