<script lang="ts">
	import type { PageProps } from './$types';
	import PageGuide from '#lib/components/PageGuide.svelte';
	import WelcomeLetter from '#lib/components/WelcomeLetter.svelte';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Help | Secret Santa</title>
</svelte:head>

<section class="space-y-8">
	<PageGuide title="About this page">
		<p>This is your welcome letter. Read it any time you want a reminder of how things work.</p>
	</PageGuide>
	<WelcomeLetter displayName={data.user.displayName} event={data.event} />
</section>
