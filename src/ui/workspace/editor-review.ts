import type { UIContext } from '../runtime/context';

export function renderEditorReviewSection(ctx: UIContext, key: string, title: string, content: string, empty: string): string {
  return `<section data-editor-key="${ctx.escapeHtml(key)}"><h3>${ctx.escapeHtml(title)}</h3>${content || `<p class="editor-review-empty">${ctx.escapeHtml(empty)}</p>`}</section>`;
}

export function renderEditorReviewFields(ctx: UIContext, label: string, fields: readonly { label: string; content: string }[]): string {
  return `<dl class="editor-review-fields" aria-label="${ctx.escapeHtml(label)}">${fields.map(field =>
    `<div><dt>${ctx.escapeHtml(field.label)}</dt><dd>${field.content}</dd></div>`).join('')}</dl>`;
}
