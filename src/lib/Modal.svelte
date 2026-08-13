<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		subtitle = '',
		size = 'md',
		busy = false,
		onclose,
		children,
		footer
	}: {
		title: string;
		subtitle?: string;
		size?: 'sm' | 'md' | 'lg';
		/** While true, Escape and backdrop clicks won't close (mid-save). */
		busy?: boolean;
		onclose: () => void;
		children: Snippet;
		footer?: Snippet;
	} = $props();

	function tryClose() {
		if (!busy) onclose();
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') tryClose();
	}
</script>

<svelte:window on:keydown={onKey} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
	class="backdrop"
	role="presentation"
	onclick={(e) => {
		if (e.target === e.currentTarget) tryClose();
	}}
>
	<div class="modal {size}" role="dialog" aria-modal="true" aria-label={title}>
		<header>
			<div class="heading">
				<h2>{title}</h2>
				{#if subtitle}<p class="sub">{subtitle}</p>{/if}
			</div>
			<button class="x" onclick={tryClose} disabled={busy} aria-label="Close">×</button>
		</header>

		<div class="body">
			{@render children()}
		</div>

		{#if footer}
			<footer>
				{@render footer()}
			</footer>
		{/if}
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(20, 18, 14, 0.55);
		backdrop-filter: blur(3px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: calc(1.5rem + env(safe-area-inset-top)) 1rem calc(1.5rem + env(safe-area-inset-bottom));
		animation: fade-in 160ms ease both;
	}

	.modal {
		background: #fff;
		border-radius: 14px;
		width: 100%;
		max-height: 90dvh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		box-shadow: 0 24px 60px -18px rgba(0, 0, 0, 0.45);
		animation: card-in 240ms cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	.modal.sm {
		max-width: 460px;
	}
	.modal.md {
		max-width: 620px;
	}
	.modal.lg {
		max-width: 860px;
	}

	header {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
		padding: 1.25rem 1.5rem 1rem;
		border-bottom: 1px solid #ebe7df;
	}

	.heading {
		min-width: 0;
		flex: 1;
	}

	h2 {
		font-family: Georgia, 'Times New Roman', serif;
		font-weight: 400;
		font-size: 1.35rem;
		color: #1a2942;
		margin: 0;
	}

	.sub {
		margin: 0.3rem 0 0;
		font-size: 0.85rem;
		color: #888;
		line-height: 1.45;
	}

	.x {
		flex-shrink: 0;
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		border: 1px solid #e0dcd4;
		background: #fff;
		font-size: 1.25rem;
		line-height: 1;
		cursor: pointer;
		color: #777;
		padding: 0;
		transition: all 120ms ease;
	}

	.x:hover:not(:disabled) {
		background: #faf9f6;
		color: #1a1a1a;
		border-color: #999;
	}

	.x:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.body {
		padding: 1.5rem;
		overflow-y: auto;
	}

	footer {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 1rem 1.5rem;
		border-top: 1px solid #ebe7df;
		background: #fbfaf7;
	}

	@keyframes fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes card-in {
		from {
			opacity: 0;
			transform: translateY(10px) scale(0.985);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	@media (max-width: 620px) {
		.backdrop {
			padding: 0;
			align-items: flex-end;
		}
		.modal {
			max-width: none;
			max-height: 94dvh;
			border-radius: 14px 14px 0 0;
		}
		header,
		.body,
		footer {
			padding-left: 1.1rem;
			padding-right: 1.1rem;
		}
	}
</style>
