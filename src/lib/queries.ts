import { supabase } from './supabase';
import type { Collection, Painting, SiteSettings } from './types';

const PAINTING_COLUMNS = 'id, title, medium, description, images, dimensions, avail, created_at';
const PAINTING_SELECT = `${PAINTING_COLUMNS}, painting_collections(collection_id)`;

type PaintingRow = Omit<Painting, 'collection_ids'> & {
	painting_collections?: { collection_id: string }[] | null;
};

function normalize(rows: PaintingRow[] | null): Painting[] {
	return (rows ?? []).map(({ painting_collections, ...rest }) => ({
		...rest,
		collection_ids: (painting_collections ?? []).map((pc) => pc.collection_id)
	}));
}

/**
 * Every painting, newest first, with its collection tags.
 *
 * Falls back to a tag-less query if the collections migration hasn't been run
 * yet — better a gallery without collections than a gallery that won't load.
 */
export async function fetchPaintings(): Promise<{ paintings: Painting[]; error: string | null }> {
	const { data, error } = await supabase
		.from('paintings')
		.select(PAINTING_SELECT)
		.order('created_at', { ascending: false });

	if (!error) return { paintings: normalize(data as PaintingRow[]), error: null };

	const fallback = await supabase
		.from('paintings')
		.select(PAINTING_COLUMNS)
		.order('created_at', { ascending: false });

	return {
		paintings: normalize(fallback.data as PaintingRow[]),
		error: fallback.error?.message ?? null
	};
}

/** Collections in display order. Returns [] if the migration hasn't been run. */
export async function fetchCollections(): Promise<Collection[]> {
	const { data, error } = await supabase
		.from('collections')
		.select('id, name, slug, description, cover_url, position, created_at')
		.order('position', { ascending: true })
		.order('created_at', { ascending: true });

	if (error) return [];
	return (data ?? []) as Collection[];
}

/** The About page feature setting. Defaults to "latest" if unset or missing. */
export async function fetchSiteSettings(): Promise<SiteSettings> {
	const { data, error } = await supabase
		.from('site_settings')
		.select('featured_mode, featured_painting_id')
		.eq('id', 1)
		.maybeSingle();

	if (error || !data) return { featured_mode: 'latest', featured_painting_id: null };
	return data as SiteSettings;
}

/** Paintings tagged into a collection, newest first. */
export function paintingsInCollection(paintings: Painting[], collectionId: string): Painting[] {
	return paintings.filter((p) => p.collection_ids.includes(collectionId));
}

/** Manual cover if set, otherwise the newest tagged painting's first image. */
export function collectionCover(collection: Collection, paintings: Painting[]): string | null {
	if (collection.cover_url) return collection.cover_url;
	const members = paintingsInCollection(paintings, collection.id);
	return members.find((p) => p.images?.[0])?.images[0] ?? null;
}

export function slugify(name: string): string {
	return name
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60);
}

/** Appends -2, -3, … until the slug is unique among `taken`. */
export function uniqueSlug(name: string, taken: string[]): string {
	const base = slugify(name) || 'collection';
	if (!taken.includes(base)) return base;
	let n = 2;
	while (taken.includes(`${base}-${n}`)) n++;
	return `${base}-${n}`;
}
