import { storyEntryType } from '../contracts/story-entry';
import type { StoryEntryDef } from '../contracts/story-entry';
import type { StoryNodeDocument } from '../contracts/story-node';
import type { StoryAction } from '../contracts/story-node-actions';
import { findStoryChoiceMarkOwnerConflict } from './story-node-structure';

/** Validate bounded author relationships across all reachable documents, not just the first page. */
export function validateStoryContinuations(entries: readonly StoryEntryDef[], documents: readonly StoryNodeDocument[], areaIds: ReadonlySet<string>): void {
  const stories = new Map(documents.map(x => [x.id, x]));
  const targets = new Set<string>();
  const fail = (id: string, reason: string): never => { throw new Error(`StoryContinuation:${id}:${reason}`); };
  const walk = (root: string, child: boolean): { cards: number; choiceMarks: Set<string>; continuation?: { entryId: string; areaId?: string; returnFlags?: readonly string[] } } => {
    const markConflict = findStoryChoiceMarkOwnerConflict(root, stories);
    if (markConflict) fail(root, `ChoiceMarkOwnerConflict:${markConflict}`);
    const pending = [root], visited = new Set<string>();
    let cards = 0;
    const choiceMarks = new Set<string>();
    let continuation: { entryId: string; areaId?: string; returnFlags?: readonly string[] } | undefined;
    while (pending.length) {
      const id = pending.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const doc = stories.get(id);
      if (!doc) fail(id, 'DocumentNotFound');
      const action = (value: StoryAction) => {
        if (child && (value.kind === 'entryRequest' || value.kind === 'overlay' && value.command.command === 'show' && value.command.content.kind === 'entryCard')) fail(id, 'NestedEntryRequest');
      };
      for (const node of doc!.nodes ?? []) {
        if (node.type === 'transfer') pending.push(node.transfer.storyId);
        if (node.type === 'operation') action(node.action);
        if (node.type !== 'click') continue;
        const input = node.interaction;
        if (input.kind === 'kizunaCard') { cards++; if (child) fail(id, 'NestedKizuna'); }
        if (input.kind === 'areaContinue') { if (!areaIds.has(input.areaId)) fail(id, 'AreaNotFound'); if (child) fail(id, 'ChildAreaWait'); }
        if (input.kind === 'entryCard' && input.card.continuation) {
          cards++;
          if (child) fail(id, 'NestedKizuna');
          if (input.card.continuation.areaId && !areaIds.has(input.card.continuation.areaId)) fail(id, 'AreaNotFound');
          continuation = { entryId: input.card.request.entryId, ...input.card.continuation };
        }
        if (input.kind === 'entryCard' && child) fail(id, 'NestedEntryCard');
        if (input.kind === 'choice') for (const option of input.options) if (Array.isArray(option.marks)) {
          for (const mark of option.marks) if (typeof mark === 'string') choiceMarks.add(mark);
        }
      }
    }
    return { cards, choiceMarks, ...(continuation ? { continuation } : {}) };
  };
  for (const entry of entries) {
    const parent = walk(entry.storyId, false);
    const count = parent.cards;
    if (count > 1 || entry.kizuna && count !== 1 || !entry.kizuna && count > 1) fail(entry.id, 'OneCardAndBindingRequired');
    const continuation = parent.continuation;
    if (!entry.kizuna && !continuation) continue;
    const binding = entry.kizuna ?? continuation;
    if (!binding) continue;
    const target = entries.find(x => x.id === binding.entryId);
    if (!target || storyEntryType(target) !== 'active' || target.id === entry.id || target.kizuna || targets.has(target.id)) fail(entry.id, 'InvalidChildTarget');
    targets.add(target!.id);
    if (binding.areaId !== undefined && !areaIds.has(binding.areaId)) fail(entry.id, 'AreaNotFound');
    if (binding.returnFlags !== undefined && (!Array.isArray(binding.returnFlags) || binding.returnFlags.some(x => typeof x !== 'string' || !x.trim()) || new Set(binding.returnFlags).size !== binding.returnFlags.length)) fail(entry.id, 'InvalidReturnFlags');
    const child = walk(target!.storyId, true);
    for (const flag of binding.returnFlags ?? []) {
      if (parent.choiceMarks.has(flag) && child.choiceMarks.has(flag)) fail(entry.id, `ChoiceMarkReturned:${flag}`);
    }
  }
}
