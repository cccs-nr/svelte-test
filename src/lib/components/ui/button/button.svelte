<script lang="ts" module>
	import { type VariantProps, tv } from 'tailwind-variants';
	import { cn, type WithElementRef } from '#lib/utils.js';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

	// Buttons use solid colours only: no transparency, so text always stays legible.
	const baseButton =
		"focus-visible:ring-ring aria-invalid:border-destructive rounded-lg border-2 border-transparent text-base font-semibold focus-visible:ring-3 active:not-aria-[haspopup]:translate-y-px [&_svg:not([class*='size-'])]:size-5 group/button inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap no-underline transition-colors outline-none select-none disabled:pointer-events-none disabled:border-border disabled:bg-muted disabled:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0";

	// Every size shares one height, radius and type scale so buttons look the same everywhere.
	const standardSize = 'h-(--button-h) min-w-(--button-h) px-4';

	export const buttonVariants = tv({
		base: baseButton,
		variants: {
			variant: {
				default:
					'bg-primary text-primary-foreground hover:bg-[color-mix(in_oklab,var(--primary),black_18%)]',
				outline:
					'border-primary bg-card text-foreground hover:bg-secondary aria-expanded:bg-secondary',
				secondary:
					'border-border bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklab,var(--secondary),var(--foreground)_10%)]',
				ghost: 'text-foreground hover:bg-secondary aria-expanded:bg-secondary',
				destructive:
					'border-destructive bg-destructive text-white hover:bg-[color-mix(in_oklab,var(--destructive),black_18%)] dark:text-stone-950',
				link: 'text-primary underline underline-offset-4'
			},
			size: {
				default: standardSize,
				xs: standardSize,
				sm: standardSize,
				lg: standardSize,
				icon: 'size-(--button-h)',
				'icon-xs': 'size-(--button-h)',
				'icon-sm': 'size-(--button-h)',
				'icon-lg': 'size-(--button-h)',
				// The one prominent action of a page, such as Create My Account.
				cta: 'h-(--cta-h) px-6 text-lg sm:text-xl'
			}
		},
		defaultVariants: {
			variant: 'default',
			size: 'default'
		}
	});

	export type ButtonVariant = VariantProps<typeof buttonVariants>['variant'];
	export type ButtonSize = VariantProps<typeof buttonVariants>['size'];

	export type ButtonProps = WithElementRef<HTMLButtonAttributes> & {
		variant?: ButtonVariant;
		size?: ButtonSize;
		/** Renders a link that looks and sizes exactly like a button. */
		href?: string;
	};
</script>

<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- callers pass paths already built with resolve() */
	let {
		class: className,
		variant = 'default',
		size = 'default',
		ref = $bindable(null),
		type = 'button',
		disabled,
		href,
		children,
		...restProps
	}: ButtonProps = $props();
</script>

{#if href}
	<a
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		{href}
		aria-disabled={disabled ? 'true' : undefined}
		{...restProps as HTMLAnchorAttributes}
	>
		{@render children?.()}
	</a>
{:else}
	<button
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		{type}
		{disabled}
		{...restProps}
	>
		{@render children?.()}
	</button>
{/if}
