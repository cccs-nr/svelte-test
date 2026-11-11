<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { TRPCClientError } from '@trpc/client';
	import { Gift } from '@lucide/svelte';
	import PasswordInput from '#lib/components/PasswordInput.svelte';
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';
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
	<div class="w-full max-w-xl">
		<div class="mb-8 flex items-center justify-between gap-4">
			<a
				class="inline-flex items-center gap-3 font-semibold tracking-tight text-stone-950"
				href={resolve('/')}
				aria-label="Secret Santa home"
			>
				<span class="grid size-10 place-items-center rounded-2xl bg-emerald-800 text-white">
					<Gift size={19} aria-hidden="true" />
				</span>
				Secret Santa
			</a>
			<ThemeToggle />
		</div>

		<Card class="border-white/80 bg-white/95 shadow-xl shadow-stone-900/10">
			<CardHeader>
				<p class="text-base font-semibold tracking-[0.12em] text-emerald-800 uppercase">
					Step 1 of 2
				</p>
				<CardTitle class="text-3xl tracking-tight">Create your account</CardTitle>
				<CardDescription class="text-xl leading-8 text-stone-700">
					Fill in the three boxes below, then press the green button. Afterwards, you will see a
					short welcome letter that explains how everything works.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form class="space-y-5" onsubmit={handleSubmit}>
					<div class="space-y-2">
						<label class="text-xl font-semibold" for="register-display-name">Your name</label>
						<Input
							id="register-display-name"
							bind:value={displayName}
							autocomplete="name"
							maxlength={64}
							required
							disabled={isSubmitting}
						/>
						<p class="text-base text-stone-600">
							Use your first name or full name. This is the name you will use to sign in.
						</p>
					</div>
					<div class="space-y-2">
						<label class="text-xl font-semibold" for="register-password">Password</label>
						<PasswordInput
							id="register-password"
							bind:value={password}
							autocomplete="new-password"
							minlength={3}
							maxlength={128}
							required
							disabled={isSubmitting}
						/>
						<p class="text-base text-stone-600">
							Choose something you will remember. It needs at least 3 letters or numbers. Press the
							eye to see what you typed.
						</p>
					</div>
					<div class="space-y-2">
						<label class="text-xl font-semibold" for="confirm-password">Confirm password</label>
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
					<Button
						class="h-16 w-full rounded-2xl bg-emerald-800 text-2xl font-bold hover:bg-emerald-900"
						type="submit"
						disabled={isSubmitting}
					>
						{isSubmitting ? 'Creating account…' : 'Create My Account'}
					</Button>
				</form>
			</CardContent>
			<CardFooter class="justify-center border-t border-stone-100 py-5 text-xl text-stone-700">
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
	</div>
</main>
