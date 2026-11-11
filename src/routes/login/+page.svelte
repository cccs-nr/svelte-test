<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { TRPCClientError } from '@trpc/client';
	import { Gift, LogIn, UserPlus } from '@lucide/svelte';
	import { Button } from '#lib/components/ui/button/index.js';
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
</svelte:head>

<main
	class="relative isolate min-h-screen overflow-hidden bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-emerald-100 via-stone-50 to-rose-50 px-4 py-8 text-stone-900 sm:px-8 lg:px-16"
>
	<div
		aria-hidden="true"
		class="pointer-events-none absolute top-1/3 -left-36 h-80 w-80 rounded-full bg-emerald-200/40 blur-3xl"
	></div>
	<div
		aria-hidden="true"
		class="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-rose-200/35 blur-3xl"
	></div>

	<section class="relative mx-auto flex w-full max-w-6xl flex-col gap-10">
		<div class="flex w-full items-center justify-between gap-4">
			<a
				class="inline-flex w-fit items-center gap-3 rounded-full py-2"
				href={resolve('/')}
				aria-label="Secret Santa home"
			>
				<span
					class="grid size-12 place-items-center rounded-2xl bg-emerald-800 text-white shadow-lg shadow-emerald-950/10"
				>
					<Gift size={24} strokeWidth={1.8} aria-hidden="true" />
				</span>
				<span class="text-xl font-semibold tracking-tight">Secret Santa</span>
			</a>
			<ThemeToggle />
		</div>

		<div class="mx-auto max-w-3xl space-y-5 text-center">
			<h1 class="text-4xl leading-tight font-bold tracking-tight text-stone-950 sm:text-5xl">
				Welcome to our Secret Santa gift exchange!
			</h1>
			<p class="text-xl leading-9 text-stone-700">
				Everyone gives one gift and receives one gift. You will be given one person to buy a gift
				for, and someone else will be buying a gift for you. It is a secret until the party!
			</p>
		</div>

		<ol
			class="mx-auto grid w-full max-w-4xl gap-4 text-xl leading-8 text-stone-800 sm:grid-cols-2"
			aria-label="How to get started"
		>
			<li class="flex items-start gap-4 rounded-2xl bg-white/80 p-5 shadow-sm">
				<span
					class="grid size-10 shrink-0 place-items-center rounded-full bg-rose-700 font-bold text-white"
					aria-hidden="true">1</span
				>
				<span
					><strong>First time here?</strong> Press the red <strong>Create My Account</strong> button.</span
				>
			</li>
			<li class="flex items-start gap-4 rounded-2xl bg-white/80 p-5 shadow-sm">
				<span
					class="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-800 font-bold text-white"
					aria-hidden="true">2</span
				>
				<span
					><strong>Already have an account?</strong> Type your name and password, then press
					<strong>Sign In</strong>.</span
				>
			</li>
		</ol>

		<div class="grid items-stretch gap-6 lg:grid-cols-2">
			<Card
				class="relative w-full border-4 border-rose-700 bg-white/95 shadow-2xl shadow-rose-900/15"
			>
				<CardHeader class="space-y-3 p-7 pb-4 sm:p-8 sm:pb-4">
					<span
						class="grid size-14 place-items-center rounded-2xl bg-rose-700 text-white"
						aria-hidden="true"
					>
						<UserPlus size={30} />
					</span>
					<CardTitle class="text-3xl tracking-tight">New here?</CardTitle>
					<CardDescription class="text-xl leading-8 text-stone-700">
						Create your account in less than a minute. You only need your name and a password you
						will remember.
					</CardDescription>
				</CardHeader>
				<CardContent class="mt-auto px-7 pb-8 sm:px-8">
					<a
						class="inline-flex h-20 w-full items-center justify-center gap-3 rounded-2xl bg-rose-700 px-4 text-2xl font-bold text-white shadow-lg transition-colors hover:bg-rose-800 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-rose-700 sm:px-6 sm:text-3xl"
						href={resolve('/register')}
					>
						<UserPlus size={32} class="shrink-0 max-sm:hidden" aria-hidden="true" />
						Create My Account
					</a>
				</CardContent>
			</Card>

			<Card
				class="relative w-full border-4 border-emerald-800 bg-white/95 shadow-2xl shadow-emerald-900/15"
			>
				<CardHeader class="space-y-3 p-7 pb-4 sm:p-8 sm:pb-4">
					<span
						class="grid size-14 place-items-center rounded-2xl bg-emerald-800 text-white"
						aria-hidden="true"
					>
						<LogIn size={30} />
					</span>
					<CardTitle class="text-3xl tracking-tight">Already have an account?</CardTitle>
					<CardDescription class="text-xl leading-8 text-stone-700">
						Type the name and password you chose when you created your account.
					</CardDescription>
				</CardHeader>
				<CardContent class="px-7 pb-8 sm:px-8">
					<form class="space-y-5" onsubmit={handleSubmit}>
						<div class="space-y-2">
							<label class="text-xl font-semibold" for="login-identifier">Your name</label>
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

						<div class="space-y-2">
							<label class="text-xl font-semibold" for="password">Password</label>
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
							<p class="text-base text-stone-600">
								Press the eye at the end of the box to see what you typed.
							</p>
						</div>

						{#if errorMessage}
							<p class="app-alert app-alert--error text-lg" role="alert">
								{errorMessage}
							</p>
						{/if}

						<Button
							class="h-16 w-full rounded-2xl bg-emerald-800 text-2xl font-bold hover:bg-emerald-900"
							type="submit"
							disabled={isSubmitting}
						>
							{isSubmitting ? 'Signing in…' : 'Sign In'}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	</section>
</main>
