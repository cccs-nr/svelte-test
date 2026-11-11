<script lang="ts">
	import type { PageProps } from './$types';
	import WelcomeLetter from '#lib/components/WelcomeLetter.svelte';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Welcome | Secret Santa</title>
</svelte:head>

<WelcomeLetter event={data.event} />
