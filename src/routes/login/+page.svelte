<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { TRPCClientError } from '@trpc/client';
	import { LogIn, UserPlus } from '@lucide/svelte';
	import AuthShell from '#lib/components/AuthShell.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import PasswordInput from '#lib/components/PasswordInput.svelte';
	import { Card, CardContent, CardHeader, CardTitle } from '#lib/components/ui/card/index.js';
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

<AuthShell
	title="Welcome to our Secret Santa gift exchange!"
	intro="Everyone gives one gift and receives one gift. It is a secret until the party!"
>
	<Card class="gap-3 border-4 border-primary bg-white py-4 shadow-xl sm:gap-4 sm:py-6">
		<CardHeader class="px-4 sm:px-6">
			<CardTitle class="flex items-center gap-3 text-2xl tracking-tight sm:text-3xl">
				<span
					class="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"
					aria-hidden="true"
				>
					<LogIn size={22} />
				</span>
				Sign in
			</CardTitle>
		</CardHeader>
		<CardContent class="px-4 sm:px-6">
			<form class="space-y-3 sm:space-y-5" onsubmit={handleSubmit}>
				<div class="space-y-1 sm:space-y-2">
					<label class="text-lg font-semibold sm:text-xl" for="login-identifier">Your name</label>
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

				<Button size="cta" class="w-full" type="submit" disabled={isSubmitting}>
					{isSubmitting ? 'Signing in…' : 'Sign In'}
				</Button>
			</form>
		</CardContent>
	</Card>

	<Button href={resolve('/register')} variant="outline" size="cta" class="w-full">
		<UserPlus aria-hidden="true" />
		New here? Create an account
	</Button>
</AuthShell>
