<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { TRPCClientError } from '@trpc/client';
	import { UserPlus } from '@lucide/svelte';
	import AuthShell from '#lib/components/AuthShell.svelte';
	import PasswordInput from '#lib/components/PasswordInput.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Card, CardContent, CardHeader, CardTitle } from '#lib/components/ui/card/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { trpc } from '#lib/trpc/client.js';

	let displayName = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let isSubmitting = $state(false);
	let errorMessage = $state<string | null>(null);

	async function handleSubmit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (isSubmitting) return;

		if (password !== confirmPassword) {
			errorMessage = 'The passwords do not match.';
			return;
		}

		isSubmitting = true;
		errorMessage = null;

		try {
			await trpc.auth.register.mutate({ displayName, password });
			await goto(resolve('/app/welcome'));
		} catch (error) {
			if (error instanceof TRPCClientError && error.data?.code === 'TOO_MANY_REQUESTS') {
				errorMessage = 'Too many registration attempts from this network. Try again later.';
			} else if (error instanceof TRPCClientError) {
				errorMessage = error.message;
			} else {
				errorMessage = 'Unable to create your account. Please try again.';
			}
		} finally {
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>Welcome | Secret Santa</title>
	<meta name="description" content="Create a participant account for the Secret Santa exchange." />
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
					<UserPlus size={22} />
				</span>
				Create an account
			</CardTitle>
		</CardHeader>
		<CardContent class="px-4 sm:px-6">
			<form class="space-y-3 sm:space-y-5" onsubmit={handleSubmit}>
				<div class="space-y-1 sm:space-y-2">
					<label class="text-lg font-semibold sm:text-xl" for="register-display-name"
						>Your name</label
					>
					<Input
						id="register-display-name"
						bind:value={displayName}
						autocomplete="name"
						maxlength={64}
						required
						disabled={isSubmitting}
					/>
					<p class="hidden text-base text-stone-700 sm:block">
						Use your first name or full name. This is the name you will use to sign in.
					</p>
				</div>
				<div class="space-y-1 sm:space-y-2">
					<label class="text-lg font-semibold sm:text-xl" for="register-password">Password</label>
					<PasswordInput
						id="register-password"
						bind:value={password}
						autocomplete="new-password"
						minlength={3}
						maxlength={128}
						required
						disabled={isSubmitting}
					/>
					<p class="hidden text-base text-stone-700 sm:block">
						Choose something you will remember. It needs at least 3 letters or numbers. Press the
						eye to see what you typed.
					</p>
				</div>
				<div class="space-y-1 sm:space-y-2">
					<label class="text-lg font-semibold sm:text-xl" for="confirm-password"
						>Confirm password</label
					>
					<PasswordInput
						id="confirm-password"
						bind:value={confirmPassword}
						autocomplete="new-password"
						minlength={3}
						maxlength={128}
						required
						disabled={isSubmitting}
					/>
				</div>
				{#if errorMessage}
					<p class="app-alert app-alert--error text-lg" role="alert">
						{errorMessage}
					</p>
				{/if}
				<Button size="cta" class="w-full" type="submit" disabled={isSubmitting}>
					{isSubmitting ? 'Creating account…' : 'Create My Account'}
				</Button>
			</form>
		</CardContent>
	</Card>

	<Button href={resolve('/login')} variant="outline" size="cta" class="w-full">
		Already have an account? Sign in!
	</Button>
</AuthShell>
