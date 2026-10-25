import type { TagRef } from '../../../engine/core/tag';

/** Fixed scene translation modes. Add a typed output and validator before adding another mode. */
export enum VariantTranslationMode {
  GameplayB = 'gameplay-b',
}

export interface VariantTranslationRef {
  readonly id: string;
  readonly revision: number;
}

export interface VariantRawValue {
  readonly id: string;
  readonly value: number;
}

/** Finite long-term build facts; IDs are logical sources, not unqualified Map-local Action IDs. */
export interface VariantBuildFacts {
  readonly capabilityIds: readonly string[];
  readonly tags: readonly TagRef[];
  readonly candidateSourceIds: readonly string[];
}

export interface VariantRawInput extends VariantBuildFacts {
  readonly attributes: readonly VariantRawValue[];
}

export interface VariantTranslationDimension {
  readonly id: string;
  readonly min: number;
  readonly max: number;
  /** Ascending, unique grade thresholds. First minInclusive must equal min. */
  readonly grades: readonly { readonly id: string; readonly minInclusive: number }[];
}

export interface VariantGradeParameter {
  readonly attributeId: string;
  /** Exactly one explicit safe integer value per grade of the bound attribute. */
  readonly values: readonly { readonly gradeId: string; readonly value: number }[];
}

/** Trusted author data within the fixed gameplay-b translator; never executable expressions. */
export interface GameplayBVariantTranslationRules extends VariantTranslationRef {
  readonly mode: VariantTranslationMode.GameplayB;
  readonly dimensions: readonly VariantTranslationDimension[];
  readonly parameters: {
    readonly maxHp: VariantGradeParameter;
    readonly baseAgility: VariantGradeParameter;
    readonly maxAgility: VariantGradeParameter;
  };
}

export interface VariantGrowthAttribute {
  readonly id: string;
  readonly base: number;
  readonly perLevel: number;
  readonly perStar: number;
  readonly perAffectionLevel: number;
}

/** Only these three progression tracks are consumed in v1. Gear/skill Effects are not interpreted. */
export interface VariantTranslationProgress {
  readonly level: number;
  readonly stars: number;
  readonly affectionLevel: number;
}

export interface VariantTranslationProfile extends VariantTranslationRef, VariantBuildFacts {
  readonly variantId: string;
  readonly attributes: readonly VariantGrowthAttribute[];
}

/** Complete fixed build; does not inherit current player cultivation. */
export interface VariantTranslationSlice extends VariantTranslationRef, VariantRawInput {
  readonly variantId: string;
}

/** Trusted entry policy, resolved by entryId; never supplied as a request's authorization flag. */
export interface VariantTranslationEntry extends VariantTranslationRef {
  readonly mode: VariantTranslationMode.GameplayB;
  readonly rules: VariantTranslationRef;
  readonly minPartySize: number;
  readonly maxPartySize: number;
  readonly allowDuplicateVariants: boolean;
  readonly owned: readonly { readonly variantId: string; readonly profile: VariantTranslationRef }[];
  readonly slices: readonly {
    readonly slice: VariantTranslationRef;
    readonly ownership: 'required' | 'scene-provided';
  }[];
}

/** Trusted constructor dependency. Every revision lookup must return the exact requested revision. */
export interface VariantTranslationContentResolver {
  resolveEntry(entryId: string): VariantTranslationEntry | undefined;
  resolveRules(ref: VariantTranslationRef): GameplayBVariantTranslationRules | undefined;
  resolveProfile(ref: VariantTranslationRef): VariantTranslationProfile | undefined;
  resolveSlice(ref: VariantTranslationRef): VariantTranslationSlice | undefined;
}

export type VariantTranslationSource =
  | { readonly kind: 'owned'; readonly variantId: string }
  | { readonly kind: 'slice'; readonly slice: VariantTranslationRef };

export interface VariantTranslationMemberRequest {
  readonly slotId: string;
  readonly source: VariantTranslationSource;
}

export interface VariantTranslationRequest {
  readonly entryId: string;
  readonly mode: VariantTranslationMode;
  readonly members: readonly VariantTranslationMemberRequest[];
}

export interface GameplayBVariantBuild extends VariantBuildFacts {
  readonly mode: VariantTranslationMode.GameplayB;
  readonly grades: readonly {
    readonly attributeId: string;
    readonly rawValue: number;
    readonly gradeId: string;
  }[];
  readonly parameters: {
    readonly maxHp: number;
    readonly baseAgility: number;
    readonly maxAgility: number;
  };
}

export interface TranslatedVariantMember {
  readonly slotId: string;
  readonly variantId: string;
  /** Derived from Variant.proto for statistics only. Never an admission or combat key. */
  readonly statisticsCharacterId: string;
  readonly source: VariantTranslationSource;
  /** Present only for owned builds. */
  readonly profile?: VariantTranslationRef;
  /** Frozen consumed progress, not a live roster reference. Present only for owned builds. */
  readonly progression?: VariantTranslationProgress;
  readonly input: VariantRawInput;
  readonly build: GameplayBVariantBuild;
}

export interface VariantTranslationSnapshot {
  readonly schemaVersion: 1;
  readonly mode: VariantTranslationMode.GameplayB;
  readonly entry: VariantTranslationRef;
  readonly rules: VariantTranslationRef;
  /** Provenance only. Restore does not re-read ownership or current cultivation. */
  readonly activeInit: string;
  /** Canonical content evidence for exact revision compatibility; not an authentication signature. */
  readonly contentEvidence: string;
  readonly members: readonly TranslatedVariantMember[];
}

export type VariantTranslationIssueCode =
  | 'invalid-request' | 'unsupported-mode' | 'entry-unavailable' | 'source-not-allowed'
  | 'variant-not-found' | 'variant-not-owned' | 'content-version-mismatch'
  | 'input-invalid' | 'rules-invalid' | 'party-policy-violation'
  | 'stale-preview' | 'snapshot-invalid';

export interface VariantTranslationIssue {
  readonly code: VariantTranslationIssueCode;
  readonly path: string;
  readonly message: string;
}

export interface VariantTranslationBlocked {
  readonly status: 'blocked';
  readonly issues: readonly VariantTranslationIssue[];
}

export type VariantTranslationPreview = VariantTranslationBlocked | {
  readonly status: 'ready';
  readonly token: string;
  readonly members: readonly TranslatedVariantMember[];
};

export type VariantTranslationConfirmation = VariantTranslationBlocked | {
  readonly status: 'confirmed';
  readonly snapshot: VariantTranslationSnapshot;
};

export type VariantTranslationRestore = VariantTranslationBlocked | {
  readonly status: 'restored';
  readonly snapshot: VariantTranslationSnapshot;
};

/** Preparation API only; it does not start a MapRun or grant ownership. */
export interface VariantTranslationPort {
  preview(request: VariantTranslationRequest): VariantTranslationPreview;
  confirm(token: string): VariantTranslationConfirmation;
  restore(snapshot: unknown): VariantTranslationRestore;
}
