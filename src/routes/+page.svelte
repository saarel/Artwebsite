<script lang="ts">
	import type { Painting } from '$lib/types';

	let { data } = $props();
	const featured = $derived<Painting | null>(data.featured);
</script>

<svelte:head>
	<title>About · Art By Grigory Orenbakh</title>
</svelte:head>

<nav class="site-nav">
	<a href="/" class="brand">Grigory Orenbakh</a>
	<div class="links">
		<a href="/" aria-current="page">About</a>
		<a href="/gallery">Gallery</a>
	</div>
</nav>

<main>
	<section class="bio">
		<p class="eyebrow">Dr. Grigory</p>
		<h1>Orenbakh</h1>
		<p class="role">Jewish Artist</p>
		<hr />

		<div class="prose">
			<p>
				Dr. Grigory Orenbakh is a Jewish artist whose work is deeply inspired by faith, memory,
				culture, and the beauty found in everyday life.
			</p>
			<p>
				Born and raised in Ukraine, he discovered his love for art at a young age and later
				studied at art school, where he developed the techniques and creative foundation that
				continue to shape his work today.
			</p>
			<p>
				After immigrating to America, Dr. Orenbakh continued pursuing his passion for art while
				building a new life and carrying with him the traditions, history, and values that have
				always been important to him. His Jewish identity plays a central role in his work,
				especially through his love for Israel and Judaica. Many of his pieces reflect
				spirituality, heritage, and the emotional connection between people, history, and faith.
			</p>
		</div>

		<a href="/gallery" class="cta">Explore the Collection</a>
	</section>

	{#if featured}
		<figure class="artwork">
			<a class="frame-link" href={`/gallery?painting=${featured.id}`} aria-label={`View ${featured.title}`}>
				<div class="frame">
					{#if featured.images?.[0]}
						<img
							src={featured.images[0]}
							alt={featured.title}
							width={featured.dimensions?.[0]?.w || undefined}
							height={featured.dimensions?.[0]?.h || undefined}
						/>
					{/if}
				</div>
			</a>
			<figcaption>
				<div class="title">&ldquo;{featured.title}&rdquo;</div>
				<div class="meta">{featured.medium}</div>
			</figcaption>
		</figure>
	{/if}
</main>

<style>
	:global(body) {
		background: #f4f0e8;
		color: #1a1a1a;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
	}

	.site-nav {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem 3rem;
		max-width: 1400px;
		margin: 0 auto;
	}

	.brand {
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 1.1rem;
		letter-spacing: 0.1em;
		color: #1a2942;
		text-decoration: none;
		text-transform: uppercase;
	}

	.links {
		display: flex;
		gap: 2rem;
	}

	.links a {
		position: relative;
		color: #555;
		text-decoration: none;
		font-size: 0.85rem;
		letter-spacing: 0.15em;
		text-transform: uppercase;
		padding-bottom: 0.35rem;
		transition: color 180ms ease;
	}

	.links a:hover {
		color: #1a2942;
	}

	.links a[aria-current='page'] {
		color: #1a2942;
	}

	.links a[aria-current='page']::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 1.5px;
		background: #c8a571;
		view-transition-name: nav-indicator;
	}

	main {
		max-width: 1400px;
		margin: 0 auto;
		padding: 2rem 3rem 5rem;
		display: grid;
		grid-template-columns: 1fr 1.2fr;
		gap: 5rem;
		align-items: center;
	}

	/* ---- bio ---- */
	.bio {
		max-width: 460px;
	}

	.eyebrow {
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 1rem;
		letter-spacing: 0.25em;
		color: #c8a571;
		text-transform: uppercase;
		margin: 0 0 0.5rem;
	}

	h1 {
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 3.5rem;
		font-weight: 400;
		color: #1a2942;
		margin: 0 0 0.75rem;
		line-height: 1;
		letter-spacing: 0.01em;
	}

	.role {
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 0.85rem;
		letter-spacing: 0.3em;
		color: #1a2942;
		text-transform: uppercase;
		margin: 0 0 1.25rem;
	}

	hr {
		width: 50px;
		height: 1px;
		background: #c8a571;
		border: none;
		margin: 0 0 2rem;
	}

	.prose {
		color: #555;
		line-height: 1.75;
		font-size: 0.95rem;
		font-family: Georgia, 'Times New Roman', serif;
	}

	.prose p {
		margin: 0 0 1.25rem;
	}

	.cta {
		display: inline-block;
		margin-top: 2rem;
		padding: 1rem 2rem;
		border: 1px solid #c8a571;
		color: #1a2942;
		text-decoration: none;
		font-size: 0.8rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		transition: all 150ms ease;
	}

	.cta:hover {
		background: #c8a571;
		color: #fff;
	}

	/* ---- artwork ---- */
	.artwork {
		margin: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.frame-link {
		display: inline-block;
		cursor: pointer;
		transition: transform 200ms ease;
		max-width: 100%;
	}

	.frame-link:hover {
		transform: translateY(-3px);
	}

	.frame {
		background: linear-gradient(135deg, #d8b88a 0%, #c9a06a 50%, #d8b88a 100%);
		padding: 18px;
		border-radius: 2px;
		box-shadow:
			0 30px 60px -15px rgba(0, 0, 0, 0.25),
			0 10px 20px -10px rgba(0, 0, 0, 0.15),
			inset 0 0 0 1px rgba(255, 255, 255, 0.3),
			inset 0 0 0 2px rgba(0, 0, 0, 0.05);
		display: inline-block;
	}

	.frame img {
		display: block;
		max-width: 100%;
		max-height: 75vh;
		width: auto;
		height: auto;
	}

	figcaption {
		text-align: center;
		margin-top: 2rem;
		font-family: Georgia, 'Times New Roman', serif;
	}

	figcaption .title {
		font-size: 1.1rem;
		font-style: italic;
		color: #1a1a1a;
		margin-bottom: 0.4rem;
	}

	figcaption .meta {
		font-size: 0.85rem;
		color: #888;
		letter-spacing: 0.05em;
	}

	/* ---- responsive ---- */
	@media (max-width: 900px) {
		.site-nav {
			padding: 1.25rem 1.5rem;
			flex-direction: column;
			gap: 1rem;
			align-items: center;
			text-align: center;
		}

		.links {
			gap: 1.5rem;
		}

		main {
			grid-template-columns: 1fr;
			gap: 3rem;
			padding: 1rem 1.5rem 3rem;
		}

		.bio {
			max-width: none;
			order: 2;
		}

		.artwork {
			order: 1;
		}

		h1 {
			font-size: 2.5rem;
		}

		.frame {
			padding: 12px;
		}
	}

	@media (max-width: 560px) {
		h1 {
			font-size: 2.25rem;
		}
		main {
			padding: 0.5rem 1rem 2rem;
		}
	}
</style>
