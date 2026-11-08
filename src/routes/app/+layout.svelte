<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { TRPCClientError } from '@trpc/client';
	import { Menu, X } from '@lucide/svelte';
	import type { LayoutProps } from './$types';
	import { Button } from '#lib/components/ui/button/index.js';
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';
	import { trpc } from '#lib/trpc/client.js';

	let { children, data }: LayoutProps = $props();
	let isMobileNavigationOpen = $state(false);
	let isSigningOut = $state(false);
	let logoutError = $state<string | null>(null);
	let clientUnreadMessageCount = $state<number | null>(null);
	let unreadMessageCount = $derived(clientUnreadMessageCount ?? data.unreadMessageCount);
	let unreadMessageError = $state<string | null>(null);

	onMount(() => {
		if (!data.user.isParticipating) return;

		let isDisposed = false;
		let isRefreshing = false;

		async function refreshUnreadMessageCount(): Promise<void> {
			if (isRefreshing) return;
			isRefreshing = true;

			try {
				const result = await trpc.conversations.unreadCount.query();
				if (!isDisposed) {
					clientUnreadMessageCount = result.count;
					unreadMessageError = null;
				}
			} catch (error) {
				if (!isDisposed) {
					unreadMessageError =
						error instanceof TRPCClientError
							? 'Unread message count could not be refreshed.'
							: 'Unable to reach the messaging service.';
				}
			} finally {
				isRefreshing = false;
			}
		}

		void refreshUnreadMessageCount();
		const interval = window.setInterval(() => void refreshUnreadMessageCount(), 15_000);
		return () => {
			isDisposed = true;
			window.clearInterval(interval);
		};
	});

	function closeMobileNavigation(): void {
		isMobileNavigationOpen = false;
	}

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
				id="main-navigation"
				class={`order-3 ${isMobileNavigationOpen ? 'flex' : 'hidden'} w-full flex-col gap-1 text-sm sm:order-none sm:flex sm:w-auto sm:flex-row sm:flex-wrap sm:gap-2`}
				aria-label="Main navigation"
			>
				<a
					href={resolve('/app')}
					onclick={closeMobileNavigation}
					class="rounded-lg px-3 py-2 text-stone-600 hover:bg-stone-100 hover:text-stone-950"
				>
					Overview
				</a>
				{#if data.user.role === 'organizer'}
					<a
						href={resolve('/app/event')}
						onclick={closeMobileNavigation}
						class="rounded-lg px-3 py-2 text-stone-600 hover:bg-stone-100 hover:text-stone-950"
					>
						Event
					</a>
					<a
						href={resolve('/app/participants')}
						onclick={closeMobileNavigation}
						class="rounded-lg px-3 py-2 text-stone-600 hover:bg-stone-100 hover:text-stone-950"
					>
						Participants
					</a>
					<a
						href={resolve('/app/households')}
						onclick={closeMobileNavigation}
						class="rounded-lg px-3 py-2 text-stone-600 hover:bg-stone-100 hover:text-stone-950"
					>
						Households
					</a>
					<a
						href={resolve('/app/assignments')}
						onclick={closeMobileNavigation}
						class="rounded-lg px-3 py-2 text-stone-600 hover:bg-stone-100 hover:text-stone-950"
					>
						Assignments
					</a>
				{/if}
				{#if data.user.isParticipating}
					<a
						href={resolve('/app/wishlist')}
						onclick={closeMobileNavigation}
						class="rounded-lg px-3 py-2 text-stone-600 hover:bg-stone-100 hover:text-stone-950"
					>
						Wishlist
					</a>
					<a
						href={resolve('/app/messages')}
						onclick={closeMobileNavigation}
						aria-label={unreadMessageCount > 0
							? `Messages, ${unreadMessageCount} unread`
							: 'Messages'}
						class="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-stone-600 hover:bg-stone-100 hover:text-stone-950"
					>
						Messages
						{#if unreadMessageCount > 0}
							<span
								class="grid min-w-5 place-items-center rounded-full bg-rose-100 px-1.5 py-0.5 text-xs font-semibold text-rose-800"
								aria-hidden="true"
							>
								{unreadMessageCount}
							</span>
						{/if}
					</a>
				{/if}
				<a
					href={resolve('/app/profile')}
					onclick={closeMobileNavigation}
					class="rounded-lg px-3 py-2 text-stone-600 hover:bg-stone-100 hover:text-stone-950"
				>
					Profile
				</a>
			</nav>
			<div class="flex items-center gap-4">
				<div class="hidden text-right sm:block">
					<p class="text-sm font-medium text-stone-900">{data.user.displayName}</p>
					<p class="text-xs text-stone-500">
						{data.user.role === 'organizer' && data.user.isParticipating
							? 'Organizer · Participant'
							: data.user.role}
					</p>
				</div>
				<ThemeToggle />
				<Button
					type="button"
					variant="outline"
					class="size-10 p-0 sm:hidden"
					aria-controls="main-navigation"
					aria-expanded={isMobileNavigationOpen}
					aria-label={isMobileNavigationOpen ? 'Close navigation' : 'Open navigation'}
					onclick={() => (isMobileNavigationOpen = !isMobileNavigationOpen)}
				>
					{#if isMobileNavigationOpen}
						<X size={18} aria-hidden="true" />
					{:else}
						<Menu size={18} aria-hidden="true" />
					{/if}
				</Button>
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
	{#if unreadMessageError}
		<p class="mx-auto mt-2 max-w-6xl px-4 text-sm text-rose-700 sm:px-8" role="status">
			{unreadMessageError}
		</p>
	{/if}

	<main class="mx-auto max-w-6xl px-4 py-10 sm:px-8">
		{@render children()}
	</main>
</div>
