<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { TRPCClientError } from '@trpc/client';
	import { Gift, LogIn, UserPlus } from '@lucide/svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import DisplaySettings from '#lib/components/DisplaySettings.svelte';
	import PasswordInput from '#lib/components/PasswordInput.svelte';
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '#lib/components/ui/card/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { trpc } from '#lib/trpc/client.js';

	let identifier = $state('');
	let password = $state('');
	let isSubmitting = $state(false);
	let errorMessage = $state<string | null>(null);

	async function handleSubmit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (isSubmitting) return;

		isSubmitting = true;
		errorMessage = null;

		try {
			await trpc.auth.login.mutate({ identifier, password });
			await goto(resolve('/app'));
		} catch (error) {
			if (error instanceof TRPCClientError && error.data?.code === 'TOO_MANY_REQUESTS') {
				errorMessage = 'Too many sign-in attempts. Please wait a little before trying again.';
			} else if (error instanceof TRPCClientError) {
				errorMessage = 'The name or password is not correct.';
			} else {
				errorMessage = 'Unable to reach the sign-in service. Please try again.';
			}
		} finally {
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>Sign in | Secret Santa</title>
	<meta
		name="description"
		content="Welcome to the Secret Santa gift exchange. Create an account or sign in."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:title" content="Join our Secret Santa gift exchange" />
	<meta
		property="og:description"
		content="Everyone gives one gift and gets one gift. Tap to create your account and make your wishlist."
	/>
</svelte:head>

<main
	class="relative isolate flex min-h-dvh flex-col overflow-hidden bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-emerald-100 via-stone-50 to-rose-50 px-4 py-4 text-stone-900 sm:px-8 sm:py-8 lg:px-16"
>
	<div
		aria-hidden="true"
		class="pointer-events-none absolute top-1/3 -left-36 h-80 w-80 rounded-full bg-emerald-200/40 blur-3xl"
	></div>
	<div
		aria-hidden="true"
		class="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-rose-200/35 blur-3xl"
	></div>

	<section
		class="relative mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-3 sm:gap-8"
	>
		<div class="flex w-full items-center justify-between gap-4">
			<a
				class="inline-flex w-fit items-center gap-3 rounded-full py-1"
				href={resolve('/')}
				aria-label="Secret Santa home"
			>
				<span
					class="grid size-10 place-items-center rounded-2xl bg-emerald-800 text-white shadow-lg shadow-emerald-950/10 sm:size-12"
				>
					<Gift size={22} strokeWidth={1.8} aria-hidden="true" />
				</span>
				<span class="text-xl font-semibold tracking-tight whitespace-nowrap max-[420px]:sr-only"
					>Secret Santa</span
				>
			</a>
			<div class="flex items-center gap-2">
				<DisplaySettings />
				<ThemeToggle />
			</div>
		</div>

		<div class="mx-auto max-w-3xl space-y-2 text-center sm:space-y-4">
			<h1
				class="text-2xl leading-tight font-bold tracking-tight text-stone-950 min-[400px]:text-3xl sm:text-4xl lg:text-5xl"
			>
				Welcome to our Secret Santa gift exchange!
			</h1>
			<p class="hidden text-xl leading-9 text-stone-700 sm:block">
				Everyone gives one gift and receives one gift. You will be given one person to buy a gift
				for, and someone else will be buying a gift for you. It is a secret until the party!
			</p>
			<p class="text-lg leading-7 text-stone-700 sm:hidden [@media(max-height:900px)]:hidden">
				Everyone gives one gift and gets one gift. It is a secret until the party!
			</p>
		</div>

		<div class="mx-auto w-full max-w-xl space-y-3 sm:space-y-5">
			<Card
				class="relative w-full gap-3 border-4 border-emerald-800 bg-white/95 py-4 shadow-2xl shadow-emerald-900/15 sm:gap-4 sm:py-6"
			>
				<CardHeader class="space-y-2 px-4 sm:px-8">
					<CardTitle class="flex items-center gap-3 text-2xl tracking-tight sm:text-3xl">
						<span
							class="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-800 text-white sm:size-12"
							aria-hidden="true"
						>
							<LogIn size={24} />
						</span>
						Sign in
					</CardTitle>
					<CardDescription class="hidden text-xl leading-8 text-stone-700 sm:block">
						Type the name and password you chose when you created your account.
					</CardDescription>
				</CardHeader>
				<CardContent class="px-4 sm:px-8">
					<form class="space-y-3 sm:space-y-5" onsubmit={handleSubmit}>
						<div class="space-y-1 sm:space-y-2">
							<label class="text-lg font-semibold sm:text-xl" for="login-identifier"
								>Your name</label
							>
							<Input
								id="login-identifier"
								name="username"
								autocomplete="username"
								placeholder="Your first or full name"
								bind:value={identifier}
								required
								minlength={1}
								maxlength={64}
								disabled={isSubmitting}
								aria-invalid={Boolean(errorMessage)}
							/>
						</div>

						<div class="space-y-1 sm:space-y-2">
							<label class="text-lg font-semibold sm:text-xl" for="password">Password</label>
							<PasswordInput
								id="password"
								name="password"
								autocomplete="current-password"
								placeholder="Your password"
								bind:value={password}
								required
								minlength={3}
								maxlength={128}
								disabled={isSubmitting}
								aria-invalid={Boolean(errorMessage)}
							/>
							<p class="hidden text-base text-stone-700 sm:block">
								Press the eye at the end of the box to see what you typed.
							</p>
						</div>

						{#if errorMessage}
							<p class="app-alert app-alert--error text-lg" role="alert">
								{errorMessage}
							</p>
						{/if}

						<Button
							class="h-14 w-full rounded-2xl bg-emerald-800 text-xl font-bold hover:bg-emerald-900 sm:h-16 sm:text-2xl"
							type="submit"
							disabled={isSubmitting}
						>
							{isSubmitting ? 'Signing in…' : 'Sign In'}
						</Button>
					</form>
				</CardContent>
			</Card>

			<a
				class="inline-flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-rose-800 px-4 text-xl font-bold text-white shadow-lg transition-colors hover:bg-rose-900 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-rose-800 sm:h-20 sm:text-2xl"
				href={resolve('/register')}
			>
				<UserPlus size={28} class="shrink-0 max-sm:hidden" aria-hidden="true" />
				New here? Create an account
			</a>
		</div>
	</section>
</main>
