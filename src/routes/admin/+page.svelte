<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import {
		uploadImages,
		deleteImagesByUrl,
		setPaintingCollections,
		type UploadProgress
	} from '$lib/admin';
	import { fetchCollections, fetchPaintings, fetchSiteSettings, uniqueSlug } from '$lib/queries';
	import BulkUpload from '$lib/BulkUpload.svelte';
	import Modal from '$lib/Modal.svelte';
	import type { Collection, FeaturedMode, Painting, Inquiry } from '$lib/types';

	type Tab = 'paintings' | 'collections' | 'inquiries';

	// --- data ---
	let paintings = $state<Painting[]>([]);
	let collections = $state<Collection[]>([]);
	let inquiries = $state<Inquiry[]>([]);
	let loading = $state(true);
	let loadError = $state<string | null>(null);

	let tab = $state<Tab>('paintings');
	let search = $state('');
	let inquiryFilter = $state<'all' | 'unread'>('all');

	// --- shared upload progress ---
	let progress = $state<UploadProgress | null>(null);

	// --- toast ---
	let toast = $state<{ message: string; kind: 'success' | 'error' } | null>(null);
	let toastTimer: ReturnType<typeof setTimeout> | null = null;

	function showToast(message: string, kind: 'success' | 'error' = 'success') {
		toast = { message, kind };
		if (toastTimer) clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = null), 3500);
	}

	// --- confirm dialog ---
	let confirmState = $state<{
		title: string;
		message: string;
		label: string;
		run: () => Promise<void>;
	} | null>(null);
	let confirmBusy = $state(false);

	function askConfirm(title: string, message: string, label: string, run: () => Promise<void>) {
		confirmState = { title, message, label, run };
	}

	async function runConfirm() {
		if (!confirmState) return;
		confirmBusy = true;
		try {
			await confirmState.run();
			confirmState = null;
		} finally {
			confirmBusy = false;
		}
	}

	onMount(loadAll);

	async function loadAll() {
		loading = true;
		loadError = null;

		const [pRes, cRes, sRes, iRes] = await Promise.all([
			fetchPaintings(),
			fetchCollections(),
			fetchSiteSettings(),
			supabase
				.from('inquiries')
				.select(
					'id, painting_id, type, first_name, last_name, email, phone, message, read_at, created_at, painting:paintings(id, title)'
				)
				.is('archived_at', null)
				.order('created_at', { ascending: false })
		]);

		if (pRes.error) loadError = pRes.error;
		paintings = pRes.paintings;
		collections = cRes;
		featuredMode = sRes.featured_mode;
		featuredPaintingId = sRes.featured_painting_id;

		if (iRes.error) loadError = (loadError ? loadError + ' / ' : '') + iRes.error.message;
		else inquiries = (iRes.data ?? []) as unknown as Inquiry[];

		loading = false;
	}

	async function logout() {
		await supabase.auth.signOut();
		goto('/admin/login');
	}

	function toggleId(list: string[], id: string): string[] {
		return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
	}

	function previewUrl(file: File) {
		return URL.createObjectURL(file);
	}

	function formatDate(iso: string) {
		return new Date(iso).toLocaleString();
	}

	function collectionsFor(p: Painting) {
		return collections.filter((c) => p.collection_ids.includes(c.id));
	}

	function paintingsIn(collectionId: string) {
		return paintings.filter((p) => p.collection_ids.includes(collectionId));
	}

	const unreadCount = $derived(inquiries.filter((i) => !i.read_at).length);

	const visiblePaintings = $derived.by(() => {
		const q = search.trim().toLowerCase();
		if (!q) return paintings;
		return paintings.filter(
			(p) =>
				p.title.toLowerCase().includes(q) ||
				p.medium.toLowerCase().includes(q) ||
				collectionsFor(p).some((c) => c.name.toLowerCase().includes(q))
		);
	});

	const visibleInquiries = $derived(
		inquiryFilter === 'unread' ? inquiries.filter((i) => !i.read_at) : inquiries
	);

	// ============================================================
	// Add a painting
	// ============================================================
	let addOpen = $state(false);
	let newTitle = $state('');
	let newMedium = $state('');
	let newDescription = $state('');
	let newCollectionIds = $state<string[]>([]);
	let newFiles = $state<File[]>([]);
	let uploading = $state(false);
	let addError = $state<string | null>(null);

	function openAdd() {
		newTitle = '';
		newMedium = '';
		newDescription = '';
		newCollectionIds = [];
		newFiles = [];
		addError = null;
		addOpen = true;
	}

	function addNewFiles(e: Event) {
		const input = e.target as HTMLInputElement;
		if (!input.files?.length) return;
		newFiles = [...newFiles, ...Array.from(input.files)];
		input.value = '';
	}

	async function handleAdd(e: SubmitEvent) {
		e.preventDefault();
		if (!newTitle.trim()) {
			addError = 'Give the painting a title.';
			return;
		}
		if (newFiles.length === 0) {
			addError = 'Add at least one image.';
			return;
		}

		uploading = true;
		addError = null;

		try {
			const { urls, dimensions } = await uploadImages(newFiles, (p) => (progress = p));
			progress = null;

			const { data, error } = await supabase
				.from('paintings')
				.insert({
					title: newTitle.trim(),
					medium: newMedium.trim(),
					description: newDescription.trim() || null,
					images: urls,
					dimensions
				})
				.select('id')
				.single();
			if (error) throw error;

			if (newCollectionIds.length > 0 && data) {
				await setPaintingCollections(data.id, newCollectionIds);
			}

			addOpen = false;
			await loadAll();
			showToast(`"${newTitle.trim()}" added`);
		} catch (err) {
			addError = err instanceof Error ? err.message : String(err);
		} finally {
			uploading = false;
			progress = null;
		}
	}

	// ============================================================
	// Edit a painting
	// ============================================================
	let editingId = $state<string | null>(null);
	let editTitle = $state('');
	let editMedium = $state('');
	let editDescription = $state('');
	let editCollectionIds = $state<string[]>([]);
	let editAddFiles = $state<File[]>([]);
	let editSaving = $state(false);
	let editError = $state<string | null>(null);

	const editing = $derived(paintings.find((p) => p.id === editingId) ?? null);

	function openEdit(p: Painting) {
		editingId = p.id;
		editTitle = p.title;
		editMedium = p.medium;
		editDescription = p.description ?? '';
		editCollectionIds = [...p.collection_ids];
		editAddFiles = [];
		editError = null;
	}

	function addEditFiles(e: Event) {
		const input = e.target as HTMLInputElement;
		if (!input.files?.length) return;
		editAddFiles = [...editAddFiles, ...Array.from(input.files)];
		input.value = '';
	}

	async function saveEdit() {
		const p = editing;
		if (!p) return;

		editSaving = true;
		editError = null;

		try {
			let images = p.images;
			let dimensions = p.dimensions ?? [];
			if (editAddFiles.length > 0) {
				const { urls: addedUrls, dimensions: addedDims } = await uploadImages(
					editAddFiles,
					(x) => (progress = x)
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

			await setPaintingCollections(p.id, editCollectionIds);

			const savedCollectionIds = [...editCollectionIds];
			paintings = paintings.map((x) =>
				x.id === p.id
					? {
							...x,
							title: editTitle.trim(),
							medium: editMedium.trim(),
							description: editDescription.trim() || null,
							images,
							dimensions,
							collection_ids: savedCollectionIds
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

	function removeImage(p: Painting, url: string) {
		askConfirm('Remove image?', 'This deletes the file permanently.', 'Remove', async () => {
			const idx = p.images.indexOf(url);
			const remaining = p.images.filter((_, i) => i !== idx);
			const remainingDims = (p.dimensions ?? []).filter((_, i) => i !== idx);
			const { error } = await supabase
				.from('paintings')
				.update({ images: remaining, dimensions: remainingDims })
				.eq('id', p.id);
			if (error) {
				showToast('Update failed: ' + error.message, 'error');
				return;
			}
			await deleteImagesByUrl([url]);
			paintings = paintings.map((x) =>
				x.id === p.id ? { ...x, images: remaining, dimensions: remainingDims } : x
			);
			showToast('Image removed');
		});
	}

	function deletePainting(p: Painting) {
		askConfirm(
			`Delete "${p.title}"?`,
			'The painting and its images are removed for good. This cannot be undone.',
			'Delete',
			async () => {
				const { error } = await supabase.from('paintings').delete().eq('id', p.id);
				if (error) {
					showToast('Delete failed: ' + error.message, 'error');
					return;
				}
				await deleteImagesByUrl(p.images);
				paintings = paintings.filter((x) => x.id !== p.id);
				if (editingId === p.id) editingId = null;
				showToast(`"${p.title}" deleted`);
			}
		);
	}

	async function toggleAvail(p: Painting) {
		const newAvail = !p.avail;
		const { error } = await supabase.from('paintings').update({ avail: newAvail }).eq('id', p.id);
		if (error) {
			showToast('Update failed: ' + error.message, 'error');
			return;
		}
		paintings = paintings.map((x) => (x.id === p.id ? { ...x, avail: newAvail } : x));
		showToast(`"${p.title}" marked ${newAvail ? 'available' : 'no longer available'}`);
	}

	// ============================================================
	// Collections
	// ============================================================
	let collectionModal = $state<{ mode: 'new' | 'edit'; id: string | null } | null>(null);
	let cName = $state('');
	let cDescription = $state('');
	let cCover = $state('');
	let collectionSaving = $state(false);
	let collectionError = $state<string | null>(null);

	const editingCollection = $derived(
		collectionModal?.id ? (collections.find((c) => c.id === collectionModal!.id) ?? null) : null
	);

	function openNewCollection() {
		cName = '';
		cDescription = '';
		cCover = '';
		collectionError = null;
		collectionModal = { mode: 'new', id: null };
	}

	function openEditCollection(c: Collection) {
		cName = c.name;
		cDescription = c.description ?? '';
		cCover = c.cover_url ?? '';
		collectionError = null;
		collectionModal = { mode: 'edit', id: c.id };
	}

	async function saveCollection() {
		const name = cName.trim();
		if (!name) {
			collectionError = 'Give the collection a name.';
			return;
		}

		collectionSaving = true;
		collectionError = null;

		if (collectionModal?.mode === 'new') {
			const { data, error } = await supabase
				.from('collections')
				.insert({
					name,
					slug: uniqueSlug(
						name,
						collections.map((c) => c.slug)
					),
					description: cDescription.trim() || null,
					position: collections.length
				})
				.select('id, name, slug, description, cover_url, position, created_at')
				.single();

			collectionSaving = false;
			if (error) {
				collectionError = error.message;
				return;
			}
			collections = [...collections, data as Collection];
			collectionModal = null;
			showToast(`Collection "${name}" created`);
			return;
		}

		const c = editingCollection;
		if (!c) {
			collectionSaving = false;
			return;
		}

		// Keep the slug (and any shared links) stable unless the name changed.
		const slug =
			name === c.name
				? c.slug
				: uniqueSlug(
						name,
						collections.filter((x) => x.id !== c.id).map((x) => x.slug)
					);

		const patch = {
			name,
			slug,
			description: cDescription.trim() || null,
			cover_url: cCover || null
		};

		const { error } = await supabase.from('collections').update(patch).eq('id', c.id);
		collectionSaving = false;

		if (error) {
			collectionError = error.message;
			return;
		}

		collections = collections.map((x) => (x.id === c.id ? { ...x, ...patch } : x));
		collectionModal = null;
		showToast(`"${name}" updated`);
	}

	function deleteCollection(c: Collection) {
		const count = paintingsIn(c.id).length;
		askConfirm(
			`Delete "${c.name}"?`,
			count
				? `The ${count} painting${count === 1 ? '' : 's'} in it stay in your gallery — they just lose this tag.`
				: 'This collection is empty.',
			'Delete',
			async () => {
				const { error } = await supabase.from('collections').delete().eq('id', c.id);
				if (error) {
					showToast('Delete failed: ' + error.message, 'error');
					return;
				}
				collections = collections.filter((x) => x.id !== c.id);
				paintings = paintings.map((p) => ({
					...p,
					collection_ids: p.collection_ids.filter((id) => id !== c.id)
				}));
				if (collectionModal?.id === c.id) collectionModal = null;
				showToast(`"${c.name}" deleted`);
			}
		);
	}

	async function moveCollection(c: Collection, direction: -1 | 1) {
		const i = collections.findIndex((x) => x.id === c.id);
		const j = i + direction;
		if (i < 0 || j < 0 || j >= collections.length) return;

		const reordered = [...collections];
		[reordered[i], reordered[j]] = [reordered[j], reordered[i]];
		collections = reordered.map((x, idx) => ({ ...x, position: idx }));

		const { error } = await supabase.from('collections').upsert(
			collections.map((x) => ({
				id: x.id,
				name: x.name,
				slug: x.slug,
				position: x.position
			}))
		);
		if (error) {
			showToast('Reorder failed: ' + error.message, 'error');
			await loadAll();
		}
	}

	// ============================================================
	// About page image
	// ============================================================
	let featuredOpen = $state(false);
	let featuredMode = $state<FeaturedMode>('latest');
	let featuredPaintingId = $state<string | null>(null);
	let featuredSaving = $state(false);
	let featuredError = $state<string | null>(null);

	const featuredPainting = $derived(
		featuredMode === 'manual'
			? (paintings.find((p) => p.id === featuredPaintingId) ?? null)
			: (paintings[0] ?? null)
	);

	async function saveFeatured() {
		if (featuredMode === 'manual' && !featuredPaintingId) {
			featuredError = 'Pick a painting, or switch back to "latest".';
			return;
		}

		featuredSaving = true;
		featuredError = null;

		const { error } = await supabase
			.from('site_settings')
			.update({
				featured_mode: featuredMode,
				featured_painting_id: featuredMode === 'manual' ? featuredPaintingId : null,
				updated_at: new Date().toISOString()
			})
			.eq('id', 1);

		featuredSaving = false;

		if (error) {
			featuredError = error.message;
			return;
		}
		featuredOpen = false;
		showToast(
			featuredMode === 'latest' ? 'About page follows your latest painting' : 'About page image set'
		);
	}

	// ============================================================
	// Inquiries
	// ============================================================
	let openInquiryId = $state<string | null>(null);
	const openInquiry = $derived(inquiries.find((i) => i.id === openInquiryId) ?? null);

	async function showInquiry(inq: Inquiry) {
		openInquiryId = inq.id;
		if (!inq.read_at) {
			const now = new Date().toISOString();
			const { error } = await supabase.from('inquiries').update({ read_at: now }).eq('id', inq.id);
			if (!error) {
				inquiries = inquiries.map((x) => (x.id === inq.id ? { ...x, read_at: now } : x));
			}
		}
	}

	async function markUnread(inq: Inquiry) {
		const { error } = await supabase.from('inquiries').update({ read_at: null }).eq('id', inq.id);
		if (!error) {
			inquiries = inquiries.map((x) => (x.id === inq.id ? { ...x, read_at: null } : x));
			openInquiryId = null;
			showToast('Marked unread');
		}
	}

	function archiveInquiry(inq: Inquiry) {
		askConfirm(
			'Remove this inquiry?',
			`From ${inq.first_name} ${inq.last_name}. It's hidden from this list but kept in the database.`,
			'Remove',
			async () => {
				const { error } = await supabase
					.from('inquiries')
					.update({ archived_at: new Date().toISOString() })
					.eq('id', inq.id);
				if (error) {
					showToast('Failed to remove: ' + error.message, 'error');
					return;
				}
				inquiries = inquiries.filter((x) => x.id !== inq.id);
				openInquiryId = null;
				showToast('Inquiry removed');
			}
		);
	}

	function mailtoFor(inq: Inquiry) {
		const subject =
			inq.type === 'commission'
				? 'Re: your commission request'
				: `Re: ${inq.painting?.title ?? 'your inquiry'}`;
		return `mailto:${inq.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`Hi ${inq.first_name},\n\n`)}`;
	}
</script>

<svelte:head>
	<title>Admin · Art By Grigory Orenbakh</title>
</svelte:head>

<header class="topbar">
	<div class="brand">
		<h1>Admin</h1>
		<a href="/" class="view-site">View site →</a>
	</div>
	<button class="logout" onclick={logout}>Sign out</button>
</header>

<nav class="tabs" aria-label="Admin sections">
	<button class="tab" class:active={tab === 'paintings'} onclick={() => (tab = 'paintings')}>
		Paintings <span class="pill">{paintings.length}</span>
	</button>
	<button class="tab" class:active={tab === 'collections'} onclick={() => (tab = 'collections')}>
		Collections <span class="pill">{collections.length}</span>
	</button>
	<button class="tab" class:active={tab === 'inquiries'} onclick={() => (tab = 'inquiries')}>
		Inquiries
		{#if unreadCount > 0}
			<span class="pill alert">{unreadCount} new</span>
		{:else}
			<span class="pill">{inquiries.length}</span>
		{/if}
	</button>
</nav>

<main>
	{#if loading}
		<p class="muted">Loading…</p>
	{:else if loadError}
		<p class="error">{loadError}</p>
	{:else if tab === 'paintings'}
		<!-- ============= PAINTINGS ============= -->
		<div class="toolbar">
			<button class="primary" onclick={openAdd}>+ Add painting</button>
			<BulkUpload {collections} ondone={loadAll} ontoast={showToast} compact />
			<input
				class="search"
				type="search"
				bind:value={search}
				placeholder="Search title, medium, collection…"
			/>
			<button class="ghost push-right" onclick={() => (featuredOpen = true)}>
				About page image
			</button>
		</div>

		{#if paintings.length === 0}
			<div class="empty">
				<p>No paintings yet.</p>
				<p class="hint">Use “Add painting” for one, or “Bulk upload” for a whole batch.</p>
			</div>
		{:else if visiblePaintings.length === 0}
			<div class="empty"><p>Nothing matches “{search}”.</p></div>
		{:else}
			<div class="rows">
				{#each visiblePaintings as p, i (p.id)}
					<article class="row" class:dim={!p.avail} style="animation-delay: {Math.min(i, 8) * 35}ms">
						<div class="thumb">
							{#if p.images?.[0]}
								<img src={p.images[0]} alt="" loading="lazy" />
							{/if}
						</div>

						<div class="info">
							<div class="line1">
								<span class="name">{p.title}</span>
								<span class="status" class:unavailable={!p.avail}>
									{p.avail ? 'Available' : 'No longer available'}
								</span>
							</div>
							<div class="line2">{p.medium}</div>
							<div class="line3">
								<span>{p.images.length} image{p.images.length === 1 ? '' : 's'}</span>
								{#each collectionsFor(p) as c (c.id)}
									<span class="tag">{c.name}</span>
								{/each}
							</div>
						</div>

						<div class="row-actions">
							<button onclick={() => openEdit(p)}>Edit</button>
							<button onclick={() => toggleAvail(p)}>
								{p.avail ? 'Mark unavailable' : 'Mark available'}
							</button>
							<button class="icon danger" onclick={() => deletePainting(p)} aria-label="Delete">
								<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
									<path
										d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6"
										fill="none"
										stroke="currentColor"
										stroke-width="1.8"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
								</svg>
							</button>
						</div>
					</article>
				{/each}
			</div>
		{/if}
	{:else if tab === 'collections'}
		<!-- ============= COLLECTIONS ============= -->
		<div class="toolbar">
			<button class="primary" onclick={openNewCollection}>+ New collection</button>
			<p class="toolbar-note">Tag paintings into a collection from each painting’s Edit screen.</p>
		</div>

		{#if collections.length === 0}
			<div class="empty">
				<p>No collections yet.</p>
				<p class="hint">Create one, then tag paintings into it.</p>
			</div>
		{:else}
			<div class="rows">
				{#each collections as c, i (c.id)}
					{@const members = paintingsIn(c.id)}
					{@const cover = c.cover_url ?? members.find((m) => m.images?.[0])?.images[0]}
					<article class="row" style="animation-delay: {Math.min(i, 8) * 35}ms">
						<div class="thumb wide">
							{#if cover}<img src={cover} alt="" loading="lazy" />{/if}
						</div>

						<div class="info">
							<div class="line1">
								<span class="name">{c.name}</span>
								<span class="status neutral">
									{members.length}
									{members.length === 1 ? 'piece' : 'pieces'}
								</span>
							</div>
							<div class="line2 slug">/collections/{c.slug}</div>
							{#if c.description}<div class="line3">{c.description}</div>{/if}
						</div>

						<div class="row-actions">
							<div class="reorder">
								<button
									class="icon"
									onclick={() => moveCollection(c, -1)}
									disabled={i === 0}
									aria-label="Move up">↑</button
								>
								<button
									class="icon"
									onclick={() => moveCollection(c, 1)}
									disabled={i === collections.length - 1}
									aria-label="Move down">↓</button
								>
							</div>
							<button onclick={() => openEditCollection(c)}>Edit</button>
							<a class="btn-link" href={`/collections/${c.slug}`} target="_blank">View</a>
							<button class="icon danger" onclick={() => deleteCollection(c)} aria-label="Delete">
								<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
									<path
										d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6"
										fill="none"
										stroke="currentColor"
										stroke-width="1.8"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
								</svg>
							</button>
						</div>
					</article>
				{/each}
			</div>
		{/if}
	{:else}
		<!-- ============= INQUIRIES ============= -->
		<div class="toolbar">
			<div class="segmented">
				<button class:on={inquiryFilter === 'all'} onclick={() => (inquiryFilter = 'all')}>
					All {inquiries.length}
				</button>
				<button class:on={inquiryFilter === 'unread'} onclick={() => (inquiryFilter = 'unread')}>
					Unread {unreadCount}
				</button>
			</div>
		</div>

		{#if visibleInquiries.length === 0}
			<div class="empty">
				<p>{inquiryFilter === 'unread' ? 'Nothing unread.' : 'No inquiries yet.'}</p>
				{#if inquiryFilter !== 'unread'}
					<p class="hint">Messages about a painting or a commission land here.</p>
				{/if}
			</div>
		{:else}
			<div class="rows">
				{#each visibleInquiries as inq, i (inq.id)}
					<button
						class="row inquiry"
						class:unread={!inq.read_at}
						style="animation-delay: {Math.min(i, 10) * 30}ms"
						onclick={() => showInquiry(inq)}
					>
						<span class="dot" aria-hidden="true"></span>
						<div class="info">
							<div class="line1">
								<span class="name">{inq.first_name} {inq.last_name}</span>
								<span class="type" class:commission={inq.type === 'commission'}>
									{inq.type === 'commission' ? 'Commission' : 'Inquiry'}
								</span>
							</div>
							<div class="line2">
								{inq.type === 'commission'
									? 'Custom commission request'
									: `re: ${inq.painting?.title ?? '(deleted painting)'}`}
							</div>
							<div class="line3 excerpt">{inq.message}</div>
						</div>
						<span class="when">{formatDate(inq.created_at)}</span>
					</button>
				{/each}
			</div>
		{/if}
	{/if}
</main>

<!-- ============= ADD PAINTING MODAL ============= -->
{#if addOpen}
	<Modal
		title="Add a painting"
		subtitle="One piece, with as many photos of it as you like."
		size="md"
		busy={uploading}
		onclose={() => (addOpen = false)}
	>
		<form id="add-form" class="form" onsubmit={handleAdd}>
			<label>
				<span>Title</span>
				<input type="text" bind:value={newTitle} disabled={uploading} />
			</label>
			<label>
				<span>Medium</span>
				<input
					type="text"
					bind:value={newMedium}
					disabled={uploading}
					placeholder="e.g. Oil on canvas, 24 x 36 in"
				/>
			</label>
			<label>
				<span>Description</span>
				<textarea bind:value={newDescription} rows="3" disabled={uploading}></textarea>
			</label>

			{#if collections.length > 0}
				<div class="field">
					<span class="field-label">Collections</span>
					<div class="chips">
						{#each collections as c (c.id)}
							<button
								type="button"
								class="chip"
								class:on={newCollectionIds.includes(c.id)}
								disabled={uploading}
								onclick={() => (newCollectionIds = toggleId(newCollectionIds, c.id))}
							>
								{c.name}
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<div class="field">
				<span class="field-label">Images</span>
				<div class="file-buttons">
					<label class="file-btn">
						Choose files
						<input
							type="file"
							accept="image/*"
							multiple
							disabled={uploading}
							onchange={addNewFiles}
						/>
					</label>
					<label class="file-btn">
						Take photo
						<input
							type="file"
							accept="image/*"
							capture="environment"
							disabled={uploading}
							onchange={addNewFiles}
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
									onclick={() => (newFiles = newFiles.filter((_, x) => x !== i))}
									disabled={uploading}
									aria-label="Remove">×</button
								>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			{#if addError}<p class="error">{addError}</p>{/if}
		</form>

		{#snippet footer()}
			<button class="ghost" onclick={() => (addOpen = false)} disabled={uploading}>Cancel</button>
			<button class="primary push-right" type="submit" form="add-form" disabled={uploading}>
				{uploading ? 'Uploading…' : 'Add painting'}
			</button>
		{/snippet}
	</Modal>
{/if}

<!-- ============= EDIT PAINTING MODAL ============= -->
{#if editing}
	<Modal
		title="Edit painting"
		subtitle={editing.title}
		size="lg"
		busy={editSaving}
		onclose={() => (editingId = null)}
	>
		<div class="form">
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

			{#if collections.length > 0}
				<div class="field">
					<span class="field-label">Collections</span>
					<div class="chips">
						{#each collections as c (c.id)}
							<button
								type="button"
								class="chip"
								class:on={editCollectionIds.includes(c.id)}
								disabled={editSaving}
								onclick={() => (editCollectionIds = toggleId(editCollectionIds, c.id))}
							>
								{c.name}
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<div class="field">
				<span class="field-label">Images</span>
				<div class="image-grid">
					{#each editing.images as img (img)}
						<div class="image-tile">
							<img src={img} alt="" />
							<button
								type="button"
								class="remove-img"
								onclick={() => removeImage(editing!, img)}
								disabled={editSaving}
								aria-label="Remove image">×</button
							>
						</div>
					{/each}
				</div>

				<div class="file-buttons">
					<label class="file-btn">
						Add more
						<input
							type="file"
							accept="image/*"
							multiple
							disabled={editSaving}
							onchange={addEditFiles}
						/>
					</label>
					<label class="file-btn">
						Take photo
						<input
							type="file"
							accept="image/*"
							capture="environment"
							disabled={editSaving}
							onchange={addEditFiles}
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
									onclick={() => (editAddFiles = editAddFiles.filter((_, x) => x !== i))}
									disabled={editSaving}
									aria-label="Remove">×</button
								>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			{#if editError}<p class="error">{editError}</p>{/if}
		</div>

		{#snippet footer()}
			<button class="danger-text" onclick={() => deletePainting(editing!)} disabled={editSaving}>
				Delete
			</button>
			<button class="ghost push-right" onclick={() => (editingId = null)} disabled={editSaving}>
				Cancel
			</button>
			<button class="primary" onclick={saveEdit} disabled={editSaving}>
				{editSaving ? 'Saving…' : 'Save changes'}
			</button>
		{/snippet}
	</Modal>
{/if}

<!-- ============= COLLECTION MODAL ============= -->
{#if collectionModal}
	<Modal
		title={collectionModal.mode === 'new' ? 'New collection' : 'Edit collection'}
		size="sm"
		busy={collectionSaving}
		onclose={() => (collectionModal = null)}
	>
		<div class="form">
			<label>
				<span>Name</span>
				<!-- svelte-ignore a11y_autofocus -->
				<input
					type="text"
					bind:value={cName}
					disabled={collectionSaving}
					autofocus
					placeholder="e.g. Judaica"
				/>
			</label>
			<label>
				<span>Description</span>
				<textarea
					bind:value={cDescription}
					rows="2"
					disabled={collectionSaving}
					placeholder="Shown under the collection title"
				></textarea>
			</label>

			{#if collectionModal.mode === 'edit' && editingCollection}
				<label>
					<span>Cover image</span>
					<select bind:value={cCover} disabled={collectionSaving}>
						<option value="">Newest painting in the collection</option>
						{#each paintingsIn(editingCollection.id) as m (m.id)}
							{#if m.images?.[0]}
								<option value={m.images[0]}>{m.title}</option>
							{/if}
						{/each}
					</select>
				</label>
			{/if}

			{#if collectionError}<p class="error">{collectionError}</p>{/if}
		</div>

		{#snippet footer()}
			<button class="ghost" onclick={() => (collectionModal = null)} disabled={collectionSaving}>
				Cancel
			</button>
			<button class="primary push-right" onclick={saveCollection} disabled={collectionSaving}>
				{collectionSaving ? 'Saving…' : collectionModal?.mode === 'new' ? 'Create' : 'Save'}
			</button>
		{/snippet}
	</Modal>
{/if}

<!-- ============= ABOUT PAGE IMAGE MODAL ============= -->
{#if featuredOpen}
	<Modal
		title="About page image"
		subtitle="The painting shown beside your bio on the home page."
		size="md"
		busy={featuredSaving}
		onclose={() => (featuredOpen = false)}
	>
		<div class="featured">
			<div class="form">
				<label class="radio">
					<input type="radio" bind:group={featuredMode} value="latest" disabled={featuredSaving} />
					<span>
						<strong>Use my latest painting</strong>
						<em>Updates itself every time you add a new piece.</em>
					</span>
				</label>
				<label class="radio">
					<input type="radio" bind:group={featuredMode} value="manual" disabled={featuredSaving} />
					<span>
						<strong>Pick one myself</strong>
						<em>Stays put until you change it.</em>
					</span>
				</label>

				{#if featuredMode === 'manual'}
					<label>
						<span>Painting</span>
						<select bind:value={featuredPaintingId} disabled={featuredSaving}>
							<option value={null}>Choose a painting…</option>
							{#each paintings as p (p.id)}
								<option value={p.id}>{p.title}</option>
							{/each}
						</select>
					</label>
				{/if}

				{#if featuredError}<p class="error">{featuredError}</p>{/if}
			</div>

			<div class="featured-preview">
				<span class="field-label">Currently showing</span>
				{#if featuredPainting?.images?.[0]}
					<img src={featuredPainting.images[0]} alt={featuredPainting.title} />
					<div class="featured-title">{featuredPainting.title}</div>
				{:else}
					<div class="featured-none">Nothing to show yet.</div>
				{/if}
			</div>
		</div>

		{#snippet footer()}
			<button class="ghost" onclick={() => (featuredOpen = false)} disabled={featuredSaving}>
				Cancel
			</button>
			<button class="primary push-right" onclick={saveFeatured} disabled={featuredSaving}>
				{featuredSaving ? 'Saving…' : 'Save'}
			</button>
		{/snippet}
	</Modal>
{/if}

<!-- ============= INQUIRY MODAL ============= -->
{#if openInquiry}
	<Modal
		title={`${openInquiry.first_name} ${openInquiry.last_name}`}
		subtitle={openInquiry.type === 'commission'
			? `Commission request · ${formatDate(openInquiry.created_at)}`
			: `re: ${openInquiry.painting?.title ?? '(deleted painting)'} · ${formatDate(openInquiry.created_at)}`}
		size="md"
		onclose={() => (openInquiryId = null)}
	>
		<div class="contact-grid">
			<div class="contact">
				<span class="field-label">Email</span>
				<a href={`mailto:${openInquiry.email}`}>{openInquiry.email}</a>
			</div>
			<div class="contact">
				<span class="field-label">Phone</span>
				<a href={`tel:${openInquiry.phone}`}>{openInquiry.phone}</a>
			</div>
		</div>
		<span class="field-label">Message</span>
		<p class="message">{openInquiry.message}</p>

		{#snippet footer()}
			<a class="primary as-link" href={mailtoFor(openInquiry!)}>Reply by email</a>
			<button class="ghost" onclick={() => markUnread(openInquiry!)}>Mark unread</button>
			<button class="danger-text push-right" onclick={() => archiveInquiry(openInquiry!)}>
				Remove
			</button>
		{/snippet}
	</Modal>
{/if}

<!-- ============= CONFIRM ============= -->
{#if confirmState}
	<Modal
		title={confirmState.title}
		size="sm"
		busy={confirmBusy}
		onclose={() => (confirmState = null)}
	>
		<p class="confirm-message">{confirmState.message}</p>

		{#snippet footer()}
			<button class="ghost" onclick={() => (confirmState = null)} disabled={confirmBusy}>
				Cancel
			</button>
			<button class="danger-solid push-right" onclick={runConfirm} disabled={confirmBusy}>
				{confirmBusy ? 'Working…' : confirmState?.label}
			</button>
		{/snippet}
	</Modal>
{/if}

<!-- ============= TOAST + UPLOAD PROGRESS ============= -->
{#if toast}
	<div class="toast" class:error-toast={toast.kind === 'error'} role="status" aria-live="polite">
		<span>{toast.message}</span>
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
		margin: 0;
	}

	/* ---------- chrome ---------- */
	.topbar {
		position: sticky;
		top: 0;
		z-index: 20;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.9rem 2rem;
		background: #fff;
		border-bottom: 1px solid #ebe7df;
	}

	.brand {
		display: flex;
		align-items: baseline;
		gap: 1.25rem;
	}

	h1 {
		font-family: Georgia, serif;
		font-weight: 400;
		margin: 0;
		font-size: 1.4rem;
		letter-spacing: 0.02em;
	}

	.view-site {
		color: #888;
		text-decoration: none;
		font-size: 0.85rem;
	}

	.view-site:hover {
		color: #1a1a1a;
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

	.tabs {
		position: sticky;
		top: 3.55rem;
		z-index: 19;
		display: flex;
		gap: 0.25rem;
		padding: 0 2rem;
		background: #fff;
		border-bottom: 1px solid #ebe7df;
		overflow-x: auto;
	}

	.tab {
		position: relative;
		background: none;
		border: none;
		padding: 0.75rem 0.9rem 0.7rem;
		cursor: pointer;
		font: 500 0.92rem -apple-system, sans-serif;
		color: #888;
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		white-space: nowrap;
		transition: color 140ms ease;
	}

	.tab:hover {
		color: #1a1a1a;
	}

	.tab.active {
		color: #1a2942;
	}

	.tab.active::after {
		content: '';
		position: absolute;
		left: 0.55rem;
		right: 0.55rem;
		bottom: -1px;
		height: 2px;
		background: #c8a571;
		border-radius: 2px 2px 0 0;
	}

	.pill {
		font-size: 0.7rem;
		font-weight: 600;
		padding: 0.1rem 0.5rem;
		border-radius: 999px;
		background: #f0ede6;
		color: #8a8272;
	}

	.tab.active .pill {
		background: #eef1f6;
		color: #1a2942;
	}

	.pill.alert {
		background: #c44;
		color: #fff;
	}

	main {
		max-width: 1000px;
		margin: 0 auto;
		padding: 1.5rem 2rem 4rem;
	}

	/* ---------- toolbar ---------- */
	.toolbar {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
		margin-bottom: 1.25rem;
	}

	.toolbar-note {
		margin: 0;
		font-size: 0.85rem;
		color: #999;
	}

	.search {
		flex: 1 1 220px;
		min-width: 160px;
		font: 400 0.92rem -apple-system, sans-serif;
		padding: 0.5rem 0.85rem;
		border: 1px solid #ded8cc;
		border-radius: 999px;
		background: #fff;
		color: #1a1a1a;
	}

	.search:focus {
		outline: none;
		border-color: #1a2942;
	}

	.push-right {
		margin-left: auto;
	}

	.segmented {
		display: inline-flex;
		background: #ece8e0;
		border-radius: 999px;
		padding: 0.18rem;
		gap: 0.15rem;
	}

	.segmented button {
		border: none;
		background: none;
		border-radius: 999px;
		padding: 0.35rem 0.9rem;
		cursor: pointer;
		font: 500 0.82rem -apple-system, sans-serif;
		color: #7d7668;
		transition: all 140ms ease;
	}

	.segmented button.on {
		background: #fff;
		color: #1a2942;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
	}

	/* ---------- buttons ---------- */
	.primary {
		padding: 0.55rem 1.2rem;
		background: #1a2942;
		color: #fff;
		border: none;
		border-radius: 999px;
		cursor: pointer;
		font: 500 0.9rem -apple-system, sans-serif;
		transition: background 120ms ease;
		white-space: nowrap;
	}

	.primary:hover:not(:disabled) {
		background: #26385a;
	}

	.as-link {
		display: inline-flex;
		align-items: center;
		text-decoration: none;
	}

	.ghost {
		padding: 0.55rem 1.1rem;
		background: #fff;
		border: 1px solid #d6d2c8;
		border-radius: 999px;
		cursor: pointer;
		font: 500 0.88rem -apple-system, sans-serif;
		color: #444;
		transition: all 120ms ease;
		white-space: nowrap;
	}

	.ghost:hover:not(:disabled) {
		border-color: #333;
		background: #faf9f6;
		color: #1a1a1a;
	}

	.danger-text {
		background: none;
		border: none;
		color: #b00;
		cursor: pointer;
		font: 500 0.88rem -apple-system, sans-serif;
		padding: 0.55rem 0.4rem;
	}

	.danger-text:hover:not(:disabled) {
		color: #800;
		text-decoration: underline;
	}

	.danger-solid {
		padding: 0.55rem 1.2rem;
		background: #b00;
		color: #fff;
		border: none;
		border-radius: 999px;
		cursor: pointer;
		font: 500 0.9rem -apple-system, sans-serif;
		transition: background 120ms ease;
	}

	.danger-solid:hover:not(:disabled) {
		background: #900;
	}

	button:disabled,
	.primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* ---------- rows ---------- */
	.rows {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.row {
		display: grid;
		grid-template-columns: 88px 1fr auto;
		gap: 1rem;
		align-items: center;
		padding: 0.75rem;
		border: 1px solid #ebe7df;
		border-radius: 10px;
		background: #fff;
		text-align: left;
		transition:
			border-color 150ms ease,
			box-shadow 150ms ease;
		animation: row-in 340ms cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	.row:hover {
		border-color: #d6d2c8;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
	}

	.row.dim {
		background: #fbfaf7;
	}

	@keyframes row-in {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.thumb {
		width: 88px;
		height: 88px;
		border-radius: 7px;
		overflow: hidden;
		background: #f2efe9;
	}

	.thumb.wide {
		height: 66px;
	}

	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.info {
		min-width: 0;
	}

	.line1 {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		flex-wrap: wrap;
		margin-bottom: 0.15rem;
	}

	.name {
		font-weight: 500;
		font-size: 1rem;
		color: #1a1a1a;
	}

	.status {
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.03em;
		padding: 0.15rem 0.6rem;
		border-radius: 999px;
		background: #e8f0e8;
		color: #2a5d2a;
		white-space: nowrap;
	}

	.status.unavailable {
		background: #f7e8d8;
		color: #8a4a14;
	}

	.status.neutral {
		background: #eef1f6;
		color: #1a2942;
	}

	.line2 {
		color: #777;
		font-style: italic;
		font-size: 0.88rem;
	}

	.line2.slug {
		font-style: normal;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.78rem;
		color: #a09684;
	}

	.line3 {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex-wrap: wrap;
		margin-top: 0.35rem;
		font-size: 0.78rem;
		color: #999;
	}

	.tag {
		font-size: 0.7rem;
		padding: 0.12rem 0.55rem;
		border-radius: 999px;
		background: #eef1f6;
		color: #1a2942;
	}

	.row-actions {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.row-actions button:not(.icon),
	.btn-link {
		font: 500 0.83rem -apple-system, sans-serif;
		padding: 0.42rem 0.9rem;
		border: 1px solid #ded8cc;
		background: #fff;
		border-radius: 999px;
		cursor: pointer;
		color: #444;
		text-decoration: none;
		transition: all 120ms ease;
		white-space: nowrap;
	}

	.row-actions button:not(.icon):hover,
	.btn-link:hover {
		border-color: #333;
		background: #faf9f6;
		color: #1a1a1a;
	}

	.icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border: 1px solid #ded8cc;
		background: #fff;
		border-radius: 50%;
		cursor: pointer;
		color: #666;
		padding: 0;
		transition: all 120ms ease;
	}

	.icon:hover:not(:disabled) {
		border-color: #999;
		color: #1a1a1a;
	}

	.icon.danger:hover:not(:disabled) {
		border-color: #b00;
		color: #b00;
		background: #fdf4f4;
	}

	.reorder {
		display: flex;
		gap: 0.2rem;
		margin-right: 0.2rem;
	}

	/* ---------- inquiries ---------- */
	.row.inquiry {
		grid-template-columns: 10px 1fr auto;
		width: 100%;
		border-width: 1px;
		cursor: pointer;
		font: inherit;
		align-items: start;
	}

	.row.inquiry.unread {
		background: #fff8e6;
		border-color: #ead89a;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: transparent;
		margin-top: 0.45rem;
	}

	.row.inquiry.unread .dot {
		background: #c44;
		box-shadow: 0 0 0 3px rgba(204, 68, 68, 0.15);
	}

	.type {
		font-size: 0.65rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		padding: 0.12rem 0.5rem;
		border-radius: 999px;
		background: #e8eef5;
		color: #1a4878;
	}

	.type.commission {
		background: #f4ebd9;
		color: #7a5a14;
	}

	.excerpt {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: #aaa;
	}

	.when {
		color: #aaa;
		font-size: 0.78rem;
		white-space: nowrap;
		padding-top: 0.15rem;
	}

	.contact-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		padding-bottom: 1rem;
		margin-bottom: 1rem;
		border-bottom: 1px solid #f0ecdc;
	}

	.contact {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}

	.contact a {
		color: #1a1a1a;
		text-decoration: none;
		font-size: 0.95rem;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.contact a:hover {
		text-decoration: underline;
		text-decoration-color: #c8a571;
		text-underline-offset: 3px;
	}

	.message {
		white-space: pre-wrap;
		line-height: 1.65;
		margin: 0.4rem 0 0;
		color: #2a2a2a;
		padding: 0.85rem 1rem;
		background: #faf9f6;
		border-radius: 8px;
		border-left: 3px solid #c8a571;
		font-size: 0.95rem;
	}

	.confirm-message {
		margin: 0;
		line-height: 1.6;
		color: #555;
	}

	/* ---------- forms (inside modals) ---------- */
	.form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.form :global(label),
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.form :global(label) > :global(span:first-child),
	.field-label {
		font-size: 0.75rem;
		color: #888;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-weight: 600;
	}

	input[type='text'],
	input[type='search'],
	textarea,
	select {
		font: 400 1rem/1.4 -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
		padding: 0.65rem 0.85rem;
		border: 1px solid #d6d2c8;
		border-radius: 8px;
		background: #fff;
		color: #1a1a1a;
	}

	input:focus,
	textarea:focus,
	select:focus {
		outline: none;
		border-color: #1a2942;
	}

	textarea {
		resize: vertical;
	}

	.radio {
		flex-direction: row;
		align-items: flex-start;
		gap: 0.65rem;
		cursor: pointer;
		padding: 0.75rem 1rem;
		border: 1px solid #ebe7df;
		border-radius: 10px;
		transition: border-color 120ms ease;
	}

	.radio:hover {
		border-color: #d6d2c8;
	}

	.radio input {
		margin-top: 0.2rem;
		accent-color: #1a2942;
		width: 1rem;
		height: 1rem;
	}

	.radio span {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.radio strong {
		font-weight: 500;
		font-size: 0.95rem;
	}

	.radio em {
		font-style: normal;
		font-size: 0.82rem;
		color: #999;
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

	.file-buttons {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.file-btn {
		display: inline-flex;
		align-items: center;
		padding: 0.5rem 1.1rem;
		border: 1px solid #d6d2c8;
		border-radius: 999px;
		cursor: pointer;
		background: #fff;
		font-size: 0.88rem;
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

	.pending li,
	.image-tile {
		position: relative;
		width: 84px;
		height: 84px;
		border-radius: 8px;
		overflow: hidden;
		background: #f5f3ee;
		border: 1px solid #ebe7df;
	}

	.pending img,
	.image-tile img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.pending button,
	.remove-img {
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

	.pending button:hover,
	.remove-img:hover {
		background: #000;
	}

	.image-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.featured {
		display: grid;
		grid-template-columns: 1fr 200px;
		gap: 1.5rem;
		align-items: start;
	}

	.featured-preview {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.featured-preview img {
		width: 100%;
		aspect-ratio: 4 / 5;
		object-fit: contain;
		background: #f5f3ee;
		border: 1px solid #ebe7df;
		border-radius: 8px;
	}

	.featured-title {
		font-size: 0.85rem;
		color: #666;
		font-style: italic;
	}

	.featured-none {
		padding: 2rem 1rem;
		text-align: center;
		color: #aaa;
		font-size: 0.85rem;
		background: #faf9f6;
		border: 1px dashed #e0dcd4;
		border-radius: 8px;
	}

	/* ---------- misc ---------- */
	.muted {
		color: #888;
	}

	.error {
		color: #b00;
		margin: 0;
		font-size: 0.9rem;
	}

	.empty {
		padding: 3rem 1rem;
		text-align: center;
		color: #a9a294;
		background: #fff;
		border: 1px dashed #e2ddd2;
		border-radius: 12px;
	}

	.empty p {
		margin: 0;
	}

	.empty .hint {
		font-size: 0.88rem;
		margin-top: 0.4rem;
		color: #bdb6a8;
	}

	.toast {
		position: fixed;
		top: 1.25rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 1200;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.7rem 0.85rem 0.7rem 1.1rem;
		background: #1a2942;
		color: #fff;
		border-radius: 999px;
		box-shadow: 0 6px 24px -8px rgba(0, 0, 0, 0.4);
		font-size: 0.9rem;
		animation: toast-in 300ms cubic-bezier(0.16, 1, 0.3, 1) both;
		max-width: calc(100vw - 2rem);
	}

	.toast.error-toast {
		background: #b00;
	}

	.toast-close {
		background: none;
		border: none;
		font-size: 1.15rem;
		line-height: 1;
		color: rgba(255, 255, 255, 0.7);
		cursor: pointer;
		padding: 0 0.2rem;
	}

	.toast-close:hover {
		color: #fff;
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

	.upload-overlay {
		position: fixed;
		inset: 0;
		background: rgba(20, 18, 14, 0.55);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1150;
		padding: 1rem;
	}

	.upload-card {
		background: #fff;
		border-radius: 12px;
		padding: 2rem 2.25rem;
		max-width: 340px;
		width: 100%;
		text-align: center;
		box-shadow: 0 20px 50px -10px rgba(0, 0, 0, 0.3);
	}

	.spinner {
		width: 40px;
		height: 40px;
		margin: 0 auto 1.15rem;
		border: 3px solid #ebe7df;
		border-top-color: #1a2942;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	.upload-title {
		margin: 0 0 0.85rem;
		font-weight: 500;
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
		background: #1a2942;
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

	/* ---------- responsive ---------- */
	@media (max-width: 700px) {
		.topbar {
			padding: 0.75rem 1rem;
		}
		.tabs {
			top: 3.2rem;
			padding: 0 0.5rem;
		}
		main {
			padding: 1rem 0.85rem 3rem;
		}
		.row {
			grid-template-columns: 64px 1fr;
			gap: 0.75rem;
		}
		.thumb {
			width: 64px;
			height: 64px;
		}
		.thumb.wide {
			height: 52px;
		}
		.row-actions {
			grid-column: 1 / -1;
			flex-wrap: wrap;
		}
		.row.inquiry {
			grid-template-columns: 10px 1fr;
		}
		.when {
			grid-column: 2;
			padding-top: 0.35rem;
		}
		.contact-grid {
			grid-template-columns: 1fr;
		}
		.featured {
			grid-template-columns: 1fr;
		}
		.featured-preview {
			max-width: 180px;
		}
		.search {
			order: 5;
			flex-basis: 100%;
		}
		.push-right {
			margin-left: 0;
		}
	}
</style>
