import type { UIContext } from '../runtime/context';
import { storyEntries, type StoryEditorState } from './model';

export type StoryReferenceKind = 'story' | 'entry' | 'activeEntry' | 'passiveEntry' | 'resource' | 'spot' | 'area' | 'init' | 'enhancement' | 'item' | 'character' | 'variant' | 'image' | 'colorGroup' | 'funclet';

/** Full content registry choices for Story authoring; player unlock state is never consulted. */
export function storyReferenceOptions(ctx: UIContext, kind: StoryReferenceKind, state?: StoryEditorState): Array<{ value: string; label: string }> {
  const registry = ctx.game.registry;
  const stories = new Map<string, { id: string; name: string }>(registry.stories);
  for (const draft of state?.drafts ?? []) stories.set(draft.document.id, draft.document);
  switch (kind) {
    case 'funclet': return [...registry.funcletDefs.values()].map(x=>({value:x.id,label:x.description || x.id}));
    case 'story': return [...stories.values()].map(x => ({ value: x.id, label: x.name || x.id }));
    case 'entry':
    case 'activeEntry':
    case 'passiveEntry': return [...(state ? storyEntries(state,registry.storyEntries) : registry.storyEntries).values()].filter(x => kind === 'entry' || x.type === (kind === 'activeEntry' ? 'active' : 'passive')).map(x => ({ value: x.id, label: `${x.type === 'active' ? '主动' : '被动'} · ${x.openingTitle || stories.get(x.storyId)?.name || x.id}` }));
    case 'resource': return [...registry.resourceDisplays.values()].map(x => ({ value: x.resourceId, label: x.label || x.resourceId }));
    case 'spot': return [...registry.spots.values()].map(x => ({ value: x.id, label: x.name || x.id }));
    case 'area': return [...registry.areas.values()].map(x => ({ value: x.id, label: x.name || x.id }));
    case 'init': return [...registry.inits.values()].map(x => ({ value: x.id, label: x.name || x.id }));
    case 'enhancement': return [...registry.enhancements.values()].map(x => ({ value: x.id, label: x.name || x.id }));
    case 'item': return [...registry.items.values()].map(x => ({ value: x.id, label: x.name || x.id }));
    case 'character': return [...registry.characters.values()].map(x => ({ value: x.id, label: x.displayName || x.id }));
    case 'variant': return [...registry.characterVariants.values()].map(x => ({ value: x.id, label: x.displayName || x.id }));
    case 'colorGroup': return [...registry.colorGroups.values()].map(x => ({ value: x.id, label: x.name || x.id }));
    case 'image': return [...registry.pics.values()].map(x => ({ value: x.id, label: x.label || x.id }));
  }
}

export function renderStoryReferenceOptions(ctx: UIContext, kind: StoryReferenceKind): string {
  return storyReferenceOptions(ctx, kind).map(option => `<option value="${ctx.escapeHtml(option.value)}">${ctx.escapeHtml(option.label)}</option>`).join('');
}
