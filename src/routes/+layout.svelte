<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';

	injectAnalytics();

	let { children } = $props();
</script>

<svelte:head>
	<title>Artbygrigoryorenbakh</title>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
