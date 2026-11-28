import type { EditorResourceRef } from './editor-resource-request';
import type { EditorEntryIconType } from '../components/shared/editor-entity-icon';

export interface EditorExplorerNodePresentation {
  readonly kind?: string;
  readonly entryType?: EditorEntryIconType;
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
  readonly run?: (root: HTMLElement) => void;
}

/** A position is scoped to its view. A resource can appear at several positions. */
export interface EditorExplorerNode {
  readonly placementKey: string;
  readonly parentKey?: string;
  readonly folder?: { readonly mount?: 'on-expand'; readonly toggleIconType?: string };
  readonly resource?: EditorResourceRef;
  readonly resourceActionLabel?: string;
  readonly openDisabledReason?: string;
  readonly sourceKey?: string;
  readonly label: string;
  readonly searchableText: readonly string[];
  readonly filterValues?: Readonly<Record<string, string | readonly string[]>>;
  readonly presentation?: EditorExplorerNodePresentation;
  readonly actions?: readonly EditorExplorerNodeAction[];
  readonly select?: (root: HTMLElement) => void;
  readonly selectDisabledReason?: string;
}

export function indexEditorExplorer(nodes: readonly EditorExplorerNode[]) {
  const byKey = new Map<string, EditorExplorerNode>();
  const byResource = new Map<string, EditorExplorerNode[]>();
  const children = new Map<string | undefined, EditorExplorerNode[]>();
  for (const node of nodes) {
    if (byKey.has(node.placementKey)) throw new Error("Duplicate Explorer placement: " + node.placementKey);
    byKey.set(node.placementKey, node);
    const siblings = children.get(node.parentKey) ?? [];
    siblings.push(node);
    children.set(node.parentKey, siblings);
    if (node.resource) {
      const positions = byResource.get(node.resource.resourceKey) ?? [];
      positions.push(node);
      byResource.set(node.resource.resourceKey, positions);
    }
  }
  const visited = new Set<string>();
  const trail = new Set<string>();
  const validate = (node: EditorExplorerNode): void => {
    if (visited.has(node.placementKey)) return;
    if (trail.has(node.placementKey)) throw new Error("Cyclic Explorer placement: " + node.placementKey);
    if (node.parentKey !== undefined) {
      const parent = byKey.get(node.parentKey);
      if (!parent?.folder) throw new Error("Invalid Explorer parent: " + node.parentKey);
      trail.add(node.placementKey);
      validate(parent);
      trail.delete(node.placementKey);
    }
    visited.add(node.placementKey);
  };
  for (const node of nodes) validate(node);
  return {
    byKey,
    children: (parentKey?: string): readonly EditorExplorerNode[] => children.get(parentKey) ?? [],
    candidates: (resourceKey: string, sourceKey?: string): readonly EditorExplorerNode[] => {
      const candidates = byResource.get(resourceKey) ?? [];
      return sourceKey === undefined ? candidates : candidates.filter(node => node.sourceKey === sourceKey);
    },
  };
}

export function chooseEditorExplorerPosition(candidates: readonly EditorExplorerNode[], preferredKey?: string): EditorExplorerNode | undefined {
  return candidates.find(node => node.placementKey === preferredKey) ?? candidates[0];
}
