import type { CodexKindView, CodexModView } from './model';

export function escapeCodexHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character] ?? character));
}

export function renderCodexBadges(labels: readonly string[] | undefined, className = 'runtime-editor-codex__badges'): string {
  if (!labels?.length) return '';
  return `<span class="${className}" aria-label="状态">${labels.map(label => `<span class="runtime-editor-codex__badge">${escapeCodexHtml(label)}</span>`).join('')}</span>`;
}

export function groupCodexKinds(kinds: readonly CodexKindView[]): ReadonlyMap<string, readonly CodexKindView[]> {
  const groups = new Map<string, CodexKindView[]>();
  kinds.forEach(kind => {
    const group = kind.groupLabel?.trim() || '其他内容';
    const current = groups.get(group) ?? [];
    current.push(kind);
    groups.set(group, current);
  });
  return groups;
}

export function codexModEntryCount(mod: CodexModView, entryCount: number): number {
  return mod.entryCount ?? entryCount;
}

export function renderCodexEmptyState(label: string, detail: string, key: string): string {
  return `<div class="runtime-editor-codex__empty" data-codex-empty="${escapeCodexHtml(key)}"><span class="runtime-editor-codex__empty-mark" aria-hidden="true">∅</span><strong>${escapeCodexHtml(label)}</strong><p>${escapeCodexHtml(detail)}</p></div>`;
}

