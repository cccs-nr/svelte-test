<script lang="ts">
	import { Lightbulb } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	let {
		title = 'How this page works',
		children
	}: {
		title?: string;
		children: Snippet;
	} = $props();
</script>

<!-- Shown only when Page guidance is Detailed; hidden by CSS for Simple and Off. -->
<aside class="app-guide" aria-label={title}>
	<div class="app-guide__header">
		<span class="app-guide__icon" aria-hidden="true">
			<Lightbulb size={26} />
		</span>
		<p class="app-guide__title">{title}</p>
	</div>
	<div class="app-guide__body space-y-3">
		{@render children()}
	</div>
</aside>
