<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { TRPCClientError } from '@trpc/client';
	import { type EventStatus } from '#lib/models/event.js';
	import { getRealtimeSocket } from '#lib/realtime/client.js';
	import { trpc } from '#lib/trpc/client.js';
	import CodenameAvatar from '#lib/components/CodenameAvatar.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '#lib/components/ui/card/index.js';
	import { Input } from '#lib/components/ui/input/index.js';

	type Reservation = Awaited<ReturnType<typeof trpc.reservations.adminList.query>>[number];
	type CodenameMapping = Awaited<ReturnType<typeof trpc.codenames.adminMapping.mutate>>[number];
	type Props = {
		eventStatus: EventStatus | null;
		revealedAt: Date | null;
	};

	let { eventStatus, revealedAt }: Props = $props();
	let reservations = $state<Reservation[]>([]);
	let mapping = $state<CodenameMapping[]>([]);
	let editedCodenames = $state<Record<string, string>>({});
	let isLoading = $state(true);
	let isSaving = $state(false);
	let errorMessage = $state<string | null>(null);
	let notice = $state<string | null>(null);
	let mappingDialog = $state<HTMLDialogElement>();
	let correctionDialog = $state<HTMLDialogElement>();
	let selectedReservation = $state<Reservation | null>(null);
	let correctionStatus = $state<'released' | 'purchased'>('released');
	let correctionReason = $state('');
	let revealedAtText = $derived(
		revealedAt
			? new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeStyle: 'short' }).format(
					revealedAt
				)
			: null
	);

	onMount(() => {
		const socket = getRealtimeSocket();
		const refresh = () => void loadReservations();
		socket.on('dashboard:changed', refresh);
		socket.on('connect', refresh);
		void loadReservations();
		return () => {
			socket.off('dashboard:changed', refresh);
			socket.off('connect', refresh);
		};
	});

	async function loadReservations(): Promise<void> {
		isLoading = true;
		errorMessage = null;
		try {
			reservations = await trpc.reservations.adminList.query();
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError
					? error.message
					: 'Unable to load reservation details. Please try again.';
		} finally {
			isLoading = false;
		}
	}

	async function openMappingDialog(): Promise<void> {
		const confirmed = globalThis.confirm(
			'Viewing this identity mapping is recorded. Do you want to continue?'
		);
		if (!confirmed) return;

		errorMessage = null;
		try {
			mapping = await trpc.codenames.adminMapping.mutate({ confirm: true });
			editedCodenames = Object.fromEntries(
				mapping.map(({ userId, codename }) => [userId, codename])
			);
			mappingDialog?.showModal();
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError
					? error.message
					: 'Unable to load the codename mapping. Please try again.';
		}
	}

	async function saveCodename(row: CodenameMapping): Promise<void> {
		const codename = editedCodenames[row.userId]?.trim();
		if (!codename || codename === row.codename || isSaving) return;

		isSaving = true;
		errorMessage = null;
		notice = null;
		try {
			await trpc.codenames.update.mutate({ userId: row.userId, codename });
			mapping = mapping.map((entry) =>
				entry.userId === row.userId ? { ...entry, codename } : entry
			);
			notice = `Updated the codename for ${row.displayName}.`;
			await invalidateAll();
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError
					? error.message
					: 'Unable to update this codename. Please try again.';
		} finally {
			isSaving = false;
		}
	}

	function openCorrection(reservation: Reservation, status: 'released' | 'purchased'): void {
		selectedReservation = reservation;
		correctionStatus = status;
		correctionReason = '';
		correctionDialog?.showModal();
	}

	async function saveCorrection(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (!selectedReservation || isSaving) return;

		isSaving = true;
		errorMessage = null;
		notice = null;
		try {
			await trpc.reservations.adminSetStatus.mutate({
				reservationId: selectedReservation.id,
				status: correctionStatus,
				reason: correctionReason
			});
			notice = 'Reservation corrected and recorded in the audit history.';
			correctionDialog?.close();
			await loadReservations();
			await invalidateAll();
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError
					? error.message
					: 'Unable to correct this reservation. Please try again.';
		} finally {
			isSaving = false;
		}
	}

	async function revealIdentities(): Promise<void> {
		const confirmed = globalThis.confirm(
			'Reveal all participant codenames and identities to the family? This cannot be undone.'
		);
		if (!confirmed) return;

		isSaving = true;
		errorMessage = null;
		notice = null;
		try {
			await trpc.codenames.reveal.mutate();
			notice = 'Participant identities have been revealed to the family.';
			await invalidateAll();
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError
					? error.message
					: 'Unable to reveal identities. Please try again.';
		} finally {
			isSaving = false;
		}
	}

	function handleDialogClick(event: MouseEvent): void {
		if (event.target !== event.currentTarget || isSaving) return;
		if (event.currentTarget === mappingDialog) mappingDialog?.close();
		if (event.currentTarget === correctionDialog) correctionDialog?.close();
	}
</script>

<Card class="border-stone-200 bg-white">
	<CardHeader>
		<CardTitle>Gift purchase tracking</CardTitle>
		<CardDescription>
			Review reservation states without exposing private message contents. Your own wishlist
			reservations are excluded.
		</CardDescription>
	</CardHeader>
	<CardContent class="space-y-6">
		{#if errorMessage}
			<p
				class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
				role="alert"
			>
				{errorMessage}
			</p>
		{/if}
		{#if notice}
			<p class="text-sm text-emerald-800" role="status">{notice}</p>
		{/if}

		<div class="flex flex-wrap items-center gap-3">
			<Button type="button" variant="outline" onclick={() => void openMappingDialog()}>
				Manage codenames
			</Button>
			{#if revealedAtText}
				<p class="text-sm text-stone-600">Identities revealed {revealedAtText}.</p>
			{:else}
				<Button
					type="button"
					variant="destructive"
					onclick={() => void revealIdentities()}
					disabled={eventStatus !== 'completed' || isSaving}
				>
					{eventStatus === 'completed' ? 'Reveal identities' : 'Reveal after event completion'}
				</Button>
			{/if}
		</div>

		<div class="space-y-3">
			<div>
				<h3 class="font-semibold text-stone-900">Reservations</h3>
				<p class="mt-1 text-sm text-stone-600">
					Buyers appear by codename until reveal. Corrections require a reason and are audited.
				</p>
			</div>
			{#if isLoading}
				<p class="text-sm text-stone-500">Loading reservations…</p>
			{:else if reservations.length === 0}
				<p class="rounded-lg border border-dashed border-stone-300 p-4 text-sm text-stone-600">
					No active reservations or purchases to review.
				</p>
			{:else}
				<div class="-mx-2 overflow-x-auto px-2">
					<table class="w-full min-w-[680px] border-collapse text-left text-sm">
						<thead>
							<tr class="border-b border-stone-200 text-xs tracking-wide text-stone-500 uppercase">
								<th scope="col" class="px-3 py-3 font-medium">Gift idea</th>
								<th scope="col" class="px-3 py-3 font-medium">Recipient</th>
								<th scope="col" class="px-3 py-3 font-medium">Buyer</th>
								<th scope="col" class="px-3 py-3 font-medium">Status</th>
								<th scope="col" class="px-3 py-3 font-medium">Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each reservations as reservation (reservation.id)}
								<tr class="border-b border-stone-100 last:border-0">
									<th scope="row" class="px-3 py-3 font-medium text-stone-900">
										{reservation.title}
									</th>
									<td class="px-3 py-3 text-stone-700">{reservation.ownerDisplayName}</td>
									<td class="px-3 py-3 text-stone-700">
										<span class="inline-flex items-center gap-2">
											<CodenameAvatar codename={reservation.reserverCodename} size="xs" />
											{reservation.reserverLabel}
										</span>
									</td>
									<td class="px-3 py-3 text-stone-700 capitalize">{reservation.status}</td>
									<td class="px-3 py-3">
										<div class="flex flex-wrap gap-2">
											{#if reservation.status === 'reserved'}
												<Button
													type="button"
													size="sm"
													variant="outline"
													onclick={() => openCorrection(reservation, 'purchased')}
													disabled={isSaving}
												>
													Mark purchased
												</Button>
											{/if}
											<Button
												type="button"
												size="sm"
												variant="outline"
												onclick={() => openCorrection(reservation, 'released')}
												disabled={isSaving}
											>
												Release
											</Button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	</CardContent>
</Card>

<dialog
	bind:this={mappingDialog}
	class="m-auto max-h-[92vh] w-[95vw] max-w-3xl overflow-y-auto rounded-2xl bg-white text-stone-950 shadow-2xl backdrop:bg-black/60"
	aria-labelledby="codename-dialog-title"
	onclick={handleDialogClick}
>
	<div class="p-5 sm:p-7">
		<div class="mb-5 flex items-start justify-between gap-4">
			<div>
				<h2 id="codename-dialog-title" class="text-xl font-semibold">Participant codenames</h2>
				<p class="mt-1 text-sm text-stone-600">
					This mapping is hidden from the normal Dashboard and each access is recorded.
				</p>
			</div>
			<Button type="button" variant="outline" onclick={() => mappingDialog?.close()}>Close</Button>
		</div>
		<div class="-mx-2 overflow-x-auto px-2">
			<table class="w-full min-w-[520px] border-collapse text-left text-sm">
				<thead>
					<tr class="border-b border-stone-200 text-xs tracking-wide text-stone-500 uppercase">
						<th scope="col" class="px-3 py-3 font-medium">Participant</th>
						<th scope="col" class="px-3 py-3 font-medium">Codename</th>
						<th scope="col" class="px-3 py-3 font-medium">Action</th>
					</tr>
				</thead>
				<tbody>
					{#each mapping as row (row.userId)}
						<tr class="border-b border-stone-100 last:border-0">
							<th scope="row" class="px-3 py-3 font-medium">{row.displayName}</th>
							<td class="px-3 py-3">
								<Input
									id={`codename-${row.userId}`}
									bind:value={editedCodenames[row.userId]}
									maxlength={60}
									aria-label={`Codename for ${row.displayName}`}
								/>
							</td>
							<td class="px-3 py-3">
								<Button
									type="button"
									size="sm"
									variant="outline"
									onclick={() => void saveCodename(row)}
									disabled={isSaving ||
										!editedCodenames[row.userId]?.trim() ||
										editedCodenames[row.userId]?.trim() === row.codename}
								>
									Save
								</Button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</dialog>

<dialog
	bind:this={correctionDialog}
	class="m-auto w-[95vw] max-w-lg rounded-2xl bg-white text-stone-950 shadow-2xl backdrop:bg-black/60"
	aria-labelledby="reservation-correction-title"
	onclick={handleDialogClick}
>
	<form class="space-y-5 p-5 sm:p-7" onsubmit={saveCorrection}>
		<div>
			<h2 id="reservation-correction-title" class="text-xl font-semibold">Correct reservation</h2>
			<p class="mt-2 text-sm text-stone-600">
				{selectedReservation?.title} will be marked {correctionStatus}. Record why this correction
				is needed.
			</p>
		</div>
		<div class="space-y-2">
			<label class="text-sm font-medium" for="reservation-correction-reason">Reason</label>
			<textarea
				id="reservation-correction-reason"
				class="min-h-24 w-full rounded-md border border-stone-300 bg-white p-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
				bind:value={correctionReason}
				minlength="3"
				maxlength="500"
				required></textarea>
		</div>
		<div class="flex justify-end gap-2">
			<Button
				type="button"
				variant="outline"
				onclick={() => correctionDialog?.close()}
				disabled={isSaving}
			>
				Cancel
			</Button>
			<Button type="submit" disabled={isSaving || correctionReason.trim().length < 3}>
				{isSaving ? 'Saving…' : 'Save correction'}
			</Button>
		</div>
	</form>
</dialog>
