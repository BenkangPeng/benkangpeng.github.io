import { checkContent, report } from './site-checks.mjs';
const { errors, posts } = checkContent('src/content/blog');
report(errors, `Content check passed: ${posts.length} Markdown/MDX articles.`);
