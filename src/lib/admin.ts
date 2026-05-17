import { supabase } from './supabase';
import type { ImageDimension } from './types';

const BUCKET = 'paintings';

function readDimensions(file: File): Promise<ImageDimension> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => {
			resolve({ w: img.naturalWidth, h: img.naturalHeight });
			URL.revokeObjectURL(url);
		};
		img.onerror = (e) => {
			URL.revokeObjectURL(url);
			reject(e);
		};
		img.src = url;
	});
}

export async function uploadImages(
	files: File[]
): Promise<{ urls: string[]; dimensions: ImageDimension[] }> {
	const folder = crypto.randomUUID();
	const urls: string[] = [];
	const dimensions: ImageDimension[] = [];

	for (const file of files) {
		const dim = await readDimensions(file).catch(() => ({ w: 0, h: 0 }));

		const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
		const path = `${folder}/${crypto.randomUUID()}.${ext}`;

		const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
			contentType: file.type,
			upsert: false
		});
		if (error) throw error;

		const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
		urls.push(data.publicUrl);
		dimensions.push(dim);
	}

	return { urls, dimensions };
}

export async function deleteImagesByUrl(urls: string[]): Promise<void> {
	const paths = urls
		.map((u) => u.match(/\/storage\/v1\/object\/public\/paintings\/(.+)$/)?.[1])
		.filter((p): p is string => !!p);
	if (paths.length === 0) return;
	await supabase.storage.from(BUCKET).remove(paths);
}
