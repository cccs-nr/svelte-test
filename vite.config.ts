import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { realtimeVitePlugin } from './scripts/realtime-vite-plugin.mjs';

function getBasePath(): '' | `/${string}` {
	const basePath = process.env.BASE_PATH || '';
	if (basePath && (!basePath.startsWith('/') || basePath.endsWith('/'))) {
		throw new Error('BASE_PATH must start with / and must not end with /.');
	}
	return basePath as '' | `/${string}`;
}

const basePath = getBasePath();

export default defineConfig({
	define: {
		__APP_BASE_PATH__: JSON.stringify(basePath)
	},
	plugins: [
		tailwindcss(),
		realtimeVitePlugin(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			paths: {
				base: basePath,
				origin: process.env.ORIGIN || undefined
			}
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
