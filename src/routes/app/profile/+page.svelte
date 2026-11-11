<script lang="ts">
	import { KeyRound, Save, Shuffle, Trash2, X } from '@lucide/svelte';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { TRPCClientError } from '@trpc/client';
	import type { PageProps } from './$types';
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
	import PageGuide from '#lib/components/PageGuide.svelte';
	import PageSummary from '#lib/components/PageSummary.svelte';
	import PasswordInput from '#lib/components/PasswordInput.svelte';
	import ProfileAvatar from '#lib/components/ProfileAvatar.svelte';
	import { trpc } from '#lib/trpc/client.js';

	let { data }: PageProps = $props();
	let displayNameOverride = $state<string | null>(null);
	let participationOverride = $state<boolean | null>(null);
	let displayName = $derived(displayNameOverride ?? data.profile.displayName);
	let isParticipating = $derived(participationOverride ?? data.profile.isParticipating);
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
	let codenameErrorMessage = $state<string | null>(null);
	let codenameSuccessMessage = $state<string | null>(null);
	let isSavingCodename = $state(false);
	let passwordDialog = $state<HTMLDialogElement>();

	function closeDialog(dialog: HTMLDialogElement | undefined): void {
		if (!isSaving && !isSavingAvatar) dialog?.close();
	}

	function handleDialogClick(event: MouseEvent): void {
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

	async function uploadAvatar(image: File): Promise<void> {
		const formData = new FormData();
		formData.set('image', image, image.name);
		const response = await fetch(resolve('/api/profile-image'), {
			method: 'POST',
			body: formData
		});
		await checkAvatarResponse(response, 'Unable to update your profile picture.');
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
		if (isSaving || isSavingAvatar) return;

		const image = avatarFiles?.[0];
		if (image && image.size > data.maxImageBytes) {
			avatarErrorMessage = `Choose an image no larger than ${Math.ceil(
				data.maxImageBytes / (1024 * 1024)
			)} MiB.`;
			return;
		}

		isSaving = true;
		isSavingAvatar = true;
		errorMessage = null;
		successMessage = null;
		avatarErrorMessage = null;
		avatarSuccessMessage = null;

		try {
			await trpc.auth.updateProfile.mutate({
				displayName,
				...(data.profile.role === 'organizer' ? { isParticipating } : {})
			});

			let pictureError: string | null = null;
			if (image) {
				try {
					await uploadAvatar(image);
					avatarFiles = undefined;
				} catch (error) {
					pictureError =
						error instanceof Error ? error.message : 'Unable to update your profile picture.';
				}
			}

			try {
				await invalidateAll();
			} catch {
				errorMessage =
					'Your profile was saved, but could not be refreshed. Reload the page to see your changes.';
				return;
			}

			displayNameOverride = null;
			participationOverride = null;
			if (pictureError) {
				avatarErrorMessage = pictureError;
				successMessage = 'Your profile details were saved.';
			} else {
				successMessage = 'Profile updated.';
			}
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError ? error.message : 'Unable to update your profile.';
		} finally {
			isSaving = false;
			isSavingAvatar = false;
		}
	}

	async function changeCodename(): Promise<void> {
		if (isSavingCodename || data.availableCodenameCount === 0) return;

		isSavingCodename = true;
		codenameErrorMessage = null;
		codenameSuccessMessage = null;
		try {
			const result = await trpc.codenames.changeMine.mutate();
			await invalidateAll();
			codenameSuccessMessage = `Your codename is now ${result.codename}.`;
		} catch (error) {
			codenameErrorMessage =
				error instanceof TRPCClientError
					? error.message
					: 'Unable to change your codename. Please try again.';
		} finally {
			isSavingCodename = false;
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
		<p class="app-page-kicker">Account</p>
		<div class="app-page-titlebar">
			<h1 class="app-page-title">Your profile</h1>
			<PageGuide pageId="profile">
				<p>
					This page is about your name, picture, codename, and password. Save your name, selected
					picture, and organizer participation setting together using <strong>Save Profile</strong>.
				</p>
				<ul>
					<li>
						<strong>Profile:</strong> choose a photo and update the name other people see. If you
						are an organizer, you can also choose whether to participate. Press
						<strong>Save Profile</strong> to apply these changes. Use
						<strong>Remove picture</strong>
						to delete your current photo.
					</li>
					<li>
						<strong>Your codename:</strong> after the draw you receive a Christmas codename. You can pick
						a different one until the event is complete.
					</li>
					<li>
						<strong>Change password:</strong> choose a new password. Other devices will be signed out.
					</li>
				</ul>
			</PageGuide>
		</div>
		<PageSummary simple="Change your name, picture or password."
			>Update the name other participants see and keep your password secure.</PageSummary
		>
	</div>

	{#if errorMessage}
		<p class="app-alert app-alert--error" role="alert">
			{errorMessage}
		</p>
	{/if}
	{#if successMessage}
		<p class="app-notice" role="status">{successMessage}</p>
	{/if}

	<Card>
		<CardHeader>
			<CardTitle>Profile details</CardTitle>
			<CardDescription>
				Update the name other participants see and your profile picture. Organizers can also choose
				whether to participate in the exchange.
			</CardDescription>
		</CardHeader>
		<CardContent class="space-y-5">
			<p class="text-sm text-stone-600 capitalize">
				{data.profile.role}
				{#if data.profile.role === 'organizer' && data.profile.isParticipating}
					· Participant
				{/if}
				{#if data.profile.householdName}
					· {data.profile.householdName}
				{/if}
			</p>
			<form class="space-y-5" onsubmit={saveProfile}>
				<div class="flex flex-col gap-4 min-[480px]:flex-row min-[480px]:items-start">
					<ProfileAvatar
						displayName={data.profile.displayName}
						hasAvatar={data.profile.hasAvatar}
						imageVersion={data.profile.avatarVersion}
						size="lg"
					/>
					<div class="min-w-0 flex-1 space-y-3">
						<div class="space-y-2">
							<label class="text-base font-semibold" for="profile-picture">Choose a picture</label>
							<Input
								id="profile-picture"
								type="file"
								accept="image/jpeg,image/png,image/webp"
								bind:files={avatarFiles}
								disabled={isSaving || isSavingAvatar}
							/>
							<p class="app-hint text-sm text-stone-600">
								JPEG, PNG, or WebP up to {formatFileSize(data.maxImageBytes)}.
							</p>
						</div>
						{#if data.profile.hasAvatar}
							<Button
								type="button"
								variant="outline"
								onclick={removeAvatar}
								disabled={isSaving || isSavingAvatar}
							>
								<Trash2 aria-hidden="true" />
								Remove picture
							</Button>
						{/if}
					</div>
				</div>
				<div class="space-y-2">
					<label class="text-base font-semibold" for="profile-display-name">Your name</label>
					<Input
						id="profile-display-name"
						value={displayName}
						oninput={(event) => {
							displayNameOverride = event.currentTarget.value;
						}}
						maxlength={64}
						required
						disabled={isSaving || isSavingAvatar}
					/>
				</div>
				{#if data.profile.role === 'organizer'}
					<div class="space-y-2 rounded-xl border border-stone-200 bg-stone-50 p-4">
						<label class="flex items-start gap-3 text-sm text-stone-700">
							<input
								class="mt-1"
								type="checkbox"
								checked={isParticipating}
								onchange={(event) => {
									participationOverride = event.currentTarget.checked;
								}}
								disabled={isSaving || isSavingAvatar || !data.canChangeParticipation}
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
							<p class="text-sm text-stone-600">
								Reset assignments before changing your participation setting.
							</p>
						{/if}
					</div>
				{/if}
				{#if avatarErrorMessage}
					<p class="text-sm text-rose-700" role="alert">{avatarErrorMessage}</p>
				{/if}
				{#if avatarSuccessMessage}
					<p class="app-notice" role="status">{avatarSuccessMessage}</p>
				{/if}
				<div class="flex justify-end">
					<Button type="submit" disabled={isSaving || isSavingAvatar}>
						<Save aria-hidden="true" />
						{isSaving ? 'Saving…' : 'Save profile'}
					</Button>
				</div>
			</form>
		</CardContent>
	</Card>

	{#if data.profile.codename}
		<Card>
			<CardHeader>
				<CardTitle>Your codename</CardTitle>
				<CardDescription>
					Other gift givers see your codename. Your assigned recipient sees “Secret Santa” instead.
				</CardDescription>
			</CardHeader>
			<CardContent class="space-y-4">
				<div class="flex items-center gap-4">
					<CodenameAvatar codename={data.profile.codename} size="lg" />
					<div>
						<p class="text-lg font-semibold text-stone-950">{data.profile.codename}</p>
						<p class="mt-1 text-sm text-stone-600">Your codename profile picture</p>
					</div>
				</div>
				{#if codenameErrorMessage}
					<p class="text-sm text-rose-700" role="alert">{codenameErrorMessage}</p>
				{/if}
				{#if codenameSuccessMessage}
					<p class="app-notice" role="status">{codenameSuccessMessage}</p>
				{/if}
				{#if data.canChangeCodename}
					{#if data.availableCodenameCount > 0}
						<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<p class="text-sm text-stone-600">
								{data.availableCodenameCount} unused {data.availableCodenameCount === 1
									? 'codename is'
									: 'codenames are'} available. We’ll randomly choose one for you.
							</p>
							<Button
								type="button"
								onclick={() => void changeCodename()}
								disabled={isSavingCodename}
							>
								<Shuffle aria-hidden="true" />
								{isSavingCodename ? 'Choosing…' : 'Pick a new codename'}
							</Button>
						</div>
					{:else}
						<p class="text-sm text-stone-600">
							All 50 codenames are currently in use, so there are no unused names to select.
						</p>
					{/if}
				{:else}
					<p class="text-sm text-stone-600">
						Codenames are locked after the event is completed or the identity reveal begins.
					</p>
				{/if}
			</CardContent>
		</Card>
	{/if}

	{#if !data.isManagingOther}
		<Card>
			<CardHeader>
				<CardTitle>Change password</CardTitle>
				<CardDescription>
					Use at least 3 characters; any characters are allowed. Changing your password signs out
					your other active sessions.
				</CardDescription>
			</CardHeader>
			<CardContent class="flex flex-wrap items-center justify-between gap-4">
				<p class="text-sm text-stone-600">
					Update your password and sign out other active sessions.
				</p>
				<Button type="button" variant="outline" onclick={() => passwordDialog?.showModal()}>
					<KeyRound aria-hidden="true" />
					Change password
				</Button>
			</CardContent>
		</Card>
	{/if}

	<dialog
		bind:this={passwordDialog}
		class="app-dialog m-auto max-h-[92dvh] w-[min(95vw,36rem)] overflow-y-auto rounded-2xl shadow-2xl backdrop:bg-black/60"
		aria-labelledby="change-password-title"
		onclick={handleDialogClick}
	>
		<div class="p-5 sm:p-7">
			<div class="mb-6 flex items-start justify-between gap-4">
				<div>
					<h2 id="change-password-title" class="text-xl font-semibold">Change password</h2>
					<p class="app-hint mt-1 text-sm text-stone-600">
						Use at least 3 characters. Any characters are allowed.
					</p>
				</div>
				<Button
					type="button"
					variant="outline"
					onclick={() => closeDialog(passwordDialog)}
					disabled={isSaving}
				>
					<X aria-hidden="true" />
					Close
				</Button>
			</div>
			{#if errorMessage}
				<p class="mb-4 text-sm text-rose-700" role="alert">{errorMessage}</p>
			{/if}
			<form class="space-y-5" onsubmit={changePassword}>
				<div class="space-y-2">
					<label class="text-base font-semibold" for="current-password">Current password</label>
					<PasswordInput
						id="current-password"
						bind:value={currentPassword}
						autocomplete="current-password"
						minlength={3}
						maxlength={128}
						required
						disabled={isSaving}
					/>
				</div>
				<div class="space-y-2">
					<label class="text-base font-semibold" for="new-password">New password</label>
					<PasswordInput
						id="new-password"
						bind:value={newPassword}
						autocomplete="new-password"
						minlength={3}
						maxlength={128}
						required
						disabled={isSaving}
					/>
				</div>
				<div class="space-y-2">
					<label class="text-base font-semibold" for="confirm-password">Confirm new password</label>
					<PasswordInput
						id="confirm-password"
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
						<X aria-hidden="true" />
						Cancel
					</Button>
					<Button type="submit" disabled={isSaving}>
						<KeyRound aria-hidden="true" />
						{isSaving ? 'Changing…' : 'Change password'}
					</Button>
				</div>
			</form>
		</div>
	</dialog>
</section>
