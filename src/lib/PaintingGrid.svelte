<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import type { Painting } from './types';
	import PaintingModal from './PaintingModal.svelte';

	let {
		paintings,
		emptyMessage = 'No pieces here yet.'
	}: { paintings: Painting[]; emptyMessage?: string } = $props();

	let selected = $state<Painting | null>(null);
	// Tracks whether we own a pushed history entry for the open modal so
	// closing can pop it (instead of leaving dead URLs in history).
	let hasPushedState = false;

	function open(p: Painting) {
		selected = p;
		if (typeof window === 'undefined') return;
		// Update URL so the modal is shareable. We only push one history entry
		// per "modal session" — subsequent modal switches just replace it.
		const url = new URL(window.location.href);
		if (url.searchParams.get('painting') !== p.id) {
			url.searchParams.set('painting', p.id);
			if (hasPushedState) {
				history.replaceState({ painting: p.id }, '', url);
			} else {
				history.pushState({ painting: p.id }, '', url);
				hasPushedState = true;
			}
		}
	}

	function close() {
		selected = null;
		requestAnimationFrame(() => {
			if (typeof window === 'undefined') return;
			if (hasPushedState) {
				// Pop the entry we pushed so back button skips it cleanly.
				history.back();
				hasPushedState = false;
			} else if (window.location.search) {
				const url = new URL(window.location.href);
				url.searchParams.delete('painting');
				history.replaceState(null, '', url.pathname + url.search);
			}
		});
	}

	onMount(() => {
		const id = page.url.searchParams.get('painting');
		if (id) {
			const match = paintings.find((p) => p.id === id);
			if (match) selected = match;
		}

		const onPop = () => {
			const newId = new URL(window.location.href).searchParams.get('painting');
			if (!newId) {
				// Back / forward landed on the bare URL — close modal.
				selected = null;
				hasPushedState = false;
				return;
			}
			const match = paintings.find((p) => p.id === newId);
			if (match && selected?.id !== match.id) open(match);
		};
		window.addEventListener('popstate', onPop);
		return () => window.removeEventListener('popstate', onPop);
	});
</script>

{#if paintings.length === 0}
	<p class="empty">{emptyMessage}</p>
{:else}
	<div class="masonry">
		{#each paintings as p, i (p.id)}
			<button class="card" onclick={() => open(p)} aria-label={`Open ${p.title}`}>
				<div
					class="thumb"
					style="--ar: {p.dimensions?.[0]?.w && p.dimensions[0].h
						? `${p.dimensions[0].w} / ${p.dimensions[0].h}`
						: '4 / 5'};"
				>
					{#if p.images?.[0]}
						<img
							src={p.images[0]}
							alt={p.title}
							width={p.dimensions?.[0]?.w || undefined}
							height={p.dimensions?.[0]?.h || undefined}
							loading={i < 6 ? 'eager' : 'lazy'}
							fetchpriority={i < 3 ? 'high' : 'auto'}
							decoding="async"
						/>
					{/if}
					{#if !p.avail}
						<span class="sold-badge">No longer available</span>
					{/if}
				</div>
				<div class="caption">
					<div class="title">{p.title}</div>
					<div class="medium">{p.medium}</div>
				</div>
			</button>
		{/each}
	</div>
{/if}

{#if selected}
	{#key selected.id}
		<PaintingModal painting={selected} onclose={close} />
	{/key}
{/if}

<style>
	.empty {
		text-align: center;
		color: #777;
		padding: 2rem;
	}

	.masonry {
		column-count: 3;
		column-gap: 1rem;
		padding: 1rem;
	}

	@media (max-width: 900px) {
		.masonry {
			column-count: 2;
		}
	}

	@media (max-width: 560px) {
		.masonry {
			column-count: 1;
		}
	}

	.card {
		display: block;
		width: 100%;
		break-inside: avoid;
		margin: 0 0 1rem;
		padding: 0;
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		font: inherit;
		color: inherit;
		-webkit-tap-highlight-color: transparent;
		transition: transform 120ms ease;
	}

	.card:hover {
		transform: translateY(-2px);
	}

	.thumb {
		position: relative;
		aspect-ratio: var(--ar, 4 / 5);
		background: #ebe7df;
		overflow: hidden;
		border-radius: 2px;
	}

	.card img {
		width: 100%;
		height: 100%;
		display: block;
		object-fit: contain;
	}

	.sold-badge {
		position: absolute;
		top: 0.5rem;
		left: 0.5rem;
		background: rgba(0, 0, 0, 0.78);
		color: #fff;
		font-size: 0.7rem;
		letter-spacing: 0.05em;
		font-style: italic;
		padding: 0.3rem 0.65rem;
		border-radius: 2px;
		font-family: Georgia, 'Times New Roman', serif;
	}

	.caption {
		padding: 0.5rem 0.25rem;
	}

	.title {
		font-weight: 500;
	}

	.medium {
		font-size: 0.85rem;
		color: #666;
		font-style: italic;
	}
</style>
