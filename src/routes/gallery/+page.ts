import { supabase } from '$lib/supabase';
import type { Painting } from '$lib/types';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const { data, error } = await supabase
		.from('paintings')
		.select('id, title, medium, description, images, dimensions, avail, created_at')
		.order('created_at', { ascending: false });

	return {
		paintings: (data ?? []) as Painting[],
		error: error?.message ?? null
	};
};
