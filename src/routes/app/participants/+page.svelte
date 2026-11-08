<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { TRPCClientError } from '@trpc/client';
	import type { PageProps } from './$types';
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
	import { trpc } from '#lib/trpc/client.js';

	let { data }: PageProps = $props();
	let accounts = $derived(data.accounts);
	let createUsername = $state('');
	let createDisplayName = $state('');
	let createPassword = $state('');
	let createRole = $state<UserRole>('participant');
	let createHouseholdId = $state('');
	let selectedAccountId = $state<string | null>(null);
	let editUsername = $state('');
	let editDisplayName = $state('');
	let editRole = $state<UserRole>('participant');
	let editHouseholdId = $state('');
	let editIsActive = $state(true);
	let resetPassword = $state('');
	let isSaving = $state(false);
	let errorMessage = $state<string | null>(null);
	let successMessage = $state<string | null>(null);

	function selectAccount(account: (typeof accounts)[number]): void {
		selectedAccountId = account.id;
		editUsername = account.username;
		editDisplayName = account.displayName;
		editRole = account.role;
		editHouseholdId = account.householdId ?? '';
		editIsActive = account.isActive;
		resetPassword = '';
		errorMessage = null;
		successMessage = null;
	}

	async function createAccount(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (isSaving) return;

		isSaving = true;
		errorMessage = null;
		successMessage = null;

		try {
			await trpc.participants.create.mutate({
				username: createUsername,
				displayName: createDisplayName,
				password: createPassword,
				role: createRole,
				householdId: createHouseholdId || null
			});
			await invalidateAll();
			createUsername = '';
			createDisplayName = '';
			createPassword = '';
			createRole = 'participant';
			createHouseholdId = '';
			successMessage = 'Account created.';
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError ? error.message : 'Unable to create the account.';
		} finally {
			isSaving = false;
		}
	}

	async function updateAccount(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (!selectedAccountId || isSaving) return;

		const current = accounts.find((account) => account.id === selectedAccountId);
		if (current?.isActive && !editIsActive && !globalThis.confirm('Deactivate this account?'))
			return;

		isSaving = true;
		errorMessage = null;
		successMessage = null;

		try {
			await trpc.participants.update.mutate({
				id: selectedAccountId,
				username: editUsername,
				displayName: editDisplayName,
				role: editRole,
				isActive: editIsActive,
				householdId: editHouseholdId || null
			});
			await invalidateAll();
			successMessage = 'Account updated.';
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError ? error.message : 'Unable to update the account.';
		} finally {
			isSaving = false;
		}
	}

	async function updatePassword(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (!selectedAccountId || isSaving) return;

		isSaving = true;
		errorMessage = null;
		successMessage = null;

		try {
			await trpc.participants.resetPassword.mutate({
				id: selectedAccountId,
				password: resetPassword
			});
			resetPassword = '';
			successMessage = 'Password reset. Existing sessions for this account were signed out.';
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError ? error.message : 'Unable to reset the password.';
		} finally {
			isSaving = false;
		}
	}
</script>

<svelte:head>
	<title>Participants | Secret Santa</title>
</svelte:head>

<section class="space-y-8">
	<div>
		<p class="text-sm font-medium tracking-[0.18em] text-emerald-800 uppercase">Organizer</p>
		<h1 class="mt-3 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">
			Participants
		</h1>
		<p class="mt-3 max-w-2xl text-stone-600">
			Anyone can register as a participant. Manage accounts, roles, access, and household
			assignments here.
		</p>
	</div>

	{#if errorMessage}
		<p
			class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
			role="alert"
		>
			{errorMessage}
		</p>
	{/if}
	{#if successMessage}
		<p class="text-sm text-emerald-800" role="status">{successMessage}</p>
	{/if}

	<Card class="border-stone-200 bg-white">
		<CardHeader>
			<CardTitle>Create an account</CardTitle>
			<CardDescription>
				You can also send family members the public registration page. New accounts are participants
				by default.
			</CardDescription>
		</CardHeader>
		<CardContent>
			<form class="grid gap-5 md:grid-cols-2" onsubmit={createAccount}>
				<div class="space-y-2">
					<label class="text-sm font-medium" for="create-username">Username</label>
					<Input
						id="create-username"
						bind:value={createUsername}
						autocomplete="off"
						minlength={3}
						maxlength={32}
						required
						disabled={isSaving}
					/>
				</div>
				<div class="space-y-2">
					<label class="text-sm font-medium" for="create-display-name">Display name</label>
					<Input
						id="create-display-name"
						bind:value={createDisplayName}
						maxlength={64}
						required
						disabled={isSaving}
					/>
				</div>
				<div class="space-y-2">
					<label class="text-sm font-medium" for="create-password">Initial password</label>
					<Input
						id="create-password"
						type="password"
						bind:value={createPassword}
						autocomplete="new-password"
						minlength={12}
						maxlength={128}
						required
						disabled={isSaving}
					/>
				</div>
				<div class="space-y-2">
					<label class="text-sm font-medium" for="create-role">Role</label>
					<select
						id="create-role"
						bind:value={createRole}
						disabled={isSaving}
						class="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
					>
						<option value="participant">Participant</option>
						<option value="organizer">Organizer</option>
					</select>
				</div>
				<div class="space-y-2 md:col-span-2">
					<label class="text-sm font-medium" for="create-household">Household</label>
					<select
						id="create-household"
						bind:value={createHouseholdId}
						disabled={isSaving}
						class="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
					>
						<option value="">No household</option>
						{#each data.householdOptions as household (household.id)}
							<option value={household.id}>{household.name}</option>
						{/each}
					</select>
				</div>
				<div class="md:col-span-2">
					<Button type="submit" disabled={isSaving}>
						{isSaving ? 'Creating…' : 'Create account'}
					</Button>
				</div>
			</form>
		</CardContent>
	</Card>

	<Card class="border-stone-200 bg-white">
		<CardHeader>
			<CardTitle>Account list</CardTitle>
			<CardDescription>
				{accounts.length}
				{accounts.length === 1 ? 'account' : 'accounts'}, including organizer accounts.
			</CardDescription>
		</CardHeader>
		<CardContent>
			{#if accounts.length === 0}
				<p class="text-sm text-stone-600">No accounts have registered yet.</p>
			{:else}
				<ul class="divide-y divide-stone-100">
					{#each accounts as account (account.id)}
						<li class="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
							<div>
								<p class="font-medium text-stone-950">{account.displayName}</p>
								<p class="mt-1 text-sm text-stone-500">
									@{account.username} · {account.role} · {account.isActive ? 'Active' : 'Disabled'}
									{#if account.householdName}
										· {account.householdName}
									{/if}
								</p>
							</div>
							<Button
								variant="outline"
								type="button"
								aria-label={`Edit ${account.displayName}`}
								onclick={() => selectAccount(account)}
							>
								Edit
							</Button>
						</li>
					{/each}
				</ul>
			{/if}
		</CardContent>
	</Card>

	{#if selectedAccountId}
		<Card class="border-stone-200 bg-white">
			<CardHeader>
				<CardTitle>Edit account</CardTitle>
				<CardDescription>
					Disabling an account signs it out. At least one active organizer must remain.
				</CardDescription>
			</CardHeader>
			<CardContent class="space-y-8">
				<form class="grid gap-5 md:grid-cols-2" onsubmit={updateAccount}>
					<div class="space-y-2">
						<label class="text-sm font-medium" for="edit-username">Username</label>
						<Input
							id="edit-username"
							bind:value={editUsername}
							minlength={3}
							maxlength={32}
							required
							disabled={isSaving}
						/>
					</div>
					<div class="space-y-2">
						<label class="text-sm font-medium" for="edit-display-name">Display name</label>
						<Input
							id="edit-display-name"
							bind:value={editDisplayName}
							maxlength={64}
							required
							disabled={isSaving}
						/>
					</div>
					<div class="space-y-2">
						<label class="text-sm font-medium" for="edit-role">Role</label>
						<select
							id="edit-role"
							bind:value={editRole}
							disabled={isSaving}
							class="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
						>
							<option value="participant">Participant</option>
							<option value="organizer">Organizer</option>
						</select>
					</div>
					<div class="space-y-2">
						<label class="text-sm font-medium" for="edit-household">Household</label>
						<select
							id="edit-household"
							bind:value={editHouseholdId}
							disabled={isSaving}
							class="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
						>
							<option value="">No household</option>
							{#each data.householdOptions as household (household.id)}
								<option value={household.id}>{household.name}</option>
							{/each}
						</select>
					</div>
					<label class="flex items-center gap-3 text-sm text-stone-700 md:col-span-2">
						<input type="checkbox" bind:checked={editIsActive} disabled={isSaving} />
						Account is active
					</label>
					<div class="flex flex-wrap gap-3 md:col-span-2">
						<Button type="submit" disabled={isSaving}>
							{isSaving ? 'Saving…' : 'Save account'}
						</Button>
						<Button variant="outline" type="button" onclick={() => (selectedAccountId = null)}>
							Cancel
						</Button>
					</div>
				</form>

				{#if selectedAccountId !== data.currentUserId}
					<form class="space-y-4 border-t border-stone-100 pt-6" onsubmit={updatePassword}>
						<div>
							<h3 class="font-medium text-stone-950">Reset password</h3>
							<p class="mt-1 text-sm text-stone-500">
								The account holder will need the new password you set.
							</p>
						</div>
						<div class="max-w-md space-y-2">
							<label class="text-sm font-medium" for="reset-password">New password</label>
							<Input
								id="reset-password"
								type="password"
								bind:value={resetPassword}
								autocomplete="new-password"
								minlength={12}
								maxlength={128}
								required
								disabled={isSaving}
							/>
						</div>
						<Button type="submit" variant="outline" disabled={isSaving}>Reset password</Button>
					</form>
				{/if}
			</CardContent>
		</Card>
	{/if}
</section>
