<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { TRPCClientError } from '@trpc/client';
	import type { PageProps } from './$types';
	import { Button } from '#lib/components/ui/button/index.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '#lib/components/ui/card/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import ProfileAvatar from '#lib/components/ProfileAvatar.svelte';
	import { trpc } from '#lib/trpc/client.js';

	let { data }: PageProps = $props();
	let displayName = $derived(data.profile.displayName);
	let isParticipating = $derived(data.profile.isParticipating);
	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let avatarFiles = $state<FileList>();
	let isSavingAvatar = $state(false);
	let avatarErrorMessage = $state<string | null>(null);
	let avatarSuccessMessage = $state<string | null>(null);
	let isSaving = $state(false);
	let errorMessage = $state<string | null>(null);
	let successMessage = $state<string | null>(null);
	let avatarDialog = $state<HTMLDialogElement>();
	let profileDialog = $state<HTMLDialogElement>();
	let passwordDialog = $state<HTMLDialogElement>();

	function closeDialog(dialog: HTMLDialogElement | undefined): void {
		if (!isSaving && !isSavingAvatar) dialog?.close();
	}

	function handleDialogClick(event: MouseEvent): void {
		if (event.target === avatarDialog) closeDialog(avatarDialog);
		if (event.target === profileDialog) closeDialog(profileDialog);
		if (event.target === passwordDialog) closeDialog(passwordDialog);
	}

	async function checkAvatarResponse(response: Response, fallback: string): Promise<void> {
		if (response.ok) return;

		let message = `${fallback} (HTTP ${response.status}).`;
		const responseBody = await response.text();
		if (responseBody) {
			try {
				const payload: unknown = JSON.parse(responseBody);
				if (
					typeof payload === 'object' &&
					payload !== null &&
					'error' in payload &&
					typeof payload.error === 'string'
				) {
					message = payload.error;
				}
			} catch (error) {
				if (!(error instanceof SyntaxError)) throw error;
			}
		}

		throw new Error(message);
	}

	async function uploadAvatar(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (isSavingAvatar) return;

		const image = avatarFiles?.[0];
		if (!image) {
			avatarErrorMessage = 'Choose a picture to upload.';
			return;
		}
		if (image.size > data.maxImageBytes) {
			avatarErrorMessage = `Choose an image no larger than ${Math.ceil(
				data.maxImageBytes / (1024 * 1024)
			)} MiB.`;
			return;
		}

		isSavingAvatar = true;
		avatarErrorMessage = null;
		avatarSuccessMessage = null;
		try {
			const formData = new FormData();
			formData.set('image', image, image.name);
			const response = await fetch(resolve('/api/profile-image'), {
				method: 'POST',
				body: formData
			});
			await checkAvatarResponse(response, 'Unable to update your profile picture.');
			avatarFiles = undefined;
			await invalidateAll();
			avatarSuccessMessage = 'Profile picture updated.';
			avatarDialog?.close();
		} catch (error) {
			avatarErrorMessage =
				error instanceof TRPCClientError
					? error.message
					: error instanceof Error
						? error.message
						: 'Unable to update your profile picture.';
		} finally {
			isSavingAvatar = false;
		}
	}

	async function removeAvatar(): Promise<void> {
		if (isSavingAvatar || !data.profile.hasAvatar) return;
		if (!globalThis.confirm('Remove your profile picture?')) return;

		isSavingAvatar = true;
		avatarErrorMessage = null;
		avatarSuccessMessage = null;
		try {
			const response = await fetch(resolve('/api/profile-image'), { method: 'DELETE' });
			await checkAvatarResponse(response, 'Unable to remove your profile picture.');
			await invalidateAll();
			avatarSuccessMessage = 'Profile picture removed.';
			avatarDialog?.close();
		} catch (error) {
			avatarErrorMessage =
				error instanceof Error ? error.message : 'Unable to remove your profile picture.';
		} finally {
			isSavingAvatar = false;
		}
	}

	function formatFileSize(bytes: number): string {
		const mebibyte = 1024 * 1024;
		return bytes >= mebibyte
			? `${(bytes / mebibyte).toFixed(bytes % mebibyte === 0 ? 0 : 1)} MiB`
			: `${Math.ceil(bytes / 1024)} KiB`;
	}

	async function saveProfile(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (isSaving) return;

		isSaving = true;
		errorMessage = null;
		successMessage = null;

		try {
			await trpc.auth.updateProfile.mutate({
				displayName,
				...(data.profile.role === 'organizer' ? { isParticipating } : {})
			});
			await invalidateAll();
			successMessage = 'Profile updated.';
			profileDialog?.close();
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError ? error.message : 'Unable to update your profile.';
		} finally {
			isSaving = false;
		}
	}

	async function changePassword(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (isSaving) return;

		if (newPassword !== confirmPassword) {
			errorMessage = 'The new passwords do not match.';
			successMessage = null;
			return;
		}

		isSaving = true;
		errorMessage = null;
		successMessage = null;

		try {
			await trpc.auth.changePassword.mutate({ currentPassword, newPassword });
			currentPassword = '';
			newPassword = '';
			confirmPassword = '';
			successMessage = 'Password changed. Your other sessions have been signed out.';
			passwordDialog?.close();
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError ? error.message : 'Unable to change your password.';
		} finally {
			isSaving = false;
		}
	}
</script>

<svelte:head>
	<title>Your profile | Secret Santa</title>
</svelte:head>

<section class="mx-auto max-w-3xl space-y-8">
	<div>
		<p class="text-sm font-medium tracking-[0.18em] text-emerald-800 uppercase">Account</p>
		<h1 class="mt-3 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">
			Your profile
		</h1>
		<p class="mt-3 text-stone-600">
			Update the name other participants see and keep your password secure.
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
			<CardTitle>Profile picture</CardTitle>
			<CardDescription>
				Your picture appears in your account menu and on your side of messages. Your Secret Santa’s
				identity stays private.
			</CardDescription>
		</CardHeader>
		<CardContent class="flex flex-col gap-5 sm:flex-row sm:items-center">
			<ProfileAvatar
				displayName={data.profile.displayName}
				hasAvatar={data.profile.hasAvatar}
				imageVersion={data.profile.avatarVersion}
				size="lg"
			/>
			<div class="min-w-0 flex-1 space-y-4">
				{#if avatarSuccessMessage}
					<p class="text-sm text-emerald-800" role="status">{avatarSuccessMessage}</p>
				{/if}
				<Button type="button" variant="outline" onclick={() => avatarDialog?.showModal()}>
					{data.profile.hasAvatar ? 'Change picture' : 'Add profile picture'}
				</Button>
			</div>
		</CardContent>
	</Card>

	<dialog
		bind:this={avatarDialog}
		class="m-auto max-h-[92vh] w-[95vw] max-w-xl overflow-y-auto rounded-2xl bg-white text-stone-950 shadow-2xl backdrop:bg-black/60"
		aria-labelledby="profile-picture-title"
		onclick={handleDialogClick}
	>
		<div class="p-5 sm:p-7">
			<div class="mb-6 flex items-start justify-between gap-4">
				<div>
					<h2 id="profile-picture-title" class="text-xl font-semibold">Profile picture</h2>
					<p class="mt-1 text-sm text-stone-600">
						JPEG, PNG, or WebP up to {formatFileSize(data.maxImageBytes)}.
					</p>
				</div>
				<Button
					type="button"
					variant="outline"
					onclick={() => closeDialog(avatarDialog)}
					disabled={isSavingAvatar}
				>
					Close
				</Button>
			</div>
			{#if avatarErrorMessage}
				<p class="mb-4 text-sm text-rose-700" role="alert">{avatarErrorMessage}</p>
			{/if}
			<form class="flex flex-wrap items-end gap-3" onsubmit={uploadAvatar}>
				<div class="min-w-0 flex-1 space-y-2">
					<label class="text-sm font-medium" for="profile-picture">Choose a picture</label>
					<Input
						id="profile-picture"
						type="file"
						accept="image/jpeg,image/png,image/webp"
						bind:files={avatarFiles}
						disabled={isSavingAvatar}
					/>
				</div>
				<Button type="submit" disabled={isSavingAvatar}>
					{isSavingAvatar ? 'Uploading…' : 'Upload'}
				</Button>
				{#if data.profile.hasAvatar}
					<Button type="button" variant="outline" onclick={removeAvatar} disabled={isSavingAvatar}>
						Remove
					</Button>
				{/if}
			</form>
		</div>
	</dialog>

	<Card class="border-stone-200 bg-white">
		<CardHeader>
			<CardTitle>Profile details</CardTitle>
			<CardDescription>
				Your name is how family members recognize you and what you can use to sign in.
			</CardDescription>
		</CardHeader>
		<CardContent class="flex flex-wrap items-center justify-between gap-4">
			<div>
				<p class="font-medium text-stone-950">{data.profile.displayName}</p>
				<p class="mt-1 text-sm text-stone-600 capitalize">
					{data.profile.role}
					{#if data.profile.role === 'organizer' && data.profile.isParticipating}
						· Participant
					{/if}
					{#if data.profile.householdName}
						· {data.profile.householdName}
					{/if}
				</p>
			</div>
			<Button type="button" variant="outline" onclick={() => profileDialog?.showModal()}>
				Edit profile
			</Button>
		</CardContent>
	</Card>

	<dialog
		bind:this={profileDialog}
		class="m-auto max-h-[92vh] w-[95vw] max-w-xl overflow-y-auto rounded-2xl bg-white text-stone-950 shadow-2xl backdrop:bg-black/60"
		aria-labelledby="profile-details-title"
		onclick={handleDialogClick}
	>
		<div class="p-5 sm:p-7">
			<div class="mb-6 flex items-start justify-between gap-4">
				<div>
					<h2 id="profile-details-title" class="text-xl font-semibold">Edit profile</h2>
					<p class="mt-1 text-sm text-stone-600">
						Your name is how family members recognize you and what you can use to sign in.
					</p>
				</div>
				<Button
					type="button"
					variant="outline"
					onclick={() => closeDialog(profileDialog)}
					disabled={isSaving}
				>
					Close
				</Button>
			</div>
			{#if errorMessage}
				<p class="mb-4 text-sm text-rose-700" role="alert">{errorMessage}</p>
			{/if}
			<form class="space-y-5" onsubmit={saveProfile}>
				<div class="space-y-2">
					<label class="text-sm font-medium" for="profile-display-name">Your name</label>
					<Input
						id="profile-display-name"
						bind:value={displayName}
						maxlength={64}
						required
						disabled={isSaving}
					/>
				</div>
				{#if data.profile.role === 'organizer'}
					<div class="space-y-2 rounded-xl border border-stone-200 bg-stone-50 p-4">
						<label class="flex items-start gap-3 text-sm text-stone-700">
							<input
								class="mt-1"
								type="checkbox"
								bind:checked={isParticipating}
								disabled={isSaving || !data.canChangeParticipation}
							/>
							<span>
								<span class="font-medium text-stone-900">Also participate in the exchange</span>
								<span class="mt-1 block text-stone-600">
									You’ll be included in the draw and can see only your own recipient and their
									wishlist. You’ll keep all organizer tools.
								</span>
							</span>
						</label>
						{#if !data.canChangeParticipation}
							<p class="text-xs text-stone-500">
								Reset assignments before changing your participation setting.
							</p>
						{/if}
					</div>
				{/if}
				<div class="flex justify-end gap-3">
					<Button
						type="button"
						variant="outline"
						onclick={() => closeDialog(profileDialog)}
						disabled={isSaving}
					>
						Cancel
					</Button>
					<Button type="submit" disabled={isSaving}>
						{isSaving ? 'Saving…' : 'Save profile'}
					</Button>
				</div>
			</form>
		</div>
	</dialog>

	<Card class="border-stone-200 bg-white">
		<CardHeader>
			<CardTitle>Change password</CardTitle>
			<CardDescription>
				Use at least 3 characters; any characters are allowed. Changing your password signs out your
				other active sessions.
			</CardDescription>
		</CardHeader>
		<CardContent class="flex flex-wrap items-center justify-between gap-4">
			<p class="text-sm text-stone-600">Update your password and sign out other active sessions.</p>
			<Button type="button" variant="outline" onclick={() => passwordDialog?.showModal()}>
				Change password
			</Button>
		</CardContent>
	</Card>

	<dialog
		bind:this={passwordDialog}
		class="m-auto max-h-[92vh] w-[95vw] max-w-xl overflow-y-auto rounded-2xl bg-white text-stone-950 shadow-2xl backdrop:bg-black/60"
		aria-labelledby="change-password-title"
		onclick={handleDialogClick}
	>
		<div class="p-5 sm:p-7">
			<div class="mb-6 flex items-start justify-between gap-4">
				<div>
					<h2 id="change-password-title" class="text-xl font-semibold">Change password</h2>
					<p class="mt-1 text-sm text-stone-600">
						Use at least 3 characters. Any characters are allowed.
					</p>
				</div>
				<Button
					type="button"
					variant="outline"
					onclick={() => closeDialog(passwordDialog)}
					disabled={isSaving}
				>
					Close
				</Button>
			</div>
			{#if errorMessage}
				<p class="mb-4 text-sm text-rose-700" role="alert">{errorMessage}</p>
			{/if}
			<form class="space-y-5" onsubmit={changePassword}>
				<div class="space-y-2">
					<label class="text-sm font-medium" for="current-password">Current password</label>
					<Input
						id="current-password"
						type="password"
						bind:value={currentPassword}
						autocomplete="current-password"
						minlength={3}
						maxlength={128}
						required
						disabled={isSaving}
					/>
				</div>
				<div class="space-y-2">
					<label class="text-sm font-medium" for="new-password">New password</label>
					<Input
						id="new-password"
						type="password"
						bind:value={newPassword}
						autocomplete="new-password"
						minlength={3}
						maxlength={128}
						required
						disabled={isSaving}
					/>
				</div>
				<div class="space-y-2">
					<label class="text-sm font-medium" for="confirm-password">Confirm new password</label>
					<Input
						id="confirm-password"
						type="password"
						bind:value={confirmPassword}
						autocomplete="new-password"
						minlength={3}
						maxlength={128}
						required
						disabled={isSaving}
					/>
				</div>
				<div class="flex justify-end gap-3">
					<Button
						type="button"
						variant="outline"
						onclick={() => closeDialog(passwordDialog)}
						disabled={isSaving}
					>
						Cancel
					</Button>
					<Button type="submit" disabled={isSaving}>
						{isSaving ? 'Changing…' : 'Change password'}
					</Button>
				</div>
			</form>
		</div>
	</dialog>
</section>
