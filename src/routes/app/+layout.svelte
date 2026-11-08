<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { TRPCClientError } from '@trpc/client';
	import type { LayoutProps } from './$types';
	import { Button } from '#lib/components/ui/button/index.js';
	import { trpc } from '#lib/trpc/client.js';

	let { children, data }: LayoutProps = $props();
	let isSigningOut = $state(false);
	let logoutError = $state<string | null>(null);

	async function handleLogout(): Promise<void> {
		if (isSigningOut) return;

		isSigningOut = true;
		logoutError = null;

		try {
			await trpc.auth.logout.mutate();
			await goto(resolve('/login'));
		} catch (error) {
			logoutError =
				error instanceof TRPCClientError
					? 'Could not sign out. Please try again.'
					: 'Unable to reach the sign-out service. Please try again.';
		} finally {
			isSigningOut = false;
		}
	}
</script>

<svelte:head>
	<title>Secret Santa</title>
</svelte:head>

<div class="min-h-screen bg-stone-50">
	<header class="border-b border-stone-200 bg-white/90">
		<div
			class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-8"
		>
			<a
				href={resolve('/app')}
				class="inline-flex items-center gap-3 font-semibold tracking-tight text-stone-950"
			>
				<span class="grid size-9 place-items-center rounded-xl bg-emerald-800 text-white">S</span>
				Secret Santa
			</a>
			<nav
				class="order-3 flex w-full flex-wrap gap-2 text-sm sm:order-none sm:w-auto"
				aria-label="Main navigation"
			>
				<a
					href={resolve('/app')}
					class="rounded-lg px-3 py-2 text-stone-600 hover:bg-stone-100 hover:text-stone-950"
				>
					Overview
				</a>
				{#if data.user.role === 'organizer'}
					<a
						href={resolve('/app/event')}
						class="rounded-lg px-3 py-2 text-stone-600 hover:bg-stone-100 hover:text-stone-950"
					>
						Event
					</a>
					<a
						href={resolve('/app/participants')}
						class="rounded-lg px-3 py-2 text-stone-600 hover:bg-stone-100 hover:text-stone-950"
					>
						Participants
					</a>
					<a
						href={resolve('/app/households')}
						class="rounded-lg px-3 py-2 text-stone-600 hover:bg-stone-100 hover:text-stone-950"
					>
						Households
					</a>
				{/if}
				<a
					href={resolve('/app/profile')}
					class="rounded-lg px-3 py-2 text-stone-600 hover:bg-stone-100 hover:text-stone-950"
				>
					Profile
				</a>
			</nav>
			<div class="flex items-center gap-4">
				<div class="hidden text-right sm:block">
					<p class="text-sm font-medium text-stone-900">{data.user.displayName}</p>
					<p class="text-xs text-stone-500 capitalize">{data.user.role}</p>
				</div>
				<Button variant="outline" disabled={isSigningOut} onclick={handleLogout}>
					{isSigningOut ? 'Signing out…' : 'Sign out'}
				</Button>
			</div>
		</div>
	</header>

	{#if logoutError}
		<p class="mx-auto mt-4 max-w-6xl px-4 text-sm text-rose-700 sm:px-8" role="alert">
			{logoutError}
		</p>
	{/if}

	<main class="mx-auto max-w-6xl px-4 py-10 sm:px-8">
		{@render children()}
	</main>
</div>
