import { supabase } from '$lib/supabase';
import type { Painting } from '$lib/types';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const { data } = await supabase
		.from('paintings')
		.select('id, title, medium, description, images, dimensions, sold, created_at')
		.order('created_at', { ascending: false })
		.limit(1);

	return {
		featured: (data?.[0] ?? null) as Painting | null
	};
};
