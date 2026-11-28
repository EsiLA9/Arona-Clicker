import type { UIContext } from '../runtime/context';
import type { StoryCardGradient } from '../../data-services/contracts/story-card-gradient';
import { renderStoryIdentityCardContent, storyCardStyle, storyIdentityTitle, type StoryIdentityKind } from '../components/story/story-identity';
import type { EditorEntryIconType } from '../components/shared/editor-entity-icon';
export { storyCardPickerColors, storyCardStyle, storyEditorTargetColor } from '../components/story/story-identity';

export function renderStoryEditorTarget(ctx: UIContext, kind: StoryIdentityKind, id: string, label: string, available: boolean,
  options?: { relation?: { key: string; detail: string; path?: string; showType?: boolean }; gradient?: StoryCardGradient; entryType?: EditorEntryIconType }): string {
  const e = ctx.escapeHtml;
  const relation = options?.relation;
  const type = kind === 'story' ? 'Story' : 'StoryEntry';
  const name = available ? storyIdentityTitle(kind, label, id) : id ? '目标不存在' : `尚未选择 ${type}`;
  const title = [available ? `打开 ${type}：${name}` : name, id, relation?.path].filter(Boolean).join(' · ');
  const colors = storyCardStyle(kind, id, available ? options?.gradient : undefined);
  const detail = relation && [relation.showType === false ? '' : type, relation.detail].filter(Boolean).join(' · ');
  return `<button type="button" class="story-identity-card story-editor-target-card${relation ? ' story-editor-relation-item' : ''}" data-story-target-kind="${kind}" data-story-target-id="${e(id)}" data-editor-key="${e(relation?.key ?? `${kind}-target:${id}`)}" data-editor-${kind}-target="${e(id)}" style="${colors}" title="${e(title)}"${available ? '' : ' disabled'}>
    ${renderStoryIdentityCardContent(ctx, { kind, id, title: name, entryType: options?.entryType })}${detail ? `<span class="story-editor-relation-detail">${e(detail)}</span>` : ''}
  </button>`;
}

export function renderStoryCardOverview(ctx: UIContext, kind: StoryIdentityKind, id: string, label: string, gradient?: StoryCardGradient,
  editable = false, entryType?: EditorEntryIconType): string {
  const e = ctx.escapeHtml;
  const tag = editable ? 'button' : 'div';
  const title = storyIdentityTitle(kind, label, id);
  return `<${tag} class="story-identity-card story-editor-target-card story-editor-card-overview" data-story-target-kind="${kind}" data-story-target-id="${e(id)}"
    data-editor-key="card-overview:${e(id)}" style="${storyCardStyle(kind, id, gradient)}"${editable ? ' type="button" data-story-card-edit aria-haspopup="dialog" title="编辑卡片渐变"' : ''}>
    ${renderStoryIdentityCardContent(ctx, { kind, id, title, entryType })}
  </${tag}>`;
}
