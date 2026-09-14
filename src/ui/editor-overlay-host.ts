import type { UIContext } from './context';
import type { UserThemeDraft } from '../arona-clicker/types/user-theme';
import type { BackgroundLayerDef } from '../engine/types/theme';
import type { ThemeLayerTargetRef } from '../arona-clicker/services/user-theme-layer-service';
import { renderLayerEditorDialogShell, renderLayerManagerShell } from './components/user-theme-layer-manager';

const roots = new Map<string, HTMLElement>();

export function ensureUserThemeLayerOverlay(ctx: UIContext, sessionId: string, draft: UserThemeDraft, active: boolean, initialTarget: ThemeLayerTargetRef | null = null, resolvedLayers: readonly BackgroundLayerDef[] = []): HTMLElement {
  const existing = roots.get(sessionId);
  if (existing?.isConnected) return existing;
  const root = document.createElement('div');
  root.className = 'editor-overlay-root';
  root.dataset.editorOverlayRoot = '';
  root.dataset.sessionId = sessionId;
  root.innerHTML = `${renderLayerManagerShell(ctx, draft, active, initialTarget, resolvedLayers)}${renderLayerEditorDialogShell(active)}`;
  document.body.appendChild(root);
  roots.set(sessionId, root);
  return root;
}

export function cleanupUserThemeLayerOverlay(sessionId: string): void {
  roots.get(sessionId)?.remove();
  roots.delete(sessionId);
}
