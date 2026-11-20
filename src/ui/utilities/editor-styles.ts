import type { ToastService } from '../components/shared/toast';

const editorStyles = {
  story: () => import('../css/story-editor.css'),
  runtime: () => import('../css/runtime-editor.css'),
};
type Editor = keyof typeof editorStyles;
export type EditorStyleLoader = (editor: Editor) => Promise<void> | undefined;
const ready = new Set<Editor>();

export const loadEditorStyles: EditorStyleLoader = editor => {
  if (ready.has(editor)) return;
  return editorStyles[editor]().then(() => { ready.add(editor); });
};

export function withEditorStyles(
  host: { loadEditorStyles?: EditorStyleLoader; toast: ToastService },
  editor: Editor,
  trigger: Element,
  open: () => void,
): void {
  if (trigger.getAttribute('aria-busy') === 'true') return;
  const loading = host.loadEditorStyles?.(editor);
  if (!loading) {
    open();
    return;
  }
  trigger.setAttribute('aria-busy', 'true');
  void loading.then(() => {
    trigger.removeAttribute('aria-busy');
    if (trigger.isConnected) open();
  }, error => {
    trigger.removeAttribute('aria-busy');
    if (trigger.isConnected) host.toast.show('编辑器样式加载失败，请刷新页面后重试。', 'error');
    console.error(error);
  });
}
