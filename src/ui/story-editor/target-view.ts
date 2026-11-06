import type { UIContext } from '../runtime/context';

export function storyEditorTargetColor(id: string): string {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index++) hash = Math.imul(hash ^ id.charCodeAt(index), 16777619);
  return `hsl(${(hash >>> 0) % 360} 46% 27%)`;
}

export function renderStoryEditorTarget(ctx: UIContext, kind: 'story' | 'entry', id: string, label: string, available: boolean): string {
  const type = kind === 'story' ? 'Story' : 'Entry';
  const title = available ? `打开 ${type}：${label} · ${id}` : `${type} 不存在或尚未配置：${id}`;
  return `<button type="button" class="story-editor-target-card" data-editor-key="${kind}-target:${ctx.escapeHtml(id)}" data-editor-${kind}-target="${ctx.escapeHtml(id)}" style="--story-editor-choice-flag-color:${storyEditorTargetColor(id)}" title="${ctx.escapeHtml(title)}"${available ? '' : ' disabled'}><strong>${ctx.escapeHtml(label)}</strong>${label !== id && id ? `<small>${ctx.escapeHtml(id)}</small>` : ''}<span aria-hidden="true">↗</span></button>`;
}
