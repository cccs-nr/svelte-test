<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- hrefs are built with resolve() by the caller */
	import { onMount } from 'svelte';
	import { positionDropdown } from '#lib/dropdown-position.js';
	import type { Component } from 'svelte';
	import { ChevronDown, Menu } from '@lucide/svelte';

	export type NavigationItem = {
		href: string;
		label: string;
		icon: Component<{ size?: number; 'aria-hidden'?: 'true' | boolean }>;
		isActive: boolean;
		badge?: number;
		badgeText?: string;
		/** Items in different groups are separated by a divider. */
		group?: number;
	};

	let { items }: { items: NavigationItem[] } = $props();
	let isOpen = $state(false);
	let trigger = $state<HTMLButtonElement>();
	let panel = $state<HTMLElement>();
	let totalBadges = $derived(items.reduce((sum, item) => sum + (item.badge ?? 0), 0));

	$effect(() => {
		if (!isOpen || !trigger || !panel) return;
		const place = () => positionDropdown(trigger!, panel!);
		place();
		window.addEventListener('resize', place);
		return () => window.removeEventListener('resize', place);
	});

	onMount(() => {
		function closeOnOutside(event: Event): void {
			if (!isOpen || !(event.target instanceof Node)) return;
			if (trigger?.contains(event.target) || panel?.contains(event.target)) return;
			isOpen = false;
		}

		function closeOnEscape(event: KeyboardEvent): void {
			if (!isOpen || event.key !== 'Escape') return;
			isOpen = false;
			trigger?.focus();
		}

		document.addEventListener('pointerdown', closeOnOutside);
		document.addEventListener('focusin', closeOnOutside);
		document.addEventListener('keydown', closeOnEscape);
		return () => {
			document.removeEventListener('pointerdown', closeOnOutside);
			document.removeEventListener('focusin', closeOnOutside);
			document.removeEventListener('keydown', closeOnEscape);
		};
	});
</script>

<div class="relative">
	<button
		bind:this={trigger}
		type="button"
		class="holiday-topnav__account inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border-2 px-3 text-base font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-amber-300"
		aria-expanded={isOpen}
		aria-controls="main-navigation"
		aria-label={totalBadges > 0 ? `Menu, ${totalBadges} new updates` : 'Menu'}
		onclick={() => (isOpen = !isOpen)}
	>
		<Menu size={22} aria-hidden="true" />
		<span>Menu</span>
		{#if totalBadges > 0}
			<span
				class="holiday-topnav__badge grid min-w-5 place-items-center rounded-md px-1.5 py-0.5 text-sm font-semibold"
				aria-hidden="true"
			>
				{totalBadges}
			</span>
		{/if}
		<ChevronDown size={20} aria-hidden="true" />
	</button>
	<nav
		bind:this={panel}
		id="main-navigation"
		hidden={!isOpen}
		class="app-surface absolute top-full right-0 z-50 mt-3 w-72 max-w-[calc(100vw-2rem)] rounded-xl border-2 border-border p-2 text-foreground shadow-2xl"
		aria-label="Main navigation"
	>
		<p class="px-3 pt-1 pb-2 text-sm font-semibold tracking-[0.14em] text-primary uppercase">
			Go to
		</p>
		<ul class="space-y-1">
			{#each items as item, index (item.href)}
				{#if index > 0 && item.group !== items[index - 1]?.group}
					<li class="my-1 border-t border-border" role="separator" aria-hidden="true"></li>
				{/if}
				<li>
					<a
						href={item.href}
						class={`flex min-h-12 items-center justify-between gap-3 rounded-lg px-3 py-2 text-lg font-semibold no-underline ${
							item.isActive ? 'bg-accent-red text-white' : 'hover:bg-secondary'
						}`}
						aria-current={item.isActive ? 'page' : undefined}
						aria-label={item.badge
							? `${item.label}, ${item.badge} ${item.badgeText ?? ''}`
							: undefined}
						onclick={() => (isOpen = false)}
					>
						<span class="flex min-w-0 items-center gap-3">
							<item.icon size={22} aria-hidden="true" />
							{item.label}
						</span>
						{#if item.badge}
							<span
								class="grid min-w-6 place-items-center rounded-md bg-amber-300 px-1.5 py-0.5 text-sm font-semibold text-stone-950"
								aria-hidden="true"
							>
								{item.badge}
							</span>
						{/if}
					</a>
				</li>
			{/each}
		</ul>
	</nav>
</div>
