import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkContent, checkSite } from './site-checks.mjs';

function temporary(t) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-checks-'));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	return root;
}
function write(root, file, content) {
	const target = path.join(root, file);
	fs.mkdirSync(path.dirname(target), { recursive: true });
	fs.writeFileSync(target, content);
}
const frontmatter = "---\ntitle: Demo\ndescription: A real summary\npubDate: '2025-07-03'\n---\nBody\n";

test('a failed check exits nonzero so CI cannot report success', () => {
	const module = new URL('./site-checks.mjs', import.meta.url).href;
	const result = spawnSync(process.execPath, ['--input-type=module', '-e', `import { report } from ${JSON.stringify(module)}; report(['demo.md: description is missing'], 'OK');`], { encoding: 'utf8' });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /demo.md: description is missing/);
	assert.ok(!result.stdout.includes('OK'));
});

test('missing/blank description, invalid dates/YAML, missing title and empty bodies fail with filenames', (t) => {
	const root = temporary(t);
	const cases = [
		[frontmatter.replace('description: A real summary\n', ''), 'description'],
		[frontmatter.replace('A real summary', "'   '"), 'description'],
		[frontmatter.replace("'2025-07-03'", "'not-a-date'"), 'pubDate'],
		[frontmatter.replace("'2025-07-03'", 'null'), 'pubDate'],
		[frontmatter.replace('title: Demo\n', ''), 'title'],
		[frontmatter.replace('description: A real summary', 'description: [broken'), 'demo.md'],
		[frontmatter.replace('Body', ''), 'body is empty'],
	];
	for (const [content, expected] of cases) {
		write(root, 'demo.md', content);
		const { errors } = checkContent(root);
		assert.ok(errors.some((message) => message.includes(expected)), errors.join('\n'));
		assert.ok(errors.every((message) => message.includes('demo.md')));
	}
});

test('nested Chinese filenames and custom slugs work; URL collisions fail', (t) => {
	const root = temporary(t);
	write(root, '笔记/Hello World.mdx', frontmatter);
	let result = checkContent(root);
	assert.deepEqual(result.errors, []);
	assert.equal(result.posts[0].id, '笔记/hello-world');
	write(root, 'another.md', frontmatter.replace('title: Demo', "title: Demo\nslug: '笔记/hello-world'"));
	result = checkContent(root);
	assert.ok(result.errors.some((message) => message.includes('duplicate article URL')));
});

function siteFixture(t) {
	const root = temporary(t);
	const shell = (body) => `<html><head><meta name="description" content="Summary"><link rel="canonical" href="https://example.test/"></head><body>${body}</body></html>`;
	write(root, 'index.html', shell('<a href="/blog/">Blog</a>'));
	write(root, 'blog/index.html', shell('<a href="/blog/demo/">Demo</a>'));
	const body = '<h2 id="section">Section</h2><a href="#section">Contents</a><img src="/plot.png"><script src="/app.js"></script><link rel="stylesheet" href="/style.css">';
	write(root, 'blog/demo/index.html', shell(body));
	write(root, 'rss.xml', '<rss><link>https://example.test/blog/demo/</link></rss>');
	write(root, 'plot.png', 'image');
	write(root, 'app.js', '');
	write(root, 'style.css', '@font-face { src: url("font.woff2"); }');
	write(root, 'font.woff2', 'font');
	return { root, shell, body, posts: [{ id: 'demo', file: 'src/content/blog/demo.md' }] };
}

test('a fully built article, listing, RSS, anchors, code, images and CSS fonts pass', (t) => {
	const { root, posts } = siteFixture(t);
	assert.deepEqual(checkSite(root, posts), []);
});

test('silently omitted articles, listing entries and RSS entries are caught', (t) => {
	const { root, posts } = siteFixture(t);
	assert.ok(checkSite(root, [...posts, { id: 'lost', file: 'lost.md' }]).some((message) => message.includes('silently missing')));
	write(root, 'blog/index.html', '<meta name="description" content="Summary">');
	write(root, 'rss.xml', '');
	const errors = checkSite(root, posts);
	assert.ok(errors.some((message) => message.includes('missing from blog listing')));
	assert.ok(errors.some((message) => message.includes('missing from RSS')));
});

test('broken image/font paths, Windows paths, anchors, formulas and Markdown syntax fail', (t) => {
	const { root, posts, shell, body } = siteFixture(t);
	const cases = [
		['<img src="/missing.png">', 'missing src'],
		['<img alt="local screenshot">', 'image missing src'],
		['<img src="/Plot.png">', 'src'],
		['<img src="D:\\Pictures\\local.png">', 'local computer path'],
		['<a href="#missing">Missing section</a>', 'missing heading/anchor'],
		['<span class="katex-error">broken</span>', 'invalid math'],
		['$\\frac{1}{2}$', 'unrendered TeX'],
		['![[image]](image with spaces.png)', 'unrendered Markdown image'],
	];
	for (const [extra, expected] of cases) {
		write(root, 'blog/demo/index.html', shell(body + extra));
		assert.ok(checkSite(root, posts).some((message) => message.includes(expected)), expected);
	}
	write(root, 'blog/demo/index.html', shell(body + '<pre><code>![[example]](example.png) $\\frac{1}{2}$</code></pre><a href="https://external.test/no-network-check">External</a>'));
	assert.deepEqual(checkSite(root, posts), []);
	write(root, 'style.css', 'p { background: url(missing-font.woff2); }');
	assert.ok(checkSite(root, posts).some((message) => message.includes('CSS asset')));
});
