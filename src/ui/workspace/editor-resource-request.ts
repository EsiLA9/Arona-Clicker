export type EditorResourceOrigin = 'explorer-placement' | 'instance-link' | 'external' | 'development';

export interface EditorResourceRef {
  readonly providerKey: string;
  readonly resourceKey: string;
  readonly kind: string;
  readonly id: string;
  /** Optional Provider hint for aggregate resources whose write owner is separate from identity. */
  readonly ownerModName?: string;
}

export interface EditorResourceOpenRequest {
  readonly resource: EditorResourceRef;
  readonly placementKey?: string;
  readonly origin: EditorResourceOrigin;
  /** Provider-specific source hint, such as a Story pack or draft source. */
  readonly sourceKey?: string;
}

export function editorResourceOpenRequest(element: HTMLElement, origin: EditorResourceOrigin = 'explorer-placement'): EditorResourceOpenRequest | undefined {
  const { editorResourceProvider: providerKey, editorResourceKey: resourceKey,
    editorResourceKind: kind, editorResourceId: id, editorPlacementKey: placementKey,
    editorResourceSource: sourceKey, editorResourceOwner: ownerModName } = element.dataset;
  if (!providerKey || !resourceKey || !kind || !id) return undefined;
  return {
    resource: { providerKey, resourceKey, kind, id, ownerModName: ownerModName || undefined },
    placementKey: placementKey || undefined,
    origin,
    // An empty attribute is an explicit runtime source. Only an absent
    // attribute means that the caller has no source hint.
    sourceKey: element.hasAttribute('data-editor-resource-source') ? sourceKey ?? '' : undefined,
  };
}
