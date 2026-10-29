import type { UIContext } from '../runtime/context';
import type { WorkspaceColumnSpec } from '../components/shared/workspace-frame';

/** Recomputes dynamic semantic content from its original explicit binding and options. */
export type SemanticColumnRefresh = (ctx: UIContext) => WorkspaceColumnSpec;

export interface SemanticColumnSpec extends WorkspaceColumnSpec {
  semanticRefresh?: SemanticColumnRefresh;
}
