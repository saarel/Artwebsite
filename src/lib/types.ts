export type ImageDimension = { w: number; h: number };

export type Painting = {
	id: string;
	title: string;
	medium: string;
	description: string | null;
	images: string[];
	dimensions: ImageDimension[];
	avail: boolean;
	created_at?: string;
};

export type Inquiry = {
	id: string;
	painting_id: string;
	first_name: string;
	last_name: string;
	email: string;
	phone: string;
	message: string;
	read_at: string | null;
	created_at: string;
	painting?: { id: string; title: string } | null;
};
