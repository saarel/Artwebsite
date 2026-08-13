<script lang="ts">
	let { current = '' }: { current?: 'about' | 'gallery' | 'collections' | '' } = $props();
</script>

<nav class="site-nav">
	<a href="/" class="brand">Grigory Orenbakh</a>
	<div class="links">
		<a href="/" aria-current={current === 'about' ? 'page' : undefined}>About</a>
		<a href="/gallery" aria-current={current === 'gallery' ? 'page' : undefined}>Gallery</a>
		<a href="/collections" aria-current={current === 'collections' ? 'page' : undefined}>
			Collections
		</a>
	</div>
</nav>

<style>
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

	@media (max-width: 900px) {
		.site-nav {
			padding: 1.25rem 1.5rem;
		}
	}

	@media (max-width: 520px) {
		.site-nav {
			flex-direction: column;
			gap: 0.75rem;
			align-items: center;
			text-align: center;
		}
		.links {
			gap: 1.25rem;
		}
	}
</style>
