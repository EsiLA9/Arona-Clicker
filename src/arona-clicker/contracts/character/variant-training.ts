import type { VariantTranslationPreview, VariantTranslationSnapshot } from './variant-translation';
import type { MapRunSaveSnapshot } from '../map/map-run';

export type VariantTrainingSource = 'owned' | 'normal' | 'enhanced';

export interface VariantTrainingView {
  readonly phase: 'preparation' | 'battle' | 'result';
  readonly variantId: string;
  readonly displayName: string;
  readonly owned: boolean;
  readonly sources: readonly { readonly id: VariantTrainingSource; readonly label: string }[];
  readonly translation: VariantTranslationSnapshot | null;
  readonly round: number;
  readonly commitVersion: number;
  readonly partyHp: number | null;
  readonly partyMaxHp: number | null;
  readonly enemyHp: number | null;
  readonly enemyMaxHp: number;
  readonly outcome: 'success' | 'failure' | null;
  readonly lastRound: {
    readonly round: number;
    readonly order: readonly {
      readonly side: 'party' | 'enemy';
      readonly agility: number;
      readonly skipped: boolean;
    }[];
  } | null;
}

/** Separate, memory-only testing checkpoint. Never inserted into the player's SaveData. */
export interface VariantTrainingCheckpoint {
  readonly schemaVersion: 1;
  readonly templateVersion: 1;
  /** Canonical consistency binding of translation, template and MapRun; not an authentication signature. */
  readonly binding: string;
  readonly translation: VariantTranslationSnapshot;
  readonly mapRun: MapRunSaveSnapshot;
}

/** Dedicated local training commands. No player ownership, cultivation or reward writes. */
export interface VariantTrainingPort {
  getView(): VariantTrainingView;
  preview(source: VariantTrainingSource): VariantTranslationPreview;
  start(token: string): VariantTrainingView;
  commitRound(expectedCommitVersion: number): VariantTrainingView;
  save(): VariantTrainingCheckpoint;
  load(checkpoint: unknown): VariantTrainingView;
}
