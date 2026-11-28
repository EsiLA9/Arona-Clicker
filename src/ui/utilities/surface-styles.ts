import type { ToastService } from '../components/shared/toast';

async function loadEditorWorkspaceStyles(): Promise<void> {
  await import('../css/overlay-scrollbar.css');
  await import('../css/editor-workspace.css');
  await import('../css/editor-directory.css');
}

async function loadStoryEditorStyles(): Promise<void> {
  await loadEditorWorkspaceStyles();
  await import('../css/story-editor.css');
}

const surfaceStyles = {
  story: loadStoryEditorStyles,
  'world-editor': loadEditorWorkspaceStyles,
  runtime: () => import('../css/runtime-editor.css'),
  operation: () => import('../css/operation-workspace.css'),
  'map-entry': () => import('../css/map-entry-workspace.css'),
  map: () => import('../css/map-workspace.css'),
  'area-map': () => import('../css/area-map.css'),
  theme: () => import('../css/user-theme-editor.css'),
  collection: () => import('../css/codex.css'),
};
type Surface = keyof typeof surfaceStyles;
export type SurfaceStyleLoader = (surface: Surface) => Promise<void> | undefined;
const ready = new Set<Surface>();

export const loadSurfaceStyles: SurfaceStyleLoader = surface => {
  if (ready.has(surface)) return;
  return surfaceStyles[surface]().then(() => { ready.add(surface); });
};

export function withSurfaceStyles(
  host: { loadSurfaceStyles?: SurfaceStyleLoader; toast: ToastService },
  surface: Surface,
  trigger: Element,
  open: () => void,
): void {
  if (trigger.getAttribute('aria-busy') === 'true') return;
  const loading = host.loadSurfaceStyles?.(surface);
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
    if (trigger.isConnected) host.toast.show('界面样式加载失败，请刷新页面后重试。', 'error');
    console.error(error);
  });
}
