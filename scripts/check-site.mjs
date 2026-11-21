import { checkContent, checkSite, report } from './site-checks.mjs';
const { errors, posts } = checkContent('src/content/blog');
report([...errors, ...checkSite('dist', posts)], `Site check passed: all ${posts.length} articles are built, listed and in RSS; local links/assets and anchors exist.`);
