<script lang="ts">
	import { suggestedCodenames } from '#lib/models/codenames.js';

	type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

	const suggestedAvatarSlugs = new Set(suggestedCodenames.map(slugify));
	type Props = {
		codename: string;
		size?: AvatarSize;
	};

	let { codename, size = 'md' }: Props = $props();
	let sizeClass = $derived(
		size === 'xs'
			? 'size-6'
			: size === 'sm'
				? 'size-8'
				: size === 'lg'
					? 'size-20 sm:size-24'
					: 'size-12'
	);
	let avatarSource = $derived(getAvatarSource(codename));

	function slugify(value: string): string {
		return value
			.normalize('NFKD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLocaleLowerCase('en')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
	}

	function getAvatarSource(name: string): string {
		const slug = slugify(name);
		return suggestedAvatarSlugs.has(slug)
			? `${__APP_BASE_PATH__}/codename-avatars/${slug}.svg`
			: `${__APP_BASE_PATH__}/codename-avatars/default.svg`;
	}
</script>

<img
	class={`inline-block shrink-0 rounded-full object-cover ${sizeClass}`}
	src={avatarSource}
	alt={`Illustrated avatar for ${codename}`}
	decoding="async"
/>
