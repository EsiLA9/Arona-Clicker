import type { UIContext } from '../runtime/context';
import type { StoryCardGradient } from '../../data-services/contracts/story-card-gradient';
import { isStoryCardGradient } from '../../data-services/validation/story-card-gradient';
import { contrastRatio, INK_ON_DARK, INK_ON_LIGHT, MIN_CONTRAST, parseColor, readableOnColor, representativeColorOf, toHex } from '../../engine/core/color';

type CardKind = 'story' | 'entry';

function hashId(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index++) hash = Math.imul(hash ^ id.charCodeAt(index), 16777619);
  return hash >>> 0;
}

export function storyEditorTargetColor(id: string): string {
  return `hsl(${hashId(id) % 360} 46% 27%)`;
}

function defaultGradient(kind: CardKind, id: string): StoryCardGradient {
  const hue = hashId(`${kind}:${id}`) % 360;
  return { start: `hsl(${hue} 67% 94%)`, end: `hsl(${(hue + 48) % 360} 63% 80%)` };
}

export function storyCardPickerColors(kind: CardKind, id: string, gradient?: StoryCardGradient): StoryCardGradient {
  const { start, end } = isStoryCardGradient(gradient) ? gradient : defaultGradient(kind, id);
  return { start: toHex(parseColor(start)!), end: toHex(parseColor(end)!) };
}

export function storyCardStyle(kind: CardKind, id: string, gradient?: StoryCardGradient): string {
  const { start, end } = isStoryCardGradient(gradient) ? gradient : defaultGradient(kind, id);
  const representative = representativeColorOf(`linear-gradient(105deg, ${start}, ${end})`);
  const preferred = readableOnColor(representative ?? start);
  const alternate = preferred === INK_ON_DARK ? INK_ON_LIGHT : INK_ON_DARK;
  const readable = (ink: string) => [start, end].every(color => contrastRatio(ink, color) >= MIN_CONTRAST);
  const ink = readable(preferred) || !readable(alternate) ? preferred : alternate;
  const scrim = readable(ink) ? 'transparent' : ink === INK_ON_DARK ? 'rgb(0 0 0 / 60%)' : 'rgb(255 255 255 / 60%)';
  return `--story-card-default-start:${start};--story-card-default-end:${end};--story-card-ink:${ink};--story-card-scrim:${scrim}`;
}

export function renderStoryEditorTarget(ctx: UIContext, kind: CardKind, id: string, label: string, available: boolean,
  options?: { relation?: { key: string; detail: string; path?: string; showType?: boolean }; gradient?: StoryCardGradient }): string {
  const e = ctx.escapeHtml;
  const relation = options?.relation;
  const type = kind === 'story' ? 'Story' : 'StoryEntry';
  const name = available ? (label && label !== id ? label : `未命名 ${type}`) : id ? '目标不存在' : `尚未选择 ${type}`;
  const title = [available ? `打开 ${type}：${name}` : name, id, relation?.path].filter(Boolean).join(' · ');
  const colors = storyCardStyle(kind, id, available ? options?.gradient : undefined);
  const detail = relation && [relation.showType === false ? '' : type, relation.detail].filter(Boolean).join(' · ');
  return `<button type="button" class="story-editor-target-card${relation ? ' story-editor-relation-item' : ''}" data-story-target-kind="${kind}" data-story-target-id="${e(id)}" data-editor-key="${e(relation?.key ?? `${kind}-target:${id}`)}" data-editor-${kind}-target="${e(id)}" style="${colors}" title="${e(title)}"${available ? '' : ' disabled'}>
    <strong>${e(name)}</strong>${id ? `<code>${e(id)}</code>` : ''}${detail ? `<span class="story-editor-relation-detail">${e(detail)}</span>` : ''}
  </button>`;
}

export function renderStoryCardOverview(ctx: UIContext, kind: CardKind, id: string, label: string, gradient?: StoryCardGradient,
  editable = false): string {
  const e = ctx.escapeHtml;
  const tag = editable ? 'button' : 'div';
  const title = label && label !== id ? label : kind === 'story' ? '未命名 Story' : '未命名 StoryEntry';
  return `<${tag} class="story-editor-target-card story-editor-card-overview" data-story-target-kind="${kind}" data-story-target-id="${e(id)}"
    data-editor-key="card-overview:${e(id)}" style="${storyCardStyle(kind, id, gradient)}"${editable ? ' type="button" data-story-card-edit aria-haspopup="dialog" title="编辑卡片渐变"' : ''}>
    <strong>${e(title)}</strong><code>${e(id)}</code>
  </${tag}>`;
}
