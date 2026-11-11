<script lang="ts">
	import { resolve } from '$app/paths';

	type AvatarSize = 'sm' | 'md' | 'lg';
	type Props = {
		displayName: string;
		hasAvatar: boolean;
		imageSrc?: string;
		imageVersion?: number;
		size?: AvatarSize;
		class?: string;
	};

	let {
		displayName,
		hasAvatar,
		imageSrc = resolve('/api/profile-image'),
		imageVersion = 0,
		size = 'md',
		class: className = ''
	}: Props = $props();
	let imageFailedFor = $state<string | null>(null);

	let avatarSource = $derived(
		`${imageSrc}${imageSrc.includes('?') ? '&' : '?'}v=${encodeURIComponent(String(imageVersion))}`
	);
	let avatarSize = $derived(
		size === 'sm' ? 'size-9 text-sm' : size === 'lg' ? 'size-16 text-2xl' : 'size-11 text-lg'
	);
	let initial = $derived(displayName.trim().slice(0, 1).toLocaleUpperCase() || '?');

	function handleImageError(): void {
		imageFailedFor = avatarSource;
	}
</script>

<span
	class={`inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary font-semibold text-primary-foreground ${avatarSize} ${className}`}
	role="img"
	aria-label={`${displayName} avatar`}
>
	{#if hasAvatar && imageFailedFor !== avatarSource}
		<img class="size-full object-cover" src={avatarSource} alt="" onerror={handleImageError} />
	{:else}
		{initial}
	{/if}
</span>
