import type { EditorWorkspaceTheme } from './editor-workspace-appearance';
import type { EditorReturn } from './editor-return';
import { createEditorBrowseInstanceManager } from './editor-browse-instances';
import { EditorExplorerService } from './editor-explorer-service';
import { createEditorWorkspaceColumn, createEditorWorkspaceFrame } from './editor-workspace-frame';
import { editorLayout, editorToolIcon, editorWorkspaceEdges, type EditorLayoutState, type EditorWorkspaceChrome, type EditorWorkspaceView } from './editor-workspace';
import type { WorkspaceColumnSpec } from '../components/shared/workspace-frame';
import type { UIContext } from '../runtime/context';
import type { BrowseInstanceSnapshot } from './browse-instance-manager';
import type { EditorExplorerStateSnapshot } from './editor-explorer-service';
import { worldWorkIcon, worldWorkType } from '../runtime-editor/world-browser';
import { renderStoryDocumentIcon } from './editor-directory';

export type EditorExplorerType = 'story' | 'world';

export interface EditorWorkbenchExternalSession {
  readonly theme: EditorWorkspaceTheme;
  readonly returnTo: EditorReturn;
}

export interface EditorWorkbenchBusinessChrome {
  readonly commands: string;
  readonly status: string;
  readonly canDuplicate: boolean;
  readonly temporaryView?: boolean;
  readonly viewOverride?: EditorWorkspaceView;
  readonly instancesVisible?: boolean;
}

export interface EditorWorkbenchBusinessProjection extends EditorWorkbenchBusinessChrome {
  readonly columns: readonly WorkspaceColumnSpec[];
}

export interface EditorExplorerProjection {
  readonly type: EditorExplorerType;
  readonly state: EditorExplorerStateSnapshot;
  readonly column: WorkspaceColumnSpec;
  readonly bindColumn: (root: HTMLElement) => () => void;
}

export interface EditorWorkbenchProjection {
  readonly context: EditorWorkbenchCompositionContext;
  readonly chrome: EditorWorkspaceChrome;
  readonly frame: ReturnType<typeof createEditorWorkspaceFrame>;
}

/** Short-lived read view assembled from the three authoritative services for one render/update. */
export interface EditorWorkbenchCompositionContext {
  readonly activeExplorerType: EditorExplorerType;
  readonly explorerState: EditorExplorerStateSnapshot;
  readonly browseInstances: BrowseInstanceSnapshot<unknown>;
  readonly layout: Readonly<EditorLayoutState>;
}

const storyWorkIcon = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 4h4.5A2.5 2.5 0 0 1 10 6.5V17a3.2 3.2 0 0 0-2.5-1.3H3zm14 0h-4.5A2.5 2.5 0 0 0 10 6.5V17a3.2 3.2 0 0 1 2.5-1.3H17z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';

export function createEditorWorkbenchChrome(context: EditorWorkbenchCompositionContext,
  business?: EditorWorkbenchBusinessChrome): EditorWorkspaceChrome {
  return {
    layout: context.layout, edges: editorWorkspaceEdges(['left', 'center', 'right']),
    temporaryView: business?.temporaryView ?? false, viewOverride: business?.viewOverride,
    instancesVisible: business?.instancesVisible,
    workTypes: [
      { id: 'story', name: '故事编辑', icon: storyWorkIcon, active: context.activeExplorerType === 'story' },
      { id: worldWorkType, name: '世界编辑器', icon: worldWorkIcon, active: context.activeExplorerType === 'world' },
    ],
    instances: context.browseInstances.instances.filter(instance => instance.id === context.browseInstances.activeBrowseInstanceId
      || Boolean(instance.resourceKey || instance.presentation.kind)).map(instance => ({
      id: instance.id, title: instance.presentation.title,
      typeLabel: instance.providerKey === worldWorkType ? 'World' : instance.presentation.kind === 'entry' ? 'Entry' : 'Story',
      label: instance.presentation.title, icon: instance.providerKey === worldWorkType ? worldWorkIcon
        : instance.presentation.kind ? renderStoryDocumentIcon(instance.presentation.kind === 'entry' ? 'entry' : 'story') : editorToolIcon('open'),
      active: instance.id === context.browseInstances.activeBrowseInstanceId,
    })),
    canDuplicate: business?.canDuplicate ?? false,
    commands: business?.commands ?? '', status: business?.status ?? '尚未打开浏览实例',
  };
}

/** Owns one advanced-editor session and its shared instance manager. Geometry remains in EditorLayoutService. */
export class EditorWorkbench {
  readonly browseInstances = createEditorBrowseInstanceManager();
  readonly explorer = new EditorExplorerService();
  activeExplorerType: EditorExplorerType = 'story';
  private current?: EditorWorkbenchExternalSession;

  get session(): EditorWorkbenchExternalSession | undefined { return this.current; }
  get isOpen(): boolean { return Boolean(this.current); }
  get activeTheme(): EditorWorkspaceTheme | undefined { return this.current?.theme; }

  /** Compose only the common frame and chrome; provider columns/commands are read from this call's live projection. */
  project(ctx: UIContext, explorer: EditorExplorerProjection, business?: EditorWorkbenchBusinessProjection): EditorWorkbenchProjection {
    const composition: EditorWorkbenchCompositionContext = {
      activeExplorerType: this.activeExplorerType, explorerState: explorer.state,
      browseInstances: this.browseInstances.snapshot(), layout: editorLayout.state,
    };
    const businessColumns = business?.columns ?? [];
    const columns = [businessColumns.find(column => column.slot === 'left') ?? { ...explorer.column, bind: explorer.bindColumn },
      businessColumns.find(column => column.slot === 'center') ?? createEditorWorkspaceColumn(ctx, { key: 'editor-content', slot: 'center', bindingKey: 'empty-workbench',
        workspaceOwner: 'editor-workbench', hostId: 'editor-content', themeScope: 'center.editor', title: '内容',
        content: '<p class="editor-workbench-empty" role="status">从左侧目录打开资源，或切换工作类型。</p>' }),
      businessColumns.find(column => column.slot === 'right') ?? createEditorWorkspaceColumn(ctx, { key: 'editor-inspector', slot: 'right', bindingKey: 'empty-workbench',
        workspaceOwner: 'editor-workbench', hostId: 'editor-inspector', themeScope: 'right.editor', title: '属性',
        visible: editorLayout.state.mode === 'advanced', content: '' })];
    const chrome = createEditorWorkbenchChrome(composition, business);
    return { context: composition, chrome, frame: createEditorWorkspaceFrame('editor-workbench', columns) };
  }

  enter(session: EditorWorkbenchExternalSession): boolean {
    if (this.current) return false;
    this.current = session;
    return true;
  }

  leave(): EditorWorkbenchExternalSession | undefined {
    const session = this.current;
    this.current = undefined;
    return session;
  }
}
