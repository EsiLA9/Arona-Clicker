import type { StoryEntryDef } from '../contracts/story-entry';
import type { StoryNodeDocument, StoryNodeResult } from '../contracts/story-node';
import type { StoryAction } from '../contracts/story-node-actions';

/** Validate bounded author relationships across all reachable documents, not just the first page. */
export function validateStoryContinuations(entries: readonly StoryEntryDef[], documents: readonly StoryNodeDocument[], areaIds: ReadonlySet<string>): void {
  const stories = new Map(documents.map(x => [x.id, x]));
  const targets = new Set<string>();
  const fail = (id: string, reason: string): never => { throw new Error(`StoryContinuation:${id}:${reason}`); };
  const walk = (root: string, child: boolean): number => {
    const pending = [root], visited = new Set<string>();
    let cards = 0;
    while (pending.length) {
      const id = pending.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const doc = stories.get(id);
      if (!doc) fail(id, 'DocumentNotFound');
      const action = (value: StoryAction) => {
        if (child && (value.kind === 'entryRequest' || value.kind === 'overlay' && value.command.command === 'show' && value.command.content.kind === 'entryCard')) fail(id, 'NestedEntryRequest');
      };
      const result = (value?: StoryNodeResult) => { value?.actions?.forEach(action); if (value?.transfer) pending.push(value.transfer.storyId); };
      for (const node of doc!.nodes ?? []) {
        if (node.type === 'transfer') pending.push(node.transfer.storyId);
        if (node.type === 'operation') action(node.action);
        if (node.type !== 'click') continue;
        const input = node.interaction;
        if (input.kind === 'kizunaCard') { cards++; if (child) fail(id, 'NestedKizuna'); }
        if (input.kind === 'areaContinue') { if (!areaIds.has(input.areaId)) fail(id, 'AreaNotFound'); if (child) fail(id, 'ChildAreaWait'); }
        if (input.kind === 'entryCard' && input.card.continuation) { cards++; if (child) fail(id, 'NestedKizuna'); if (input.card.continuation.areaId && !areaIds.has(input.card.continuation.areaId)) fail(id, 'AreaNotFound'); }
        if (input.kind === 'entryCard' && child) fail(id, 'NestedEntryCard');
        if (input.kind === 'button') result(input.result);
        if (input.kind === 'choice') { input.sharedActions?.forEach(action); input.options.forEach(x => result(x.result)); }
      }
    }
    return cards;
  };
  for (const entry of entries) {
    const count = walk(entry.storyId, false);
    if (count > 1 || entry.kizuna && count !== 1 || !entry.kizuna && count > 1) fail(entry.id, 'OneCardAndBindingRequired');
    const continuationNode = stories.get(entry.storyId)?.nodes?.find(node => node.type === 'click' && node.interaction.kind === 'entryCard' && node.interaction.card.continuation);
    const continuation = continuationNode?.type === 'click' && continuationNode.interaction.kind === 'entryCard' ? continuationNode.interaction.card.continuation : undefined;
    if (!entry.kizuna && !continuation) continue;
    const continuationEntryId = continuationNode?.type === 'click' && continuationNode.interaction.kind === 'entryCard' ? continuationNode.interaction.card.request.entryId : undefined;
    const binding = entry.kizuna ?? (continuation && continuationEntryId ? { entryId: continuationEntryId, areaId: continuation.areaId, returnFlags: continuation.returnFlags } : undefined);
    if (!binding) continue;
    const target = entries.find(x => x.id === binding.entryId);
    if (!target || target.type !== 'active' || target.id === entry.id || target.kizuna || targets.has(target.id)) fail(entry.id, 'InvalidChildTarget');
    targets.add(target!.id);
    if (binding.areaId !== undefined && !areaIds.has(binding.areaId)) fail(entry.id, 'AreaNotFound');
    if (binding.returnFlags !== undefined && (!Array.isArray(binding.returnFlags) || binding.returnFlags.some(x => typeof x !== 'string' || !x.trim()) || new Set(binding.returnFlags).size !== binding.returnFlags.length)) fail(entry.id, 'InvalidReturnFlags');
    walk(target!.storyId, true);
  }
}
