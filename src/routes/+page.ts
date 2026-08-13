import { supabase } from '$lib/supabase';
import { fetchSiteSettings } from '$lib/queries';
import type { Painting } from '$lib/types';
import type { PageLoad } from './$types';

const COLUMNS = 'id, title, medium, description, images, dimensions, avail, created_at';

export const load: PageLoad = async () => {
	const settings = await fetchSiteSettings();

	if (settings.featured_mode === 'manual' && settings.featured_painting_id) {
		const { data } = await supabase
			.from('paintings')
			.select(COLUMNS)
			.eq('id', settings.featured_painting_id)
			.maybeSingle();

		// Fall through to "latest" if the chosen painting was deleted.
		if (data) return { featured: { ...data, collection_ids: [] } as Painting };
	}

	const { data } = await supabase
		.from('paintings')
		.select(COLUMNS)
		.order('created_at', { ascending: false })
		.limit(1);

	return {
		featured: data?.[0] ? ({ ...data[0], collection_ids: [] } as Painting) : null
	};
};
