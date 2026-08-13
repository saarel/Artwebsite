<script lang="ts">
	import { onMount } from 'svelte';
	import type { Painting } from './types';
	import { supabase } from './supabase';
	import { AsYouType, isValidPhoneNumber, type CountryCode } from 'libphonenumber-js/min';

	const DEFAULT_COUNTRY: CountryCode = 'US';
	const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
	const MIN_MESSAGE_LENGTH = 10;

	let { painting, onclose }: { painting: Painting; onclose: () => void } = $props();

	let imageIndex = $state(0);
	let showInquiry = $state(false);

	let zoomed = $state(false);
	let zoomOrigin = $state({ x: 50, y: 50 });
	let pan = $state({ x: 0, y: 0 });
	let isFullscreen = $state(false);
	let dragging = $state(false);
	let dragStart = { x: 0, y: 0, panX: 0, panY: 0 };
	let didDrag = false;

	let firstName = $state('');
	let lastName = $state('');
	let email = $state('');
	let phone = $state('');
	let message = $state('');
	let submitting = $state(false);
	let submitted = $state(false);
	let submitError = $state<string | null>(null);

	let errors = $state<{
		firstName: string | null;
		lastName: string | null;
		email: string | null;
		phone: string | null;
		message: string | null;
	}>({
		firstName: null,
		lastName: null,
		email: null,
		phone: null,
		message: null
	});

	function formatPhone(raw: string): string {
		return new AsYouType(DEFAULT_COUNTRY).input(raw);
	}

	function onPhoneInput(e: Event) {
		const target = e.target as HTMLInputElement;
		phone = formatPhone(target.value);
		errors.phone = null;
	}

	function validateFirstName() {
		errors.firstName = firstName.trim() ? null : 'First name is required.';
	}

	function validateLastName() {
		errors.lastName = lastName.trim() ? null : 'Last name is required.';
	}

	function validateEmail() {
		const value = email.trim();
		if (!value) errors.email = 'Email is required.';
		else if (!EMAIL_RE.test(value)) errors.email = 'Please enter a valid email address.';
		else errors.email = null;
	}

	function validatePhone() {
		const value = phone.trim();
		if (!value) errors.phone = 'Phone number is required.';
		else if (!isValidPhoneNumber(value, DEFAULT_COUNTRY))
			errors.phone = 'Please enter a valid phone number.';
		else errors.phone = null;
	}

	function validateMessage() {
		const value = message.trim();
		if (!value) errors.message = 'Message is required.';
		else if (value.length < MIN_MESSAGE_LENGTH)
			errors.message = `Message must be at least ${MIN_MESSAGE_LENGTH} characters.`;
		else errors.message = null;
	}

	function validateAll() {
		validateFirstName();
		validateLastName();
		validateEmail();
		validatePhone();
		validateMessage();
		return !Object.values(errors).some(Boolean);
	}

	async function submitInquiry(e: SubmitEvent) {
		e.preventDefault();
		if (!validateAll()) return;

		submitting = true;
		submitError = null;

		const { error } = await supabase.from('inquiries').insert({
			painting_id: painting.id,
			type: 'inquiry',
			first_name: firstName.trim(),
			last_name: lastName.trim(),
			email: email.trim(),
			phone: phone.trim(),
			message: message.trim()
		});

		submitting = false;
		if (error) {
			submitError = error.message;
		} else {
			submitted = true;
		}
	}

	function next() {
		imageIndex = (imageIndex + 1) % painting.images.length;
		unzoom();
	}

	function prev() {
		imageIndex = (imageIndex - 1 + painting.images.length) % painting.images.length;
		unzoom();
	}

	function zoomAtPoint(e: MouseEvent) {
		const img = e.currentTarget as HTMLImageElement;
		const rect = img.getBoundingClientRect();
		zoomOrigin = {
			x: ((e.clientX - rect.left) / rect.width) * 100,
			y: ((e.clientY - rect.top) / rect.height) * 100
		};
		pan = { x: 0, y: 0 };
		zoomed = !zoomed;
	}

	function unzoom() {
		zoomed = false;
		pan = { x: 0, y: 0 };
	}

	function onImagePointerDown(e: PointerEvent) {
		if (!zoomed) return;
		e.preventDefault();
		const img = e.currentTarget as HTMLImageElement;
		img.setPointerCapture(e.pointerId);
		dragging = true;
		didDrag = false;
		dragStart = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
	}

	function onImagePointerMove(e: PointerEvent) {
		if (!dragging) return;
		const dx = e.clientX - dragStart.x;
		const dy = e.clientY - dragStart.y;
		if (Math.abs(dx) > 4 || Math.abs(dy) > 4) didDrag = true;
		pan = { x: dragStart.panX + dx, y: dragStart.panY + dy };
	}

	function onImagePointerUp(e: PointerEvent) {
		const img = e.currentTarget as HTMLImageElement;
		try {
			img.releasePointerCapture(e.pointerId);
		} catch {
			/* noop */
		}
		dragging = false;
	}

	function onImageClick(e: MouseEvent) {
		if (didDrag) {
			didDrag = false;
			return;
		}
		zoomAtPoint(e);
	}

	function toggleFullscreen(e: MouseEvent) {
		e.stopPropagation();
		if (document.fullscreenElement) {
			document.exitFullscreen();
			return;
		}
		const carousel = (e.currentTarget as HTMLElement).closest('.carousel') as HTMLElement | null;
		if (carousel?.requestFullscreen) {
			carousel.requestFullscreen().catch(() => {});
		}
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
		if (e.key === 'ArrowRight') next();
		if (e.key === 'ArrowLeft') prev();
	}

	onMount(() => {
		// Defer mounting the inquiry form so the modal can paint immediately.
		requestAnimationFrame(() => (showInquiry = true));

		const handler = () => {
			isFullscreen = !!document.fullscreenElement;
		};
		document.addEventListener('fullscreenchange', handler);
		return () => document.removeEventListener('fullscreenchange', handler);
	});
</script>

<svelte:window on:keydown={onKey} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
	class="modal-backdrop"
	role="dialog"
	aria-modal="true"
	aria-label={painting.title}
	tabindex="-1"
	onclick={(e) => {
		if (e.target === e.currentTarget) onclose();
	}}
>
	<div class="modal">
		<button class="close" onclick={onclose} aria-label="Close">×</button>

		<div class="carousel">
			{#if painting.images.length > 1}
				<button class="nav prev" onclick={prev} aria-label="Previous image">‹</button>
			{/if}

			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<img
				src={painting.images[imageIndex]}
				alt={painting.title}
				draggable="false"
				onclick={onImageClick}
				ondblclick={unzoom}
				onpointerdown={onImagePointerDown}
				onpointermove={onImagePointerMove}
				onpointerup={onImagePointerUp}
				ondragstart={(e) => e.preventDefault()}
				oncontextmenu={(e) => e.preventDefault()}
				class="zoomable"
				class:zoomed
				class:dragging
				style="transform-origin: {zoomOrigin.x}% {zoomOrigin.y}%; transform: {zoomed
					? `translate(${pan.x}px, ${pan.y}px) scale(2.2)`
					: ''};"
			/>

			{#if zoomed}
				<button
					class="unzoom-btn"
					onclick={(e) => {
						e.stopPropagation();
						unzoom();
					}}
					aria-label="Reset zoom"
				>
					<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
						<path
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M5 12h14"
						/>
						<circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" stroke-width="2" />
						<path
							d="M15.5 15.5l4 4"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
						/>
					</svg>
				</button>
			{/if}

			{#if painting.images.length > 1}
				<button class="nav next" onclick={next} aria-label="Next image">›</button>
			{/if}

			<button
				class="fullscreen-btn"
				class:in-fullscreen={isFullscreen}
				onclick={toggleFullscreen}
				aria-label={isFullscreen ? 'Exit fullscreen' : 'View fullscreen'}
			>
				{#if isFullscreen}
					<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
						<path
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M6 6l12 12 M18 6L6 18"
						/>
					</svg>
				{:else}
					<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
						<path
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M4 10V4h6 M14 4h6v6 M20 14v6h-6 M10 20H4v-6"
						/>
					</svg>
				{/if}
			</button>
		</div>

		{#if painting.images.length > 1}
			<div class="counter">{imageIndex + 1} / {painting.images.length}</div>
		{/if}

		<div class="details">
			{#if !painting.avail}
				<span class="status-pill">No longer available</span>
			{/if}
			<h2>{painting.title}</h2>
			<div class="medium">{painting.medium}</div>
			{#if painting.description}
				<p>{painting.description}</p>
			{/if}

			{#if showInquiry}
				<div class="inquiry">
					<h3>Inquire about this piece</h3>

					{#if submitted}
						<p class="success">Thanks — your message has been sent. The artist will be in touch.</p>
					{:else}
						<form onsubmit={submitInquiry} novalidate>
							<div class="row">
								<label>
									<span>First name</span>
									<input
										type="text"
										bind:value={firstName}
										disabled={submitting}
										autocomplete="given-name"
										aria-invalid={errors.firstName ? 'true' : undefined}
										oninput={() => (errors.firstName = null)}
										onblur={validateFirstName}
									/>
									{#if errors.firstName}
										<span class="field-error">{errors.firstName}</span>
									{/if}
								</label>
								<label>
									<span>Last name</span>
									<input
										type="text"
										bind:value={lastName}
										disabled={submitting}
										autocomplete="family-name"
										aria-invalid={errors.lastName ? 'true' : undefined}
										oninput={() => (errors.lastName = null)}
										onblur={validateLastName}
									/>
									{#if errors.lastName}
										<span class="field-error">{errors.lastName}</span>
									{/if}
								</label>
							</div>
							<div class="row">
								<label>
									<span>Email</span>
									<input
										type="email"
										bind:value={email}
										disabled={submitting}
										autocomplete="email"
										aria-invalid={errors.email ? 'true' : undefined}
										oninput={() => (errors.email = null)}
										onblur={validateEmail}
									/>
									{#if errors.email}
										<span class="field-error">{errors.email}</span>
									{/if}
								</label>
								<label>
									<span>Phone</span>
									<input
										type="tel"
										value={phone}
										disabled={submitting}
										autocomplete="tel"
										inputmode="tel"
										placeholder="(555) 123-4567"
										aria-invalid={errors.phone ? 'true' : undefined}
										oninput={onPhoneInput}
										onblur={validatePhone}
									/>
									{#if errors.phone}
										<span class="field-error">{errors.phone}</span>
									{/if}
								</label>
							</div>
							<label>
								<span>Message</span>
								<textarea
									bind:value={message}
									rows="4"
									disabled={submitting}
									placeholder="I'm interested in this piece..."
									aria-invalid={errors.message ? 'true' : undefined}
									oninput={() => (errors.message = null)}
									onblur={validateMessage}
								></textarea>
								{#if errors.message}
									<span class="field-error">{errors.message}</span>
								{/if}
							</label>
							{#if submitError}
								<p class="error">{submitError}</p>
							{/if}
							<button type="submit" class="submit" disabled={submitting}>
								{submitting ? 'Sending…' : 'Send inquiry'}
							</button>
						</form>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.85);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: calc(1rem + env(safe-area-inset-top)) calc(1rem + env(safe-area-inset-right))
			calc(1rem + env(safe-area-inset-bottom)) calc(1rem + env(safe-area-inset-left));
		animation: backdrop-in 200ms ease-out both;
	}

	.modal {
		background: #fff;
		max-width: 1100px;
		width: 100%;
		max-height: 95dvh;
		overflow-y: auto;
		border-radius: 4px;
		position: relative;
		display: flex;
		flex-direction: column;
		animation: modal-in 320ms cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	@keyframes backdrop-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes modal-in {
		from {
			opacity: 0;
			transform: scale(0.96) translateY(10px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	.close {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		width: 2.2rem;
		height: 2.2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.95);
		border: 1px solid #e0dcd4;
		border-radius: 50%;
		font-size: 1.4rem;
		line-height: 1;
		cursor: pointer;
		color: #1a1a1a;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
		transition: background 120ms ease;
		z-index: 3;
		padding: 0;
	}

	.close:hover {
		background: #fff;
	}

	.carousel {
		position: relative;
		background: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		overflow: hidden;
		flex-shrink: 0;
	}

	.carousel img {
		max-width: 100%;
		max-height: 75vh;
		width: auto;
		height: auto;
		object-fit: contain;
		display: block;
	}

	.nav {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		background: rgba(255, 255, 255, 0.95);
		border: 1px solid #e0dcd4;
		font-size: 2rem;
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 50%;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #1a1a1a;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		transition: background 120ms ease;
	}

	.nav:hover {
		background: #fff;
	}

	.zoomable {
		cursor: zoom-in;
		transition: transform 250ms ease;
		will-change: transform;
		user-select: none;
	}

	.zoomable.zoomed {
		cursor: grab;
		touch-action: none;
	}

	.zoomable.zoomed.dragging {
		cursor: grabbing;
		transition: none;
	}

	.fullscreen-btn {
		position: absolute;
		bottom: 0.75rem;
		right: 0.75rem;
		width: 2.2rem;
		height: 2.2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.92);
		border: 1px solid #e0dcd4;
		border-radius: 50%;
		cursor: pointer;
		color: #1a1a1a;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		transition: background 120ms ease;
		padding: 0;
	}

	.fullscreen-btn:hover {
		background: #fff;
	}

	.unzoom-btn {
		position: absolute;
		bottom: 0.75rem;
		left: 0.75rem;
		width: 2.2rem;
		height: 2.2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.95);
		border: 1px solid #e0dcd4;
		border-radius: 50%;
		cursor: pointer;
		color: #1a1a1a;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		transition: background 120ms ease;
		padding: 0;
		z-index: 3;
	}

	.unzoom-btn:hover {
		background: #fff;
	}

	.carousel:fullscreen {
		background: #000;
		padding: 0;
		width: 100vw;
		height: 100vh;
	}

	.carousel:fullscreen img {
		max-width: 100vw;
		max-height: 100vh;
	}

	.fullscreen-btn.in-fullscreen {
		background: rgba(255, 255, 255, 0.95);
		color: #1a1a1a;
		width: 2.6rem;
		height: 2.6rem;
		top: 1rem;
		right: 1rem;
		bottom: auto;
	}

	.nav.prev {
		left: 0.75rem;
	}
	.nav.next {
		right: 0.75rem;
	}

	.counter {
		text-align: center;
		padding: 0.5rem;
		color: #666;
		font-size: 0.85rem;
	}

	.details {
		padding: 1rem 1.5rem 1.5rem;
	}

	.status-pill {
		display: inline-block;
		padding: 0.2rem 0.65rem;
		margin-bottom: 0.5rem;
		background: #f7e8d8;
		color: #8a4a14;
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		border-radius: 999px;
		white-space: nowrap;
	}

	.details h2 {
		margin: 0 0 0.25rem;
		font-family: Georgia, serif;
		font-weight: 400;
	}

	.details .medium {
		margin-bottom: 1rem;
		font-size: 0.85rem;
		color: #666;
		font-style: italic;
	}

	.details p {
		line-height: 1.6;
		color: #333;
	}

	.inquiry {
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 1px solid #eee;
	}

	.inquiry h3 {
		font-family: Georgia, serif;
		font-weight: 400;
		margin: 0 0 1rem;
	}

	.inquiry form {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.inquiry .row {
		display: flex;
		gap: 0.85rem;
	}

	.inquiry .row label {
		flex: 1;
	}

	.inquiry label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.85rem;
		color: #555;
	}

	.inquiry input,
	.inquiry textarea {
		font: inherit;
		padding: 0.55rem 0.7rem;
		border: 1px solid #ccc;
		border-radius: 3px;
		background: #fff;
	}

	.inquiry input:focus,
	.inquiry textarea:focus {
		outline: none;
		border-color: #333;
	}

	.inquiry input[aria-invalid='true'],
	.inquiry textarea[aria-invalid='true'] {
		border-color: #b00;
	}

	.field-error {
		color: #b00;
		font-size: 0.8rem;
		margin-top: 0.15rem;
	}

	.inquiry textarea {
		resize: vertical;
		min-height: 5rem;
	}

	.submit {
		align-self: center;
		padding: 0.7rem 2rem;
		background: #c8a571;
		color: #fff;
		border: none;
		border-radius: 999px;
		cursor: pointer;
		font: inherit;
		transition:
			background 120ms ease,
			box-shadow 120ms ease;
		box-shadow: 0 1px 4px rgba(200, 165, 113, 0.4);
	}

	.submit:hover:not(:disabled) {
		background: #b89460;
		box-shadow: 0 2px 8px rgba(200, 165, 113, 0.5);
	}

	.submit:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.inquiry .error {
		color: #b00;
		padding: 0;
		text-align: left;
		font-size: 0.9rem;
	}

	.success {
		padding: 0.85rem 1rem;
		background: #f0f8f0;
		border: 1px solid #cfe5cf;
		color: #2a5d2a;
		border-radius: 3px;
	}

	@media (max-width: 560px) {
		.inquiry .row {
			flex-direction: column;
		}
	}
</style>
