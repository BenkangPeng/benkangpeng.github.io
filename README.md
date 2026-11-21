# Benkang Peng's blog

A static blog built with Astro. Posts live in `src/content/blog/` and can use Markdown, MDX, math, code copying, and a nested table of contents.

## Local development

Use Node.js 24 (CI uses the same major version), then run:

```sh
# Install the exact dependency versions in package-lock.json. This matches CI.
npm ci
# Start the dev server
npm run dev
```

The site is served at `http://localhost:4321`. These commands manage that background process: `npm run astro -- dev status` shows whether it is running and which address it uses, `npm run astro -- dev logs` prints its output, and `npm run astro -- dev stop` shuts it down.

## Writing a post

Every `.md` and `.mdx` file needs a non-empty `title`, a non-empty `description`, and a valid `pubDate`:

```yaml
---
title: 'Post title'
description: 'One or two sentences summarizing the post'
pubDate: '2026-11-21'
tags: [GPU, Cuda]
---
```

`updatedDate`, `heroImage`, and a custom `slug` are optional. Without a `slug`, the URL comes from the file path: Chinese characters are kept, text is lowercased, and spaces become hyphens. A `.md` and `.mdx` file at the same path, or files whose names differ only by case and produce the same URL, are treated as a conflict.

Put local images in an `images/` directory next to the post and reference them with a relative path. Wrap paths that contain spaces in angle brackets, for example `![Description](<images/example figure.png>)`. Do not reference paths on a personal machine.

## Checks

Before committing, run the same full check that GitHub Actions runs:

```sh
npm run ci
```

The generated-site check follows each post from its **source Markdown to the article page, the blog index, and the RSS feed**, so a successful build cannot hide an unpublished post. It also checks that path casing matches. That catches asset paths which work on macOS but fail on Linux.

`check:site` reads the current `dist/`, so build again after editing a post. Prefer `npm run ci`, which avoids checking a stale build. The checker ignores Markdown and TeX syntax inside code samples. Blog-index excerpts are plain text, so math in an excerpt is not expected to be typeset.

## GitHub Actions

The workflow in `.github/workflows/ci.yml` runs on push, pull request, and manual dispatch. It installs the locked dependencies with `npm ci`, then runs `npm run ci`. Any failing stage fails the check. Errors appear in the Actions log and as error annotations.

This workflow only checks the site. It does not deploy or modify the repository. Changes run on GitHub only after they are committed and pushed.

When a Pages deployment is added later, make the deploy job depend on the check with `needs: check`, and require the `Site checks / check` status before merging to the main branch. Running checks and deployment as unrelated workflows does not stop a broken version from going live.

## What is not checked

The checks do not request external sites. Timeouts and rate limits on third-party sites could otherwise block ordinary commits. External links can later get their own scheduled check. Visual details such as color, spacing, and line breaks, along with in-browser behavior such as copying and pagination, still need a page preview. Desktop and mobile screenshot regression, and browser interaction tests, can be added later.
