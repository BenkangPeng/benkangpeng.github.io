import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter } from '@astrojs/markdown-remark';
import { parse } from 'parse5';
import { blogMetadata, getBlogId } from '../src/content/blog-metadata.mjs';

export function filesUnder(root) {
	return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
		const file = path.join(root, entry.name);
		return entry.isDirectory() ? filesUnder(file) : [file];
	}).sort();
}

export function checkContent(root) {
	const errors = [], posts = [], ids = new Map();
	for (const file of filesUnder(root).filter((file) => /\.(md|mdx)$/.test(file))) {
		try {
			const { frontmatter, content } = parseFrontmatter(fs.readFileSync(file, 'utf8'));
			const result = blogMetadata.safeParse(frontmatter);
			if (!result.success) {
				for (const issue of result.error.issues) errors.push(`${file}: ${issue.path.join('.')}: ${issue.message}`);
				continue;
			}
			if (!content.trim()) errors.push(`${file}: article body is empty`);
			const id = getBlogId(path.relative(root, file).split(path.sep).join('/'), result.data);
			if (!id || id === 'index') errors.push(`${file}: reserved or empty article URL: ${id}`);
			if (ids.has(id)) errors.push(`${file}: duplicate article URL /blog/${id}/ (also ${ids.get(id)})`);
			ids.set(id, file);
			posts.push({ file, id });
		} catch (error) { errors.push(`${file}: ${error.message}`); }
	}
	if (!posts.length && !errors.length) errors.push(`${root}: no Markdown articles found`);
	return { errors, posts };
}

export function nodes(root, predicate, result = []) {
	if (predicate(root)) result.push(root);
	for (const child of root.childNodes ?? []) nodes(child, predicate, result);
	return result;
}
const attr = (node, name) => node.attrs?.find((attribute) => attribute.name === name)?.value;

export function checkSite(dist, posts) {
	const errors = [], pages = new Map();
	if (!fs.existsSync(path.join(dist, 'index.html'))) return ['dist/index.html is missing; run the production build first'];
	const files = filesUnder(dist);
	const exactPaths = new Set(files.map((file) => path.relative(dist, file).split(path.sep).join('/')));
	for (const file of files.filter((file) => file.endsWith('.html'))) {
		const relative = path.relative(dist, file).split(path.sep).join('/');
		const doc = parse(fs.readFileSync(file, 'utf8'));
		pages.set(relative, { doc, ids: new Set(nodes(doc, (n) => attr(n, 'id') !== undefined).map((n) => attr(n, 'id'))) });
	}
	const canonical = nodes(pages.get('index.html').doc, (n) => n.tagName === 'link' && attr(n, 'rel') === 'canonical')[0];
	const origin = new URL(attr(canonical, 'href') ?? 'https://benkangpeng.github.io').origin;
	const root = path.resolve(dist);
	function resolveLink(value, from, label) {
		if (!value || value.startsWith('data:')) return;
		if (/^[a-z]:[\\/]/i.test(value)) { errors.push(`${from}: ${label} uses a local computer path: ${value}`); return; }
		let url;
		try { url = new URL(value, new URL(from, origin + '/')); }
		catch { errors.push(`${from}: malformed ${label}: ${value}`); return; }
		if (url.origin !== origin || !['https:', 'http:'].includes(url.protocol)) return;
		let target, fragment;
		try { target = path.resolve(dist, '.' + decodeURIComponent(url.pathname)); fragment = decodeURIComponent(url.hash.slice(1)); }
		catch { errors.push(`${from}: invalid URL encoding: ${value}`); return; }
		if (!target.startsWith(root + path.sep) && target !== root) { errors.push(`${from}: path escapes site: ${value}`); return; }
		if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
		if (!fs.existsSync(target)) { errors.push(`${from}: missing ${label}: ${value}`); return; }
		const relative = path.relative(dist, target).split(path.sep).join('/');
		if (!exactPaths.has(relative)) { errors.push(`${from}: missing or incorrectly cased ${label}: ${value}`); return; }
		if (fragment && pages.has(relative) && !pages.get(relative).ids.has(fragment)) errors.push(`${from}: missing heading/anchor: ${value}`);
		return relative;
	}
	for (const [file, { doc }] of pages) {
		const description = nodes(doc, (n) => n.tagName === 'meta' && attr(n, 'name') === 'description')[0];
		if (!attr(description ?? {}, 'content')?.trim()) errors.push(`${file}: missing page description`);
		for (const node of nodes(doc, (n) => n.tagName)) {
			if (node.tagName === 'img' && !attr(node, 'src')?.trim()) errors.push(`${file}: image missing src (possibly a sanitized local computer path)`);
			for (const name of ['href', 'src', 'poster']) if (attr(node, name) !== undefined) resolveLink(attr(node, name), file, name);
			if (attr(node, 'class')?.split(/\s+/).includes('katex-error')) errors.push(`${file}: invalid math formula (katex-error)`);
		}
		function visibleText(node, excluded = false) {
			if (excluded || ['pre', 'code', 'script', 'style', 'math'].includes(node.tagName) || attr(node, 'class')?.split(/\s+/).includes('katex')) return '';
			if (node.nodeName === '#text') return node.value;
			return (node.childNodes ?? []).map((child) => visibleText(child)).join('');
		}
		const text = visibleText(doc);
		if (/!\[[^\n]{0,250}\]\(/.test(text)) errors.push(`${file}: unrendered Markdown image syntax`);
		// The archive intentionally uses plain-text excerpts rather than rendered math.
		if (file !== 'blog/index.html' && /\$[^$\n]*\\(?:frac|sum|times|begin|mathbf)\b[^$\n]*\$/.test(text)) errors.push(`${file}: unrendered TeX formula`);
	}
	const listing = pages.get('blog/index.html');
	const listed = new Set(listing ? nodes(listing.doc, (n) => n.tagName === 'a').map((n) => resolveLink(attr(n, 'href'), 'blog/index.html', 'article link')) : []);
	const rss = fs.existsSync(path.join(dist, 'rss.xml')) ? fs.readFileSync(path.join(dist, 'rss.xml'), 'utf8') : '';
	const rssLinks = [...rss.matchAll(/<link>([\s\S]*?)<\/link>/g)].map((match) => {
		try { return decodeURIComponent(new URL(match[1]).pathname); } catch { return ''; }
	});
	for (const post of posts) {
		const page = `blog/${post.id}/index.html`;
		if (!pages.has(page)) errors.push(`${post.file}: article silently missing from build: ${page}`);
		if (!listed.has(page)) errors.push(`${post.file}: article missing from blog listing`);
		if (!rssLinks.includes(`/blog/${post.id}/`)) errors.push(`${post.file}: article missing from RSS`);
	}
	for (const file of files.filter((file) => file.endsWith('.css'))) {
		const css = fs.readFileSync(file, 'utf8');
		for (const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) resolveLink(match[1], path.relative(dist, file).split(path.sep).join('/'), 'CSS asset');
	}
	return [...new Set(errors)];
}

export function report(errors, success) {
	if (!errors.length) { console.log(success); return; }
	for (const error of errors) {
		console.error(`ERROR: ${error}`);
		if (process.env.GITHUB_ACTIONS) console.error(`::error::${error.replaceAll('%', '%25').replaceAll('\n', '%0A').replaceAll('\r', '%0D')}`);
	}
	console.error(`\n${errors.length} check(s) failed.`);
	process.exitCode = 1;
}
