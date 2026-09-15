import type { DefinitionChange } from '../../data-services/definition/definition-types';
import type { SpotDef } from '../../data-services/contracts/world';
import type { Registry } from '../../data-services/registry/registry';

export interface RuntimeSpotInput {
  readonly idName: string;
  readonly areaId: string;
  readonly name: string;
  readonly description: string;
  readonly baseCost: number;
  readonly baseCostResource: string;
  readonly baseYield: number;
  readonly baseYieldResource: string;
  readonly baseCapacity: number;
  /** 可选数值字段：未设置时省略该键，不写入 Def。 */
  readonly yieldPerLevel?: number;
  readonly maxLevel?: number;
  readonly upgradeCostBase?: number;
  readonly upgradeCostGrowth?: number;
}

export type RuntimeSpotMutation =
  | {
      readonly operation: 'create';
      readonly modName: string;
      readonly spot: RuntimeSpotInput;
      readonly expectedRevision: number;
    }
  | {
      readonly operation: 'replace';
      readonly modName: string;
      readonly idName: string;
      readonly spot: RuntimeSpotInput;
      readonly expectedRevision: number;
    }
  | {
      readonly operation: 'delete';
      readonly modName: string;
      readonly idName: string;
      readonly playerData: 'retain' | 'purge';
      readonly expectedRevision: number;
    }
  | {
      readonly operation: 'suspend';
      readonly modName: string;
      readonly idName: string;
      readonly expectedRevision: number;
    }
  | {
      readonly operation: 'resume';
      readonly modName: string;
      readonly idName: string;
      readonly expectedRevision: number;
    };

export type RuntimeContentDiagnosticCode =
  | 'invalid-operation'
  | 'invalid-revision'
  | 'stale-revision'
  | 'invalid-mod-name'
  | 'mod-conflict'
  | 'invalid-content-id'
  | 'invalid-spot-id'
  | 'invalid-field'
  | 'spot-not-owned'
  | 'spot-not-found'
  | 'unsupported-operation'
  | 'registry-rejected'
  | 'commit-failed'
  | 'rollback-failed';

export interface RuntimeContentDiagnostic {
  readonly code: RuntimeContentDiagnosticCode;
  readonly path?: string;
  readonly message: string;
}

export interface RuntimeModStateSnapshot {
  readonly modName: string | null;
  readonly sourceId: string;
  readonly spots: ReadonlyMap<string, SpotDef>;
  readonly suspendedSpotIds: ReadonlySet<string>;
  readonly revision: number;
}

export interface RuntimeSpotCommit {
  readonly mutation: RuntimeSpotMutation;
  readonly operation: RuntimeSpotMutation['operation'];
  readonly modName: string;
  readonly spotId: string;
  readonly previousSpot: SpotDef | undefined;
  readonly currentSpot: SpotDef | undefined;
  readonly playerData: 'retain' | 'purge' | undefined;
  readonly revisionBefore: number;
  readonly revisionAfter: number;
  readonly transition: DefinitionChange;
}

export interface RuntimeSpotRollbackContext {
  readonly commit: RuntimeSpotCommit;
  readonly error: unknown;
  readonly registryRollbackError?: unknown;
}

export interface RuntimeContentCoordinatorSettings {
  readonly modName?: string;
  readonly temporaryModName?: string;
  readonly sourceId?: string;
  readonly onCommitted?: (commit: RuntimeSpotCommit) => void;
  readonly onRollback?: (context: RuntimeSpotRollbackContext) => void;
}

export interface RuntimeContentCoordinatorOptions extends RuntimeContentCoordinatorSettings {
  readonly registry: Registry;
}

export interface RuntimeSpotMutationResult {
  readonly ok: boolean;
  readonly revision: number;
  readonly spotId: string;
  readonly operation: RuntimeSpotMutation['operation'];
  readonly transition?: DefinitionChange;
  readonly diagnostics: readonly RuntimeContentDiagnostic[];
  readonly message: string;
}

export interface RuntimeDefinitionEditorCommands {
  createSpot(spot: RuntimeSpotInput): RuntimeSpotMutationResult;
  replaceSpot(idName: string, spot: RuntimeSpotInput): RuntimeSpotMutationResult;
  deleteSpot(idName: string, playerData: 'retain' | 'purge'): RuntimeSpotMutationResult;
  suspendSpot(idName: string): RuntimeSpotMutationResult;
  resumeSpot(idName: string): RuntimeSpotMutationResult;
}
