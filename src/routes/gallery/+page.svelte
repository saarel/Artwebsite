<script lang="ts">
	import type { Painting } from '$lib/types';
	import { supabase } from '$lib/supabase';
	import { AsYouType, isValidPhoneNumber, type CountryCode } from 'libphonenumber-js';

	const DEFAULT_COUNTRY: CountryCode = 'US';
	const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
	const MIN_MESSAGE_LENGTH = 10;

	let { data } = $props();
	const paintings = $derived<Painting[]>(data.paintings);

	let selected = $state<Painting | null>(null);
	let imageIndex = $state(0);

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

	function resetForm() {
		firstName = '';
		lastName = '';
		email = '';
		phone = '';
		message = '';
		submitting = false;
		submitted = false;
		submitError = null;
		errors = {
			firstName: null,
			lastName: null,
			email: null,
			phone: null,
			message: null
		};
	}

	function open(p: Painting) {
		selected = p;
		imageIndex = 0;
		resetForm();
	}

	function close() {
		selected = null;
		resetForm();
	}

	async function submitInquiry(e: SubmitEvent) {
		e.preventDefault();
		if (!selected) return;

		if (!validateAll()) return;

		submitting = true;
		submitError = null;

		const { error } = await supabase.from('inquiries').insert({
			painting_id: selected.id,
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
		if (!selected) return;
		imageIndex = (imageIndex + 1) % selected.images.length;
	}

	function prev() {
		if (!selected) return;
		imageIndex = (imageIndex - 1 + selected.images.length) % selected.images.length;
	}

	function onKey(e: KeyboardEvent) {
		if (!selected) return;
		if (e.key === 'Escape') close();
		if (e.key === 'ArrowRight') next();
		if (e.key === 'ArrowLeft') prev();
	}
</script>

<svelte:window on:keydown={onKey} />

<header>
	<h1>Gallery</h1>
</header>

{#if data.error}
	<p class="error">Could not load paintings: {data.error}</p>
{:else if paintings.length === 0}
	<p class="empty">Art coming soon.</p>
{:else}
	<div class="masonry">
		{#each paintings as p (p.id)}
			<button class="card" onclick={() => open(p)} aria-label={`Open ${p.title}`}>
				<div class="thumb">
					{#if p.images?.[0]}
						<img src={p.images[0]} alt={p.title} loading="lazy" />
					{/if}
					{#if p.sold}
						<span class="sold-badge">SOLD</span>
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
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="modal-backdrop"
		role="dialog"
		aria-modal="true"
		aria-label={selected.title}
		tabindex="-1"
		onclick={(e) => { if (e.target === e.currentTarget) close(); }}
	>
		<div class="modal">
			<button class="close" onclick={close} aria-label="Close">×</button>

			<div class="carousel">
				{#if selected.images.length > 1}
					<button class="nav prev" onclick={prev} aria-label="Previous image">‹</button>
				{/if}

				<img src={selected.images[imageIndex]} alt={selected.title} />

				{#if selected.images.length > 1}
					<button class="nav next" onclick={next} aria-label="Next image">›</button>
				{/if}
			</div>

			{#if selected.images.length > 1}
				<div class="counter">{imageIndex + 1} / {selected.images.length}</div>
			{/if}

			<div class="details">
				<h2>{selected.title}</h2>
				<div class="medium">{selected.medium}</div>
				{#if selected.description}
					<p>{selected.description}</p>
				{/if}

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
			</div>
		</div>
	</div>
{/if}

<style>
	header {
		padding: 2rem 1.5rem 1rem;
		text-align: center;
	}

	h1 {
		font-family: Georgia, serif;
		font-weight: 400;
		letter-spacing: 0.05em;
		margin: 0;
	}

	.error,
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
		.masonry { column-count: 2; }
	}

	@media (max-width: 560px) {
		.masonry { column-count: 1; }
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
		transition: transform 120ms ease;
	}

	.card:hover {
		transform: translateY(-2px);
	}

	.thumb {
		position: relative;
	}

	.card img {
		width: 100%;
		height: auto;
		display: block;
		border-radius: 2px;
	}

	.sold-badge {
		position: absolute;
		top: 0.5rem;
		left: 0.5rem;
		background: rgba(0, 0, 0, 0.78);
		color: #fff;
		font-size: 0.7rem;
		letter-spacing: 0.15em;
		padding: 0.25rem 0.55rem;
		border-radius: 2px;
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

	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.85);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 1rem;
	}

	.modal {
		background: #fff;
		max-width: 1100px;
		width: 100%;
		max-height: 95vh;
		overflow-y: auto;
		border-radius: 4px;
		position: relative;
		display: flex;
		flex-direction: column;
	}

	.close {
		position: absolute;
		top: 0.5rem;
		right: 0.75rem;
		background: none;
		border: none;
		font-size: 2rem;
		line-height: 1;
		cursor: pointer;
		color: #333;
		z-index: 2;
	}

	.carousel {
		position: relative;
		background: #111;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.carousel img {
		max-width: 100%;
		max-height: 75vh;
		object-fit: contain;
		display: block;
	}

	.nav {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		background: rgba(255, 255, 255, 0.85);
		border: none;
		font-size: 2rem;
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 50%;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.nav.prev { left: 0.75rem; }
	.nav.next { right: 0.75rem; }

	.counter {
		text-align: center;
		padding: 0.5rem;
		color: #666;
		font-size: 0.85rem;
	}

	.details {
		padding: 1rem 1.5rem 1.5rem;
	}

	.details h2 {
		margin: 0 0 0.25rem;
		font-family: Georgia, serif;
		font-weight: 400;
	}

	.details .medium {
		margin-bottom: 1rem;
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
		align-self: flex-start;
		padding: 0.6rem 1.4rem;
		background: #111;
		color: #fff;
		border: none;
		border-radius: 3px;
		cursor: pointer;
		font: inherit;
		transition: background 120ms ease;
	}

	.submit:hover:not(:disabled) {
		background: #333;
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
		.inquiry .row { flex-direction: column; }
	}
</style>
