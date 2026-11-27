import type { EditorWorkspaceTheme } from './editor-workspace-appearance';
import type { EditorReturn } from './editor-return';
import { createEditorBrowseInstanceManager } from './editor-browse-instances';
import { EditorExplorerService } from './editor-explorer-service';

export type EditorExplorerType = 'story' | 'world';

export interface EditorWorkbenchExternalSession {
  readonly theme: EditorWorkspaceTheme;
  readonly returnTo: EditorReturn;
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
