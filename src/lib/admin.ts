import { supabase } from './supabase';

const BUCKET = 'paintings';

export async function uploadImages(files: File[]): Promise<string[]> {
	const folder = crypto.randomUUID();
	const urls: string[] = [];

	for (const file of files) {
		const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
		const path = `${folder}/${crypto.randomUUID()}.${ext}`;

		const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
			contentType: file.type,
			upsert: false
		});
		if (error) throw error;

		const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
		urls.push(data.publicUrl);
	}

	return urls;
}

export async function deleteImagesByUrl(urls: string[]): Promise<void> {
	const paths = urls
		.map((u) => u.match(/\/storage\/v1\/object\/public\/paintings\/(.+)$/)?.[1])
		.filter((p): p is string => !!p);
	if (paths.length === 0) return;
	await supabase.storage.from(BUCKET).remove(paths);
}
