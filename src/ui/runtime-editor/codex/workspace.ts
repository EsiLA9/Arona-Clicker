import { renderWorkspaceLayout } from '../../components/shared/workspace-frame';

export interface ContentWorkspaceSlots {
  readonly navigation: string;
  readonly entries: string;
  readonly detail: string;
  readonly actions?: string;
}

/** Shared tool geometry; callers own read-only or authoring content and state. */
export function renderContentWorkspace(slots: ContentWorkspaceSlots): string {
  const frame = renderWorkspaceLayout({
    id: 'content-tool',
    className: 'runtime-editor-codex__grid',
    layout: { responsive: 'pane-switch' },
    columns: [slots.navigation, slots.entries, slots.detail],
  });
  return `${frame}${slots.actions ? `<footer class="content-workspace-actions">${slots.actions}</footer>` : ''}`;
}
