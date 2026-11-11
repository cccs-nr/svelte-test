<script lang="ts">
	import { ExternalLink as ExternalLinkIcon } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	let { href, children }: { href: string; children: Snippet } = $props();
</script>

<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external gift link -->
<a
	{href}
	target="_blank"
	rel="noopener noreferrer external"
	class="text-lg font-bold text-primary underline decoration-2 underline-offset-4 hover:text-(--accent-red-strong)"
>
	{@render children()}<ExternalLinkIcon
		size={18}
		aria-hidden="true"
		class="ml-1.5 inline align-[-0.15em]"
	/><span class="sr-only"> (opens in a new tab)</span>
</a>
