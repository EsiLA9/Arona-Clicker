import type { UIContext } from '../runtime/context';

export function renderStoryDocumentIcon(kind: 'story' | 'entry'): string {
  return kind === 'story'
    ? '<svg class="editor-document-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 4h4.5A2.5 2.5 0 0 1 10 6.5V17a3.2 3.2 0 0 0-2.5-1.3H3zm14 0h-4.5A2.5 2.5 0 0 0 10 6.5V17a3.2 3.2 0 0 1 2.5-1.3H17z"/></svg>'
    : '<svg class="editor-document-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 3.5h8l4 4V16a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 16zM12 3.5V8h4m-9 3h6m-6 3h6"/></svg>';
}

export function renderEditorGear(): string {
  return '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8.7 2.5h2.6l.5 1.8 1.5.9 1.8-.5 1.3 2.2-1.3 1.4v1.8l1.3 1.4-1.3 2.2-1.8-.5-1.5.9-.5 1.8H8.7l-.5-1.8-1.5-.9-1.8.5-1.3-2.2 1.3-1.4V8.3L3.6 6.9l1.3-2.2 1.8.5 1.5-.9z"/><circle cx="10" cy="9.9" r="2.4"/></svg>';
}

export function renderEditorDirectoryTools(label: string, controls: string, key: string): string {
  return `<div class="editor-directory-tools" data-editor-key="${key}" role="group" aria-label="${label}">${controls}</div>`;
}

export function renderEditorDirectoryList(content: string, attributes = ''): string {
  return `<ul class="editor-directory-tree"${attributes ? ' ' + attributes : ''}>${content}</ul>`;
}

export function renderEditorDirectoryRow(ctx: UIContext, spec: {
  key: string;
  control: string;
  controlsBefore?: string;
  actions?: string;
  children?: string;
  attributes?: string;
}): string {
  const heading = spec.controlsBefore || spec.actions || spec.children
    ? `<div class="editor-directory-heading">${spec.controlsBefore ?? ''}${spec.control}${spec.actions ?? ''}</div>` : spec.control;
  return `<li data-editor-key="${ctx.escapeHtml(spec.key)}"${spec.attributes ? ' ' + spec.attributes : ''}>${heading}${spec.children ?? ''}</li>`;
}

export function renderEditorDirectoryToggle(open: boolean | undefined, attributes: string, content = '', className = 'mini-action'): string {
  return `<button type="button" class="${className}" ${attributes} ${open === undefined ? 'disabled' : `aria-expanded="${open}"`}>
    <svg class="editor-directory-chevron" viewBox="0 0 12 12" aria-hidden="true"><path d="m4 2 4 4-4 4"/></svg>${content}</button>`;
}

export function setEditorDirectoryExpanded(toggle: HTMLElement, open: boolean): boolean {
  const children = toggle.closest('li')?.querySelector<HTMLUListElement>(':scope > ul');
  if (!children) return false;
  toggle.setAttribute('aria-expanded', String(open));
  children.hidden = !open;
  return true;
}
