<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { TRPCClientError } from '@trpc/client';
	import { ArrowLeftRight, Gift, BookOpen, LogOut, Menu, UserRound, X } from '@lucide/svelte';
	import type { LayoutProps } from './$types';
	import { Button } from '#lib/components/ui/button/index.js';
	import CodenameAvatar from '#lib/components/CodenameAvatar.svelte';
	import ProfileAvatar from '#lib/components/ProfileAvatar.svelte';
	import DisplaySettings from '#lib/components/DisplaySettings.svelte';
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';
	import { connectRealtime, disconnectRealtime } from '#lib/realtime/client.js';
	import { trpc } from '#lib/trpc/client.js';

	let { children, data }: LayoutProps = $props();
	let isMobileNavigationOpen = $state(false);
	let isAccountMenuOpen = $state(false);
	let accountButton = $state<HTMLButtonElement>();
	let accountMenu = $state<HTMLDivElement>();
	let isSigningOut = $state(false);
	let logoutError = $state<string | null>(null);
	let realtimeError = $state<string | null>(null);
	let clientBadgeCounts = $state<{ wishlist: number; gift: number; messages: number } | null>(null);
	let badgeCounts = $derived(clientBadgeCounts ?? data.badgeCounts);
	let isHomeActive = $derived(page.url.pathname === resolve('/app'));
	let isDashboardActive = $derived(page.url.pathname === resolve('/app/dashboard'));
	let isAssignmentsActive = $derived(page.url.pathname === resolve('/app/assignments'));
	let isGiftGivingActive = $derived(page.url.pathname.startsWith(resolve('/app/gift-giving')));
	let isMessagesActive = $derived(page.url.pathname.startsWith(resolve('/app/messages')));
	let isConversationPage = $derived(page.url.pathname.startsWith(`${resolve('/app/messages')}/`));
	let isWelcomeActive = $derived(page.url.pathname === resolve('/app/welcome'));
	let isWishlistActive = $derived(page.url.pathname === resolve('/app/wishlist'));

	onMount(() => {
		const socket = connectRealtime();
		const hasParticipantAccess = data.user.role === 'participant' || data.user.isParticipating;
		let isDisposed = false;
		let isRefreshing = false;
		let reconnectTimer: number | undefined;

		async function refreshBadgeCounts(): Promise<void> {
			if (!hasParticipantAccess || isRefreshing) return;
			isRefreshing = true;
			try {
				clientBadgeCounts = await trpc.notifications.badges.query();
			} catch (error) {
				realtimeError =
					error instanceof TRPCClientError
						? 'Live updates are connected, but notification badges could not be refreshed.'
						: 'Unable to refresh notification badges.';
			} finally {
				isRefreshing = false;
			}
		}

		function handleConnect(): void {
			realtimeError = null;
			void refreshBadgeCounts();
		}

		function handleConnectError(): void {
			realtimeError = 'Live updates are unavailable. The displayed badges may be out of date.';
		}

		function handleCodenameUpdate(): void {
			void invalidateAll();
		}

		function handleDisconnect(reason: string): void {
			if (isDisposed || reason === 'io client disconnect') return;
			realtimeError = 'Live updates disconnected. Reconnecting…';
			if (reason === 'io server disconnect') {
				reconnectTimer = window.setTimeout(() => socket.connect(), 500);
			}
		}

		socket.on('connect', handleConnect);
		socket.on('connect_error', handleConnectError);
		socket.on('disconnect', handleDisconnect);
		socket.on('badges:changed', refreshBadgeCounts);
		socket.on('codenames:changed', handleCodenameUpdate);

		return () => {
			isDisposed = true;
			if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
			socket.off('connect', handleConnect);
			socket.off('connect_error', handleConnectError);
			socket.off('disconnect', handleDisconnect);
			socket.off('badges:changed', refreshBadgeCounts);
			socket.off('codenames:changed', handleCodenameUpdate);
			disconnectRealtime();
		};
	});

	onMount(() => {
		function handleOutsidePointerDown(event: PointerEvent): void {
			if (!isAccountMenuOpen || !(event.target instanceof Node)) return;
			if (accountButton?.contains(event.target) || accountMenu?.contains(event.target)) return;
			isAccountMenuOpen = false;
		}

		function handleAccountKeyDown(event: KeyboardEvent): void {
			if (!isAccountMenuOpen) return;
			if (event.key === 'Escape') {
				event.preventDefault();
				isAccountMenuOpen = false;
				accountButton?.focus();
				return;
			}

			const menuItems = accountMenu?.querySelectorAll<HTMLElement>('[role="menuitem"]');
			if (!menuItems?.length) return;
			const currentIndex = Array.from(menuItems).findIndex(
				(item) => item === document.activeElement
			);
			let nextIndex: number | null = null;
			if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % menuItems.length;
			if (event.key === 'ArrowUp') {
				nextIndex = (currentIndex - 1 + menuItems.length) % menuItems.length;
			}
			if (event.key === 'Home') nextIndex = 0;
			if (event.key === 'End') nextIndex = menuItems.length - 1;
			if (nextIndex !== null) {
				event.preventDefault();
				menuItems[nextIndex]?.focus();
			}
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

	function navigationClass(isActive: boolean): string {
		return `holiday-topnav__link rounded-lg px-3 py-2 transition-colors ${
			isActive ? 'is-current shadow-sm' : ''
		}`;
	}

	async function switchPerson(userId: string): Promise<void> {
		closeAccountMenu();
		try {
			await trpc.members.switchTo.mutate({ userId });
			window.location.assign(resolve('/app'));
		} catch {
			logoutError = 'Could not switch person. Please try again.';
		}
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

<div
	class={isConversationPage
		? 'flex h-dvh flex-col overflow-hidden bg-transparent'
		: 'min-h-screen bg-transparent'}
>
	<header
		class={`holiday-topnav sticky top-0 z-40 border-b-4 border-rose-800 bg-[#123b2b]/95 shadow-sm backdrop-blur ${isConversationPage ? 'shrink-0 max-sm:hidden' : ''}`}
	>
		<div
			class="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-2 px-3 py-2 sm:gap-4 sm:px-8"
		>
			<a
				href={resolve('/app')}
				class="holiday-topnav__brand inline-flex min-w-0 items-center gap-3 font-semibold tracking-tight"
			>
				<span class="holiday-topnav__brand-mark grid size-9 place-items-center rounded-xl">
					<Gift size={18} aria-hidden="true" />
				</span>
				<span class="whitespace-nowrap">Secret Santa</span>
			</a>
			<nav
				id="main-navigation"
				class={`order-3 ${isMobileNavigationOpen ? 'flex' : 'hidden'} w-full flex-col gap-1 text-base sm:order-none sm:flex sm:w-auto sm:flex-row sm:flex-wrap sm:gap-2`}
				aria-label="Main navigation"
			>
				{#if data.hasAcknowledgedWelcome}
					{#if data.user.role === 'organizer'}
						<a
							href={resolve('/app/dashboard')}
							onclick={closeMobileNavigation}
							class={navigationClass(isDashboardActive)}
							aria-current={isDashboardActive ? 'page' : undefined}
						>
							Dashboard
						</a>
						<a
							href={resolve('/app/assignments')}
							onclick={closeMobileNavigation}
							class={navigationClass(isAssignmentsActive)}
							aria-current={isAssignmentsActive ? 'page' : undefined}
						>
							Assignments
						</a>
					{/if}
					{#if data.user.isParticipating}
						<a
							href={resolve('/app')}
							onclick={closeMobileNavigation}
							class={navigationClass(isHomeActive)}
							aria-current={isHomeActive ? 'page' : undefined}
						>
							Home
						</a>
						<a
							href={resolve('/app/wishlist')}
							onclick={closeMobileNavigation}
							class={`${navigationClass(isWishlistActive)} inline-flex items-center gap-2`}
							aria-current={isWishlistActive ? 'page' : undefined}
							aria-label={badgeCounts.wishlist > 0
								? `My Wishlist, ${badgeCounts.wishlist} new updates`
								: 'My Wishlist'}
						>
							My Wishlist
							{#if badgeCounts.wishlist > 0}
								<span
									class="holiday-topnav__badge grid min-w-5 place-items-center rounded-full px-1.5 py-0.5 text-sm font-semibold"
									aria-hidden="true"
								>
									{badgeCounts.wishlist}
								</span>
							{/if}
						</a>
						<a
							href={resolve('/app/gift-giving')}
							onclick={closeMobileNavigation}
							class={`${navigationClass(isGiftGivingActive)} inline-flex items-center gap-2`}
							aria-current={isGiftGivingActive ? 'page' : undefined}
							aria-label={badgeCounts.gift > 0
								? `Your Draw, ${badgeCounts.gift} new updates`
								: 'Your Draw'}
						>
							Your Draw
							{#if badgeCounts.gift > 0}
								<span
									class="holiday-topnav__badge grid min-w-5 place-items-center rounded-full px-1.5 py-0.5 text-sm font-semibold"
									aria-hidden="true"
								>
									{badgeCounts.gift}
								</span>
							{/if}
						</a>
						<a
							href={resolve('/app/messages')}
							onclick={closeMobileNavigation}
							class={`${navigationClass(isMessagesActive)} inline-flex items-center gap-2`}
							aria-current={isMessagesActive ? 'page' : undefined}
							aria-label={badgeCounts.messages > 0
								? `Messages, ${badgeCounts.messages} unread`
								: 'Messages'}
						>
							Messages
							{#if badgeCounts.messages > 0}
								<span
									class="holiday-topnav__badge grid min-w-5 place-items-center rounded-full px-1.5 py-0.5 text-sm font-semibold"
									aria-hidden="true"
								>
									{badgeCounts.messages}
								</span>
							{/if}
						</a>
					{/if}
					<a
						href={resolve('/app/welcome')}
						onclick={closeMobileNavigation}
						class={`${navigationClass(isWelcomeActive)} inline-flex items-center gap-2`}
						aria-current={isWelcomeActive ? 'page' : undefined}
					>
						<BookOpen size={18} aria-hidden="true" />
						Welcome
					</a>
				{/if}
			</nav>
			<div class="flex items-center gap-4">
				<Button
					type="button"
					variant="outline"
					hidden={!data.hasAcknowledgedWelcome}
					class="holiday-topnav__menu-toggle size-10 p-0 sm:hidden"
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
						aria-haspopup="menu"
						aria-expanded={isAccountMenuOpen}
						aria-controls="account-menu"
						onclick={() => {
							isMobileNavigationOpen = false;
							isAccountMenuOpen = !isAccountMenuOpen;
							if (isAccountMenuOpen) {
								requestAnimationFrame(() => {
									accountMenu?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
								});
							}
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
						class="app-surface absolute top-full right-0 z-50 mt-3 w-80 max-w-[calc(100vw-2rem)] rounded-3xl border border-border p-2 shadow-2xl"
						role="menu"
						aria-labelledby="account-menu-title"
						aria-orientation="vertical"
					>
						<div
							class="flex items-center gap-3 rounded-2xl border border-stone-100 bg-stone-50 p-3"
						>
							<ProfileAvatar
								displayName={data.user.displayName}
								hasAvatar={data.hasAvatar}
								imageVersion={data.avatarVersion}
								size="lg"
							/>
							<div class="min-w-0">
								<p id="account-menu-title" class="truncate text-base font-semibold">
									{data.user.displayName}
								</p>
								<p class="mt-1 text-sm text-stone-600">
									{data.user.role === 'organizer' && data.user.isParticipating
										? 'Organizer · Participant'
										: data.user.role}
								</p>
							</div>
						</div>
						{#if data.user.codename}
							<div
								class="mt-2 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3"
							>
								<CodenameAvatar codename={data.user.codename} size="md" />
								<div class="min-w-0">
									<p class="text-sm font-medium tracking-wide text-emerald-800 uppercase">
										Your codename
									</p>
									<p class="mt-0.5 truncate font-semibold text-stone-950">
										{data.user.codename}
									</p>
								</div>
							</div>
						{/if}
						<div class="my-2 border-t border-stone-200"></div>
						<a
							href={resolve('/app/profile')}
							onclick={closeAccountMenu}
							class="flex h-10 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 hover:text-stone-950"
							role="menuitem"
							tabindex={-1}
						>
							<UserRound size={18} aria-hidden="true" />
							Profile
						</a>
						{#each data.members.filter((member) => member.id !== data.user.id) as member (member.id)}
							<Button
								type="button"
								variant="ghost"
								size="lg"
								class="w-full cursor-pointer justify-start gap-3 rounded-xl px-3 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary hover:text-foreground"
								role="menuitem"
								tabindex={-1}
								onclick={() => switchPerson(member.id)}
							>
								<ArrowLeftRight size={18} aria-hidden="true" />
								<span class="truncate">
									Switch to {member.displayName}{member.unreadMessages > 0
										? ` (${member.unreadMessages} new)`
										: ''}
								</span>
							</Button>
						{/each}
						<ThemeToggle menuItem />
						<DisplaySettings menuItem />
						<Button
							type="button"
							variant="ghost"
							size="lg"
							class="w-full cursor-pointer justify-start gap-3 rounded-xl px-3 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50 hover:text-rose-900"
							disabled={isSigningOut}
							role="menuitem"
							tabindex={-1}
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

	{#if data.isManagingOther}
		<div
			class="mx-auto mt-4 flex w-[calc(100%-2rem)] max-w-6xl flex-wrap items-center justify-between gap-3 rounded-2xl border-4 border-double border-primary bg-card p-4 text-lg"
			role="status"
		>
			<p>
				<ArrowLeftRight size={22} class="mr-2 inline" aria-hidden="true" />
				You are using the app as <strong>{data.user.displayName}</strong>
				(managed from {data.account.displayName}’s account).
			</p>
			<Button type="button" size="lg" onclick={() => switchPerson(data.account.id)}>
				Switch back to {data.account.displayName}
			</Button>
		</div>
	{/if}
	{#if logoutError}
		<p class="app-alert app-alert--error mx-auto mt-4 w-[calc(100%-2rem)] max-w-6xl" role="alert">
			{logoutError}
		</p>
	{/if}
	{#if realtimeError}
		<p
			class={`app-alert app-alert--warning mx-auto w-full max-w-6xl ${
				isConversationPage ? 'mt-1 px-3 py-1 text-sm sm:mt-2 sm:px-4 sm:py-2 sm:text-sm' : 'mt-2'
			}`}
			role="status"
			aria-live="polite"
		>
			{isConversationPage ? 'Live updates unavailable; badges may be out of date.' : realtimeError}
		</p>
	{/if}
	<main
		class={isConversationPage
			? 'mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-0 py-0 sm:px-8 sm:py-4'
			: 'mx-auto max-w-6xl px-4 py-10 sm:px-8'}
	>
		{@render children()}
	</main>
</div>
