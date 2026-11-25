import type { StoryCardGradient } from '../../data-services/contracts/story-card-gradient';
import type { ModalManager } from '../interaction/modal';
import type { UIContext } from '../runtime/context';
import type { StoryEditorTarget } from './model';
import { openStoryEditorDialog } from './editor-dialog';
import { renderStoryCardOverview, storyCardPickerColors, storyCardStyle } from './target-view';

export function openStoryCardGradientDialog(modal: ModalManager, ctx: UIContext, trigger: HTMLElement, target: StoryEditorTarget,
  name: string, original: StoryCardGradient | undefined, onPreview: (gradient?: StoryCardGradient) => void,
  onApply: (gradient?: StoryCardGradient) => boolean, onClose: () => void): HTMLElement {
  const { kind, id } = target;
  const initial = storyCardPickerColors(kind, id, original);
  let pending = original;
  let applied = false;
  const panel = openStoryEditorDialog(modal, {
    title: '编辑卡片渐变',
    body: `${renderStoryCardOverview(ctx, kind, id, name, original)}
      <div class="story-editor-card-gradient-fields">
        <label>起色<input type="color" name="start" value="${initial.start}"></label>
        <label>止色<input type="color" name="end" value="${initial.end}"></label>
      </div>
      <p class="story-editor-error" data-card-gradient-error role="status" hidden></p>`,
    footer: '<button type="button" class="modal-close">取消</button><button type="button" class="mini-action" data-modal-action="reset">恢复自动配色</button><button type="button" class="primary-button" data-modal-action="apply">应用到草稿</button>',
    onClose: () => { onPreview(applied ? pending : original); onClose(); },
    onAction: action => {
      if (action === 'reset') {
        const defaults = storyCardPickerColors(kind, id);
        start.value = defaults.start;
        end.value = defaults.end;
        pending = undefined;
        preview();
      }
      if (action === 'apply') {
        if (!onApply(pending)) {
          const error = panel.querySelector<HTMLElement>('[data-card-gradient-error]')!;
          error.textContent = '当前内容或数据包编辑状态已变化，无法应用。';
          error.hidden = false;
          return;
        }
        applied = true;
        modal.close();
      }
    },
  }, trigger);
  const start = panel.querySelector<HTMLInputElement>('[name="start"]')!;
  const end = panel.querySelector<HTMLInputElement>('[name="end"]')!;
  const card = panel.querySelector<HTMLElement>('.story-editor-card-overview')!;
  function preview(): void {
    card.setAttribute('style', storyCardStyle(kind, id, pending));
    onPreview(pending);
  }
  panel.addEventListener('input', event => {
    if (event.target !== start && event.target !== end) return;
    pending = { start: start.value, end: end.value };
    preview();
  });
  return panel;
}
