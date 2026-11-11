const guidanceKey = 'secret-santa-guidance';
const visibilityKey = 'secret-santa-high-visibility';
const themeKey = 'secret-santa-theme';

export type GuidanceMode = 'detailed' | 'simple' | 'off';

/** Display preferences shared by every component; mirrored to <html> for CSS. */
export const preferences = $state({
	guidance: 'detailed' as GuidanceMode,
	highVisibility: false,
	dark: false
});

function save(key: string, value: string): void {
	try {
		window.localStorage.setItem(key, value);
	} catch (error) {
		console.warn('Could not save the display preference.', error);
	}
}

/** Reads the values the early script in app.html already applied to <html>. */
export function loadPreferences(): void {
	const root = document.documentElement;
	const guidance = root.dataset.guidance;
	preferences.guidance = guidance === 'simple' || guidance === 'off' ? guidance : 'detailed';
	preferences.highVisibility = root.dataset.visibility === 'high';
	preferences.dark = root.classList.contains('dark');
}

export function setGuidance(mode: GuidanceMode): void {
	preferences.guidance = mode;
	document.documentElement.dataset.guidance = mode;
	save(guidanceKey, mode);
}

export function setHighVisibility(enabled: boolean): void {
	preferences.highVisibility = enabled;
	document.documentElement.dataset.visibility = enabled ? 'high' : 'normal';
	save(visibilityKey, enabled ? 'high' : 'normal');
}

export function setDarkMode(enabled: boolean): void {
	preferences.dark = enabled;
	document.documentElement.classList.toggle('dark', enabled);
	document.documentElement.style.colorScheme = enabled ? 'dark' : 'light';
	save(themeKey, enabled ? 'dark' : 'light');
}
