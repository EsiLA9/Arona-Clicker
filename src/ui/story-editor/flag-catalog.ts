import type { StoryDraft, StoryEditorState, StoryEditorTarget } from './model';
import { renameStoryLocalFlag } from './model';
import { storyTransferContext, type StoryCall, type StoryRelations } from './relations-model';
import { editProperty, propertyKey, readProperty } from './property-model';

export interface StoryFlagUse {
  name: string;
  kind: 'local' | 'global';
  scope: string;
  usage: 'read' | 'write' | 'remove' | 'return';
  source: StoryEditorTarget;
  nodeId?: string;
  path: string;
  available: boolean;
}
export interface StoryFlagBoundary { key: string; call: StoryCall; included?: boolean; missing: boolean }
export interface StoryFlagCatalog { uses: StoryFlagUse[]; boundaries: StoryFlagBoundary[]; missing: StoryEditorTarget[] }
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const rows = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const targetKey = (target: StoryEditorTarget): string => `${target.kind}:${target.id}`;

/** Stable node/option/action row identities keep a decision attached to its call after reordering. */
export function flagImportKey(state: StoryEditorState, relations: StoryRelations, call: StoryCall): string {
  const index = call.path.match(/^\$\.nodes\[(\d+)\]/)?.[1];
  const node = index === undefined ? undefined : relations.stories.get(call.from.id)?.nodes[Number(index)];
  const draft = state.drafts.find(draft => draft.document.id === call.from.id);
  const path = [...call.path.slice(call.path.indexOf(']') + 1).matchAll(/\.([^.[\]]+)|\[(\d+)\]/g)].map(match => match[1] ?? Number(match[2]));
  const location = node && draft ? propertyKey(draft, node.id, path) : node ? `${node.id}:${JSON.stringify(path)}` : call.path;
  return JSON.stringify([call.from.kind, call.from.id, location, call.to.id]);
}

/** Static author information: follow possible calls, never execute conditions or copy runtime flags. */
export function buildStoryFlagCatalog(state: StoryEditorState, relations: StoryRelations, start: StoryEditorTarget, related = false): StoryFlagCatalog {
  const result: StoryFlagCatalog = { uses: [], boundaries: [], missing: [] };
  const choices = state.drafts.find(draft => draft.document.id === start.id)?.flagImports ?? {};
  const outgoing = new Map<string, StoryCall[]>();
  for (const call of relations.calls) { const key = targetKey(call.from); outgoing.set(key, [...(outgoing.get(key) ?? []), call]); }
  const incoming = new Map<string, StoryCall[]>();
  if (related) for (const call of relations.calls) if (call.from.kind === 'story' && call.to.kind === 'story') {
    const key = targetKey(call.to); incoming.set(key,[...(incoming.get(key) ?? []),call]);
  }
  const visited = new Set<string>();
  const seenUses = new Set<string>();
  const pending = [{ target: start, scope: targetKey(start), available: true }];
  if (related && start.kind === 'story') {
    const { entries } = storyTransferContext(relations, start.id, 'both');
    if (entries.length) pending.splice(0,1,...entries.map(entry => ({target:{kind:'entry' as const,id:entry.id},scope:`entry:${entry.id}`,available:true})));
  }
  for (let i = 0; i < pending.length; i++) {
    const { target, scope, available } = pending[i];
    const visit = JSON.stringify([targetKey(target), scope]);
    if (visited.has(visit)) continue;
    visited.add(visit);
    const content = target.kind === 'story' ? relations.stories.get(target.id) : relations.entries.get(target.id);
    if (!content) { if (!result.missing.some(item => targetKey(item) === targetKey(target))) result.missing.push(target); continue; }
    let nodeId: string | undefined;
    const add = (name: unknown, kind: StoryFlagUse['kind'], usage: StoryFlagUse['usage'], path: string) => {
      if (typeof name !== 'string' || !name.trim()) return;
      const key = JSON.stringify([kind, kind === 'global' ? 'global' : scope, targetKey(target), path, usage, name]);
      if (seenUses.has(key)) return;
      seenUses.add(key);
      result.uses.push({ name, kind, usage, scope: kind === 'global' ? 'global' : scope, source: target, nodeId, path, available: kind === 'global' || available });
    };
    const condition = (value: unknown, path: string): void => {
      if (!object(value)) return;
      if (value.target === 'flag') add(value.key, 'global', 'read', `${path}.key`);
      rows(value.conditions).forEach((item, index) => condition(item, `${path}.conditions[${index}]`));
    };
    const effects = (value: unknown, path: string): void => rows(value).forEach((item, index) => {
      if (object(item) && item.op === 'setFlag') add(item.flagId ?? item.target, 'global', 'write', `${path}[${index}].${item.flagId == null ? 'target' : 'flagId'}`);
    });
    const returns = (value: unknown, path: string): void => { if (object(value)) rows(value.returnFlags).forEach((name, index) => add(name, 'local', 'return', `${path}.returnFlags[${index}]`)); };
    const action = (value: unknown, path: string): void => {
      if (!object(value)) return;
      if (value.kind === 'localFlag' && (value.op === 'set' || value.op === 'remove')) add(value.name, 'local', value.op === 'set' ? 'write' : 'remove', `${path}.name`);
      if (value.kind === 'state') effects(value.effects, `${path}.effects`);
      if (value.kind === 'overlay' && object(value.command) && value.command.command === 'show' && object(value.command.content) && value.command.content.kind === 'entryCard' && object(value.command.content.card)) returns(value.command.content.card.continuation, `${path}.command.content.card.continuation`);
    };
    if (target.kind === 'story' && 'nodes' in content) {
      content.nodes.forEach((node, index) => {
        nodeId = node.id; const path = `$.nodes[${index}]`;
        add(node.requiresFlag, 'local', 'read', `${path}.requiresFlag`);
        if (node.type === 'operation') action(node.action, `${path}.action`);
        if (node.type !== 'click') return;
        const input = node.interaction;
        if (input?.kind === 'choice') {
          rows(input.options).forEach((option, index) => {
            if (!object(option)) return;
            const optionPath = `${path}.interaction.options[${index}]`;
            condition(option.showWhen, `${optionPath}.showWhen`);
            add(option.requiresFlag, 'local', 'read', `${optionPath}.requiresFlag`);
            rows(option.marks).forEach((name, markIndex) => add(name, 'local', 'write', `${optionPath}.marks[${markIndex}]`));
          });
        }
        if (input?.kind === 'entryCard') returns(input.card?.continuation, `${path}.interaction.card.continuation`);
      });
    } else if ('triggerCondition' in content) {
      condition(content.triggerCondition, '$.triggerCondition');
      if ('block' in content) condition(content.block, '$.block');
      effects(content.completionReward?.first, '$.completionReward.first'); effects(content.completionReward?.repeat, '$.completionReward.repeat');
      content.conditionalRewards?.forEach((reward, index) => { condition(reward.condition, `$.conditionalRewards[${index}].condition`); effects(reward.effects, `$.conditionalRewards[${index}].effects`); });
      content.reactions?.forEach((reaction, index) => { condition(reaction.condition, `$.reactions[${index}].condition`); effects(reaction.effects, `$.reactions[${index}].effects`); });
      content.revealTriggers?.forEach((reveal, index) => condition(reveal.condition, `$.revealTriggers[${index}].condition`));
      returns(content.kizuna, '$.kizuna');
    }
    nodeId = undefined;
    for (const call of outgoing.get(targetKey(target)) ?? []) {
      if (call.to.kind === 'entry' && start.kind === 'story') {
        const key = flagImportKey(state, relations, call);
        const boundary = { key, call, included: choices[key], missing: !relations.entries.has(call.to.id) };
        if (!result.boundaries.some(item => item.key === key)) result.boundaries.push(boundary);
        if (!boundary.included) continue;
      }
      const crossesEntry = call.to.kind === 'entry';
      pending.push({ target: call.to, scope: crossesEntry ? targetKey(call.to) : scope, available: crossesEntry ? false : available });
    }
    for (const call of incoming.get(targetKey(target)) ?? []) pending.push({target:call.from,scope,available});
  }
  return result;
}

export function storyFlagNames(catalog: StoryFlagCatalog, kind: StoryFlagUse['kind']): string[] {
  return [...new Set(catalog.uses.filter(use => use.kind === kind && use.available).map(use => use.name))].sort();
}

export function storyFlagRenameUses(catalog: StoryFlagCatalog, storyId: string, kind: string, name: string, scope: string) {
  const own = (use: StoryFlagUse) => use.source.kind === 'story' && use.source.id === storyId;
  const matches = catalog.uses.filter(use => use.kind === kind && use.name === name);
  const current = matches.filter(own);
  const scopes = new Set(current.map(use => use.scope));
  const locations = [...new Map(current.map(use => [use.path, use])).values()];
  return {
    locations: scopes.has(scope) ? locations : [],
    external: matches.filter(use => !own(use) && scopes.has(use.scope)),
    scopes,
  };
}

export function renameStoryCatalogFlag(draft: StoryDraft, catalog: StoryFlagCatalog, kind: string, name: string, scope: string, next: string) {
  const { locations, scopes } = storyFlagRenameUses(catalog, draft.document.id, kind, name, scope);
  if (!locations.length) return '本篇已找不到此标记的引用。';
  if (!next) return '请输入新的 Flag ID。';
  if (next === name) return undefined;
  if (catalog.uses.some(use => use.name === next && use.kind === kind && scopes.has(use.scope))) return '该作用域内已有同名 Flag。';
  const fields = locations.map(use => ({
    nodeId: use.nodeId!,
    path: [...use.path.replace(/^\$\.nodes\[\d+\]/, '').matchAll(/\.([^.[\]]+)|\[(\d+)\]/g)].map(match => match[1] ?? Number(match[2])),
  }));
  if (fields.some(({ nodeId, path }) => readProperty(draft, nodeId, path) !== name)) return 'Flag 的引用已变化，请重新打开重命名。';
  if (kind === 'local') {
    const result = renameStoryLocalFlag(draft, name, next, false);
    if (!result.ok) return result.reason;
  }
  for (const { nodeId, path } of fields) editProperty(draft, nodeId, path, next);
  return undefined;
}
