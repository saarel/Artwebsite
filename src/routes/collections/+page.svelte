<script lang="ts">
	import type { Collection, Painting } from '$lib/types';
	import { collectionCover, paintingsInCollection } from '$lib/queries';
	import SiteNav from '$lib/SiteNav.svelte';

	let { data } = $props();
	const paintings = $derived<Painting[]>(data.paintings);
	const collections = $derived<Collection[]>(data.collections);

	const cards = $derived(
		collections.map((c) => ({
			collection: c,
			cover: collectionCover(c, paintings),
			count: paintingsInCollection(paintings, c.id).length
		}))
	);

	const untagged = $derived(paintings.filter((p) => p.collection_ids.length === 0).length);
</script>

<svelte:head>
	<title>Collections · Art By Grigory Orenbakh</title>
</svelte:head>

<SiteNav current="collections" />

<header>
	<h1>Collections</h1>
	<p class="subtitle">Bodies of work, grouped by theme.</p>
</header>

{#if data.error}
	<p class="error">Could not load collections: {data.error}</p>
{:else if collections.length === 0}
	<p class="empty">Collections coming soon.</p>
{:else}
	<div class="grid">
		{#each cards as { collection, cover, count }, i (collection.id)}
			<a
				class="card"
				href={`/collections/${collection.slug}`}
				style="animation-delay: {Math.min(i, 8) * 50}ms"
			>
				<div class="frame">
					{#if cover}
						<img
							src={cover}
							alt={collection.name}
							loading={i < 4 ? 'eager' : 'lazy'}
							fetchpriority={i < 2 ? 'high' : 'auto'}
							decoding="async"
						/>
					{:else}
						<div class="placeholder" aria-hidden="true"></div>
					{/if}
					<span class="count">{count} {count === 1 ? 'piece' : 'pieces'}</span>
				</div>
				<div class="caption">
					<h2>{collection.name}</h2>
					{#if collection.description}
						<p>{collection.description}</p>
					{/if}
				</div>
			</a>
		{/each}
	</div>

	{#if untagged > 0}
		<p class="all-link">
			<a href="/gallery">See all {paintings.length} works in the gallery →</a>
		</p>
	{/if}
{/if}

<style>
	header {
		padding: 1rem 1.5rem 0.5rem;
		text-align: center;
	}

	h1 {
		font-family: Georgia, serif;
		font-weight: 400;
		letter-spacing: 0.05em;
		margin: 0;
	}

	.subtitle {
		color: #777;
		font-family: Georgia, 'Times New Roman', serif;
		font-style: italic;
		font-size: 0.95rem;
		margin: 0.5rem 0 0;
	}

	.error {
		text-align: center;
		color: #b00;
		padding: 2rem;
	}

	.empty {
		text-align: center;
		color: #777;
		padding: 3rem 2rem;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 2rem 1.5rem;
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem 1.5rem 3rem;
	}

	.card {
		text-decoration: none;
		color: inherit;
		display: block;
		animation: card-in 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	@keyframes card-in {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.frame {
		position: relative;
		aspect-ratio: 4 / 3;
		overflow: hidden;
		border-radius: 3px;
		background: #ebe7df;
		box-shadow: 0 10px 24px -14px rgba(0, 0, 0, 0.4);
		transition:
			transform 220ms cubic-bezier(0.16, 1, 0.3, 1),
			box-shadow 220ms ease;
	}

	.card:hover .frame {
		transform: translateY(-4px);
		box-shadow: 0 18px 34px -16px rgba(0, 0, 0, 0.45);
	}

	.frame img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		transition: transform 500ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	.card:hover .frame img {
		transform: scale(1.04);
	}

	.placeholder {
		width: 100%;
		height: 100%;
		background: linear-gradient(135deg, #ece7dd 0%, #e0d9cb 100%);
	}

	.count {
		position: absolute;
		bottom: 0.6rem;
		left: 0.6rem;
		background: rgba(26, 41, 66, 0.85);
		color: #fff;
		font-size: 0.7rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		padding: 0.28rem 0.65rem;
		border-radius: 999px;
	}

	.caption {
		padding: 0.85rem 0.15rem 0;
	}

	.caption h2 {
		font-family: Georgia, 'Times New Roman', serif;
		font-weight: 400;
		font-size: 1.25rem;
		color: #1a2942;
		margin: 0;
		letter-spacing: 0.02em;
	}

	.caption p {
		color: #666;
		font-size: 0.88rem;
		line-height: 1.5;
		margin: 0.35rem 0 0;
	}

	.all-link {
		text-align: center;
		padding: 0 1.5rem 3rem;
		margin: 0;
	}

	.all-link a {
		color: #777;
		font-size: 0.85rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		text-decoration: none;
		border-bottom: 1px solid #c8a571;
		padding-bottom: 0.2rem;
		transition: color 150ms ease;
	}

	.all-link a:hover {
		color: #1a2942;
	}

	@media (max-width: 560px) {
		.grid {
			grid-template-columns: 1fr;
			gap: 1.75rem;
			padding: 1.5rem 1rem 2.5rem;
		}
	}
</style>
