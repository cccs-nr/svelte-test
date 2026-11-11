<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
	let holidayBackground = $derived(`url("${__APP_BASE_PATH__}/winter-holiday.svg")`);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="app-background" style={`background-image: ${holidayBackground}`}>
	{@render children()}
</div>
