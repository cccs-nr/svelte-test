<script lang="ts">
	import { onMount } from 'svelte';
	import { Moon, Sun } from '@lucide/svelte';
	import { Button } from '#lib/components/ui/button/index.js';

	const themeStorageKey = 'secret-santa-theme';
	let isDark = $state(false);
	let hasExplicitPreference = false;

	function applyTheme(): void {
		document.documentElement.classList.toggle('dark', isDark);
		document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
	}

	onMount(() => {
		const media = window.matchMedia('(prefers-color-scheme: dark)');
		try {
			const preference = window.localStorage.getItem(themeStorageKey);
			hasExplicitPreference = preference === 'dark' || preference === 'light';
			isDark = preference === 'dark' ? true : preference === 'light' ? false : media.matches;
		} catch (error) {
			console.warn('Could not read the saved theme preference.', error);
			isDark = media.matches;
		}

		applyTheme();
		const handleSystemThemeChange = (event: MediaQueryListEvent): void => {
			if (hasExplicitPreference) return;
			isDark = event.matches;
			applyTheme();
		};
		media.addEventListener('change', handleSystemThemeChange);
		return () => media.removeEventListener('change', handleSystemThemeChange);
	});

	function toggleTheme(): void {
		isDark = !isDark;
		hasExplicitPreference = true;
		applyTheme();
		try {
			window.localStorage.setItem(themeStorageKey, isDark ? 'dark' : 'light');
		} catch (error) {
			console.warn('Could not save the theme preference.', error);
		}
	}
</script>

<Button
	type="button"
	variant="outline"
	class="size-10 rounded-full border-stone-200 bg-white/80 p-0 shadow-sm"
	aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
	aria-pressed={isDark}
	onclick={toggleTheme}
>
	{#if isDark}
		<Sun size={18} aria-hidden="true" />
	{:else}
		<Moon size={18} aria-hidden="true" />
	{/if}
</Button>
