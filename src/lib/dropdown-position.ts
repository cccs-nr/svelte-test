const EDGE_GAP = 8;

/**
 * Places a dropdown panel under its trigger. On phones (< 600px) the panel is centred on the screen
 * just below the top navigation bar instead, so it never falls outside the view.
 */
export function positionDropdown(trigger: HTMLElement, panel: HTMLElement): void {
	const style = panel.style;
	style.position = '';
	style.top = '';
	style.left = '';
	style.right = '';
	style.transform = '';
	style.margin = '';
	style.width = '';

	if (window.innerWidth < 600) {
		const bar = trigger.closest('header') ?? trigger;
		style.position = 'fixed';
		style.top = `${Math.round(bar.getBoundingClientRect().bottom) + EDGE_GAP}px`;
		style.left = '50%';
		style.right = 'auto';
		style.transform = 'translateX(-50%)';
		style.margin = '0';
		style.width = 'min(22rem, calc(100vw - 2rem))';
		return;
	}

	// Under the trigger, right-aligned by default; flip to left-aligned if that would leave the view.
	const rect = panel.getBoundingClientRect();
	if (rect.left < EDGE_GAP) {
		style.left = '0';
		style.right = 'auto';
	} else if (rect.right > window.innerWidth - EDGE_GAP) {
		style.right = '0';
		style.left = 'auto';
	}
}
