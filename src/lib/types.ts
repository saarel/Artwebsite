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
	/** Ids of every collection this painting is tagged into. */
	collection_ids: string[];
};

export type Collection = {
	id: string;
	name: string;
	slug: string;
	description: string | null;
	/** Manually chosen cover. When null the newest painting in the collection is used. */
	cover_url: string | null;
	position: number;
	created_at?: string;
};

export type FeaturedMode = 'latest' | 'manual';

export type SiteSettings = {
	featured_mode: FeaturedMode;
	featured_painting_id: string | null;
};

export type InquiryType = 'inquiry' | 'commission';

export type Inquiry = {
	id: string;
	painting_id: string | null;
	type: InquiryType;
	first_name: string;
	last_name: string;
	email: string;
	phone: string;
	message: string;
	read_at: string | null;
	created_at: string;
	painting?: { id: string; title: string } | null;
};
