import { supabase } from './supabase';
import type { ImageDimension } from './types';

const BUCKET = 'paintings';
const MAX_DIM = 2400; // px — preserves print-detail quality, ~10x smaller than phone originals
const QUALITY = 0.9;
const CACHE_CONTROL = '31536000'; // 1 year — images are content-addressed via uuid, safe to cache forever

type ProcessedImage = {
	blob: Blob;
	width: number;
	height: number;
	contentType: string;
	ext: string;
};

function loadImage(file: File): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(url);
			resolve(img);
		};
		img.onerror = (e) => {
			URL.revokeObjectURL(url);
			reject(e);
		};
		img.src = url;
	});
}

async function processImage(file: File): Promise<ProcessedImage> {
	const img = await loadImage(file);
	const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
	const width = Math.round(img.naturalWidth * scale);
	const height = Math.round(img.naturalHeight * scale);

	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Canvas 2D context unavailable');
	ctx.drawImage(img, 0, 0, width, height);

	const blob = await new Promise<Blob>((resolve, reject) => {
		canvas.toBlob(
			(b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
			'image/webp',
			QUALITY
		);
	});

	return { blob, width, height, contentType: 'image/webp', ext: 'webp' };
}

export type UploadProgress = {
	current: number;
	total: number;
	phase: 'processing' | 'uploading';
};

export async function uploadImages(
	files: File[],
	onProgress?: (p: UploadProgress) => void
): Promise<{ urls: string[]; dimensions: ImageDimension[] }> {
	const folder = crypto.randomUUID();
	const urls: string[] = [];
	const dimensions: ImageDimension[] = [];

	for (let i = 0; i < files.length; i++) {
		onProgress?.({ current: i + 1, total: files.length, phase: 'processing' });
		const processed = await processImage(files[i]);

		onProgress?.({ current: i + 1, total: files.length, phase: 'uploading' });
		const path = `${folder}/${crypto.randomUUID()}.${processed.ext}`;

		const { error } = await supabase.storage.from(BUCKET).upload(path, processed.blob, {
			contentType: processed.contentType,
			cacheControl: CACHE_CONTROL,
			upsert: false
		});
		if (error) throw error;

		const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
		urls.push(data.publicUrl);
		dimensions.push({ w: processed.width, h: processed.height });
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
