/** World information targets are limited to knowledge; movement and collection remain separate actions. */
export type WorldInformationTarget = 'existence' | 'name' | 'utility' | 'condition';
export type WorldInformationTargetRef =
  | { readonly entityKind: 'area'; readonly entityId: string; readonly target: WorldInformationTarget }
  | { readonly entityKind: 'areaMap'; readonly entityId: string; readonly target: WorldInformationTarget }
  | { readonly entityKind: 'areaMapNode'; readonly mapId: string; readonly nodeId: string; readonly target: WorldInformationTarget };

