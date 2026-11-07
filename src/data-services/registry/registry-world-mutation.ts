import type { AreaDef, InitDef } from '../contracts/world';
import type { AreaMapDef } from '../contracts/area-map';

export type RegistryInitMutation =
  | { readonly operation: 'create'; readonly ownerModName: string; readonly init: InitDef }
  | { readonly operation: 'replace'; readonly ownerModName: string; readonly init: InitDef }
  | { readonly operation: 'delete'; readonly ownerModName: string; readonly initId: string };

export type RegistryAreaMutation =
  | { readonly operation: 'create'; readonly ownerModName: string; readonly area: AreaDef }
  | { readonly operation: 'replace'; readonly ownerModName: string; readonly area: AreaDef }
  | { readonly operation: 'delete'; readonly ownerModName: string; readonly areaId: string };

export type RegistryAreaMapMutation =
  | { readonly operation: 'create'; readonly ownerModName: string; readonly areaMap: AreaMapDef }
  | { readonly operation: 'replace'; readonly ownerModName: string; readonly areaMap: AreaMapDef }
  | { readonly operation: 'delete'; readonly ownerModName: string; readonly areaMapId: string };

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

export interface RegistryAreaMapMutationReceipt {
  readonly operation: RegistryAreaMapMutation['operation'];
  readonly ownerModName: string;
  readonly areaMapId: string;
  readonly previousAreaMap: AreaMapDef | undefined;
  readonly currentAreaMap: AreaMapDef | undefined;
  rollback(): void;
}

export interface RegistryAreaMapMutationBatchReceipt {
  readonly areaMapIds: readonly string[];
  readonly changes: readonly {
    readonly operation: RegistryAreaMapMutation['operation'];
    readonly ownerModName: string;
    readonly areaMapId: string;
    readonly previousAreaMap: AreaMapDef | undefined;
    readonly currentAreaMap: AreaMapDef | undefined;
  }[];
  rollback(): void;
}
