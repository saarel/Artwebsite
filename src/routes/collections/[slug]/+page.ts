import { error as kitError } from '@sveltejs/kit';
import { fetchCollections, fetchPaintings, paintingsInCollection } from '$lib/queries';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	const [{ paintings, error }, collections] = await Promise.all([
		fetchPaintings(),
		fetchCollections()
	]);

	const collection = collections.find((c) => c.slug === params.slug);
	if (!collection) kitError(404, 'Collection not found');

	return {
		collection,
		paintings: paintingsInCollection(paintings, collection.id),
		error
	};
};
