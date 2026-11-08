<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { TRPCClientError } from '@trpc/client';
	import { Gift, ShieldCheck, Sparkles } from '@lucide/svelte';
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
	let password = $state('');
	let isSubmitting = $state(false);
	let errorMessage = $state<string | null>(null);

	async function handleSubmit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (isSubmitting) return;

		isSubmitting = true;
		errorMessage = null;

		try {
			await trpc.auth.login.mutate({ username, password });
			await goto(resolve('/app'));
		} catch (error) {
			if (error instanceof TRPCClientError && error.data?.code === 'TOO_MANY_REQUESTS') {
				errorMessage = 'Too many sign-in attempts. Please wait a little before trying again.';
			} else if (error instanceof TRPCClientError) {
				errorMessage = 'The username or password is not correct.';
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
	<meta name="description" content="Sign in to your private Secret Santa gift exchange." />
</svelte:head>

<main
	class="relative isolate grid min-h-screen overflow-hidden bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-emerald-100 via-stone-50 to-rose-50 px-4 py-8 text-stone-900 sm:px-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)] lg:px-16"
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
		class="relative mx-auto flex w-full max-w-6xl flex-col justify-between gap-12 lg:col-span-2"
	>
		<a
			class="inline-flex w-fit items-center gap-3 rounded-full py-2"
			href={resolve('/')}
			aria-label="Secret Santa home"
		>
			<span
				class="grid size-11 place-items-center rounded-2xl bg-emerald-800 text-white shadow-lg shadow-emerald-950/10"
			>
				<Gift size={21} strokeWidth={1.8} aria-hidden="true" />
			</span>
			<span class="text-lg font-semibold tracking-tight">Secret Santa</span>
		</a>

		<div
			class="grid items-center gap-12 py-2 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.75fr)] lg:gap-20"
		>
			<div class="max-w-2xl">
				<p
					class="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-900/10 bg-white/70 px-4 py-2 text-sm font-medium text-emerald-900 shadow-sm"
				>
					<Sparkles size={16} aria-hidden="true" />
					A little surprise brings everyone closer
				</p>
				<h1
					class="max-w-xl text-4xl leading-tight font-semibold tracking-tight text-stone-950 sm:text-5xl lg:text-6xl"
				>
					Make the giving part feel like magic.
				</h1>
				<p class="mt-6 max-w-lg text-lg leading-8 text-stone-600">
					Your family exchange, thoughtfully organized in one account-protected place. Sign in to
					see what’s next.
				</p>

				<div class="mt-10 flex flex-wrap gap-3 text-sm text-stone-600">
					<div class="inline-flex items-center gap-2 rounded-full bg-white/75 px-4 py-2 shadow-sm">
						<ShieldCheck size={16} class="text-emerald-800" aria-hidden="true" />
						Account protected
					</div>
					<div class="inline-flex items-center gap-2 rounded-full bg-white/75 px-4 py-2 shadow-sm">
						<Gift size={16} class="text-rose-700" aria-hidden="true" />
						One joyful exchange
					</div>
				</div>
			</div>

			<Card
				class="relative w-full border-white/80 bg-white/90 shadow-2xl shadow-stone-900/10 backdrop-blur"
			>
				<CardHeader class="space-y-2 p-7 pb-5 sm:p-8 sm:pb-6">
					<p class="text-sm font-medium tracking-[0.18em] text-emerald-800 uppercase">
						Your exchange awaits
					</p>
					<CardTitle class="text-2xl tracking-tight">Welcome back</CardTitle>
					<CardDescription class="text-base">
						Sign in with your account to continue to the family exchange.
					</CardDescription>
				</CardHeader>
				<CardContent class="px-7 pb-6 sm:px-8">
					<form class="space-y-5" onsubmit={handleSubmit}>
						<div class="space-y-2">
							<label class="text-sm font-medium" for="username">Username</label>
							<Input
								id="username"
								name="username"
								autocomplete="username"
								placeholder="Your username"
								bind:value={username}
								required
								minlength={3}
								maxlength={32}
								disabled={isSubmitting}
								aria-invalid={Boolean(errorMessage)}
							/>
						</div>

						<div class="space-y-2">
							<label class="text-sm font-medium" for="password">Password</label>
							<Input
								id="password"
								name="password"
								type="password"
								autocomplete="current-password"
								placeholder="Your password"
								bind:value={password}
								required
								minlength={12}
								maxlength={128}
								disabled={isSubmitting}
								aria-invalid={Boolean(errorMessage)}
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
							{isSubmitting ? 'Signing in…' : 'Sign in'}
						</Button>
					</form>
				</CardContent>
				<CardFooter
					class="justify-center border-t border-stone-100 px-7 py-5 text-center text-xs text-stone-500 sm:px-8"
				>
					<span>
						New to the exchange?
						<a
							class="font-medium text-emerald-800 underline-offset-4 hover:underline"
							href={resolve('/register')}
						>
							Create an account
						</a>
					</span>
				</CardFooter>
			</Card>
		</div>

		<p class="text-sm text-stone-500">A small family tradition, made easy to share.</p>
	</section>
</main>
