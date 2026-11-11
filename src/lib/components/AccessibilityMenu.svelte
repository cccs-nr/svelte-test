<script lang="ts">
	import { onMount } from 'svelte';
	import { positionDropdown } from '#lib/dropdown-position.js';
	import { ChevronDown, Eye } from '@lucide/svelte';
	import PreferenceSwitch from '#lib/components/PreferenceSwitch.svelte';
	import {
		loadPreferences,
		preferences,
		setDarkMode,
		setGuidance,
		setHighVisibility,
		type GuidanceMode
	} from '#lib/preferences.svelte.js';

	let { variant = 'light' }: { variant?: 'light' | 'dark' } = $props();
	let isOpen = $state(false);
	let trigger = $state<HTMLButtonElement>();
	let panel = $state<HTMLDivElement>();

	const guidanceOptions: { value: GuidanceMode; label: string }[] = [
		{ value: 'detailed', label: 'Detailed' },
		{ value: 'simple', label: 'Simple' },
		{ value: 'off', label: 'Off' }
	];

	$effect(() => {
		if (!isOpen || !trigger || !panel) return;
		const place = () => positionDropdown(trigger!, panel!);
		place();
		window.addEventListener('resize', place);
		return () => window.removeEventListener('resize', place);
	});

	onMount(() => {
		loadPreferences();

		function closeOnOutside(event: Event): void {
			if (!isOpen || !(event.target instanceof Node)) return;
			if (trigger?.contains(event.target) || panel?.contains(event.target)) return;
			isOpen = false;
		}

		function closeOnEscape(event: KeyboardEvent): void {
			if (!isOpen || event.key !== 'Escape') return;
			isOpen = false;
			trigger?.focus();
		}

		document.addEventListener('pointerdown', closeOnOutside);
		document.addEventListener('focusin', closeOnOutside);
		document.addEventListener('keydown', closeOnEscape);
		return () => {
			document.removeEventListener('pointerdown', closeOnOutside);
			document.removeEventListener('focusin', closeOnOutside);
			document.removeEventListener('keydown', closeOnEscape);
		};
	});
</script>

<div class="relative">
	<button
		bind:this={trigger}
		type="button"
		class={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border-2 px-3 text-base font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring ${
			variant === 'dark'
				? 'holiday-topnav__account'
				: 'border-primary bg-background text-primary hover:bg-secondary'
		}`}
		aria-haspopup="true"
		aria-expanded={isOpen}
		aria-controls="accessibility-menu"
		onclick={() => (isOpen = !isOpen)}
	>
		<Eye size={22} aria-hidden="true" />
		<span class={variant === 'dark' ? 'max-[1200px]:sr-only' : ''}>Accessibility</span>
		<ChevronDown size={20} aria-hidden="true" />
	</button>
	<div
		bind:this={panel}
		id="accessibility-menu"
		hidden={!isOpen}
		class="app-dropdown app-surface absolute top-full right-0 z-50 mt-3 w-80 max-w-[calc(100vw-2rem)] space-y-4 rounded-xl border-2 border-border p-4 text-foreground shadow-2xl"
		role="group"
		aria-label="Accessibility settings"
	>
		<fieldset class="space-y-2">
			<legend class="text-base font-semibold">Page guidance</legend>
			<div class="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Page guidance">
				{#each guidanceOptions as option (option.value)}
					<button
						type="button"
						class={`min-h-11 cursor-pointer rounded-lg border-2 px-2 text-base font-semibold ${
							preferences.guidance === option.value
								? 'border-primary bg-primary text-primary-foreground'
								: 'border-border bg-background hover:bg-secondary'
						}`}
						role="radio"
						aria-checked={preferences.guidance === option.value}
						onclick={() => setGuidance(option.value)}
					>
						{option.label}
					</button>
				{/each}
			</div>
			<p class="text-sm text-muted-foreground">
				Detailed shows all instructions and hints. Simple keeps one short sentence per page. Off
				also hides descriptions.
			</p>
		</fieldset>
		<PreferenceSwitch
			label="High Visibility Mode"
			checked={preferences.highVisibility}
			onchange={setHighVisibility}
		/>
		<PreferenceSwitch label="Dark mode" checked={preferences.dark} onchange={setDarkMode} />
	</div>
</div>
