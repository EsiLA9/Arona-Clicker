// ============================================================
// ui/flow/flow-render.ts — 流条目的共用渲染入口
// 只负责把 FlowEntry 交给 components/story.ts 的唯一条目分派；
// 专用 Map Talklet 也由该共享分派器渲染，流模型只提供安全的数据投影。
// ============================================================

import type { UIContext } from '../runtime/context';
import { renderChatEntry, type RenderChatEntryOptions } from '../components/story/story';
import type { FlowEntry } from './flow-entry';

/** 渲染单条流条目：实例键由条目自身提供，不新增包裹节点。 */
export function renderFlowEntry(
  ctx: UIContext,
  entry: FlowEntry,
  options: Omit<RenderChatEntryOptions, 'instanceKey'> = {},
): string {
  return renderChatEntry(ctx, entry, { ...options, instanceKey: entry.instanceKey });
}

/** 按流内顺序渲染全部条目；顺序与分组语义由调用方维护。 */
export function renderFlowEntries(
  ctx: UIContext,
  entries: readonly FlowEntry[],
  options: Omit<RenderChatEntryOptions, 'instanceKey'> = {},
): string {
  return entries.map(entry => renderFlowEntry(ctx, entry, options)).join('');
}
