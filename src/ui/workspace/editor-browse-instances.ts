import { BrowseInstanceManager } from './browse-instance-manager';
import type { StoryBrowseInstanceState } from '../story-editor/workspace-session';
import type { WorldBrowseInstanceState } from '../runtime-editor/world-browser-provider';

export type EditorBrowseInstanceState = StoryBrowseInstanceState | WorldBrowseInstanceState;

/** Workbench-wide instance registry. It starts empty; Providers create records on explicit entry. */
export function createEditorBrowseInstanceManager(): BrowseInstanceManager<EditorBrowseInstanceState> {
  return new BrowseInstanceManager<EditorBrowseInstanceState>();
}
