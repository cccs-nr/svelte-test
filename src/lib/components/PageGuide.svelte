<script lang="ts">
	import { onMount } from 'svelte';
	import { Check, CircleHelp, Lightbulb } from '@lucide/svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { Snippet } from 'svelte';

	let {
		pageId,
		title = 'How this page works',
		iconOnly = false,
		children
	}: {
		/** Identifies the page so its tutorial opens automatically only on the first visit. */
		pageId: string;
		title?: string;
		/** Shows only the help icon, for crowded toolbars. */
		iconOnly?: boolean;
		children: Snippet;
	} = $props();

	let dialog = $state<HTMLDialogElement>();
	const seenKey = 'secret-santa-seen-guides';

	function readSeen(): string[] {
		try {
			const value = JSON.parse(window.localStorage.getItem(seenKey) ?? '[]');
			return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
		} catch {
			return [];
		}
	}

	function markSeen(): void {
		const seen = readSeen();
		if (seen.includes(pageId)) return;
		try {
			window.localStorage.setItem(seenKey, JSON.stringify([...seen, pageId]));
		} catch (error) {
			console.warn('Could not remember that this page guide was shown.', error);
		}
	}

	// The first visit to a page opens its tutorial; the Help button opens it again later.
	onMount(() => {
		if (!readSeen().includes(pageId)) dialog?.showModal();
	});

	function closeOnBackdrop(event: MouseEvent): void {
		if (event.target === dialog) dialog?.close();
	}
</script>

<Button
	type="button"
	variant="outline"
	aria-label={`Help: ${title}`}
	onclick={() => dialog?.showModal()}
>
	<CircleHelp aria-hidden="true" />
	{#if !iconOnly}Help{/if}
</Button>

<dialog
	bind:this={dialog}
	class="app-dialog m-auto max-h-[92dvh] w-[min(95vw,42rem)] overflow-y-auto rounded-xl p-0 shadow-2xl backdrop:bg-black/60"
	aria-labelledby={`guide-title-${pageId}`}
	onclose={markSeen}
	onclick={closeOnBackdrop}
>
	<div class="space-y-4 p-5 sm:p-6">
		<div class="app-guide__header">
			<span class="app-guide__icon" aria-hidden="true">
				<Lightbulb size={26} />
			</span>
			<h2 id={`guide-title-${pageId}`} class="app-guide__title">{title}</h2>
		</div>
		<div class="app-guide__body space-y-3">
			{@render children()}
		</div>
		<div class="flex justify-end">
			<Button type="button" onclick={() => dialog?.close()}>
				<Check aria-hidden="true" />Got it</Button
			>
		</div>
	</div>
</dialog>
