<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';
	import { onNavigate } from '$app/navigation';

	injectAnalytics();
	injectSpeedInsights();

	onNavigate((navigation) => {
		if (!document.startViewTransition) return;

		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});

	let { children } = $props();
</script>

<svelte:head>
	<title>Artbygrigoryorenbakh</title>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

<style>
	:global(::view-transition-old(root)),
	:global(::view-transition-new(root)) {
		animation-duration: 0.35s;
		animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
	}

	:global(::view-transition-old(root)) {
		animation-name: -global-fade-out;
	}

	:global(::view-transition-new(root)) {
		animation-name: -global-fade-in;
	}

	@keyframes -global-fade-out {
		from { opacity: 1; }
		to { opacity: 0; }
	}

	@keyframes -global-fade-in {
		from { opacity: 0; transform: translateY(6px); }
		to { opacity: 1; transform: translateY(0); }
	}
</style>
