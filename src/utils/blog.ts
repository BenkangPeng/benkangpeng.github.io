/** Plain text for previews and reading estimates, without Markdown/MDX markup. */
export function plainText(body: string): string {
	return body
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/^(?:import|export)\s.+$/gm, '')
		.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm, '')
		.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
		.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
		.replace(/<[^>]+>/g, '')
		.replace(/^\s{0,3}(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+\.\s+)/gm, '')
		.replace(/[*_`~]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

export function excerpt(body: string, fallback: string, limit = 420): string {
	const text = plainText(body) || fallback;
	if (text.length <= limit) return text;
	const prefix = text.slice(0, limit);
	const boundary = prefix.lastIndexOf(' ');
	return `${prefix.slice(0, boundary > limit * 0.7 ? boundary : limit).trimEnd()}…`;
}

export function readingMinutes(body: string): number {
	const text = plainText(body);
	const cjk = text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu) ?? [];
	const words = text.replace(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu, ' ').match(/[\p{L}\p{N}]+/gu) ?? [];
	return Math.max(1, Math.ceil(words.length / 200 + cjk.length / 300));
}
