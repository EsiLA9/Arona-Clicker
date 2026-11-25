import type { UIContext } from '../../runtime/context';
import type { StoryCardGradient } from '../../../data-services/contracts/story-card-gradient';
import { isStoryCardGradient } from '../../../data-services/validation/story-card-gradient';
import { contrastRatio, INK_ON_DARK, INK_ON_LIGHT, MIN_CONTRAST, parseColor, readableOnColor, representativeColorOf, toHex } from '../../../engine/core/color';

export type StoryIdentityKind = 'story' | 'entry';

export function storyIdentityKindForTable(table: string): StoryIdentityKind | undefined {
  if (table === 'stories') return 'story';
  if (table === 'storyEntries' || table === 'activeStories' || table === 'passiveStories') return 'entry';
}

export interface StoryIdentity {
  kind: StoryIdentityKind;
  id: string;
  title: string;
  gradient?: StoryCardGradient;
}

export function resolveStoryIdentity(target: Pick<StoryIdentity, 'kind' | 'id'>,
  stories: ReadonlyMap<string, { name: string; cardGradient?: StoryCardGradient }>,
  entries: ReadonlyMap<string, { storyId: string; openingTitle?: string; cardGradient?: StoryCardGradient }>): StoryIdentity | undefined {
  const { kind, id } = target;
  if (kind === 'story') {
    const story = stories.get(id);
    if (story) return { kind, id, title: storyIdentityTitle(kind, story.name, id), gradient: story.cardGradient };
  } else {
    const entry = entries.get(id);
    if (entry) return { kind, id, title: storyIdentityTitle(kind, entry.openingTitle || stories.get(entry.storyId)?.name || '', id), gradient: entry.cardGradient };
  }
}

export function storyIdentityTitle(kind: StoryIdentityKind, title: string, id: string): string {
  return title && title !== id ? title : kind === 'story' ? '未命名 Story' : '未命名 StoryEntry';
}

/** Plain content shared by cards whose host owns selection, navigation or display. */
export function renderStoryIdentityContent(ctx: Pick<UIContext, 'escapeHtml'>, title: string, id?: string): string {
  return `<strong>${ctx.escapeHtml(title)}</strong>${id ? `<code>${ctx.escapeHtml(id)}</code>` : ''}`;
}

export function renderStoryIdentityInline(ctx: Pick<UIContext, 'escapeHtml'>, kind: StoryIdentityKind, title: string, id?: string): string {
  return `<span class="story-identity-inline" data-story-target-kind="${kind}">${renderStoryIdentityContent(ctx, title, id)}</span>`;
}

export function renderStoryIdentityPreview(ctx: UIContext, identity: StoryIdentity): string {
  const { kind, id, title, gradient } = identity;
  return `<span class="story-identity-card story-identity-preview" data-story-target-kind="${kind}" data-story-target-id="${ctx.escapeHtml(id)}" style="${storyCardStyle(kind, id, gradient)}">${renderStoryIdentityContent(ctx, title, id)}</span>`;
}

function hashId(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index++) hash = Math.imul(hash ^ id.charCodeAt(index), 16777619);
  return hash >>> 0;
}

export function storyEditorTargetColor(id: string): string {
  return `hsl(${hashId(id) % 360} 46% 27%)`;
}

function defaultGradient(kind: StoryIdentityKind, id: string): StoryCardGradient {
  const hue = hashId(`${kind}:${id}`) % 360;
  return { start: `hsl(${hue} 67% 94%)`, end: `hsl(${(hue + 48) % 360} 63% 80%)` };
}

export function storyCardPickerColors(kind: StoryIdentityKind, id: string, gradient?: StoryCardGradient): StoryCardGradient {
  const { start, end } = isStoryCardGradient(gradient) ? gradient : defaultGradient(kind, id);
  return { start: toHex(parseColor(start)!), end: toHex(parseColor(end)!) };
}

export function storyCardStyle(kind: StoryIdentityKind, id: string, gradient?: StoryCardGradient): string {
  const { start, end } = isStoryCardGradient(gradient) ? gradient : defaultGradient(kind, id);
  const representative = representativeColorOf(`linear-gradient(105deg, ${start}, ${end})`);
  const preferred = readableOnColor(representative ?? start);
  const alternate = preferred === INK_ON_DARK ? INK_ON_LIGHT : INK_ON_DARK;
  const readable = (ink: string) => [start, end].every(color => contrastRatio(ink, color) >= MIN_CONTRAST);
  const ink = readable(preferred) || !readable(alternate) ? preferred : alternate;
  const scrim = readable(ink) ? 'transparent' : ink === INK_ON_DARK ? 'rgb(0 0 0 / 60%)' : 'rgb(255 255 255 / 60%)';
  return `--story-card-default-start:${start};--story-card-default-end:${end};--story-card-ink:${ink};--story-card-scrim:${scrim}`;
}
