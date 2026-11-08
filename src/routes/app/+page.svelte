<script lang="ts">
	import { Gift, ShieldCheck } from '@lucide/svelte';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '#lib/components/ui/card/index.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Your exchange | Secret Santa</title>
</svelte:head>

<section class="space-y-8">
	<div>
		<p class="text-sm font-medium tracking-[0.18em] text-emerald-800 uppercase">
			Application foundation
		</p>
		<h1 class="mt-3 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">
			Welcome, {data.user.displayName}
		</h1>
		<p class="mt-3 max-w-2xl text-stone-600">
			Your account is ready. We’ll build the event, participant, and gift-exchange tools in the next
			phases.
		</p>
	</div>

	<div class="grid gap-5 md:grid-cols-2">
		<Card class="border-stone-200 bg-white">
			<CardHeader>
				<div
					class="mb-2 grid size-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-800"
				>
					<ShieldCheck size={20} aria-hidden="true" />
				</div>
				<CardTitle>Private account</CardTitle>
				<CardDescription>
					You’re signed in as a {data.user.role}. Account access is managed by the organizer.
				</CardDescription>
			</CardHeader>
			<CardContent class="text-sm text-stone-600">
				Username: <span class="font-medium text-stone-900">{data.user.username}</span>
			</CardContent>
		</Card>

		<Card class="border-stone-200 bg-white">
			<CardHeader>
				<div class="mb-2 grid size-11 place-items-center rounded-2xl bg-rose-50 text-rose-800">
					<Gift size={20} aria-hidden="true" />
				</div>
				<CardTitle>The exchange is taking shape</CardTitle>
				<CardDescription>
					This foundation includes sign-in, secure sessions, role-aware API access, and persistent
					storage.
				</CardDescription>
			</CardHeader>
		</Card>
	</div>
</section>
