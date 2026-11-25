import type { StoryDef } from '../../data-services/contracts/story';
import type { StoryEntryDef } from '../../data-services/contracts/story-entry';
import { collectDefinitionReferences } from '../../data-services/registry/runtime-content-reference-rules';
import { storyEntries, type StoryDraftDocument, type StoryEditorState, type StoryEditorTarget } from './model';

export interface StoryCall {
  from: StoryEditorTarget;
  to: StoryEditorTarget;
  label: string;
  path: string;
}
export interface StoryRelations {
  stories: ReadonlyMap<string, StoryDef | StoryDraftDocument>;
  entries: ReadonlyMap<string, StoryEntryDef>;
  calls: readonly StoryCall[];
}
const key = (target: StoryEditorTarget): string => `${target.kind}:${target.id}`;

/** Derive both directions from live author content; never persist a second set of references. */
export function buildStoryRelations(state: StoryEditorState, sourceStories: ReadonlyMap<string, StoryDef>, sourceEntries: ReadonlyMap<string, StoryEntryDef>): StoryRelations {
  const stories = new Map<string, StoryDef | StoryDraftDocument>(sourceStories);
  for (const draft of state.drafts) if (!draft.entryOnly || !stories.has(draft.document.id)) stories.set(draft.document.id, draft.document);
  const entries = storyEntries(state, sourceEntries);
  const calls: StoryCall[] = [];
  for (const story of stories.values()) {
    const from: StoryEditorTarget = { kind: 'story', id: story.id };
    for (const ref of collectDefinitionReferences({ definitionKind: 'stories', fullId: story.id }, story, [])) {
      if (ref.scope !== 'global' || ref.confidence !== 'declared') continue;
      const kind = ref.path.endsWith('.transfer.storyId') ? 'story' : ref.path.endsWith('.request.entryId') ? 'entry' : undefined;
      if (!kind) continue;
      const nodeIndex = ref.path.match(/^\$\.nodes\[(\d+)\]/)?.[1];
      const node = nodeIndex === undefined ? undefined : story.nodes[Number(nodeIndex)];
      calls.push({ from, to: { kind, id: ref.value }, label: `${ref.relation}${node ? ` · 节点 ${node.id}` : ''}`, path: ref.path });
    }
  }
  for (const entry of entries.values()) {
    const from: StoryEditorTarget = { kind: 'entry', id: entry.id };
    for (const ref of collectDefinitionReferences({ definitionKind: 'storyEntries', fullId: entry.id }, entry, [])) {
      if (ref.scope !== 'global' || ref.confidence !== 'declared') continue;
      const kind = ref.path === '$.storyId' ? 'story'
        : ref.targetKinds?.some(kind => kind === 'activeStories' || kind === 'passiveStories') ? 'entry' : undefined;
      if (kind) calls.push({ from, to: { kind, id: ref.value }, label: ref.path === '$.storyId' ? '起始 Story' : ref.relation, path: ref.path });
    }
  }
  // Legacy cards resolve their target through the starting Entry, including transferred documents.
  for (const entry of entries.values()) {
    if (!entry.kizuna?.entryId) continue;
    const pending = [entry.storyId], visited = new Set<string>();
    while (pending.length) {
      const id = pending.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      for (const call of calls) if (call.from.kind === 'story' && call.from.id === id && call.to.kind === 'story') pending.push(call.to.id);
      const story = stories.get(id);
      if (!Array.isArray(story?.nodes)) continue;
      story.nodes.forEach((node, index) => {
        if (node.type !== 'click' || node.interaction?.kind !== 'kizunaCard') return;
        const path = `$.nodes[${index}].interaction`;
        if (!calls.some(call => call.from.kind === 'story' && call.from.id === id && call.to.kind === 'entry' && call.to.id === entry.kizuna!.entryId && call.path === path)) {
          calls.push({ from: { kind: 'story', id }, to: { kind: 'entry', id: entry.kizuna!.entryId }, label: `羁绊入口 · 节点 ${node.id}`, path });
        }
      });
    }
  }
  return { stories, entries, calls };
}

/** Entry requests start separate sessions. Only Story transfers connect a Story's Entry contexts. */
export function storyTransferContext(relations: StoryRelations, storyId: string, direction: 'incoming' | 'both' = 'incoming') {
  const neighbors = new Map<string, string[]>();
  const add = (fromId: string, toId: string) => {
    const ids = neighbors.get(fromId);
    if (ids) ids.push(toId);
    else neighbors.set(fromId, [toId]);
  };
  for (const { from, to } of relations.calls) {
    if (from.kind !== 'story' || to.kind !== 'story') continue;
    add(to.id, from.id);
    if (direction === 'both') add(from.id, to.id);
  }

  const storyIds = new Set([storyId]);
  for (const id of storyIds) {
    for (const neighbor of neighbors.get(id) ?? []) storyIds.add(neighbor);
  }
  const entries = [...relations.entries.values()].filter(entry => storyIds.has(entry.storyId));
  return { storyIds, entries };
}

/** All declared branches are possible; the visited set bounds cycles and deduplicates targets. */
export function potentialStoryCalls(relations: StoryRelations, start: StoryEditorTarget): readonly StoryCall[] {
  const outgoing = new Map<string, StoryCall[]>();
  for (const call of relations.calls) {
    const source = key(call.from);
    const rows = outgoing.get(source) ?? [];
    rows.push(call); outgoing.set(source, rows);
  }
  const pending = [start], visited = new Set([key(start)]), result: StoryCall[] = [];
  for (let index = 0; index < pending.length; index++) {
    for (const call of outgoing.get(key(pending[index])) ?? []) {
      if (visited.has(key(call.to))) continue;
      visited.add(key(call.to)); result.push(call); pending.push(call.to);
    }
  }
  return result;
}
