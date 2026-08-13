<script lang="ts">
	import type { Painting } from '$lib/types';
	import { supabase } from '$lib/supabase';
	import SiteNav from '$lib/SiteNav.svelte';
	import { AsYouType, isValidPhoneNumber, type CountryCode } from 'libphonenumber-js/min';

	const DEFAULT_COUNTRY: CountryCode = 'US';
	const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
	const MIN_MESSAGE_LENGTH = 10;

	let { data } = $props();
	const featured = $derived<Painting | null>(data.featured);

	// --- commission request modal ---
	let commissionOpen = $state(false);
	let cFirst = $state('');
	let cLast = $state('');
	let cEmail = $state('');
	let cPhone = $state('');
	let cMessage = $state('');
	let cSubmitting = $state(false);
	let cSubmitted = $state(false);
	let cSubmitError = $state<string | null>(null);
	let cErrors = $state<{
		firstName: string | null;
		lastName: string | null;
		email: string | null;
		phone: string | null;
		message: string | null;
	}>({ firstName: null, lastName: null, email: null, phone: null, message: null });

	function formatPhone(raw: string): string {
		return new AsYouType(DEFAULT_COUNTRY).input(raw);
	}

	function resetCommission() {
		cFirst = '';
		cLast = '';
		cEmail = '';
		cPhone = '';
		cMessage = '';
		cSubmitting = false;
		cSubmitted = false;
		cSubmitError = null;
		cErrors = { firstName: null, lastName: null, email: null, phone: null, message: null };
	}

	function openCommission() {
		resetCommission();
		commissionOpen = true;
	}

	function closeCommission() {
		commissionOpen = false;
	}

	function onCPhoneInput(e: Event) {
		const target = e.target as HTMLInputElement;
		cPhone = formatPhone(target.value);
		cErrors.phone = null;
	}

	function validateCommission() {
		cErrors.firstName = cFirst.trim() ? null : 'First name is required.';
		cErrors.lastName = cLast.trim() ? null : 'Last name is required.';
		const emailVal = cEmail.trim();
		if (!emailVal) cErrors.email = 'Email is required.';
		else if (!EMAIL_RE.test(emailVal)) cErrors.email = 'Please enter a valid email address.';
		else cErrors.email = null;
		const phoneVal = cPhone.trim();
		if (!phoneVal) cErrors.phone = 'Phone number is required.';
		else if (!isValidPhoneNumber(phoneVal, DEFAULT_COUNTRY))
			cErrors.phone = 'Please enter a valid phone number.';
		else cErrors.phone = null;
		const msgVal = cMessage.trim();
		if (!msgVal) cErrors.message = 'Please describe your commission.';
		else if (msgVal.length < MIN_MESSAGE_LENGTH)
			cErrors.message = `Message must be at least ${MIN_MESSAGE_LENGTH} characters.`;
		else cErrors.message = null;
		return !Object.values(cErrors).some(Boolean);
	}

	async function submitCommission(e: SubmitEvent) {
		e.preventDefault();
		if (!validateCommission()) return;

		cSubmitting = true;
		cSubmitError = null;

		const { error } = await supabase.from('inquiries').insert({
			painting_id: null,
			type: 'commission',
			first_name: cFirst.trim(),
			last_name: cLast.trim(),
			email: cEmail.trim(),
			phone: cPhone.trim(),
			message: cMessage.trim()
		});

		cSubmitting = false;
		if (error) cSubmitError = error.message;
		else cSubmitted = true;
	}

	function onCKey(e: KeyboardEvent) {
		if (commissionOpen && e.key === 'Escape') closeCommission();
	}
</script>

<svelte:window on:keydown={onCKey} />

<svelte:head>
	<title>About · Art By Grigory Orenbakh</title>
</svelte:head>

<SiteNav current="about" />

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

		<div class="cta-row">
			<a href="/gallery" class="cta">Explore the Collection</a>
			<button type="button" class="cta cta-secondary" onclick={openCommission}>
				Request a Commission
			</button>
		</div>
	</section>

	{#if featured}
		<figure
			class="artwork"
			style="--ar: {featured.dimensions?.[0]?.w && featured.dimensions[0].h
				? `${featured.dimensions[0].w} / ${featured.dimensions[0].h}`
				: '4 / 5'};"
		>
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

{#if commissionOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="modal-backdrop"
		role="dialog"
		aria-modal="true"
		aria-label="Request a custom commission"
		tabindex="-1"
		onclick={(e) => { if (e.target === e.currentTarget) closeCommission(); }}
	>
		<div class="modal commission-modal">
			<button class="close" onclick={closeCommission} aria-label="Close">×</button>

			<div class="modal-body">
				<header class="modal-header">
					<h2>Request a Commission</h2>
					<p class="modal-intro">
						Tell me about the piece you have in mind — subject, size, medium, timeline. I'll be in
						touch to discuss the details.
					</p>
				</header>

				{#if cSubmitted}
					<p class="success">
						Thanks — your commission request has been sent. I'll be in touch soon.
					</p>
				{:else}
					<form onsubmit={submitCommission} novalidate>
						<div class="row">
							<label>
								<span>First name</span>
								<input
									type="text"
									bind:value={cFirst}
									disabled={cSubmitting}
									autocomplete="given-name"
									aria-invalid={cErrors.firstName ? 'true' : undefined}
									oninput={() => (cErrors.firstName = null)}
								/>
								{#if cErrors.firstName}
									<span class="field-error">{cErrors.firstName}</span>
								{/if}
							</label>
							<label>
								<span>Last name</span>
								<input
									type="text"
									bind:value={cLast}
									disabled={cSubmitting}
									autocomplete="family-name"
									aria-invalid={cErrors.lastName ? 'true' : undefined}
									oninput={() => (cErrors.lastName = null)}
								/>
								{#if cErrors.lastName}
									<span class="field-error">{cErrors.lastName}</span>
								{/if}
							</label>
						</div>
						<div class="row">
							<label>
								<span>Email</span>
								<input
									type="email"
									bind:value={cEmail}
									disabled={cSubmitting}
									autocomplete="email"
									aria-invalid={cErrors.email ? 'true' : undefined}
									oninput={() => (cErrors.email = null)}
								/>
								{#if cErrors.email}
									<span class="field-error">{cErrors.email}</span>
								{/if}
							</label>
							<label>
								<span>Phone</span>
								<input
									type="tel"
									value={cPhone}
									disabled={cSubmitting}
									autocomplete="tel"
									inputmode="tel"
									placeholder="(555) 123-4567"
									aria-invalid={cErrors.phone ? 'true' : undefined}
									oninput={onCPhoneInput}
								/>
								{#if cErrors.phone}
									<span class="field-error">{cErrors.phone}</span>
								{/if}
							</label>
						</div>
						<label>
							<span>What would you like commissioned?</span>
							<textarea
								bind:value={cMessage}
								rows="5"
								disabled={cSubmitting}
								placeholder="e.g. A 24x36 oil on canvas seascape, ideally finished by spring..."
								aria-invalid={cErrors.message ? 'true' : undefined}
								oninput={() => (cErrors.message = null)}
							></textarea>
							{#if cErrors.message}
								<span class="field-error">{cErrors.message}</span>
							{/if}
						</label>

						{#if cSubmitError}
							<p class="error">{cSubmitError}</p>
						{/if}
						<button type="submit" class="submit" disabled={cSubmitting}>
							{cSubmitting ? 'Sending…' : 'Send request'}
						</button>
					</form>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	:global(body) {
		background: #f4f0e8;
		color: #1a1a1a;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
	}

	main {
		max-width: 1400px;
		margin: 0 auto;
		padding: 2rem 3rem 5rem;
		display: grid;
		grid-template-columns: 1fr 1.2fr;
		gap: 5rem;
		align-items: start;
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
		position: relative;
		display: inline-block;
		margin-top: 2rem;
		padding: 1rem 2rem;
		border: 1px solid #c8a571;
		color: #1a2942;
		text-decoration: none;
		font-size: 0.8rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		overflow: hidden;
		isolation: isolate;
		transition:
			color 300ms cubic-bezier(0.4, 0, 0.2, 1),
			transform 150ms ease;
	}

	.cta::before {
		content: '';
		position: absolute;
		inset: 0;
		background: #c8a571;
		transform: translateX(-101%);
		transition: transform 420ms cubic-bezier(0.4, 0, 0.2, 1);
		z-index: -1;
	}

	.cta:hover {
		color: #fff;
	}

	.cta:hover::before {
		transform: translateX(0);
	}

	.cta:active {
		transform: scale(0.97);
	}

	.cta-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin: 2rem auto 0;
		max-width: 460px;
		justify-content: center;
	}

	.cta-row .cta {
		flex: 1 1 200px;
		margin: 0;
		padding: 1rem 1.25rem;
		font: 400 0.8rem/1.7 -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		text-align: center;
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.cta-secondary {
		background: none;
		cursor: pointer;
	}

	/* ============ Commission modal ============ */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(20, 18, 14, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: calc(1rem + env(safe-area-inset-top)) calc(1rem + env(safe-area-inset-right))
			calc(1rem + env(safe-area-inset-bottom)) calc(1rem + env(safe-area-inset-left));
		animation: backdrop-in 200ms ease-out both;
	}

	.commission-modal {
		background: #fff;
		max-width: 600px;
		width: 100%;
		max-height: 95dvh;
		overflow-y: auto;
		border-radius: 8px;
		position: relative;
		animation: modal-in 320ms cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	.close {
		position: absolute;
		top: 0.85rem;
		right: 0.85rem;
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
		background: #faf9f6;
	}

	.modal-body {
		padding: 2.5rem 2rem 2rem;
	}

	.modal-header {
		text-align: center;
		margin-bottom: 1.75rem;
		padding-bottom: 1.5rem;
		border-bottom: 1px solid #ebe7df;
	}

	.modal-header h2 {
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 1.75rem;
		font-weight: 400;
		color: #1a2942;
		margin: 0 0 0.75rem;
	}

	.modal-intro {
		color: #666;
		line-height: 1.6;
		margin: 0;
		font-size: 0.9rem;
	}

	.commission-modal form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.commission-modal .row {
		display: flex;
		gap: 0.85rem;
	}

	.commission-modal .row label {
		flex: 1;
		min-width: 0;
	}

	.commission-modal label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.75rem;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.commission-modal input,
	.commission-modal textarea {
		font: 400 1rem/1.4 -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
		padding: 0.65rem 0.85rem;
		border: 1px solid #d6d2c8;
		border-radius: 6px;
		background: #fff;
		color: #1a1a1a;
		text-transform: none;
		letter-spacing: normal;
		transition: border-color 120ms ease;
	}

	.commission-modal input:focus,
	.commission-modal textarea:focus {
		outline: none;
		border-color: #1a2942;
	}

	.commission-modal input[aria-invalid='true'],
	.commission-modal textarea[aria-invalid='true'] {
		border-color: #b00;
	}

	.commission-modal textarea {
		resize: vertical;
	}

	.field-error {
		color: #b00;
		font-size: 0.78rem;
		margin-top: 0.2rem;
		text-transform: none;
		letter-spacing: normal;
	}

	.error {
		color: #b00;
		margin: 0;
		font-size: 0.9rem;
	}

	.success {
		padding: 1rem;
		background: #f0f8f0;
		border: 1px solid #cfe5cf;
		color: #2a5d2a;
		border-radius: 6px;
		text-align: center;
	}

	.submit {
		align-self: center;
		margin-top: 0.5rem;
		padding: 0.75rem 2rem;
		background: #c8a571;
		color: #fff;
		border: none;
		border-radius: 999px;
		font: 500 0.9rem -apple-system, sans-serif;
		cursor: pointer;
		transition: background 120ms ease, box-shadow 120ms ease;
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

	@keyframes backdrop-in {
		from { opacity: 0; }
		to { opacity: 1; }
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

	.frame {
		aspect-ratio: var(--ar, 4 / 5);
		max-height: 75vh;
	}

	.frame img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
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
		.modal-body {
			padding: 2rem 1.25rem 1.5rem;
		}
		.commission-modal .row {
			flex-direction: column;
			gap: 1rem;
		}
		.modal-header h2 {
			font-size: 1.5rem;
		}
	}
</style>
