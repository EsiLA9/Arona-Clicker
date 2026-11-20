import { storyEntryType } from '../../data-services/contracts/story-entry';
import type { UIContext } from '../runtime/context';
import { storyEntries, type StoryEditorState } from './model';

export type StoryReferenceKind = 'story' | 'entry' | 'activeEntry' | 'passiveEntry' | 'resource' | 'spot' | 'area' | 'areaMap' | 'init' | 'enhancement' | 'item' | 'character' | 'variant' | 'image' | 'colorGroup' | 'funclet';

export function storyReferenceDocuments(ctx: UIContext, state?: StoryEditorState) {
  const stories = new Map<string, { id: string; name: string; initId?: string }>(ctx.game.registry.stories);
  for (const draft of state?.drafts ?? []) if (!draft.entryOnly || !stories.has(draft.document.id)) stories.set(draft.document.id, draft.document);
  return stories;
}

/** Full content registry choices for Story authoring; player unlock state is never consulted. */
export function storyReferenceOptions(ctx: UIContext, kind: StoryReferenceKind, state?: StoryEditorState): Array<{ value: string; label: string }> {
  const registry = ctx.game.registry;
  switch (kind) {
    case 'funclet': return [...registry.funcletDefs.values()].map(x=>({value:x.id,label:x.description || x.id}));
    case 'story': return [...storyReferenceDocuments(ctx, state).values()].map(x => ({ value: x.id, label: x.name || x.id }));
    case 'entry':
    case 'activeEntry':
    case 'passiveEntry': {
      const stories = storyReferenceDocuments(ctx, state);
      return [...(state ? storyEntries(state,registry.storyEntries) : registry.storyEntries).values()].filter(x => kind === 'entry' || storyEntryType(x) === (kind === 'activeEntry' ? 'active' : 'passive')).map(x => ({ value: x.id, label: `${storyEntryType(x) === 'active' ? '主动' : '被动'} · ${x.openingTitle || stories.get(x.storyId)?.name || x.id}` }));
    }
    case 'resource': return [...registry.resourceDisplays.values()].map(x => ({ value: x.resourceId, label: x.label || x.resourceId }));
    case 'spot': return [...registry.spots.values()].map(x => ({ value: x.id, label: x.name || x.id }));
    case 'area': return [...registry.areas.values()].map(x => ({ value: x.id, label: x.name || x.id }));
    case 'areaMap': return [...registry.areaMaps.values()].map(x => ({ value: x.id, label: x.name || x.id }));
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
