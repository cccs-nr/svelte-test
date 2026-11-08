<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { TRPCClientError } from '@trpc/client';
	import { Gift, LogOut, Menu, UserRound, X } from '@lucide/svelte';
	import type { LayoutProps } from './$types';
	import { Button } from '#lib/components/ui/button/index.js';
	import ProfileAvatar from '#lib/components/ProfileAvatar.svelte';
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';
	import { trpc } from '#lib/trpc/client.js';

	let { children, data }: LayoutProps = $props();
	let isMobileNavigationOpen = $state(false);
	let isAccountMenuOpen = $state(false);
	let accountButton = $state<HTMLButtonElement>();
	let accountMenu = $state<HTMLDivElement>();
	let isSigningOut = $state(false);
	let logoutError = $state<string | null>(null);
	onMount(() => {
		function handleOutsidePointerDown(event: PointerEvent): void {
			if (!isAccountMenuOpen || !(event.target instanceof Node)) return;
			if (accountButton?.contains(event.target) || accountMenu?.contains(event.target)) return;
			isAccountMenuOpen = false;
		}

		function handleAccountKeyDown(event: KeyboardEvent): void {
			if (!isAccountMenuOpen || event.key !== 'Escape') return;
			event.preventDefault();
			isAccountMenuOpen = false;
			accountButton?.focus();
		}

		function handleOutsideFocus(event: FocusEvent): void {
			if (!isAccountMenuOpen || !(event.target instanceof Node)) return;
			if (accountButton?.contains(event.target) || accountMenu?.contains(event.target)) return;
			isAccountMenuOpen = false;
		}

		document.addEventListener('pointerdown', handleOutsidePointerDown);
		document.addEventListener('keydown', handleAccountKeyDown);
		document.addEventListener('focusin', handleOutsideFocus);
		return () => {
			document.removeEventListener('pointerdown', handleOutsidePointerDown);
			document.removeEventListener('keydown', handleAccountKeyDown);
			document.removeEventListener('focusin', handleOutsideFocus);
		};
	});

	function closeMobileNavigation(): void {
		isMobileNavigationOpen = false;
	}

	function closeAccountMenu(): void {
		isAccountMenuOpen = false;
	}

	async function handleLogout(): Promise<void> {
		if (isSigningOut) return;

		isSigningOut = true;
		logoutError = null;
		closeAccountMenu();

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

<div class="min-h-screen bg-transparent">
	<header
		class="sticky top-0 z-40 border-b-4 border-rose-800 bg-[#123b2b]/95 text-emerald-50 shadow-sm backdrop-blur"
	>
		<div
			class="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-2 sm:px-8"
		>
			<a
				href={resolve('/app')}
				class="inline-flex items-center gap-3 font-semibold tracking-tight text-white"
			>
				<span class="grid size-9 place-items-center rounded-xl bg-rose-700 text-white">
					<Gift size={18} aria-hidden="true" />
				</span>
				Secret Santa
			</a>
			<nav
				id="main-navigation"
				class={`order-3 ${isMobileNavigationOpen ? 'flex' : 'hidden'} w-full flex-col gap-1 text-sm sm:order-none sm:flex sm:w-auto sm:flex-row sm:flex-wrap sm:gap-2`}
				aria-label="Main navigation"
			>
				{#if data.user.role === 'organizer'}
					<a
						href={resolve('/app/dashboard')}
						onclick={closeMobileNavigation}
						class="rounded-lg px-3 py-2 text-emerald-50 hover:bg-white/10 hover:text-white"
					>
						Dashboard
					</a>
					<a
						href={resolve('/app/event')}
						onclick={closeMobileNavigation}
						class="rounded-lg px-3 py-2 text-emerald-50 hover:bg-white/10 hover:text-white"
					>
						Event
					</a>
					<a
						href={resolve('/app/participants')}
						onclick={closeMobileNavigation}
						class="rounded-lg px-3 py-2 text-emerald-50 hover:bg-white/10 hover:text-white"
					>
						Participants
					</a>
					<a
						href={resolve('/app/households')}
						onclick={closeMobileNavigation}
						class="rounded-lg px-3 py-2 text-emerald-50 hover:bg-white/10 hover:text-white"
					>
						Households
					</a>
					<a
						href={resolve('/app/assignments')}
						onclick={closeMobileNavigation}
						class="rounded-lg px-3 py-2 text-emerald-50 hover:bg-white/10 hover:text-white"
					>
						Assignments
					</a>
				{/if}
				{#if data.user.isParticipating}
					<a
						href={resolve('/app/wishlist')}
						onclick={closeMobileNavigation}
						class="rounded-lg px-3 py-2 text-emerald-50 hover:bg-white/10 hover:text-white"
					>
						Wishlist
					</a>
					<a
						href={resolve('/app/gift')}
						onclick={closeMobileNavigation}
						class="rounded-lg px-3 py-2 text-emerald-50 hover:bg-white/10 hover:text-white"
					>
						Gift
					</a>
				{/if}
			</nav>
			<div class="flex items-center gap-4">
				<Button
					type="button"
					variant="outline"
					class="size-10 border-white/30 bg-white/10 p-0 text-white hover:bg-white/20 sm:hidden"
					aria-controls="main-navigation"
					aria-expanded={isMobileNavigationOpen}
					aria-label={isMobileNavigationOpen ? 'Close navigation' : 'Open navigation'}
					onclick={() => {
						isAccountMenuOpen = false;
						isMobileNavigationOpen = !isMobileNavigationOpen;
					}}
				>
					{#if isMobileNavigationOpen}
						<X size={18} aria-hidden="true" />
					{:else}
						<Menu size={18} aria-hidden="true" />
					{/if}
				</Button>
				<div class="relative">
					<button
						bind:this={accountButton}
						id="account-menu-trigger"
						type="button"
						class="inline-flex size-10 cursor-pointer items-center justify-center rounded-full transition outline-none hover:ring-2 hover:ring-amber-300/70 focus-visible:ring-2 focus-visible:ring-amber-300"
						aria-label={`Open account menu for ${data.user.displayName}`}
						aria-haspopup="dialog"
						aria-expanded={isAccountMenuOpen}
						aria-controls="account-menu"
						onclick={() => {
							isMobileNavigationOpen = false;
							isAccountMenuOpen = !isAccountMenuOpen;
						}}
					>
						<ProfileAvatar
							displayName={data.user.displayName}
							hasAvatar={data.hasAvatar}
							imageVersion={data.avatarVersion}
							size="sm"
						/>
					</button>
					<div
						bind:this={accountMenu}
						id="account-menu"
						hidden={!isAccountMenuOpen}
						class="absolute top-full right-0 z-50 mt-3 w-80 max-w-[calc(100vw-2rem)] rounded-3xl border border-stone-200 bg-white p-3 text-stone-950 shadow-2xl"
						role="dialog"
						aria-labelledby="account-menu-title"
						aria-modal="false"
					>
						<div class="flex items-center gap-3 p-3">
							<ProfileAvatar
								displayName={data.user.displayName}
								hasAvatar={data.hasAvatar}
								imageVersion={data.avatarVersion}
								size="lg"
							/>
							<div class="min-w-0">
								<p id="account-menu-title" class="truncate font-semibold">
									{data.user.displayName}
								</p>
								<p class="truncate text-sm text-stone-600">@{data.user.username}</p>
								<p class="mt-1 text-xs text-stone-500">
									{data.user.role === 'organizer' && data.user.isParticipating
										? 'Organizer · Participant'
										: data.user.role}
								</p>
							</div>
						</div>
						<div class="my-2 border-t border-stone-100"></div>
						<a
							href={resolve('/app/profile')}
							onclick={closeAccountMenu}
							class="flex h-9 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 hover:text-stone-950"
						>
							<UserRound size={18} aria-hidden="true" />
							Profile
						</a>
						<ThemeToggle menuItem />
						<Button
							type="button"
							variant="ghost"
							size="lg"
							class="w-full cursor-pointer justify-start gap-3 rounded-xl px-3 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 hover:text-stone-950"
							disabled={isSigningOut}
							onclick={handleLogout}
						>
							<LogOut size={18} aria-hidden="true" />
							{isSigningOut ? 'Signing out…' : 'Sign out'}
						</Button>
					</div>
				</div>
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
