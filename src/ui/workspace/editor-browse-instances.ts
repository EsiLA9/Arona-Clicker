import { BrowseInstanceManager } from './browse-instance-manager';
import type { StoryBrowseInstanceState } from '../story-editor/workspace-session';
import type { WorldBrowseInstanceState } from '../runtime-editor/world-browser-provider';
import type { StoryDirectoryBrowseState } from '../story-editor/directory-instance';

export type EditorBrowseInstanceState = StoryBrowseInstanceState | WorldBrowseInstanceState | StoryDirectoryBrowseState;

/** Workbench-wide instance registry. It starts empty; Providers create records on explicit entry. */
export function createEditorBrowseInstanceManager(): BrowseInstanceManager<EditorBrowseInstanceState> {
  return new BrowseInstanceManager<EditorBrowseInstanceState>();
}
