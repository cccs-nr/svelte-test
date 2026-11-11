<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { TRPCClientError } from '@trpc/client';
	import type { UserRole } from '#lib/auth.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '#lib/components/ui/card/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import PasswordInput from '#lib/components/PasswordInput.svelte';
	import { trpc } from '#lib/trpc/client.js';

	type Participant = {
		id: string;
		username: string;
		displayName: string;
		role: UserRole;
		isParticipating: boolean;
		isActive: boolean;
		householdId: string | null;
		householdName: string | null;
		managedByName: string | null;
		lastLoginAt: string | null;
		wishlistCount: number;
		messageCount: number;
		eventStatus: string;
		assignmentFinalized: boolean;
		giftPurchased: boolean;
	};
	type HouseholdOption = { id: string; name: string };
	type SortKey = 'name' | 'ideas' | 'messages';
	type Props = {
		participants: Participant[];
		households: HouseholdOption[];
		currentUserId: string;
		assignmentsExist: boolean;
	};

	let { participants, households, currentUserId, assignmentsExist }: Props = $props();
	let createDialog = $state<HTMLDialogElement>();
	let editDialog = $state<HTMLDialogElement>();
	let selectedParticipantId = $state<string | null>(null);
	let createName = $state('');
	let createPassword = $state('');
	let createRole = $state<UserRole>('participant');
	let createHouseholdId = $state('');
	let editName = $state('');
	let editRole = $state<UserRole>('participant');
	let editHouseholdId = $state('');
	let editIsActive = $state(true);
	let resetPassword = $state('');
	let isSaving = $state(false);
	let errorMessage = $state<string | null>(null);
	let notice = $state<string | null>(null);
	let sortKey = $state<SortKey>('name');
	let sortDescending = $state(false);
	let sortedParticipants = $derived(
		[...participants].sort((left, right) => {
			const comparison =
				sortKey === 'name'
					? left.displayName.localeCompare(right.displayName)
					: sortKey === 'ideas'
						? left.wishlistCount - right.wishlistCount
						: left.messageCount - right.messageCount;
			return sortDescending ? -comparison : comparison;
		})
	);

	function sortBy(key: SortKey): void {
		if (sortKey === key) {
			sortDescending = !sortDescending;
			return;
		}
		sortKey = key;
		sortDescending = key !== 'name';
	}

	function setMobileSort(value: string): void {
		if (value !== 'name' && value !== 'ideas' && value !== 'messages') return;
		sortKey = value;
		sortDescending = value !== 'name';
	}

	function openCreateDialog(): void {
		createName = '';
		createPassword = '';
		createRole = 'participant';
		createHouseholdId = '';
		errorMessage = null;
		createDialog?.showModal();
	}

	function openEditDialog(participant: Participant): void {
		selectedParticipantId = participant.id;
		editName = participant.displayName;
		editRole = participant.role;
		editHouseholdId = participant.householdId ?? '';
		editIsActive = participant.isActive;
		resetPassword = '';
		errorMessage = null;
		editDialog?.showModal();
	}

	function handleBackdropClick(event: MouseEvent): void {
		if (!isSaving && event.target === createDialog) createDialog?.close();
		if (!isSaving && event.target === editDialog) editDialog?.close();
	}

	async function createAccount(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (isSaving) return;

		isSaving = true;
		errorMessage = null;
		try {
			await trpc.participants.create.mutate({
				displayName: createName,
				password: createPassword,
				role: createRole,
				householdId: createHouseholdId || null
			});
			await invalidateAll();
			createDialog?.close();
			notice = 'Account created.';
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError ? error.message : 'Unable to create the account.';
		} finally {
			isSaving = false;
		}
	}

	async function updateAccount(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (!selectedParticipantId || isSaving) return;

		const current = participants.find((participant) => participant.id === selectedParticipantId);
		if (current?.isActive && !editIsActive && !globalThis.confirm('Deactivate this account?'))
			return;

		isSaving = true;
		errorMessage = null;
		try {
			await trpc.participants.update.mutate({
				id: selectedParticipantId,
				displayName: editName,
				role: editRole,
				isActive: editIsActive,
				householdId: editHouseholdId || null
			});
			await invalidateAll();
			editDialog?.close();
			notice = 'Account updated.';
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError ? error.message : 'Unable to update the account.';
		} finally {
			isSaving = false;
		}
	}

	async function deleteAccount(): Promise<void> {
		if (!selectedParticipantId || isSaving) return;
		const target = participants.find((participant) => participant.id === selectedParticipantId);
		if (!target) return;
		const warning = target.managedByName
			? `Permanently delete ${target.displayName}? Their wishlist and messages will be erased. This cannot be undone.`
			: `Permanently delete ${target.displayName}? Their wishlist, messages, and any people they manage will be erased. This cannot be undone. To keep their data, deactivate the account instead.`;
		if (!globalThis.confirm(warning)) return;

		isSaving = true;
		errorMessage = null;
		try {
			await trpc.participants.delete.mutate({ id: selectedParticipantId });
			await invalidateAll();
			editDialog?.close();
			notice = `${target.displayName} was deleted.`;
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError ? error.message : 'Unable to delete the account.';
		} finally {
			isSaving = false;
		}
	}

	function formatLastLogin(value: string | null): string {
		if (!value) return 'Never signed in';
		return new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeStyle: 'short' }).format(
			new Date(value)
		);
	}

	async function updatePassword(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (!selectedParticipantId || isSaving) return;

		isSaving = true;
		errorMessage = null;
		try {
			await trpc.participants.resetPassword.mutate({
				id: selectedParticipantId,
				password: resetPassword
			});
			resetPassword = '';
			notice = 'Password reset. Existing sessions for this account were signed out.';
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError ? error.message : 'Unable to reset the password.';
		} finally {
			isSaving = false;
		}
	}
</script>

<Card id="participants">
	<CardHeader class="flex flex-row flex-wrap items-center justify-between gap-4">
		<div>
			<CardTitle>Participants and accounts</CardTitle>
			<CardDescription>
				{participants.length} accounts · create and edit accounts through dialogs. Participant membership
				changes require the draw to be reset.
			</CardDescription>
		</div>
		<Button type="button" onclick={openCreateDialog} disabled={assignmentsExist}>
			Create account
		</Button>
	</CardHeader>
	<CardContent class="space-y-4">
		{#if notice}
			<p class="app-notice" role="status">{notice}</p>
		{/if}
		{#if participants.length === 0}
			<p class="text-sm text-stone-600">No accounts have registered yet.</p>
		{:else}
			<div class="mb-3 flex items-center justify-between gap-3 xl:hidden">
				<label class="text-sm font-medium text-foreground" for="mobile-participant-sort">
					Sort participants
				</label>
				<select
					id="mobile-participant-sort"
					class="min-h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
					value={sortKey}
					onchange={(event) => setMobileSort(event.currentTarget.value)}
				>
					<option value="name">Name</option>
					<option value="ideas">Gift ideas</option>
					<option value="messages">Messages</option>
				</select>
			</div>
			<ul class="space-y-3 xl:hidden" aria-label="Participant accounts">
				{#each sortedParticipants as participant (participant.id)}
					<li class="app-surface rounded-xl border border-border p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<p class="truncate font-semibold text-foreground">{participant.displayName}</p>
								<p class="truncate text-sm text-muted-foreground">
									{participant.managedByName
										? `Managed by ${participant.managedByName}`
										: `@${participant.username}`}
								</p>
								<p class="truncate text-sm text-muted-foreground">
									Last sign-in: {formatLastLogin(participant.lastLoginAt)}
								</p>
							</div>
							<Button
								type="button"
								size="sm"
								variant="outline"
								aria-label={`Edit ${participant.displayName}`}
								onclick={() => openEditDialog(participant)}
							>
								Edit
							</Button>
						</div>
						<div class="mt-3 flex flex-wrap items-center gap-2">
							<span
								class={`rounded-full px-2 py-1 text-sm font-medium ${
									participant.isActive
										? 'bg-emerald-100 text-emerald-900'
										: 'bg-secondary text-secondary-foreground'
								}`}
							>
								{participant.isActive ? 'Active' : 'Inactive'}
							</span>
							<span class="text-sm text-muted-foreground capitalize">
								{participant.role}{participant.isParticipating ? ' · Participating' : ''}
							</span>
							{#if participant.eventStatus}
								<span class="text-sm text-muted-foreground">· {participant.eventStatus}</span>
							{/if}
						</div>
						<dl class="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
							<div>
								<dt class="text-sm text-muted-foreground">Household</dt>
								<dd class="mt-0.5 truncate text-foreground">
									{participant.householdName ?? 'None'}
								</dd>
							</div>
							<div>
								<dt class="text-sm text-muted-foreground">Gift ideas</dt>
								<dd class="mt-0.5 text-foreground tabular-nums">{participant.wishlistCount}</dd>
							</div>
							<div>
								<dt class="text-sm text-muted-foreground">Messages</dt>
								<dd class="mt-0.5 text-foreground tabular-nums">{participant.messageCount}</dd>
							</div>
							<div>
								<dt class="text-sm text-muted-foreground">Official gift</dt>
								<dd class="mt-0.5 text-foreground">
									{!participant.isParticipating
										? '—'
										: participant.giftPurchased
											? 'Purchased'
											: 'Not marked'}
								</dd>
							</div>
						</dl>
					</li>
				{/each}
			</ul>
			<div class="app-table-scroll -mx-2 hidden overflow-x-auto px-2 xl:block">
				<table class="w-full min-w-[1050px] border-collapse text-left text-sm">
					<thead>
						<tr class="border-b border-stone-200 text-sm tracking-wide text-stone-600 uppercase">
							<th
								scope="col"
								aria-sort={sortKey === 'name'
									? sortDescending
										? 'descending'
										: 'ascending'
									: 'none'}
								class="px-3 py-2 font-medium"
							>
								<button type="button" class="cursor-pointer" onclick={() => sortBy('name')}>
									Display name
								</button>
							</th>
							<th scope="col" class="px-3 py-2 font-medium">Household</th>
							<th
								scope="col"
								aria-sort={sortKey === 'ideas'
									? sortDescending
										? 'descending'
										: 'ascending'
									: 'none'}
								class="px-3 py-2 text-right font-medium"
							>
								<button type="button" class="cursor-pointer" onclick={() => sortBy('ideas')}>
									Gift ideas
								</button>
							</th>
							<th
								scope="col"
								aria-sort={sortKey === 'messages'
									? sortDescending
										? 'descending'
										: 'ascending'
									: 'none'}
								class="px-3 py-2 text-right font-medium"
							>
								<button type="button" class="cursor-pointer" onclick={() => sortBy('messages')}>
									Messages
								</button>
							</th>
							<th scope="col" class="px-3 py-2 font-medium">Gift purchase</th>
							<th scope="col" class="px-3 py-2 font-medium">Account / role</th>
							<th scope="col" class="px-3 py-2 font-medium">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each sortedParticipants as participant (participant.id)}
							<tr class="border-b border-stone-100 last:border-0">
								<th scope="row" class="px-3 py-3 font-medium text-stone-950">
									<span class="block">{participant.displayName}</span>
									<span class="mt-0.5 block text-sm font-normal text-stone-600">
										{participant.managedByName
											? `Managed by ${participant.managedByName}`
											: `@${participant.username}`}
									</span>
									<span class="mt-0.5 block text-sm font-normal text-stone-600">
										Last sign-in: {formatLastLogin(participant.lastLoginAt)}
									</span>
								</th>
								<td class="px-3 py-3 text-stone-700">{participant.householdName ?? '—'}</td>
								<td class="px-3 py-3 text-right text-stone-700 tabular-nums">
									{participant.wishlistCount}
								</td>
								<td class="px-3 py-3 text-right text-stone-700 tabular-nums">
									{participant.messageCount}
								</td>
								<td class="px-3 py-3 text-stone-700">
									{#if !participant.isParticipating}
										—
									{:else if participant.giftPurchased}
										<span class="app-status app-status--success"> Purchased </span>
									{:else}
										<span class="text-stone-600">Not marked</span>
									{/if}
								</td>
								<td class="px-3 py-3">
									<span
										class={`rounded-full px-2 py-1 text-sm ${
											participant.isActive
												? 'bg-emerald-100 text-emerald-900'
												: 'bg-stone-100 text-stone-600'
										}`}
									>
										{participant.isActive ? 'Active' : 'Inactive'}
									</span>
									<span class="ml-1 text-sm text-stone-600 capitalize">
										{participant.role}
									</span>
									<p class="mt-1 text-sm text-stone-600">{participant.eventStatus}</p>
								</td>
								<td class="px-3 py-3">
									<Button
										type="button"
										size="sm"
										variant="outline"
										aria-label={`Edit ${participant.displayName}`}
										onclick={() => openEditDialog(participant)}
									>
										Edit
									</Button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</CardContent>
</Card>

<dialog
	bind:this={createDialog}
	class="app-dialog m-auto max-h-[92dvh] w-[min(95vw,36rem)] overflow-y-auto rounded-2xl shadow-2xl backdrop:bg-black/60"
	aria-labelledby="create-account-title"
	onclick={handleBackdropClick}
>
	<div class="p-5 sm:p-7">
		<div class="mb-6 flex items-start justify-between gap-4">
			<div>
				<h2 id="create-account-title" class="text-xl font-semibold">Create account</h2>
				<p class="mt-1 text-sm text-stone-600">
					Use the name the person will use to sign in. The internal username is generated.
				</p>
			</div>
			<Button
				type="button"
				variant="outline"
				onclick={() => createDialog?.close()}
				disabled={isSaving}
			>
				Close
			</Button>
		</div>
		{#if errorMessage}
			<p class="app-alert app-alert--error mb-4" role="alert">
				{errorMessage}
			</p>
		{/if}
		<form class="grid gap-4 sm:grid-cols-2" onsubmit={createAccount}>
			<div class="space-y-2 sm:col-span-2">
				<label class="text-base font-semibold" for="create-account-name">Person’s name</label>
				<Input
					id="create-account-name"
					bind:value={createName}
					maxlength={64}
					required
					disabled={isSaving}
				/>
			</div>
			<div class="space-y-2">
				<label class="text-base font-semibold" for="create-account-password">Initial password</label
				>
				<PasswordInput
					id="create-account-password"
					bind:value={createPassword}
					autocomplete="new-password"
					minlength={3}
					maxlength={128}
					required
					disabled={isSaving}
				/>
			</div>
			<div class="space-y-2">
				<label class="text-base font-semibold" for="create-account-role">Role</label>
				<select
					id="create-account-role"
					bind:value={createRole}
					disabled={isSaving}
					class="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"
				>
					<option value="participant">Participant</option>
					<option value="organizer">Organizer</option>
				</select>
			</div>
			<div class="space-y-2 sm:col-span-2">
				<label class="text-base font-semibold" for="create-account-household">Household</label>
				<select
					id="create-account-household"
					bind:value={createHouseholdId}
					disabled={isSaving}
					class="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"
				>
					<option value="">No household</option>
					{#each households as household (household.id)}
						<option value={household.id}>{household.name}</option>
					{/each}
				</select>
			</div>
			<div class="flex justify-end gap-3 sm:col-span-2">
				<Button
					type="button"
					variant="outline"
					onclick={() => createDialog?.close()}
					disabled={isSaving}
				>
					Cancel
				</Button>
				<Button type="submit" disabled={isSaving}>
					{isSaving ? 'Creating…' : 'Create account'}
				</Button>
			</div>
		</form>
	</div>
</dialog>

<dialog
	bind:this={editDialog}
	class="app-dialog m-auto max-h-[92dvh] w-[min(95vw,36rem)] overflow-y-auto rounded-2xl shadow-2xl backdrop:bg-black/60"
	aria-labelledby="edit-account-title"
	onclick={handleBackdropClick}
	onclose={() => (selectedParticipantId = null)}
>
	<div class="p-5 sm:p-7">
		<div class="mb-6 flex items-start justify-between gap-4">
			<div>
				<h2 id="edit-account-title" class="text-xl font-semibold">Edit account</h2>
				<p class="mt-1 text-sm text-stone-600">Disabling an account signs it out.</p>
			</div>
			<Button
				type="button"
				variant="outline"
				onclick={() => editDialog?.close()}
				disabled={isSaving}
			>
				Close
			</Button>
		</div>
		{#if errorMessage}
			<p class="app-alert app-alert--error mb-4" role="alert">
				{errorMessage}
			</p>
		{/if}
		<form class="grid gap-4 sm:grid-cols-2" onsubmit={updateAccount}>
			<div class="space-y-2 sm:col-span-2">
				<label class="text-base font-semibold" for="edit-account-name">Person’s name</label>
				<Input
					id="edit-account-name"
					bind:value={editName}
					maxlength={64}
					required
					disabled={isSaving}
				/>
			</div>
			<div class="space-y-2">
				<label class="text-base font-semibold" for="edit-account-role">Role</label>
				<select
					id="edit-account-role"
					bind:value={editRole}
					disabled={isSaving || assignmentsExist}
					class="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"
				>
					<option value="participant">Participant</option>
					<option value="organizer">Organizer</option>
				</select>
			</div>
			<div class="space-y-2">
				<label class="text-base font-semibold" for="edit-account-household">Household</label>
				<select
					id="edit-account-household"
					bind:value={editHouseholdId}
					disabled={isSaving || assignmentsExist}
					class="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"
				>
					<option value="">No household</option>
					{#each households as household (household.id)}
						<option value={household.id}>{household.name}</option>
					{/each}
				</select>
			</div>
			<label class="flex items-center gap-3 text-sm text-stone-700 sm:col-span-2">
				<input
					type="checkbox"
					bind:checked={editIsActive}
					disabled={isSaving || assignmentsExist}
				/>
				Account is active
			</label>
			<div class="flex justify-end gap-3 sm:col-span-2">
				<Button
					type="button"
					variant="outline"
					onclick={() => editDialog?.close()}
					disabled={isSaving}
				>
					Cancel
				</Button>
				<Button type="submit" disabled={isSaving}>
					{isSaving ? 'Saving…' : 'Save account'}
				</Button>
			</div>
		</form>

		{#if selectedParticipantId !== currentUserId && !participants.find((participant) => participant.id === selectedParticipantId)?.managedByName}
			<form class="mt-6 space-y-3 border-t border-stone-100 pt-5" onsubmit={updatePassword}>
				<div>
					<h3 class="font-medium">Reset password</h3>
					<p class="mt-1 text-sm text-stone-600">Existing sessions will be signed out.</p>
				</div>
				<div class="flex flex-wrap gap-3">
					<label class="sr-only" for="reset-account-password">New password</label>
					<PasswordInput
						id="reset-account-password"
						bind:value={resetPassword}
						autocomplete="new-password"
						minlength={3}
						maxlength={128}
						required
						disabled={isSaving}
						class="min-w-[14rem] flex-1"
					/>
					<Button type="submit" variant="outline" disabled={isSaving}>Reset password</Button>
				</div>
			</form>
		{/if}

		{#if selectedParticipantId !== currentUserId}
			<div class="mt-6 space-y-3 border-t border-stone-100 pt-5">
				<div>
					<h3 class="font-medium">Delete account</h3>
					<p class="mt-1 text-sm text-stone-600">
						Permanently removes this person, their wishlist and their messages. Use “Account is
						active” above if you only want to block sign-in.
						{#if assignmentsExist}
							Reset the draw first to delete a participant.
						{/if}
					</p>
				</div>
				<Button
					type="button"
					variant="destructive"
					size="lg"
					disabled={isSaving}
					onclick={deleteAccount}
				>
					Delete this account
				</Button>
			</div>
		{/if}
	</div>
</dialog>
