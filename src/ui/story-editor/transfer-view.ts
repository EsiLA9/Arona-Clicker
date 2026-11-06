import type { UIContext } from '../runtime/context';
import type { StoryTransfer } from '../../data-services/contracts/story-node-actions';
import type { StoryEditorState } from './model';
import { renderStoryEditorTarget } from './target-view';

/** Editor navigation only; opening a target never executes its transfer. */
export function renderStoryTransfer(ctx: UIContext, state: StoryEditorState, transfer?: Partial<StoryTransfer>): string {
  const id = transfer?.storyId ?? '';
  const target = state.drafts.find(draft => draft.document.id === id)?.document ?? ctx.game.registry.stories.get(id);
  const mode = transfer?.mode === 'goto' ? 'goto（跳转）' : transfer?.mode === 'insert' ? 'insert（插入并返回）' : '尚未配置转移方式';
  const label = target ? target.name || '未命名 Story' : id ? `${id}（目标不存在）` : '尚未选择 Story';
  return `<div class="story-editor-transfer has-target-card"><div class="story-editor-action-node"><span>${mode}</span><strong>${ctx.escapeHtml(label)}</strong></div>${renderStoryEditorTarget(ctx, 'story', id, label, Boolean(target))}</div>`;
}
