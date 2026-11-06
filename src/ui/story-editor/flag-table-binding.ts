import type { StoryDraft } from './model';
import type { StoryFlagCatalog } from './flag-catalog';
import { editProperty } from './property-model';

export function canBindFlagTableNode(draft: StoryDraft, catalog: StoryFlagCatalog, name: string, scope: string, nodeId: string): {ok:true;changed:boolean}|{ok:false;reason:string} {
  const local = catalog.uses.filter(use => use.kind === 'local' && use.name === name && use.scope === scope);
  if (!local.some(use => use.available)) return {ok:false,reason:'该局部标记属于其他 Entry，不能绑定到当前 Story。'};
  if (!local.some(use => use.available && (use.usage === 'write' || use.usage === 'return'))) return {ok:false,reason:'此局部标记没有可用的提供方或回传声明。'};
  const node = draft.document.nodes.find(node => node.id === nodeId);
  if (!node) return {ok:false,reason:'目标节点已不存在。'};
  if (node.requiresFlag && node.requiresFlag !== name) return {ok:false,reason:`节点已有局部标记条件「${node.requiresFlag}」，请先清除或修改。`};
  return {ok:true,changed:node.requiresFlag !== name};
}

export function bindFlagTableNode(draft: StoryDraft, catalog: StoryFlagCatalog, name: string, scope: string, nodeId: string) {
  const plan = canBindFlagTableNode(draft,catalog,name,scope,nodeId);
  if (plan.ok && plan.changed) editProperty(draft,nodeId,['requiresFlag'],name);
  return plan;
}
