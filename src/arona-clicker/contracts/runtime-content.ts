import type { DefinitionChange } from '../../data-services/definition/definition-types';
import type { AreaDef, InitDef, SpotDef } from '../../data-services/contracts/world';
import type { PaymentCostDraft, PaymentOptionDraft, SpotFunctionalityDraft, SpotLevelUpgradeDraft, SpotRevealTriggerDraft } from '../../data-services/authoring/content-policy-types';
import type { Registry } from '../../data-services/registry/registry';

export type RuntimeSpotFunctionalityDraft = SpotFunctionalityDraft;
export type RuntimePaymentCostDraft = PaymentCostDraft;
export type RuntimePaymentOptionDraft = PaymentOptionDraft;
export type RuntimeSpotLevelUpgradeDraft = SpotLevelUpgradeDraft;
export type RuntimeSpotRevealTriggerDraft = SpotRevealTriggerDraft;

/**
 * 编辑器提交的 Spot 输入：键与 `SPOT_CONTENT_POLICY` 的字段 / 扩展 inputKey 对齐，
 * 由策略表负责校验与物化（见 `buildAuthoringDef`）。
 */
export interface RuntimeSpotInput {
  readonly idName: string;
  readonly areaId: string;
  readonly name: string;
  readonly description: string;
  readonly purchaseOptions: readonly RuntimePaymentOptionDraft[];
  readonly maxLevel?: number;
  readonly conditionText?: string;
  readonly global?: boolean;
  readonly functionalities?: readonly RuntimeSpotFunctionalityDraft[];
  readonly levelUpgrades?: readonly RuntimeSpotLevelUpgradeDraft[];
  readonly revealTriggers?: readonly RuntimeSpotRevealTriggerDraft[];
  /** 层级标签以 `a/b` 路径形式提交，由扩展编码为 TagPath[]。 */
  readonly tags?: readonly string[];
  readonly gachaPools?: readonly string[];
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
  | 'init-not-owned'
  | 'area-not-owned'
  | 'init-not-found'
  | 'area-not-found'
  | 'reference-blocked'
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

/** Init / Area 的热 CRUD 输入；字段与对应 authoring policy 的 inputKey 对齐。 */
export interface RuntimeInitInput {
  readonly idName: string;
  readonly name: string;
  readonly description: string;
  readonly defaultAreas: readonly string[];
  readonly startStoryId?: string;
  readonly purchaseCost?: readonly { readonly resourceId: string; readonly amount: number }[];
  readonly worldTilt?: string;
  readonly worldTiltAlias?: string;
  readonly tags?: readonly string[];
  readonly revealTriggers?: readonly RuntimeSpotRevealTriggerDraft[];
}

export interface RuntimeAreaInput {
  readonly idName: string;
  readonly initId: string;
  readonly name: string;
  readonly description: string;
  readonly defaultSpots: readonly string[];
  readonly adjacentAreaIds?: readonly string[];
  readonly topology?: readonly RuntimeAreaTopologyDraft[];
  readonly tags?: readonly string[];
  readonly revealTriggers?: readonly RuntimeSpotRevealTriggerDraft[];
}

export type RuntimeAreaTopologyType = 'oneWay' | 'twoWay';

export interface RuntimeAreaTopologyDraft {
  readonly areaId: string;
  readonly type: RuntimeAreaTopologyType;
}

export interface RuntimeAreaTopologyConnection {
  readonly fromAreaId: string;
  readonly toAreaId: string;
  readonly type: RuntimeAreaTopologyType;
  readonly ownerModName: string;
}

export interface RuntimeWorldDraft {
  readonly modName: string;
  readonly inits: readonly RuntimeInitInput[];
  readonly areas: readonly RuntimeAreaInput[];
}

export type RuntimeWorldDiagnosticCode =
  | RuntimeContentDiagnosticCode
  | 'init-not-owned'
  | 'area-not-owned'
  | 'init-not-found'
  | 'area-not-found'
  | 'reference-blocked';

export interface RuntimeWorldApplyResult {
  readonly ok: boolean;
  readonly revision: number;
  readonly diagnostics: readonly RuntimeContentDiagnostic[];
  readonly message: string;
}

export interface RuntimeWorldStateSnapshot {
  readonly modName: string | null;
  readonly sourceId: string;
  readonly inits: ReadonlyMap<string, InitDef>;
  readonly areas: ReadonlyMap<string, AreaDef>;
  readonly topology: readonly RuntimeAreaTopologyConnection[];
  readonly revision: number;
}

export interface RuntimeWorldCommit {
  readonly modName: string;
  readonly changedInitIds: readonly string[];
  readonly changedAreaIds: readonly string[];
  readonly topologyAreaIds: readonly string[];
  readonly topology: readonly RuntimeAreaTopologyConnection[];
  readonly revisionBefore: number;
  readonly revisionAfter: number;
}

export interface RuntimeWorldCoordinatorSettings {
  readonly sourceId?: string;
  readonly onCommitted?: (commit: RuntimeWorldCommit) => void;
}

export interface RuntimeWorldCoordinatorOptions extends RuntimeWorldCoordinatorSettings {
  readonly registry: Registry;
}

export interface RuntimeWorldDefinitionEditorCommands {
  applyWorldDraft(draft: RuntimeWorldDraft): RuntimeWorldApplyResult;
}
