import { z } from 'astro/zod';
import { slug } from 'github-slugger';

const date = z.union([z.string().trim().min(1), z.date()]).pipe(z.coerce.date());
export const blogMetadata = z.object({
	title: z.string().trim().min(1, 'title must not be empty'),
	description: z.string().trim().min(1, 'description must not be empty'),
	pubDate: date,
	updatedDate: date.optional(),
	tags: z.array(z.string().trim().min(1)).default([]).transform((tags) => [...new Set(tags)]),
	slug: z.string().trim().min(1).refine((value) =>
		!/[?#\\]/.test(value) && value.split('/').every((part) => part && part !== '.' && part !== '..'),
		'slug must be a relative path without empty segments, .., ? or #').optional(),
});

// Shared by the loader and checks so coverage checks follow the actual URLs.
export function getBlogId(entry, data = {}) {
	return data.slug ?? entry.replace(/\.(md|mdx)$/, '').split('/').map((part) => slug(part)).join('/').replace(/\/index$/, '');
}
