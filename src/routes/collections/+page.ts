import { fetchCollections, fetchPaintings } from '$lib/queries';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [{ paintings, error }, collections] = await Promise.all([
		fetchPaintings(),
		fetchCollections()
	]);

	return { paintings, collections, error };
};
