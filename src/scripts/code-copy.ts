async function copyText(text: string): Promise<void> {
	if (navigator.clipboard?.writeText) {
		await navigator.clipboard.writeText(text);
		return;
	}
	// Support older browsers and previews served over plain HTTP.
	const field = document.createElement('textarea');
	field.value = text;
	field.readOnly = true;
	field.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
	const previousFocus = document.activeElement;
	document.body.append(field);
	try {
		field.select();
		if (!document.execCommand('copy')) throw new Error('Copy unavailable');
	} finally {
		field.remove();
		if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
	}
}

export function initializeCodeCopy() {
	document.querySelectorAll<HTMLPreElement>('.article-content pre').forEach((pre) => {
		const code = pre.querySelector('code');
		if (!code || pre.parentElement?.classList.contains('code-block')) return;
		const wrapper = document.createElement('div');
		wrapper.className = 'code-block';
		pre.before(wrapper);
		wrapper.append(pre);
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'copy-code';
		button.textContent = 'Copy';
		button.setAttribute('aria-label', 'Copy code to clipboard');
		button.setAttribute('aria-live', 'polite');
		let reset: ReturnType<typeof setTimeout>;
		button.addEventListener('click', async () => {
			clearTimeout(reset);
			button.disabled = true;
			try {
				// Copy only the code, preserving indentation and line breaks.
				await copyText(code.textContent ?? '');
				button.textContent = 'Copied!';
				button.setAttribute('aria-label', 'Code copied to clipboard');
			} catch {
				button.textContent = 'Copy failed';
				button.setAttribute('aria-label', 'Copy failed. Select and copy the code manually.');
			} finally {
				button.disabled = false;
				reset = setTimeout(() => {
					button.textContent = 'Copy';
					button.setAttribute('aria-label', 'Copy code to clipboard');
				}, 2500);
			}
		});
		wrapper.append(button);
	});
}

initializeCodeCopy();
document.addEventListener('astro:page-load', initializeCodeCopy);
