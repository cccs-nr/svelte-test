<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { TRPCClientError } from '@trpc/client';
	import { Gift } from '@lucide/svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardFooter,
		CardHeader,
		CardTitle
	} from '#lib/components/ui/card/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { trpc } from '#lib/trpc/client.js';

	let username = $state('');
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
			await trpc.auth.register.mutate({ username, displayName, password });
			await goto(resolve('/app'));
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
	<title>Create account | Secret Santa</title>
	<meta name="description" content="Create a participant account for the Secret Santa exchange." />
</svelte:head>

<main
	class="grid min-h-screen place-items-center bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-emerald-100 via-stone-50 to-rose-50 px-4 py-10"
>
	<div class="w-full max-w-lg">
		<a
			class="mb-8 inline-flex items-center gap-3 font-semibold tracking-tight text-stone-950"
			href={resolve('/')}
			aria-label="Secret Santa home"
		>
			<span class="grid size-10 place-items-center rounded-2xl bg-emerald-800 text-white">
				<Gift size={19} aria-hidden="true" />
			</span>
			Secret Santa
		</a>

		<Card class="border-white/80 bg-white/95 shadow-xl shadow-stone-900/10">
			<CardHeader>
				<p class="text-sm font-medium tracking-[0.18em] text-emerald-800 uppercase">
					Join the exchange
				</p>
				<CardTitle class="text-2xl tracking-tight">Create your account</CardTitle>
				<CardDescription>
					Choose a username and password. New accounts join as participants.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form class="space-y-5" onsubmit={handleSubmit}>
					<div class="space-y-2">
						<label class="text-sm font-medium" for="register-username">Username</label>
						<Input
							id="register-username"
							bind:value={username}
							autocomplete="username"
							minlength={3}
							maxlength={32}
							required
							disabled={isSubmitting}
						/>
						<p class="text-xs text-stone-500">
							Use 3–32 letters, numbers, periods, underscores, or hyphens.
						</p>
					</div>
					<div class="space-y-2">
						<label class="text-sm font-medium" for="register-display-name">Display name</label>
						<Input
							id="register-display-name"
							bind:value={displayName}
							autocomplete="name"
							maxlength={64}
							required
							disabled={isSubmitting}
						/>
					</div>
					<div class="space-y-2">
						<label class="text-sm font-medium" for="register-password">Password</label>
						<Input
							id="register-password"
							type="password"
							bind:value={password}
							autocomplete="new-password"
							minlength={12}
							maxlength={128}
							required
							disabled={isSubmitting}
						/>
						<p class="text-xs text-stone-500">Use at least 12 characters.</p>
					</div>
					<div class="space-y-2">
						<label class="text-sm font-medium" for="confirm-password">Confirm password</label>
						<Input
							id="confirm-password"
							type="password"
							bind:value={confirmPassword}
							autocomplete="new-password"
							minlength={12}
							maxlength={128}
							required
							disabled={isSubmitting}
						/>
					</div>
					{#if errorMessage}
						<p
							class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
							role="alert"
						>
							{errorMessage}
						</p>
					{/if}
					<Button
						class="h-11 w-full rounded-xl bg-emerald-800 text-base hover:bg-emerald-900"
						type="submit"
						disabled={isSubmitting}
					>
						{isSubmitting ? 'Creating account…' : 'Create account'}
					</Button>
				</form>
			</CardContent>
			<CardFooter class="justify-center border-t border-stone-100 py-5 text-sm text-stone-600">
				<span>
					Already registered?
					<a
						class="font-medium text-emerald-800 underline-offset-4 hover:underline"
						href={resolve('/login')}
					>
						Sign in
					</a>
				</span>
			</CardFooter>
		</Card>
		<p class="mt-5 text-center text-xs text-stone-500">
			Open registration: anyone who can reach this site can create a participant account.
		</p>
	</div>
</main>
