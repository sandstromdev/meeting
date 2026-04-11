import { sanitize } from 'isomorphic-dompurify';
import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: true });

/** Markdown → sanitized HTML for `{@html ...}` (e.g. agenda descriptions). */
export async function renderMarkdownToHtml(source: string) {
	const raw = await marked(source);
	return sanitize(raw);
}
