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
	<title>Art By Grigory Orenbakh</title>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

<style>
	:global(::view-transition-old(root)) {
		animation: -global-fade-out 280ms cubic-bezier(0.4, 0, 1, 1) both;
	}

	:global(::view-transition-new(root)) {
		animation: -global-fade-in 520ms cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	/* Nav indicator slides smoothly between active links */
	:global(::view-transition-old(nav-indicator)),
	:global(::view-transition-new(nav-indicator)) {
		animation-duration: 0.4s;
		animation-timing-function: cubic-bezier(0.4, 1.15, 0.55, 1);
	}

	@keyframes -global-fade-out {
		from {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
		to {
			opacity: 0;
			transform: translateY(-12px) scale(0.99);
		}
	}

	@keyframes -global-fade-in {
		from {
			opacity: 0;
			transform: translateY(16px) scale(0.99);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}
</style>
