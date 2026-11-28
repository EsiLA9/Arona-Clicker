import type { ModalManager, ModalOptions } from '../interaction/modal';

type EditorDialogOptions = Omit<ModalOptions, 'title' | 'width' | 'dismissable'> & { title: string };

/** Complex edits use an explicit close action and return focus to their launch control. */
export function openStoryEditorDialog(modal: ModalManager, options: EditorDialogOptions, trigger?: HTMLElement): HTMLElement {
  const panel = modal.open({
    ...options,
    appearance: 'editor',
    panelClass: ['story-editor-dialog', options.panelClass].filter(Boolean).join(' '),
    dismissable: false,
    onClose: () => {
      options.onClose?.();
      if (trigger?.isConnected && !modal.isOpen()) trigger.focus({ preventScroll: true });
    },
  });
  panel.tabIndex = -1;
  panel.focus({ preventScroll: true });
  return panel;
}
