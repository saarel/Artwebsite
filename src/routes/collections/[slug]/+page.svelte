<script lang="ts">
	import type { Collection, Painting } from '$lib/types';
	import SiteNav from '$lib/SiteNav.svelte';
	import PaintingGrid from '$lib/PaintingGrid.svelte';

	let { data } = $props();
	const collection = $derived<Collection>(data.collection);
	const paintings = $derived<Painting[]>(data.paintings);
</script>

<svelte:head>
	<title>{collection.name} · Art By Grigory Orenbakh</title>
</svelte:head>

<SiteNav current="collections" />

<header>
	<a class="back" href="/collections">← All collections</a>
	<h1>{collection.name}</h1>
	{#if collection.description}
		<p class="subtitle">{collection.description}</p>
	{/if}
	<p class="count">
		{paintings.length}
		{paintings.length === 1 ? 'piece' : 'pieces'}
	</p>
</header>

{#if data.error}
	<p class="error">Could not load paintings: {data.error}</p>
{:else}
	<PaintingGrid {paintings} emptyMessage="Nothing in this collection yet." />
{/if}

<style>
	header {
		padding: 1rem 1.5rem 0.5rem;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}

	.back {
		color: #888;
		font-size: 0.78rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		text-decoration: none;
		transition: color 150ms ease;
	}

	.back:hover {
		color: #1a2942;
	}

	h1 {
		font-family: Georgia, serif;
		font-weight: 400;
		letter-spacing: 0.05em;
		margin: 0;
		color: #1a2942;
	}

	.subtitle {
		color: #666;
		font-family: Georgia, 'Times New Roman', serif;
		font-style: italic;
		font-size: 0.95rem;
		margin: 0;
		max-width: 620px;
		line-height: 1.6;
	}

	.count {
		margin: 0;
		font-size: 0.72rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #a09684;
	}

	.error {
		text-align: center;
		color: #b00;
		padding: 2rem;
	}
</style>
