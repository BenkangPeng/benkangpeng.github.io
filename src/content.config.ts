import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { blogMetadata, getBlogId } from './content/blog-metadata.mjs';

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}', generateId: ({ entry, data }) => getBlogId(entry, data) }),
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		blogMetadata.extend({
			heroImage: z.optional(image()),
		}),
});

export const collections = { blog };
