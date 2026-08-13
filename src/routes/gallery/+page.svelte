<script lang="ts">
	import { slide } from 'svelte/transition';
	import { page } from '$app/state';
	import type { Collection, Painting } from '$lib/types';
	import SiteNav from '$lib/SiteNav.svelte';
	import PaintingGrid from '$lib/PaintingGrid.svelte';

	let { data } = $props();
	const allPaintings = $derived<Painting[]>(data.paintings);
	const collections = $derived<Collection[]>(data.collections);

	let filter = $state<'all' | 'available' | 'unavailable'>('all');
	// null = every collection
	let collectionId = $state<string | null>(null);
	let collectionsOpen = $state(false);

	let filterEls = $state<Record<string, HTMLButtonElement | undefined>>({});
	let indicatorLeft = $state(0);
	let indicatorWidth = $state(0);
	let indicatorReady = $state(false);

	function measureIndicator() {
		const el = filterEls[filter];
		if (!el) return;
		indicatorLeft = el.offsetLeft;
		indicatorWidth = el.offsetWidth;
	}

	$effect(() => {
		// Track filter + ref availability so this re-runs when either changes.
		void filter;
		void filterEls[filter];
		measureIndicator();
	});

	$effect(() => {
		const container = filterEls.all?.parentElement;
		if (!container) return;
		measureIndicator();
		// Enable the transition on the second frame so the initial position
		// is set without animation.
		requestAnimationFrame(() => requestAnimationFrame(() => (indicatorReady = true)));
		const ro = new ResizeObserver(() => measureIndicator());
		ro.observe(container);
		window.addEventListener('resize', measureIndicator);
		return () => {
			ro.disconnect();
			window.removeEventListener('resize', measureIndicator);
		};
	});

	// A ?collection=slug link (from the collections page) preselects that filter.
	$effect(() => {
		const slug = page.url.searchParams.get('collection');
		if (!slug) return;
		const match = collections.find((c) => c.slug === slug);
		if (match && collectionId !== match.id) {
			collectionId = match.id;
			collectionsOpen = true;
		}
	});

	const byAvailability = $derived(
		filter === 'all'
			? allPaintings
			: filter === 'available'
				? allPaintings.filter((p) => p.avail)
				: allPaintings.filter((p) => !p.avail)
	);

	const paintings = $derived(
		collectionId === null
			? byAvailability
			: byAvailability.filter((p) => p.collection_ids.includes(collectionId!))
	);

	const counts = $derived({
		all: allPaintings.length,
		available: allPaintings.filter((p) => p.avail).length,
		unavailable: allPaintings.filter((p) => !p.avail).length
	});

	function collectionCount(id: string) {
		return byAvailability.filter((p) => p.collection_ids.includes(id)).length;
	}

	const activeCollection = $derived(collections.find((c) => c.id === collectionId) ?? null);

	const emptyMessage = $derived(
		allPaintings.length === 0
			? 'Art coming soon.'
			: activeCollection && filter === 'available'
				? `Nothing currently available in ${activeCollection.name}.`
				: activeCollection
					? `Nothing in ${activeCollection.name} yet.`
					: filter === 'available'
						? 'Nothing currently available.'
						: 'No pieces here yet.'
	);
</script>

<svelte:head>
	<title>Gallery · Art By Grigory Orenbakh</title>
</svelte:head>

<SiteNav current="gallery" />

<header>
	<h1>Gallery</h1>
	{#if allPaintings.length > 0}
		<div class="filters" role="tablist" aria-label="Filter by availability">
			<div
				class="indicator"
				class:ready={indicatorReady}
				style="transform: translateX({indicatorLeft}px); width: {indicatorWidth}px;"
				aria-hidden="true"
			></div>
			<button
				bind:this={filterEls.all}
				type="button"
				class="filter-btn"
				class:active={filter === 'all'}
				role="tab"
				aria-selected={filter === 'all'}
				onclick={() => (filter = 'all')}
			>
				All <span class="count">{counts.all}</span>
			</button>
			<button
				bind:this={filterEls.available}
				type="button"
				class="filter-btn"
				class:active={filter === 'available'}
				role="tab"
				aria-selected={filter === 'available'}
				onclick={() => (filter = 'available')}
			>
				Available <span class="count">{counts.available}</span>
			</button>
			<button
				bind:this={filterEls.unavailable}
				type="button"
				class="filter-btn"
				class:active={filter === 'unavailable'}
				role="tab"
				aria-selected={filter === 'unavailable'}
				onclick={() => (filter = 'unavailable')}
			>
				No longer available <span class="count">{counts.unavailable}</span>
			</button>
		</div>

		{#if collections.length > 0}
			<div class="collection-filter">
				<button
					type="button"
					class="collections-toggle"
					class:has-active={!!activeCollection}
					aria-expanded={collectionsOpen}
					onclick={() => (collectionsOpen = !collectionsOpen)}
				>
					<span class="toggle-label">
						{activeCollection ? activeCollection.name : 'All collections'}
					</span>
					<span class="chev" class:open={collectionsOpen} aria-hidden="true">›</span>
				</button>

				{#if collectionsOpen}
					<div class="collection-pills" transition:slide={{ duration: 200 }}>
						<button
							type="button"
							class="pill"
							class:active={collectionId === null}
							onclick={() => (collectionId = null)}
						>
							All collections <span class="count">{byAvailability.length}</span>
						</button>
						{#each collections as c (c.id)}
							<button
								type="button"
								class="pill"
								class:active={collectionId === c.id}
								onclick={() => (collectionId = collectionId === c.id ? null : c.id)}
							>
								{c.name} <span class="count">{collectionCount(c.id)}</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</header>

{#if data.error}
	<p class="error">Could not load paintings: {data.error}</p>
{:else}
	<PaintingGrid {paintings} {emptyMessage} />
{/if}

<style>
	header {
		padding: 1rem 1.5rem 0.5rem;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	h1 {
		font-family: Georgia, serif;
		font-weight: 400;
		letter-spacing: 0.05em;
		margin: 0;
	}

	.filters {
		position: relative;
		display: inline-flex;
		gap: 0.2rem;
		background: #ebe7df;
		padding: 0.2rem;
		border-radius: 999px;
		justify-content: center;
	}

	.indicator {
		position: absolute;
		top: 0.2rem;
		bottom: 0.2rem;
		left: 0;
		background: #c8a571;
		border-radius: 999px;
		box-shadow: 0 1px 4px rgba(200, 165, 113, 0.4);
		z-index: 0;
		pointer-events: none;
		will-change: transform, width;
	}

	.indicator.ready {
		transition:
			transform 380ms cubic-bezier(0.4, 1.15, 0.55, 1),
			width 380ms cubic-bezier(0.4, 1.15, 0.55, 1);
	}

	.filter-btn {
		position: relative;
		z-index: 1;
		background: none;
		border: none;
		padding: 0.3rem 0.75rem;
		border-radius: 999px;
		cursor: pointer;
		font: 500 0.75rem -apple-system, sans-serif;
		color: #777;
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		transition: color 200ms ease;
		white-space: nowrap;
	}

	.filter-btn:hover {
		color: #1a1a1a;
	}

	.filter-btn.active {
		color: #fff;
	}

	.filter-btn .count {
		font-size: 0.68rem;
		color: #999;
		font-weight: 400;
		transition: color 200ms ease;
	}

	.filter-btn.active .count {
		color: rgba(255, 255, 255, 0.8);
	}

	/* ---- collection filter (second row, collapsed by default) ---- */
	.collection-filter {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.6rem;
		width: 100%;
		max-width: 900px;
	}

	.collections-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		background: none;
		border: 1px solid #ded8cc;
		border-radius: 999px;
		padding: 0.32rem 0.9rem;
		cursor: pointer;
		font: 500 0.75rem -apple-system, sans-serif;
		letter-spacing: 0.04em;
		color: #777;
		transition:
			color 150ms ease,
			border-color 150ms ease,
			background 150ms ease;
	}

	.collections-toggle:hover {
		color: #1a1a1a;
		border-color: #c8a571;
	}

	.collections-toggle.has-active {
		color: #1a2942;
		border-color: #c8a571;
		background: #f6efe3;
	}

	.chev {
		display: inline-block;
		font-size: 1rem;
		line-height: 1;
		color: #b3a68f;
		transform: rotate(90deg);
		transition: transform 220ms cubic-bezier(0.4, 1.15, 0.55, 1);
	}

	.chev.open {
		transform: rotate(-90deg);
	}

	.collection-pills {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.4rem;
	}

	.pill {
		background: #fff;
		border: 1px solid #e2ddd2;
		border-radius: 999px;
		padding: 0.32rem 0.85rem;
		cursor: pointer;
		font: 500 0.75rem -apple-system, sans-serif;
		color: #666;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		transition: all 150ms ease;
		white-space: nowrap;
	}

	.pill:hover {
		border-color: #c8a571;
		color: #1a1a1a;
	}

	.pill.active {
		background: #1a2942;
		border-color: #1a2942;
		color: #fff;
	}

	.pill .count {
		font-size: 0.68rem;
		color: #a9a294;
		font-weight: 400;
	}

	.pill.active .count {
		color: rgba(255, 255, 255, 0.7);
	}

	.error {
		text-align: center;
		color: #b00;
		padding: 2rem;
	}
</style>
