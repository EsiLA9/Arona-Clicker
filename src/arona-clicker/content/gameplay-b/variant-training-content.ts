import type { GameplayMapDef } from '../../../data-services/contracts/gameplay-map';
import {
  VariantTranslationMode,
  type GameplayBVariantTranslationRules,
  type VariantTranslationContentResolver,
  type VariantTranslationEntry,
  type VariantTranslationProfile,
  type VariantTranslationRequest,
  type VariantTranslationRef,
  type VariantTranslationSlice,
  type VariantTranslationSnapshot,
  type VariantTranslationSource,
} from '../../contracts/character/variant-translation';
import type { VariantTrainingSource } from '../../contracts/character/variant-training';

export const VARIANT_TRAINING_VARIANT_ID = 'Hoshino';
export const VARIANT_TRAINING_TEMPLATE_VERSION = 1;

export const VARIANT_TRAINING_SOURCES: readonly { id: VariantTrainingSource; label: string }[] = Object.freeze([
  Object.freeze({ id: 'owned', label: '当前持有' }),
  Object.freeze({ id: 'normal', label: '普通切片' }),
  Object.freeze({ id: 'enhanced', label: '强化切片' }),
]);

const ENTRY = Object.freeze({ id: 'variant-training:entry:hoshino', revision: 1 });
const RULES = Object.freeze({ id: 'variant-training:rules:gameplay-b', revision: 1 });
const PROFILE = Object.freeze({ id: 'variant-training:profile:hoshino', revision: 1 });
const NORMAL_SLICE = Object.freeze({ id: 'variant-training:slice:normal', revision: 1 });
const ENHANCED_SLICE = Object.freeze({ id: 'variant-training:slice:enhanced', revision: 1 });

const rules: GameplayBVariantTranslationRules = Object.freeze({
  ...RULES,
  mode: VariantTranslationMode.GameplayB,
  dimensions: Object.freeze([Object.freeze({
    id: 'readiness', min: 0, max: 10_000,
    grades: Object.freeze([
      Object.freeze({ id: 'normal', minInclusive: 0 }),
      Object.freeze({ id: 'enhanced', minInclusive: 50 }),
    ]),
  })]),
  parameters: Object.freeze({
    maxHp: Object.freeze({ attributeId: 'readiness', values: Object.freeze([
      Object.freeze({ gradeId: 'normal', value: 10 }), Object.freeze({ gradeId: 'enhanced', value: 16 }),
    ]) }),
    baseAgility: Object.freeze({ attributeId: 'readiness', values: Object.freeze([
      Object.freeze({ gradeId: 'normal', value: 2 }), Object.freeze({ gradeId: 'enhanced', value: 6 }),
    ]) }),
    maxAgility: Object.freeze({ attributeId: 'readiness', values: Object.freeze([
      Object.freeze({ gradeId: 'normal', value: 8 }), Object.freeze({ gradeId: 'enhanced', value: 8 }),
    ]) }),
  }),
});

const profile: VariantTranslationProfile = Object.freeze({
  ...PROFILE,
  variantId: VARIANT_TRAINING_VARIANT_ID,
  capabilityIds: Object.freeze([]), tags: Object.freeze([]), candidateSourceIds: Object.freeze([]),
  attributes: Object.freeze([Object.freeze({
    id: 'readiness', base: 20, perLevel: 2, perStar: 2, perAffectionLevel: 1,
  })]),
});

const slices: Readonly<Record<'normal' | 'enhanced', VariantTranslationSlice>> = Object.freeze({
  normal: Object.freeze({
    ...NORMAL_SLICE, variantId: VARIANT_TRAINING_VARIANT_ID,
    attributes: Object.freeze([Object.freeze({ id: 'readiness', value: 20 })]),
    capabilityIds: Object.freeze([]), tags: Object.freeze([]), candidateSourceIds: Object.freeze([]),
  }),
  enhanced: Object.freeze({
    ...ENHANCED_SLICE, variantId: VARIANT_TRAINING_VARIANT_ID,
    attributes: Object.freeze([Object.freeze({ id: 'readiness', value: 60 })]),
    capabilityIds: Object.freeze([]), tags: Object.freeze([]), candidateSourceIds: Object.freeze([]),
  }),
});

const entry: VariantTranslationEntry = Object.freeze({
  ...ENTRY,
  mode: VariantTranslationMode.GameplayB,
  rules: RULES,
  minPartySize: 1,
  maxPartySize: 1,
  allowDuplicateVariants: false,
  owned: Object.freeze([Object.freeze({ variantId: VARIANT_TRAINING_VARIANT_ID, profile: PROFILE })]),
  slices: Object.freeze([
    Object.freeze({ slice: NORMAL_SLICE, ownership: 'scene-provided' as const }),
    Object.freeze({ slice: ENHANCED_SLICE, ownership: 'scene-provided' as const }),
  ]),
});

export const variantTrainingContent: VariantTranslationContentResolver = Object.freeze({
  resolveEntry: (id: string) => id === ENTRY.id ? entry : undefined,
  resolveRules: (ref: VariantTranslationRef) => ref.id === RULES.id && ref.revision === RULES.revision ? rules : undefined,
  resolveProfile: (ref: VariantTranslationRef) => ref.id === PROFILE.id && ref.revision === PROFILE.revision ? profile : undefined,
  resolveSlice: (ref: VariantTranslationRef) => {
    if (ref.revision !== 1) return undefined;
    return ref.id === NORMAL_SLICE.id ? slices.normal
      : ref.id === ENHANCED_SLICE.id ? slices.enhanced : undefined;
  },
});

export function variantTrainingRequest(source: VariantTrainingSource): VariantTranslationRequest {
  let translationSource: VariantTranslationSource;
  switch (source) {
    case 'owned': translationSource = Object.freeze({ kind: 'owned', variantId: VARIANT_TRAINING_VARIANT_ID }); break;
    case 'normal': translationSource = Object.freeze({ kind: 'slice', slice: NORMAL_SLICE }); break;
    case 'enhanced': translationSource = Object.freeze({ kind: 'slice', slice: ENHANCED_SLICE }); break;
    default: throw new Error('Unknown Variant training source');
  }
  return Object.freeze({
    entryId: ENTRY.id,
    mode: VariantTranslationMode.GameplayB,
    members: Object.freeze([Object.freeze({ slotId: 'trainee', source: translationSource })]),
  });
}

const TRAINING_MAP_ID = 'gameplay-b:map:variant-translation-training';

function assertSnapshot(snapshot: VariantTranslationSnapshot): VariantTranslationSnapshot['members'][number] {
  if (!snapshot || snapshot.schemaVersion !== 1 || snapshot.mode !== VariantTranslationMode.GameplayB
    || snapshot.entry?.id !== ENTRY.id || snapshot.entry.revision !== ENTRY.revision
    || snapshot.rules?.id !== RULES.id || snapshot.rules.revision !== RULES.revision
    || !Array.isArray(snapshot.members) || snapshot.members.length !== 1) {
    throw new Error('Snapshot is not a supported Variant training build');
  }
  const [member] = snapshot.members;
  if (member.slotId !== 'trainee' || member.variantId !== VARIANT_TRAINING_VARIANT_ID
    || member.statisticsCharacterId !== 'hoshino') {
    throw new Error('Snapshot member is not the fixed Hoshino trainee');
  }
  const source = member.source;
  const allowed = source.kind === 'owned' && source.variantId === VARIANT_TRAINING_VARIANT_ID
    || source.kind === 'slice' && source.slice.revision === 1
      && (source.slice.id === NORMAL_SLICE.id || source.slice.id === ENHANCED_SLICE.id);
  if (!allowed) throw new Error('Snapshot source is not allowed by the training scene');
  const raw = member.input?.attributes;
  const parameters = member.build?.parameters;
  if (!Array.isArray(raw) || raw.length !== 1 || raw[0].id !== 'readiness'
    || !Number.isSafeInteger(raw[0].value) || raw[0].value < 0 || raw[0].value > 10_000
    || !parameters || !Number.isSafeInteger(parameters.maxHp) || !Number.isSafeInteger(parameters.baseAgility)
    || parameters.maxHp < 10 || parameters.maxHp > 16
    || parameters.baseAgility < 2 || parameters.baseAgility > 6 || parameters.maxAgility !== 8
    || !Array.isArray(member.build.capabilityIds) || member.build.capabilityIds.length !== 0
    || !Array.isArray(member.build.tags) || member.build.tags.length !== 0
    || !Array.isArray(member.build.candidateSourceIds) || member.build.candidateSourceIds.length !== 0) {
    throw new Error('Snapshot translation values are outside the training bounds');
  }
  const enhanced = raw[0].value >= 50;
  if (parameters.maxHp !== (enhanced ? 16 : 10) || parameters.baseAgility !== (enhanced ? 6 : 2)) {
    throw new Error('Snapshot parameters do not match its readiness grade');
  }
  return member;
}

export function buildVariantTrainingMap(snapshot: VariantTranslationSnapshot): GameplayMapDef {
  const member = assertSnapshot(snapshot);
  const maxHp = member.build.parameters.maxHp;
  const baseAgility = member.build.parameters.baseAgility;
  return {
    id: TRAINING_MAP_ID,
    name: 'Variant 转译演练场',
    resumeVersion: VARIANT_TRAINING_TEMPLATE_VERSION,
    executionContractId: 'AG-1',
    startNodeId: 'entry',
    exitNodeIds: ['exit'],
    partyCharacterIds: ['hoshino'],
    initialPartyHp: [{ characterId: 'hoshino', initialHp: maxHp, maxHp }],
    partyAgility: [{ characterId: 'hoshino', agility: baseAgility }],
    initialPlayerCost: 0,
    actions: [
      { id: 'trainee-strike', name: '演练攻击', eligibleCharacterIds: ['hoshino'],
        agility: { base: 0, max: member.build.parameters.maxAgility }, target: { kind: 'enemy' },
        tendencyRole: 'attack', effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 2 }] } },
      { id: 'training-strike', name: '训练靶攻击', eligibleCharacterIds: [],
        agility: { base: 4, max: 4 }, target: { kind: 'partyCharacter' },
        tendencyRole: 'attack', effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 2 }] } },
    ],
    nodes: [
      { id: 'entry', title: '演练入口' },
      { id: 'battle', title: '训练靶战斗', encounter: {
        title: '训练靶', enemies: [{ id: 'training-target', initialHp: 6, maxHp: 6, agility: 0,
          actions: [{ actionId: 'training-strike', tendencyWeight: 1 }] }],
        participants: [{ characterId: 'hoshino', actions: [{ actionId: 'trainee-strike', tendencyWeight: 1 }] }],
      } },
      { id: 'exit', title: '演练出口' },
    ],
    edges: [{ fromNodeId: 'entry', toNodeId: 'battle' }, { fromNodeId: 'battle', toNodeId: 'exit' }],
  };
}
