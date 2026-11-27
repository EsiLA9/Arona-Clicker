import type { EditorResourceRef } from './editor-resource-request';

export type EditorExplorerChildState =
  | { readonly kind: 'empty' }
  | { readonly kind: 'loaded'; readonly totalCount: number }
  | { readonly kind: 'deferred'; readonly expectedCount?: number };

export interface EditorExplorerNodePresentation {
  readonly kind?: string;
  readonly icon?: string;
  readonly auxiliaryLabel?: string;
  readonly auxiliaryTone?: string;
  readonly tooltip?: string;
  readonly markers?: readonly string[];
}

export interface EditorExplorerNodeAction {
  readonly id: string;
  readonly label: string;
  readonly icon?: string;
  readonly disabledReason?: string;
  readonly resource?: EditorResourceRef;
  readonly sourceKey?: string;
  readonly attributes?: Readonly<Record<string, string>>;
}

/** Domain data prepared before free-text matching; DOM is only a later interaction surface. */
export interface EditorExplorerNode {
  readonly placementKey: string;
  readonly resource?: EditorResourceRef;
  readonly sourceKey?: string;
  readonly label: string;
  readonly searchableText: readonly string[];
  readonly children: readonly EditorExplorerNode[];
  readonly childState: EditorExplorerChildState;
  readonly presentation?: EditorExplorerNodePresentation;
  readonly actions?: readonly EditorExplorerNodeAction[];
}

export function editorExplorerChildState(count: number): EditorExplorerChildState {
  return count > 0 ? { kind: 'loaded', totalCount: count } : { kind: 'empty' };
}
