<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { slide } from 'svelte/transition';
	import { supabase } from '$lib/supabase';
	import { uploadImages, deleteImagesByUrl, type UploadProgress } from '$lib/admin';
	import type { Painting, Inquiry } from '$lib/types';

	// --- data ---
	let paintings = $state<Painting[]>([]);
	let inquiries = $state<Inquiry[]>([]);
	let loading = $state(true);
	let loadError = $state<string | null>(null);

	// --- upload form ---
	let newTitle = $state('');
	let newMedium = $state('');
	let newDescription = $state('');
	let newFiles = $state<File[]>([]);
	let uploading = $state(false);
	let uploadError = $state<string | null>(null);
	let uploadSuccess = $state(false);

	// --- edit state ---
	let editingId = $state<string | null>(null);
	let editTitle = $state('');
	let editMedium = $state('');
	let editDescription = $state('');
	let editAddFiles = $state<File[]>([]);
	let editSaving = $state(false);
	let editError = $state<string | null>(null);

	function addFiles(target: 'new' | 'edit', e: Event) {
		const input = e.target as HTMLInputElement;
		if (!input.files || input.files.length === 0) return;
		const added = Array.from(input.files);
		if (target === 'new') newFiles = [...newFiles, ...added];
		else editAddFiles = [...editAddFiles, ...added];
		input.value = ''; // allow re-selecting the same file
	}

	function removePending(target: 'new' | 'edit', idx: number) {
		if (target === 'new') newFiles = newFiles.filter((_, i) => i !== idx);
		else editAddFiles = editAddFiles.filter((_, i) => i !== idx);
	}

	function previewUrl(file: File) {
		return URL.createObjectURL(file);
	}

	// --- upload progress (shared by new + edit) ---
	let progress = $state<UploadProgress | null>(null);

	// --- toast ---
	let toast = $state<string | null>(null);
	let toastTimer: ReturnType<typeof setTimeout> | null = null;

	function showToast(message: string) {
		toast = message;
		if (toastTimer) clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = null), 3500);
	}

	// --- inquiry expansion ---
	let expandedInquiryId = $state<string | null>(null);

	onMount(loadAll);

	async function loadAll() {
		loading = true;
		loadError = null;

		const [pRes, iRes] = await Promise.all([
			supabase
				.from('paintings')
				.select('id, title, medium, description, images, dimensions, avail, created_at')
				.order('created_at', { ascending: false }),
			supabase
				.from('inquiries')
				.select(
					'id, painting_id, first_name, last_name, email, phone, message, read_at, created_at, painting:paintings(id, title)'
				)
				.is('archived_at', null)
				.order('created_at', { ascending: false })
		]);

		if (pRes.error) loadError = pRes.error.message;
		else paintings = (pRes.data ?? []) as Painting[];

		if (iRes.error) loadError = (loadError ? loadError + ' / ' : '') + iRes.error.message;
		else inquiries = (iRes.data ?? []) as unknown as Inquiry[];

		loading = false;
	}

	async function logout() {
		await supabase.auth.signOut();
		goto('/admin/login');
	}

	// --- create ---
	async function handleUpload(e: SubmitEvent) {
		e.preventDefault();
		if (newFiles.length === 0) {
			uploadError = 'Please add at least one image.';
			return;
		}

		uploading = true;
		uploadError = null;
		uploadSuccess = false;

		try {
			const { urls, dimensions } = await uploadImages(newFiles, (p) => (progress = p));
			progress = null;
			const { error } = await supabase.from('paintings').insert({
				title: newTitle.trim(),
				medium: newMedium.trim(),
				description: newDescription.trim() || null,
				images: urls,
				dimensions
			});
			if (error) throw error;

			newTitle = '';
			newMedium = '';
			newDescription = '';
			newFiles = [];
			uploadSuccess = true;
			showToast('Painting added');
			await loadAll();
		} catch (err) {
			uploadError = err instanceof Error ? err.message : String(err);
		} finally {
			uploading = false;
			progress = null;
		}
	}

	// --- delete ---
	async function deletePainting(p: Painting) {
		if (!confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
		const { error } = await supabase.from('paintings').delete().eq('id', p.id);
		if (error) {
			alert('Delete failed: ' + error.message);
			return;
		}
		await deleteImagesByUrl(p.images);
		paintings = paintings.filter((x) => x.id !== p.id);
		showToast(`"${p.title}" deleted`);
	}

	// --- toggle availability ---
	async function toggleAvail(p: Painting) {
		const newAvail = !p.avail;
		const { error } = await supabase
			.from('paintings')
			.update({ avail: newAvail })
			.eq('id', p.id);
		if (error) {
			alert('Update failed: ' + error.message);
			return;
		}
		paintings = paintings.map((x) => (x.id === p.id ? { ...x, avail: newAvail } : x));
		showToast(`"${p.title}" marked ${newAvail ? 'available' : 'unavailable'}`);
	}

	// --- edit ---
	function startEdit(p: Painting) {
		editingId = p.id;
		editTitle = p.title;
		editMedium = p.medium;
		editDescription = p.description ?? '';
		editAddFiles = [];
		editError = null;
	}

	function cancelEdit() {
		editingId = null;
		editError = null;
	}

	async function saveEdit(p: Painting) {
		editSaving = true;
		editError = null;

		try {
			let images = p.images;
			let dimensions = p.dimensions ?? [];
			if (editAddFiles.length > 0) {
				const { urls: addedUrls, dimensions: addedDims } = await uploadImages(
					editAddFiles,
					(p) => (progress = p)
				);
				progress = null;
				images = [...images, ...addedUrls];
				dimensions = [...dimensions, ...addedDims];
			}

			const { error } = await supabase
				.from('paintings')
				.update({
					title: editTitle.trim(),
					medium: editMedium.trim(),
					description: editDescription.trim() || null,
					images,
					dimensions
				})
				.eq('id', p.id);
			if (error) throw error;

			paintings = paintings.map((x) =>
				x.id === p.id
					? {
							...x,
							title: editTitle.trim(),
							medium: editMedium.trim(),
							description: editDescription.trim() || null,
							images,
							dimensions
						}
					: x
			);
			editingId = null;
			showToast(`"${editTitle.trim() || p.title}" updated`);
		} catch (err) {
			editError = err instanceof Error ? err.message : String(err);
		} finally {
			editSaving = false;
			progress = null;
		}
	}

	async function removeImage(p: Painting, url: string) {
		if (!confirm('Remove this image?')) return;
		const idx = p.images.indexOf(url);
		const remaining = p.images.filter((_, i) => i !== idx);
		const remainingDims = (p.dimensions ?? []).filter((_, i) => i !== idx);
		const { error } = await supabase
			.from('paintings')
			.update({ images: remaining, dimensions: remainingDims })
			.eq('id', p.id);
		if (error) {
			alert('Update failed: ' + error.message);
			return;
		}
		await deleteImagesByUrl([url]);
		paintings = paintings.map((x) =>
			x.id === p.id ? { ...x, images: remaining, dimensions: remainingDims } : x
		);
		showToast('Image removed');
	}

	// --- inquiries ---
	async function toggleInquiry(inq: Inquiry) {
		const willOpen = expandedInquiryId !== inq.id;
		expandedInquiryId = willOpen ? inq.id : null;

		if (willOpen && !inq.read_at) {
			const now = new Date().toISOString();
			const { error } = await supabase
				.from('inquiries')
				.update({ read_at: now })
				.eq('id', inq.id);
			if (!error) {
				inquiries = inquiries.map((x) => (x.id === inq.id ? { ...x, read_at: now } : x));
			}
		}
	}

	async function deleteInquiry(inq: Inquiry, e: MouseEvent) {
		e.stopPropagation();
		if (!confirm(`Remove this inquiry from ${inq.first_name} ${inq.last_name}?`)) return;
		const { error } = await supabase
			.from('inquiries')
			.update({ archived_at: new Date().toISOString() })
			.eq('id', inq.id);
		if (error) {
			alert('Failed to remove: ' + error.message);
			return;
		}
		inquiries = inquiries.filter((x) => x.id !== inq.id);
		if (expandedInquiryId === inq.id) expandedInquiryId = null;
		showToast(`Inquiry from ${inq.first_name} ${inq.last_name} removed`);
	}

	async function markUnread(inq: Inquiry, e: MouseEvent) {
		e.stopPropagation();
		const { error } = await supabase
			.from('inquiries')
			.update({ read_at: null })
			.eq('id', inq.id);
		if (!error) {
			inquiries = inquiries.map((x) => (x.id === inq.id ? { ...x, read_at: null } : x));
		}
	}

	function formatDate(iso: string) {
		return new Date(iso).toLocaleString();
	}

	const unreadCount = $derived(inquiries.filter((i) => !i.read_at).length);
</script>

<svelte:head>
	<title>Admin · Art By Grigory Orenbakh</title>
</svelte:head>

<header>
	<div class="header-left">
		<h1>Admin</h1>
		<a href="/" class="view-site">View site →</a>
	</div>
	<button class="logout" onclick={logout}>Sign out</button>
</header>

{#if loading}
	<p class="muted">Loading…</p>
{:else if loadError}
	<p class="error">{loadError}</p>
{:else}
	<!-- ============= UPLOAD ============= -->
	<details class="section">
		<summary>
			<span class="caret" aria-hidden="true">›</span>
			Add a painting
		</summary>
		<div class="section-body">
			<form onsubmit={handleUpload} class="upload-form">
				<label>
					<span>Title</span>
					<input type="text" bind:value={newTitle} required disabled={uploading} />
				</label>
				<label>
					<span>Medium</span>
					<input
						type="text"
						bind:value={newMedium}
						required
						disabled={uploading}
						placeholder="e.g. Oil on canvas, 24 x 36 in"
					/>
				</label>
				<label>
					<span>Description</span>
					<textarea bind:value={newDescription} rows="3" disabled={uploading}></textarea>
				</label>

				<div class="file-field">
					<span class="file-label">Images</span>
					<div class="file-buttons">
						<label class="file-btn">
							Choose files
							<input
								type="file"
								accept="image/*"
								multiple
								disabled={uploading}
								onchange={(e) => addFiles('new', e)}
							/>
						</label>
						<label class="file-btn">
							Take photo
							<input
								type="file"
								accept="image/*"
								capture="environment"
								disabled={uploading}
								onchange={(e) => addFiles('new', e)}
							/>
						</label>
					</div>

					{#if newFiles.length > 0}
						<ul class="pending">
							{#each newFiles as f, i (f.name + i)}
								<li>
									<img src={previewUrl(f)} alt="" />
									<button
										type="button"
										onclick={() => removePending('new', i)}
										disabled={uploading}
										aria-label="Remove"
									>×</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>

				{#if uploadError}
					<p class="error">{uploadError}</p>
				{/if}

				<button type="submit" disabled={uploading}>
					{uploading ? 'Uploading…' : 'Add painting'}
				</button>
			</form>
		</div>
	</details>

	<!-- ============= LISTINGS ============= -->
	<details class="section" open>
		<summary>
			<span class="caret" aria-hidden="true">›</span>
			Listings ({paintings.length})
		</summary>
		<div class="section-body">
		{#if paintings.length === 0}
			<div class="empty">
				<p>No paintings yet.</p>
				<p class="hint">Open the "Add a painting" section above to upload your first one.</p>
			</div>
		{:else}
			<div class="listings">
				{#each paintings as p, i (p.id)}
					<div
						class="listing"
						class:sold={!p.avail}
						style="animation-delay: {Math.min(i, 8) * 40}ms"
					>
						{#if editingId === p.id}
							<div class="edit-form">
								<label>
									<span>Title</span>
									<input type="text" bind:value={editTitle} disabled={editSaving} />
								</label>
								<label>
									<span>Medium</span>
									<input type="text" bind:value={editMedium} disabled={editSaving} />
								</label>
								<label>
									<span>Description</span>
									<textarea bind:value={editDescription} rows="3" disabled={editSaving}></textarea>
								</label>

								<div class="image-grid">
									{#each p.images as img (img)}
										<div class="image-tile">
											<img src={img} alt="" />
											<button
												type="button"
												class="remove-img"
												onclick={() => removeImage(p, img)}
												disabled={editSaving}
												aria-label="Remove image"
											>
												×
											</button>
										</div>
									{/each}
								</div>

								<div class="file-field">
									<span class="file-label">Add more images</span>
									<div class="file-buttons">
										<label class="file-btn">
											Choose files
											<input
												type="file"
												accept="image/*"
												multiple
												disabled={editSaving}
												onchange={(e) => addFiles('edit', e)}
											/>
										</label>
										<label class="file-btn">
											Take photo
											<input
												type="file"
												accept="image/*"
												capture="environment"
												disabled={editSaving}
												onchange={(e) => addFiles('edit', e)}
											/>
										</label>
									</div>

									{#if editAddFiles.length > 0}
										<ul class="pending">
											{#each editAddFiles as f, i (f.name + i)}
												<li>
													<img src={previewUrl(f)} alt="" />
													<button
														type="button"
														onclick={() => removePending('edit', i)}
														disabled={editSaving}
														aria-label="Remove"
													>×</button>
												</li>
											{/each}
										</ul>
									{/if}
								</div>

								{#if editError}
									<p class="error">{editError}</p>
								{/if}

								<div class="edit-actions">
									<button type="button" onclick={() => saveEdit(p)} disabled={editSaving}>
										{editSaving ? 'Saving…' : 'Save'}
									</button>
									<button
										type="button"
										class="secondary"
										onclick={cancelEdit}
										disabled={editSaving}
									>
										Cancel
									</button>
								</div>
							</div>
						{:else}
							<div class="thumb">
								{#if p.images?.[0]}
									<img src={p.images[0]} alt={p.title} />
								{/if}
								{#if !p.avail}
									<span class="sold-tag">No longer available</span>
								{/if}
							</div>
							<div class="meta">
								<div class="title-row">
									<div class="title">{p.title}</div>
									<span class="status" class:status-sold={!p.avail}>
										{p.avail ? 'Available' : 'No longer available'}
									</span>
								</div>
								<div class="medium">{p.medium}</div>
								<div class="count">
									{p.images.length} image{p.images.length === 1 ? '' : 's'}
								</div>
							</div>
							<div class="actions">
								<button onclick={() => startEdit(p)}>Edit</button>
								<button onclick={() => toggleAvail(p)}>
									{p.avail ? 'Mark unavailable' : 'Mark available'}
								</button>
								<button class="danger" onclick={() => deletePainting(p)}>Delete</button>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
		</div>
	</details>

	<!-- ============= INQUIRIES ============= -->
	<details class="section" open>
		<summary>
			<span class="caret" aria-hidden="true">›</span>
			Inquiries ({inquiries.length})
			{#if unreadCount > 0}
				<span class="unread-count">{unreadCount} new</span>
			{/if}
		</summary>
		<div class="section-body">
		{#if inquiries.length === 0}
			<div class="empty">
				<p>No inquiries yet.</p>
				<p class="hint">When visitors send a message about a painting, it'll appear here.</p>
			</div>
		{:else}
			<ul class="inquiries">
				{#each inquiries as inq, i (inq.id)}
					<li
						class:unread={!inq.read_at}
						style="animation-delay: {Math.min(i, 10) * 35}ms"
					>
						<button class="inq-header" onclick={() => toggleInquiry(inq)}>
							<span class="dot" aria-hidden="true"></span>
							<span class="who">{inq.first_name} {inq.last_name}</span>
							<span class="about">re: {inq.painting?.title ?? '(deleted painting)'}</span>
							<span class="when">{formatDate(inq.created_at)}</span>
						</button>
						{#if expandedInquiryId === inq.id}
							<div class="inq-body" transition:slide={{ duration: 220 }}>
								<div class="contact-grid">
									<div class="field">
										<span class="field-label">Email</span>
										<a class="field-value" href={`mailto:${inq.email}`}>{inq.email}</a>
									</div>
									<div class="field">
										<span class="field-label">Phone</span>
										<a class="field-value" href={`tel:${inq.phone}`}>{inq.phone}</a>
									</div>
								</div>

								<div class="message-block">
									<span class="field-label">Message</span>
									<p class="message">{inq.message}</p>
								</div>

								<div class="inq-actions">
									<a
										class="primary-action"
										href={`mailto:${inq.email}?subject=${encodeURIComponent(
											`Re: ${inq.painting?.title ?? 'your inquiry'}`
										)}&body=${encodeURIComponent(`Hi ${inq.first_name},\n\n`)}`}
									>
										Reply by email
									</a>
									{#if inq.read_at}
										<button class="link" onclick={(e) => markUnread(inq, e)}>
											Mark unread
										</button>
									{/if}
									<button class="link danger" onclick={(e) => deleteInquiry(inq, e)}>
										Delete
									</button>
								</div>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
		</div>
	</details>
{/if}

{#if toast}
	<div class="toast" role="status" aria-live="polite">
		<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
			<circle cx="12" cy="12" r="10" fill="#2a5d2a" />
			<path
				d="M7 12l3.5 3.5L17 9"
				fill="none"
				stroke="#fff"
				stroke-width="2.4"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
		<span>{toast}</span>
		<button class="toast-close" onclick={() => (toast = null)} aria-label="Dismiss">×</button>
	</div>
{/if}

{#if progress}
	<div class="upload-overlay" role="status" aria-live="polite">
		<div class="upload-card">
			<div class="spinner" aria-hidden="true"></div>
			<p class="upload-title">
				{progress.phase === 'processing' ? 'Preparing image' : 'Uploading image'}
				{progress.current} of {progress.total}
			</p>
			<div class="bar">
				<div
					class="bar-fill"
					style="width: {((progress.current - (progress.phase === 'processing' ? 0.5 : 0)) /
						progress.total) *
						100}%"
				></div>
			</div>
			<p class="upload-hint">Please don't close this tab.</p>
		</div>
	</div>
{/if}

<style>
	:global(body) {
		background: #f7f5f1;
		color: #1a1a1a;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
	}

	header {
		position: sticky;
		top: 0;
		z-index: 10;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 2rem;
		background: #fff;
		border-bottom: 1px solid #ebe7df;
		backdrop-filter: blur(8px);
	}

	.header-left {
		display: flex;
		align-items: baseline;
		gap: 1.25rem;
	}

	h1 {
		font-family: Georgia, serif;
		font-weight: 400;
		margin: 0;
		font-size: 1.5rem;
		letter-spacing: 0.02em;
	}

	.view-site {
		color: #666;
		text-decoration: none;
		font-size: 0.85rem;
	}

	.view-site:hover {
		color: #111;
	}

	.logout {
		background: #fff;
		border: 1px solid #ddd;
		padding: 0.45rem 1rem;
		border-radius: 999px;
		cursor: pointer;
		font-size: 0.85rem;
		transition: all 120ms ease;
	}

	.logout:hover {
		border-color: #333;
		background: #f5f5f5;
	}

	.section {
		max-width: 1100px;
		margin: 1rem auto 0;
		background: #fff;
		border-radius: 10px;
		border: 1px solid #ebe7df;
		overflow: hidden;
	}

	.section > summary {
		font-family: Georgia, serif;
		font-size: 1.25rem;
		padding: 1rem 1.5rem;
		cursor: pointer;
		list-style: none;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		user-select: none;
		transition: background 120ms ease;
	}

	.section > summary::-webkit-details-marker {
		display: none;
	}

	.section > summary:hover {
		background: #faf9f6;
	}

	.section[open] > summary {
		border-bottom: 1px solid #ebe7df;
	}

	.caret {
		display: inline-block;
		transition: transform 150ms ease;
		color: #999;
		font-size: 1.2rem;
		line-height: 1;
		width: 1rem;
		text-align: center;
	}

	.section[open] > summary .caret {
		transform: rotate(90deg);
	}

	.section-body {
		padding: 1.5rem;
	}

	.unread-count {
		background: #c44;
		color: #fff;
		font-size: 0.7rem;
		padding: 0.2rem 0.6rem;
		border-radius: 999px;
		letter-spacing: 0.05em;
		font-family: -apple-system, sans-serif;
		font-weight: 600;
	}

	.muted {
		color: #888;
	}

	.empty {
		padding: 2rem 1rem;
		text-align: center;
		color: #999;
	}

	.empty p {
		margin: 0;
	}

	.empty .hint {
		font-size: 0.9rem;
		margin-top: 0.4rem;
		color: #aaa;
	}

	.error {
		color: #b00;
	}

	/* ---- toast ---- */
	.toast {
		position: fixed;
		top: 1.25rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 1100;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.7rem 1rem 0.7rem 0.85rem;
		background: #fff;
		border: 1px solid #d5e0d5;
		border-radius: 999px;
		box-shadow: 0 6px 24px -8px rgba(0, 0, 0, 0.25);
		font-size: 0.9rem;
		color: #1a1a1a;
		animation: toast-in 320ms cubic-bezier(0.16, 1, 0.3, 1) both;
		max-width: calc(100vw - 2rem);
	}

	.toast-close {
		background: none;
		border: none;
		font-size: 1.2rem;
		line-height: 1;
		color: #999;
		cursor: pointer;
		padding: 0 0.2rem;
		margin-left: 0.25rem;
	}

	.toast-close:hover {
		color: #1a1a1a;
	}

	@keyframes toast-in {
		from {
			opacity: 0;
			transform: translate(-50%, -12px);
		}
		to {
			opacity: 1;
			transform: translate(-50%, 0);
		}
	}

	/* ---- upload overlay ---- */
	.upload-overlay {
		position: fixed;
		inset: 0;
		background: rgba(20, 18, 14, 0.55);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 1rem;
		animation: overlay-in 180ms ease both;
	}

	.upload-card {
		background: #fff;
		border-radius: 12px;
		padding: 2rem 2.25rem;
		max-width: 360px;
		width: 100%;
		text-align: center;
		box-shadow: 0 20px 50px -10px rgba(0, 0, 0, 0.3);
		animation: card-in 220ms cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	.spinner {
		width: 42px;
		height: 42px;
		margin: 0 auto 1.25rem;
		border: 3px solid #ebe7df;
		border-top-color: #1a1a1a;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	.upload-title {
		margin: 0 0 0.85rem;
		font-weight: 500;
		color: #1a1a1a;
	}

	.bar {
		height: 4px;
		background: #ebe7df;
		border-radius: 999px;
		overflow: hidden;
		margin-bottom: 0.85rem;
	}

	.bar-fill {
		height: 100%;
		background: #1a1a1a;
		transition: width 250ms ease;
	}

	.upload-hint {
		margin: 0;
		font-size: 0.8rem;
		color: #888;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@keyframes overlay-in {
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
			transform: translateY(8px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	/* ---- file picker / camera ---- */
	.file-field {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.file-label {
		font-size: 0.8rem;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.file-buttons {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.file-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.55rem 1.1rem;
		border: 1px solid #d6d2c8;
		border-radius: 999px;
		cursor: pointer;
		background: #fff;
		font-size: 0.9rem;
		transition: all 120ms ease;
	}

	.file-btn:hover {
		background: #faf9f6;
		border-color: #333;
	}

	.file-btn input[type='file'] {
		display: none;
	}

	.pending {
		list-style: none;
		padding: 0;
		margin: 0.5rem 0 0;
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.pending li {
		position: relative;
		width: 90px;
		height: 90px;
		border-radius: 6px;
		overflow: hidden;
		background: #f5f5f5;
		border: 1px solid #ebe7df;
	}

	.pending img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.pending button {
		position: absolute;
		top: 4px;
		right: 4px;
		background: rgba(0, 0, 0, 0.75);
		color: #fff;
		border: none;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		cursor: pointer;
		font-size: 0.95rem;
		line-height: 1;
		padding: 0;
	}

	.pending button:hover {
		background: #000;
	}

	/* ---- upload form ---- */
	.upload-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 640px;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.8rem;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	input[type='text'],
	textarea {
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

	input:focus,
	textarea:focus {
		outline: none;
		border-color: #1a1a1a;
	}

	textarea {
		resize: vertical;
	}

	button[type='submit'] {
		align-self: flex-start;
		padding: 0.7rem 1.6rem;
		background: #1a1a1a;
		color: #fff;
		border: none;
		border-radius: 999px;
		cursor: pointer;
		font: 500 0.95rem -apple-system, sans-serif;
		transition: background 120ms ease;
	}

	button[type='submit']:hover:not(:disabled) {
		background: #333;
	}

	button[type='submit']:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* ---- listings ---- */
	.listings {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.listing {
		display: grid;
		grid-template-columns: 130px 1fr auto;
		gap: 1.25rem;
		padding: 1rem;
		border: 1px solid #ebe7df;
		border-radius: 8px;
		background: #fff;
		align-items: center;
		transition: border-color 150ms ease, box-shadow 150ms ease;
		animation: row-in 380ms cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	.listing:hover {
		border-color: #d6d2c8;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
	}

	.listing.sold {
		background: #fafaf7;
	}

	.thumb {
		position: relative;
		width: 130px;
		height: 130px;
		background: #f5f5f5;
		overflow: hidden;
		border-radius: 6px;
	}

	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.sold-tag {
		position: absolute;
		top: 0.4rem;
		left: 0.4rem;
		background: rgba(0, 0, 0, 0.82);
		color: #fff;
		font-size: 0.62rem;
		letter-spacing: 0.04em;
		padding: 0.22rem 0.55rem;
		border-radius: 3px;
		font-style: italic;
		font-family: Georgia, 'Times New Roman', serif;
	}

	.meta {
		min-width: 0;
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
		margin-bottom: 0.2rem;
	}

	.meta .title {
		font-weight: 500;
		font-size: 1.05rem;
		color: #1a1a1a;
	}

	.status {
		display: inline-block;
		padding: 0.18rem 0.7rem;
		font-size: 0.7rem;
		letter-spacing: 0.03em;
		font-weight: 600;
		border-radius: 999px;
		background: #e8f0e8;
		color: #2a5d2a;
		white-space: nowrap;
	}

	.status-sold {
		background: #f7e8d8;
		color: #8a4a14;
	}

	.meta .medium {
		color: #666;
		font-style: italic;
		font-size: 0.9rem;
	}

	.meta .count {
		font-size: 0.8rem;
		color: #999;
		margin-top: 0.35rem;
	}

	.actions {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.actions button {
		font: 500 0.85rem -apple-system, sans-serif;
		padding: 0.45rem 0.95rem;
		border: 1px solid #d6d2c8;
		background: #fff;
		border-radius: 999px;
		cursor: pointer;
		transition: all 120ms ease;
		white-space: nowrap;
	}

	.actions button:hover {
		border-color: #333;
		background: #faf9f6;
	}

	.actions button.danger {
		border-color: #e8c2c2;
		color: #b00;
	}

	.actions button.danger:hover {
		background: #fdf4f4;
		border-color: #b00;
	}

	/* ---- edit form ---- */
	.edit-form {
		grid-column: 1 / -1;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 0.5rem 0;
	}

	.image-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
		gap: 0.5rem;
	}

	.image-tile {
		position: relative;
		aspect-ratio: 1;
		background: #f5f5f5;
		border-radius: 6px;
		overflow: hidden;
		border: 1px solid #ebe7df;
	}

	.image-tile img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.remove-img {
		position: absolute;
		top: 4px;
		right: 4px;
		background: rgba(0, 0, 0, 0.75);
		color: #fff;
		border: none;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		cursor: pointer;
		font-size: 1rem;
		line-height: 1;
		padding: 0;
	}

	.remove-img:hover {
		background: #000;
	}

	.edit-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.edit-actions button {
		padding: 0.6rem 1.4rem;
		background: #1a1a1a;
		color: #fff;
		border: none;
		border-radius: 999px;
		cursor: pointer;
		font: 500 0.9rem -apple-system, sans-serif;
		transition: background 120ms ease;
	}

	.edit-actions button:hover:not(:disabled) {
		background: #333;
	}

	.edit-actions button.secondary {
		background: #fff;
		color: #333;
		border: 1px solid #d6d2c8;
	}

	.edit-actions button.secondary:hover {
		background: #faf9f6;
	}

	/* ---- inquiries ---- */
	.inquiries {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.inquiries li {
		border: 1px solid #ebe7df;
		border-radius: 8px;
		background: #fff;
		overflow: hidden;
		transition: border-color 150ms ease, background 150ms ease;
		animation: row-in 380ms cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	@keyframes row-in {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.inquiries li:hover {
		border-color: #d6d2c8;
	}

	.inquiries li.unread {
		background: #fff8e6;
		border-color: #ead89a;
	}

	.inquiries li.unread:hover {
		border-color: #d8be6a;
	}

	.inq-header {
		display: grid;
		grid-template-columns: 16px 1fr 1.5fr auto;
		gap: 0.75rem;
		align-items: center;
		width: 100%;
		padding: 0.85rem 1.1rem;
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		font: inherit;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: transparent;
	}

	.inquiries li.unread .dot {
		background: #c44;
		box-shadow: 0 0 0 3px rgba(204, 68, 68, 0.15);
	}

	.who {
		font-weight: 500;
		color: #1a1a1a;
	}

	.about {
		color: #666;
		font-size: 0.9rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.when {
		color: #999;
		font-size: 0.8rem;
		white-space: nowrap;
	}

	.inq-body {
		padding: 1.1rem 1.25rem 1.25rem 2.85rem;
		border-top: 1px solid #f0ecdc;
		background: #fdfcf8;
	}

	.contact-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem 1.5rem;
		padding-bottom: 1rem;
		margin-bottom: 1rem;
		border-bottom: 1px solid #f0ecdc;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}

	.field-label {
		font-size: 0.7rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #999;
		font-weight: 600;
	}

	.field-value {
		font-size: 0.95rem;
		color: #1a1a1a;
		text-decoration: none;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.field-value:hover {
		text-decoration: underline;
		text-decoration-color: #c8a571;
		text-underline-offset: 3px;
	}

	.message-block {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 1.25rem;
	}

	.message {
		white-space: pre-wrap;
		line-height: 1.65;
		margin: 0;
		color: #2a2a2a;
		padding: 0.85rem 1rem;
		background: #fff;
		border-radius: 6px;
		border-left: 3px solid #c8a571;
		font-size: 0.95rem;
	}

	.inq-actions {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.primary-action {
		display: inline-block;
		padding: 0.55rem 1.2rem;
		background: #1a1a1a;
		color: #fff;
		text-decoration: none;
		border-radius: 999px;
		font: 500 0.85rem -apple-system, sans-serif;
		transition: background 120ms ease;
	}

	.primary-action:hover {
		background: #333;
	}

	.link {
		background: none;
		border: none;
		color: #777;
		text-decoration: underline;
		cursor: pointer;
		padding: 0;
		font: inherit;
		font-size: 0.85rem;
	}

	.link:hover {
		color: #1a1a1a;
	}

	.link.danger {
		color: #b00;
		margin-left: auto;
	}

	.link.danger:hover {
		color: #800;
	}

	@media (max-width: 700px) {
		header {
			padding: 0.85rem 1rem;
		}
		.header-left {
			gap: 0.75rem;
		}
		h1 {
			font-size: 1.25rem;
		}
		.section {
			margin: 0.6rem 0.5rem 0;
			border-radius: 8px;
		}
		.section > summary {
			padding: 0.85rem 1rem;
			font-size: 1.1rem;
		}
		.section-body {
			padding: 1rem;
		}
		.listing {
			grid-template-columns: 90px 1fr;
			gap: 0.85rem;
		}
		.thumb {
			width: 90px;
			height: 90px;
		}
		.actions {
			grid-column: 1 / -1;
			flex-direction: row;
			flex-wrap: wrap;
		}
		.inq-header {
			grid-template-columns: 16px 1fr;
			grid-template-rows: auto auto auto;
			row-gap: 0.25rem;
		}
		.about,
		.when {
			grid-column: 2;
		}
		.inq-body {
			padding-left: 1.1rem;
			padding-right: 1.1rem;
		}
		.contact-grid {
			grid-template-columns: 1fr;
			gap: 0.85rem;
		}
		.inq-actions {
			flex-wrap: wrap;
		}
	}
</style>
