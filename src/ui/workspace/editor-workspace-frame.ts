import type { UIContext } from '../runtime/context';
import { renderWorkspaceFrame, type WorkspaceColumnSpec, type WorkspaceSlot } from '../components/shared/workspace-frame';
import { renderWorkspaceTitlebar, type WorkspaceTitlebarLeaveAction } from '../components/shared/workspace-titlebar';

type EditorColumnSpec = Omit<WorkspaceColumnSpec, 'slot' | 'width' | 'surface' | 'header'> & {
  slot: WorkspaceSlot;
  key: string;
  workspaceOwner: string;
  bindingKey: string;
  themeScope: string;
  title: string;
  leaveAction?: WorkspaceTitlebarLeaveAction;
  accessory?: string;
  titleActions?: string;
};

export function createEditorWorkspaceColumn(ctx: UIContext, spec: EditorColumnSpec): WorkspaceColumnSpec {
  const { title, leaveAction, accessory, titleActions, ...column } = spec;
  const { slot, key } = column;
  const fallback = slot === 'left' ? '300px' : `var(--workspace-${slot}-width)`;
  return {
    definitionId: key,
    scroll: slot === 'left' ? 'content' : 'auto',
    ...column,
    className: ['editor-workspace-column', column.className].filter(Boolean).join(' '),
    width: `var(--editor-track-${slot}, ${fallback})`,
    surface: 'panel',
    header: renderWorkspaceTitlebar(ctx, slot, title, leaveAction, accessory, titleActions),
  };
}

export function createEditorWorkspaceFrame(id: string, columns: readonly WorkspaceColumnSpec[]) {
  return { id, instanceId: 'editor-workbench', updates: 'external' as const, columns };
}

export { renderWorkspaceFrame as renderEditorWorkspaceFrame };
