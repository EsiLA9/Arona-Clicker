import type { UIContext } from '../runtime/context';
import type { StoryTransfer } from '../../data-services/contracts/story-node-actions';
import type { StoryEditorState } from './model';
import { renderStoryEditorTarget } from './target-view';

/** Editor navigation only; opening a target never executes its transfer. */
export function renderStoryTransferTarget(ctx: UIContext, state: StoryEditorState, id: string): string {
  const target = state.drafts.find(draft => !draft.entryOnly && draft.document.id === id)?.document
    ?? ctx.game.registry.stories.get(id)
    ?? state.drafts.find(draft => draft.document.id === id)?.document;
  return renderStoryEditorTarget(ctx, 'story', id, target?.name ?? '', Boolean(target), { gradient: target?.cardGradient });
}

export function renderStoryTransfer(ctx: UIContext, state: StoryEditorState, transfer?: Partial<StoryTransfer>): string {
  const mode = transfer?.mode === 'goto' || transfer?.mode === 'insert' ? transfer.mode : undefined;
  const label = mode ? `<span class="story-editor-transfer-keyword">${mode}</span>（${mode === 'goto' ? '跳转到' : '插入并返回'}）` : '尚未配置转移方式';
  return `<div class="story-editor-transfer has-target-card"><div class="story-editor-action-node story-editor-transfer-action"${mode ? ` data-transfer-mode="${mode}"` : ''}><span>${label}</span></div>${renderStoryTransferTarget(ctx, state, transfer?.storyId ?? '')}</div>`;
}
