<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { TRPCClientError } from '@trpc/client';
	import type { PageProps } from './$types';
	import WelcomeLetter from '#lib/components/WelcomeLetter.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { trpc } from '#lib/trpc/client.js';

	let { data }: PageProps = $props();
	let isSubmitting = $state(false);
	let errorMessage = $state<string | null>(null);

	async function handleAcknowledge(): Promise<void> {
		if (isSubmitting) return;
		isSubmitting = true;
		errorMessage = null;

		try {
			await trpc.auth.acknowledgeWelcome.mutate();
			await invalidateAll();
			await goto(resolve('/app'));
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError
					? 'We could not save that. Please try again.'
					: 'Unable to reach the server. Please try again.';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>Welcome | Secret Santa</title>
</svelte:head>

<section class="space-y-8">
	<WelcomeLetter displayName={data.user.displayName} event={data.event} />
	<div class="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
		<p class="text-xl">When you have finished reading, press the button below to begin.</p>
		{#if errorMessage}
			<p class="app-alert app-alert--error w-full" role="alert">{errorMessage}</p>
		{/if}
		<Button
			size="lg"
			class="h-16 w-full max-w-md rounded-2xl bg-emerald-800 text-2xl font-bold hover:bg-emerald-900"
			disabled={isSubmitting}
			onclick={handleAcknowledge}
		>
			{isSubmitting ? 'One moment…' : 'I understand — let’s begin!'}
		</Button>
	</div>
</section>
