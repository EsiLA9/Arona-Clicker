import type { VariantTranslationSnapshot } from './variant-translation';
import type { VariantTrainingSource } from './variant-training';

export interface VariantTrainingScenarioStageBinding {
  readonly source: VariantTrainingSource;
  readonly translation: VariantTranslationSnapshot;
}

export type VariantTrainingScenarioStageTuple = readonly [
  VariantTrainingScenarioStageBinding & { readonly source: 'owned' },
  VariantTrainingScenarioStageBinding & { readonly source: 'normal' },
  VariantTrainingScenarioStageBinding & { readonly source: 'enhanced' },
];

/** Trusted, bounded input for the fixed three-stage Hoshino training Map. */
export interface VariantTrainingScenarioBinding {
  readonly schemaVersion: 1;
  readonly templateVersion: 1;
  readonly mapId: string;
  readonly activeInit: string;
  /** Fixed order is part of the contract: owned → normal → enhanced. */
  readonly stages: VariantTrainingScenarioStageTuple;
  /** Present on a saved MapRun only; binds the frozen builds to that exact run snapshot. */
  readonly run?: {
    readonly runId: string;
    /** Canonical JSON consistency evidence, not an authentication signature. */
    readonly consistency: string;
  };
}
