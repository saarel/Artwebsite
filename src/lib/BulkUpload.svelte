<script lang="ts">
	import { supabase } from './supabase';
	import { uploadImages, setPaintingCollections, type UploadProgress } from './admin';
	import type { Collection } from './types';

	let {
		collections,
		ondone,
		ontoast,
		compact = false
	}: {
		collections: Collection[];
		ondone: () => Promise<void> | void;
		ontoast: (message: string) => void;
		/** Toolbar mode: just the buttons, no explanatory blurb. */
		compact?: boolean;
	} = $props();

	type Item = {
		file: File;
		preview: string;
		title: string;
		medium: string;
		description: string;
		avail: boolean;
		collectionIds: string[];
		skipped: boolean;
		/** Already written to the database — never upload it twice on a retry. */
		saved: boolean;
	};

	let items = $state<Item[]>([]);
	let index = $state(0);
	let open = $state(false);
	let titleError = $state<string | null>(null);
	let saving = $state(false);
	let saveError = $state<string | null>(null);
	let progress = $state<UploadProgress | null>(null);
	let runTotal = $state(0);
	let runDone = $state(0);

	const current = $derived(items[index]);
	const isLast = $derived(index === items.length - 1);
	const pending = $derived(items.filter((it) => !it.skipped && !it.saved));

	function pickFiles(e: Event) {
		const input = e.target as HTMLInputElement;
		if (!input.files || input.files.length === 0) return;

		// Carry the last entry's medium + collections forward — bulk uploads are
		// usually one series at a time.
		const lastMedium = items.at(-1)?.medium ?? '';
		const lastCollections = items.at(-1)?.collectionIds ?? [];

		const added = Array.from(input.files).map((file) => ({
			file,
			preview: URL.createObjectURL(file),
			title: '',
			medium: lastMedium,
			description: '',
			avail: true,
			collectionIds: [...lastCollections],
			skipped: false,
			saved: false
		}));

		input.value = ''; // allow re-selecting the same files
		items = [...items, ...added];
		index = items.findIndex((it) => !it.title && !it.skipped);
		if (index < 0) index = items.length - 1;
		titleError = null;
		saveError = null;
		open = true;
	}

	function cleanup() {
		for (const it of items) URL.revokeObjectURL(it.preview);
		items = [];
		index = 0;
		titleError = null;
		saveError = null;
		runTotal = 0;
		runDone = 0;
	}

	function cancelAll() {
		if (saving) return;
		if (items.some((it) => it.title.trim()) && !confirm('Discard these photos and start over?'))
			return;
		open = false;
		cleanup();
	}

	function toggleCollection(id: string) {
		if (!current) return;
		current.collectionIds = current.collectionIds.includes(id)
			? current.collectionIds.filter((c) => c !== id)
			: [...current.collectionIds, id];
	}

	function back() {
		if (index > 0) {
			index--;
			titleError = null;
		}
	}

	function skip() {
		if (!current) return;
		current.skipped = true;
		advance();
	}

	function nextItem() {
		if (!current) return;
		if (!current.title.trim()) {
			titleError = 'Give this one a name first.';
			return;
		}
		current.skipped = false;
		advance();
	}

	function advance() {
		titleError = null;
		if (isLast) {
			saveAll();
			return;
		}

		// Carry medium + tags into the next photo when it's still untouched —
		// a batch is usually one series, and retyping them 20 times is a chore.
		const next = items[index + 1];
		if (next && current) {
			if (!next.medium) next.medium = current.medium;
			if (next.collectionIds.length === 0) next.collectionIds = [...current.collectionIds];
		}
		index++;
	}

	async function saveAll() {
		const toSave = items.filter((it) => !it.skipped && !it.saved && it.title.trim());
		if (toSave.length === 0) {
			const alreadySaved = items.filter((it) => it.saved).length;
			open = false;
			cleanup();
			if (alreadySaved > 0) await ondone();
			ontoast(
				alreadySaved > 0
					? `${alreadySaved} painting${alreadySaved === 1 ? '' : 's'} added`
					: 'Nothing to upload — every photo was skipped.'
			);
			return;
		}

		saving = true;
		saveError = null;
		runTotal = toSave.length;
		runDone = 0;

		try {
			for (const item of toSave) {
				const { urls, dimensions } = await uploadImages([item.file], (p) => (progress = p));
				const { data, error } = await supabase
					.from('paintings')
					.insert({
						title: item.title.trim(),
						medium: item.medium.trim(),
						description: item.description.trim() || null,
						images: urls,
						dimensions,
						avail: item.avail
					})
					.select('id')
					.single();
				if (error) throw error;

				if (item.collectionIds.length > 0 && data) {
					await setPaintingCollections(data.id, item.collectionIds);
				}
				item.saved = true;
				runDone++;
			}

			const n = items.filter((it) => it.saved).length;
			open = false;
			cleanup();
			await ondone();
			ontoast(`${n} painting${n === 1 ? '' : 's'} added`);
		} catch (err) {
			const done = runDone;
			saveError =
				(err instanceof Error ? err.message : String(err)) +
				(done > 0
					? ` — ${done} painting${done === 1 ? '' : 's'} already saved; retrying won't duplicate ${done === 1 ? 'it' : 'them'}.`
					: '');
		} finally {
			saving = false;
			progress = null;
		}
	}
</script>

<div class="bulk" class:compact>
	{#if !compact}
		<p class="lead">
			Pick a batch of photos and name them one at a time — each photo becomes its own painting.
		</p>
	{/if}
	<div class="file-buttons">
		<label class="file-btn">
			{compact ? 'Bulk upload' : 'Choose photos'}
			<input type="file" accept="image/*" multiple onchange={pickFiles} />
		</label>
		{#if !compact}
			<label class="file-btn">
				Take photo
				<input type="file" accept="image/*" capture="environment" onchange={pickFiles} />
			</label>
		{/if}
	</div>
</div>

{#if open && current}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="wizard-backdrop" role="dialog" aria-modal="true" aria-label="Name your uploads">
		<div class="wizard">
			<header class="wizard-head">
				<div class="steps">
					Photo {index + 1} of {items.length}
					{#if items.some((it) => it.skipped)}
						<span class="skipped-note">· {items.filter((it) => it.skipped).length} skipped</span>
					{/if}
				</div>
				<div class="bar" aria-hidden="true">
					<div class="bar-fill" style="width: {((index + 1) / items.length) * 100}%"></div>
				</div>
				<button class="close" onclick={cancelAll} disabled={saving} aria-label="Cancel">×</button>
			</header>

			<div class="wizard-body">
				<div class="preview">
					<img src={current.preview} alt="" />
					<span class="filename">{current.file.name}</span>
				</div>

				<div class="fields">
					<label>
						<span>What do you want to name this one?</span>
						<!-- svelte-ignore a11y_autofocus -->
						<input
							type="text"
							bind:value={current.title}
							disabled={saving}
							autofocus
							placeholder="Title"
							aria-invalid={titleError ? 'true' : undefined}
							oninput={() => (titleError = null)}
							onkeydown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									nextItem();
								}
							}}
						/>
						{#if titleError}
							<span class="field-error">{titleError}</span>
						{/if}
					</label>

					<label>
						<span>Medium</span>
						<input
							type="text"
							bind:value={current.medium}
							disabled={saving}
							placeholder="e.g. Oil on canvas, 24 x 36 in"
						/>
					</label>

					<label>
						<span>Description</span>
						<textarea bind:value={current.description} rows="2" disabled={saving}></textarea>
					</label>

					{#if collections.length > 0}
						<div class="tags">
							<span class="tags-label">Collections</span>
							<div class="chips">
								{#each collections as c (c.id)}
									<button
										type="button"
										class="chip"
										class:on={current.collectionIds.includes(c.id)}
										disabled={saving}
										onclick={() => toggleCollection(c.id)}
									>
										{c.name}
									</button>
								{/each}
							</div>
						</div>
					{/if}

					<label class="check">
						<input type="checkbox" bind:checked={current.avail} disabled={saving} />
						<span>Available for purchase</span>
					</label>

					{#if saveError}
						<p class="error">{saveError}</p>
					{/if}
				</div>
			</div>

			<footer class="wizard-foot">
				<button class="ghost" onclick={back} disabled={index === 0 || saving}>Back</button>
				<button class="ghost" onclick={skip} disabled={saving}>Skip this photo</button>
				<button class="primary" onclick={nextItem} disabled={saving}>
					{#if saving}
						Uploading…
					{:else if isLast}
						Save all ({pending.length})
					{:else}
						Save &amp; next
					{/if}
				</button>
			</footer>
		</div>
	</div>
{/if}

{#if saving}
	<div class="upload-overlay" role="status" aria-live="polite">
		<div class="upload-card">
			<div class="spinner" aria-hidden="true"></div>
			<p class="upload-title">
				Uploading painting {Math.min(runDone + 1, runTotal)} of {runTotal}
			</p>
			{#if progress}
				<p class="upload-sub">
					{progress.phase === 'processing' ? 'Preparing image' : 'Uploading image'}
				</p>
			{/if}
			<div class="bar">
				<div class="bar-fill" style="width: {runTotal ? (runDone / runTotal) * 100 : 0}%"></div>
			</div>
			<p class="upload-hint">Please don't close this tab.</p>
		</div>
	</div>
{/if}

<style>
	.bulk {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.bulk.compact {
		display: contents;
	}

	.lead {
		margin: 0;
		color: #666;
		font-size: 0.9rem;
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

	/* ---- wizard ---- */
	.wizard-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(20, 18, 14, 0.62);
		backdrop-filter: blur(3px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1050;
		padding: calc(1rem + env(safe-area-inset-top)) 1rem calc(1rem + env(safe-area-inset-bottom));
		animation: fade-in 180ms ease both;
	}

	.wizard {
		background: #fff;
		border-radius: 12px;
		width: 100%;
		max-width: 880px;
		max-height: 92dvh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		box-shadow: 0 24px 60px -18px rgba(0, 0, 0, 0.45);
		animation: card-in 260ms cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	.wizard-head {
		position: relative;
		padding: 1rem 3rem 0.85rem 1.5rem;
		border-bottom: 1px solid #ebe7df;
	}

	.steps {
		font-size: 0.8rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #999;
		margin-bottom: 0.6rem;
	}

	.skipped-note {
		color: #bbb;
		text-transform: none;
		letter-spacing: normal;
	}

	.bar {
		height: 4px;
		background: #ebe7df;
		border-radius: 999px;
		overflow: hidden;
	}

	.bar-fill {
		height: 100%;
		background: #c8a571;
		transition: width 250ms ease;
	}

	.close {
		position: absolute;
		top: 0.85rem;
		right: 1rem;
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		border: 1px solid #e0dcd4;
		background: #fff;
		font-size: 1.2rem;
		line-height: 1;
		cursor: pointer;
		color: #666;
		padding: 0;
	}

	.close:hover:not(:disabled) {
		background: #faf9f6;
		color: #1a1a1a;
	}

	.wizard-body {
		display: grid;
		grid-template-columns: 300px 1fr;
		gap: 1.5rem;
		padding: 1.5rem;
		overflow-y: auto;
	}

	.preview {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
	}

	.preview img {
		width: 100%;
		aspect-ratio: 1;
		object-fit: contain;
		background: #f4f2ee;
		border: 1px solid #ebe7df;
		border-radius: 8px;
		display: block;
	}

	.filename {
		font-size: 0.72rem;
		color: #aaa;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.fields {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		min-width: 0;
	}

	.fields label {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.78rem;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.fields input[type='text'],
	.fields textarea {
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

	.fields input:focus,
	.fields textarea:focus {
		outline: none;
		border-color: #1a1a1a;
	}

	.fields input[aria-invalid='true'] {
		border-color: #b00;
	}

	.fields textarea {
		resize: vertical;
	}

	.field-error {
		color: #b00;
		font-size: 0.78rem;
		text-transform: none;
		letter-spacing: normal;
	}

	.tags {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.tags-label {
		font-size: 0.78rem;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.chip {
		border: 1px solid #ded8cc;
		background: #fff;
		border-radius: 999px;
		padding: 0.35rem 0.85rem;
		font: 500 0.82rem -apple-system, sans-serif;
		color: #666;
		cursor: pointer;
		transition: all 120ms ease;
	}

	.chip:hover:not(:disabled) {
		border-color: #c8a571;
		color: #1a1a1a;
	}

	.chip.on {
		background: #1a2942;
		border-color: #1a2942;
		color: #fff;
	}

	.check {
		flex-direction: row !important;
		align-items: center;
		gap: 0.5rem !important;
		text-transform: none !important;
		letter-spacing: normal !important;
		font-size: 0.9rem !important;
		color: #444 !important;
		cursor: pointer;
	}

	.check input {
		width: 1rem;
		height: 1rem;
		accent-color: #1a2942;
	}

	.error {
		color: #b00;
		font-size: 0.88rem;
		margin: 0;
	}

	.wizard-foot {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 1rem 1.5rem;
		border-top: 1px solid #ebe7df;
		background: #fbfaf7;
	}

	.wizard-foot .primary {
		margin-left: auto;
		padding: 0.65rem 1.5rem;
		background: #1a1a1a;
		color: #fff;
		border: none;
		border-radius: 999px;
		cursor: pointer;
		font: 500 0.92rem -apple-system, sans-serif;
		transition: background 120ms ease;
	}

	.wizard-foot .primary:hover:not(:disabled) {
		background: #333;
	}

	.wizard-foot .ghost {
		padding: 0.6rem 1.1rem;
		background: #fff;
		border: 1px solid #d6d2c8;
		border-radius: 999px;
		cursor: pointer;
		font: 500 0.88rem -apple-system, sans-serif;
		color: #555;
		transition: all 120ms ease;
	}

	.wizard-foot .ghost:hover:not(:disabled) {
		background: #f5f3ee;
		border-color: #333;
		color: #1a1a1a;
	}

	.wizard-foot button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
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
		z-index: 1100;
		padding: 1rem;
		animation: fade-in 180ms ease both;
	}

	.upload-card {
		background: #fff;
		border-radius: 12px;
		padding: 2rem 2.25rem;
		max-width: 360px;
		width: 100%;
		text-align: center;
		box-shadow: 0 20px 50px -10px rgba(0, 0, 0, 0.3);
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
		margin: 0 0 0.35rem;
		font-weight: 500;
		color: #1a1a1a;
	}

	.upload-sub {
		margin: 0 0 0.85rem;
		font-size: 0.82rem;
		color: #888;
	}

	.upload-hint {
		margin: 0.85rem 0 0;
		font-size: 0.8rem;
		color: #888;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
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

	@media (max-width: 700px) {
		.wizard-body {
			grid-template-columns: 1fr;
			gap: 1rem;
			padding: 1rem;
		}
		.preview img {
			aspect-ratio: 4 / 3;
		}
		.wizard-foot {
			padding: 0.85rem 1rem;
			flex-wrap: wrap;
		}
		.wizard-foot .primary {
			width: 100%;
			margin-left: 0;
			order: -1;
		}
	}
</style>
