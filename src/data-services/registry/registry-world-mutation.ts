import type { AreaDef, InitDef } from '../contracts/world';

export type RegistryInitMutation =
  | { readonly operation: 'create'; readonly ownerModName: string; readonly init: InitDef }
  | { readonly operation: 'replace'; readonly ownerModName: string; readonly init: InitDef }
  | { readonly operation: 'delete'; readonly ownerModName: string; readonly initId: string };

export type RegistryAreaMutation =
  | { readonly operation: 'create'; readonly ownerModName: string; readonly area: AreaDef }
  | { readonly operation: 'replace'; readonly ownerModName: string; readonly area: AreaDef }
  | { readonly operation: 'delete'; readonly ownerModName: string; readonly areaId: string };

export interface RegistryInitMutationReceipt {
  readonly operation: RegistryInitMutation['operation'];
  readonly ownerModName: string;
  readonly initId: string;
  readonly previousInit: InitDef | undefined;
  readonly currentInit: InitDef | undefined;
  rollback(): void;
}

export interface RegistryAreaMutationReceipt {
  readonly operation: RegistryAreaMutation['operation'];
  readonly ownerModName: string;
  readonly areaId: string;
  readonly previousArea: AreaDef | undefined;
  readonly currentArea: AreaDef | undefined;
  rollback(): void;
}
