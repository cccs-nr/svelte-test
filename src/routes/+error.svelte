<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	let errorMessage = $derived(page.error?.message ?? 'An unexpected error occurred.');
	let errorStack = $derived(
		import.meta.env.DEV &&
			page.error &&
			'stack' in page.error &&
			typeof page.error.stack === 'string'
			? page.error.stack
			: null
	);
</script>

<svelte:head>
	<title>Application error | Secret Santa</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="error-page" aria-live="assertive">
	<section class="error-card" role="alert" aria-labelledby="error-title">
		<p class="error-eyebrow">Secret Santa · Error {page.status}</p>
		<h1 id="error-title">Something went wrong</h1>
		<p class="error-message">{errorMessage}</p>

		{#if errorStack}
			<details class="error-details">
				<summary>Developer details</summary>
				<pre>{errorStack}</pre>
			</details>
		{/if}

		<a class="error-link" href={resolve('/app')}>Try loading the app again</a>
	</section>
</main>

<style>
	.error-page {
		display: grid;
		min-height: 100vh;
		place-items: center;
		padding: 1.5rem;
		background:
			radial-gradient(ellipse at top, rgb(225 29 72 / 9%), transparent 58%),
			linear-gradient(180deg, #f8faf6, #f1f5f0);
	}

	.error-card {
		width: min(100%, 38rem);
		padding: clamp(1.5rem, 5vw, 2.5rem);
		border: 1px solid #d6ddd4;
		border-top: 5px solid #9f1239;
		border-radius: 1.25rem;
		background: #fff;
		color: #1c1917;
		box-shadow: 0 24px 70px rgb(28 25 23 / 14%);
	}

	.error-eyebrow {
		margin: 0;
		color: #166534;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	h1 {
		margin: 0.75rem 0 0;
		font-size: clamp(1.7rem, 4vw, 2.3rem);
		letter-spacing: -0.035em;
	}

	.error-message {
		margin: 1rem 0 0;
		overflow-wrap: anywhere;
		color: #44403c;
		line-height: 1.6;
	}

	.error-details {
		margin-top: 1.25rem;
		padding: 0.85rem 1rem;
		border: 1px solid #e7e5e4;
		border-radius: 0.75rem;
		background: #fafaf9;
		color: #44403c;
	}

	.error-details summary {
		cursor: pointer;
		font-weight: 600;
	}

	.error-details pre {
		max-height: 18rem;
		margin: 0.75rem 0 0;
		overflow: auto;
		font-size: 0.75rem;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.error-link {
		display: inline-flex;
		margin-top: 1.5rem;
		padding: 0.7rem 1rem;
		border-radius: 0.7rem;
		background: #166534;
		color: #fff;
		font-size: 0.9rem;
		font-weight: 600;
		text-decoration: none;
	}

	.error-link:hover {
		background: #14532d;
	}

	.error-link:focus-visible {
		outline: 3px solid #d97706;
		outline-offset: 3px;
	}

	:global(html.dark) .error-page {
		background:
			radial-gradient(ellipse at top, rgb(190 18 60 / 16%), transparent 58%),
			linear-gradient(180deg, #10231b, #0b1712);
	}

	:global(html.dark) .error-card {
		border-color: #3a4b41;
		background: #16261e;
		color: #f5f5f4;
	}

	:global(html.dark) .error-message,
	:global(html.dark) .error-details {
		color: #d6d3d1;
	}

	:global(html.dark) .error-details {
		border-color: #3a4b41;
		background: #1e3026;
	}
</style>
