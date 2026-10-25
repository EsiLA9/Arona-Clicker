import type { GameplayMapDef, GameplayMapNodeDef } from '../../../data-services/contracts/gameplay-map';
import {
  VariantTranslationMode,
  type VariantTranslationSnapshot,
} from '../../contracts/character/variant-translation';
import type { VariantTrainingScenarioStageTuple } from '../../contracts/character/variant-training-scenario';
import type { VariantTrainingSource } from '../../contracts/character/variant-training';
import {
  VARIANT_TRAINING_VARIANT_ID,
  variantTrainingContent,
  variantTrainingRequest,
} from './variant-training-content';
import { immutable } from '../../services/character/variant-translation-rules';

export const VARIANT_TRAINING_SCENARIO_MAP_ID = 'gameplay-b:map:variant-training-scenario';
export const VARIANT_TRAINING_SCENARIO_TEMPLATE_VERSION = 1;

export const VARIANT_TRAINING_SCENARIO_SOURCE_ORDER = Object.freeze([
  'owned', 'normal', 'enhanced',
] as const satisfies readonly VariantTrainingSource[]);

export const VARIANT_TRAINING_SCENARIO_NODE_IDS = Object.freeze({
  entry: 'entry', owned: 'battle-owned', normal: 'battle-normal', enhanced: 'battle-enhanced', exit: 'exit',
});

const RULES = Object.freeze({ id: 'variant-training:rules:gameplay-b', revision: 1 });
const ENTRY = Object.freeze({ id: 'variant-training:entry:hoshino', revision: 1 });
const PROFILE = Object.freeze({ id: 'variant-training:profile:hoshino', revision: 1 });
const SLICES = Object.freeze({
  normal: Object.freeze({ id: 'variant-training:slice:normal', revision: 1 }),
  enhanced: Object.freeze({ id: 'variant-training:slice:enhanced', revision: 1 }),
});

function fail(message: string): never { throw new Error(message); }

function readStageMember(snapshot: VariantTranslationSnapshot, source: VariantTrainingSource, activeInit: string) {
  if (!snapshot || snapshot.schemaVersion !== 1 || snapshot.mode !== VariantTranslationMode.GameplayB
    || snapshot.entry?.id !== ENTRY.id || snapshot.entry.revision !== ENTRY.revision
    || snapshot.rules?.id !== RULES.id || snapshot.rules.revision !== RULES.revision
    || snapshot.activeInit !== activeInit || !Array.isArray(snapshot.members) || snapshot.members.length !== 1) {
    return fail('Translation snapshot is not the fixed Hoshino scenario build for this Init');
  }
  const [member] = snapshot.members;
  const expectedSource = source === 'owned'
    ? member.source.kind === 'owned' && member.source.variantId === VARIANT_TRAINING_VARIANT_ID
    : member.source.kind === 'slice' && member.source.slice.revision === 1
      && member.source.slice.id === SLICES[source].id;
  if (member.slotId !== 'trainee' || member.variantId !== VARIANT_TRAINING_VARIANT_ID
    || member.statisticsCharacterId !== 'hoshino' || !expectedSource) {
    return fail(`Translation source does not match the fixed ${source} scenario slot`);
  }
  if (source === 'owned' && (member.profile?.id !== PROFILE.id || member.profile.revision !== PROFILE.revision
    || !member.progression)) return fail('Owned scenario build lacks the exact frozen Hoshino profile and progression');
  if (source !== 'owned' && (member.profile !== undefined || member.progression !== undefined)) {
    return fail('Scene-provided slices cannot carry player progression');
  }
  const raw = member.input?.attributes;
  const build = member.build;
  if (!Array.isArray(raw) || raw.length !== 1 || raw[0].id !== 'readiness'
    || !Number.isSafeInteger(raw[0].value) || raw[0].value < 0 || raw[0].value > 10_000
    || build?.mode !== VariantTranslationMode.GameplayB || !Array.isArray(build.grades)
    || build.grades.length !== 1 || build.grades[0].attributeId !== 'readiness'
    || !['normal', 'enhanced'].includes(build.grades[0].gradeId)
    || !Number.isSafeInteger(build.parameters?.maxHp) || !Number.isSafeInteger(build.parameters?.baseAgility)
    || !Number.isSafeInteger(build.parameters?.maxAgility) || build.parameters.maxAgility !== 8
    || build.capabilityIds.length !== 0 || build.tags.length !== 0 || build.candidateSourceIds.length !== 0) {
    return fail('Scenario translation values are outside the trusted Hoshino bounds');
  }
  const expectedReadiness = source === 'normal' ? 20 : source === 'enhanced' ? 60 : raw[0].value;
  const isEnhanced = expectedReadiness >= 50;
  if (raw[0].value !== expectedReadiness || build.grades[0].gradeId !== (isEnhanced ? 'enhanced' : 'normal')
    || build.parameters.maxHp !== (isEnhanced ? 16 : 10)
    || build.parameters.baseAgility !== (isEnhanced ? 6 : 2)) {
    return fail(`Scenario ${source} translation does not match its exact readiness grade`);
  }
  return member;
}

function setupFor(snapshot: VariantTranslationSnapshot, source: VariantTrainingSource, activeInit: string) {
  const member = readStageMember(snapshot, source, activeInit);
  return {
    initialPartyHp: [{ characterId: 'hoshino', initialHp: member.build.parameters.maxHp, maxHp: member.build.parameters.maxHp }],
    partyAgility: [{ characterId: 'hoshino', agility: member.build.parameters.baseAgility }],
    initialPlayerCost: 0,
  };
}

function encounter() {
  return {
    title: '训练靶',
    enemies: [{ id: 'training-target', initialHp: 6, maxHp: 6, agility: 0,
      actions: [{ actionId: 'training-target-strike', tendencyWeight: 1 }] }],
    participants: [{ characterId: 'hoshino', actions: [
      { actionId: 'training-quick-strike', tendencyWeight: 1 },
      { actionId: 'training-heavy-strike', tendencyWeight: 1 },
    ] }],
  };
}

function stageNode(source: VariantTrainingSource, snapshot: VariantTranslationSnapshot, activeInit: string): GameplayMapNodeDef {
  const nodeId = source === 'owned' ? VARIANT_TRAINING_SCENARIO_NODE_IDS.owned
    : source === 'normal' ? VARIANT_TRAINING_SCENARIO_NODE_IDS.normal : VARIANT_TRAINING_SCENARIO_NODE_IDS.enhanced;
  const label = source === 'owned' ? '当前持有' : source === 'normal' ? '普通' : '高级';
  const index = source === 'owned' ? 1 : source === 'normal' ? 2 : 3;
  const member = readStageMember(snapshot, source, activeInit);
  const sourceVersion = source === 'owned'
    ? `${member.profile!.id}@${member.profile!.revision}`
    : `${member.source.kind === 'slice' ? member.source.slice.id : ''}@${member.source.kind === 'slice' ? member.source.slice.revision : ''}`;
  return {
    id: nodeId,
    title: `第${index}/3战·${label}`,
    description: `HP ${member.build.parameters.maxHp}/${member.build.parameters.maxHp}；基础敏捷 ${member.build.parameters.baseAgility}、上限 8；来源 ${sourceVersion}；规则 ${snapshot.rules.id}@${snapshot.rules.revision}`,
    partySetup: setupFor(snapshot, source, activeInit),
    encounter: encounter(),
  };
}

/** Build only from the three snapshots prepared or strictly restored by the scenario service. */
export function buildVariantTrainingScenarioMap(
  stages: VariantTrainingScenarioStageTuple,
  activeInit: string,
): GameplayMapDef {
  const [owned, normal, enhanced] = stages;
  const fallback = setupFor(normal.translation, 'normal', activeInit);
  return immutable({
    id: VARIANT_TRAINING_SCENARIO_MAP_ID,
    name: 'Variant 三阶段演练场',
    resumeVersion: VARIANT_TRAINING_SCENARIO_TEMPLATE_VERSION,
    executionContractId: 'AG-1',
    startNodeId: VARIANT_TRAINING_SCENARIO_NODE_IDS.entry,
    exitNodeIds: [VARIANT_TRAINING_SCENARIO_NODE_IDS.exit],
    partyCharacterIds: ['hoshino'],
    initialPartyHp: fallback.initialPartyHp,
    partyAgility: fallback.partyAgility,
    initialPlayerCost: fallback.initialPlayerCost,
    actions: [
      { id: 'training-quick-strike', name: '快速打击', eligibleCharacterIds: ['hoshino'],
        agility: { base: 1, max: 8 }, target: { kind: 'enemy' }, tendencyRole: 'attack',
        effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 2 }] } },
      { id: 'training-heavy-strike', name: '强力打击', eligibleCharacterIds: ['hoshino'],
        agility: { base: 0, max: 5 }, target: { kind: 'enemy' }, tendencyRole: 'attack',
        effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 3 }] } },
      { id: 'training-target-strike', name: '训练靶攻击', eligibleCharacterIds: [],
        agility: { base: 4, max: 4 }, target: { kind: 'partyCharacter' }, tendencyRole: 'attack',
        effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 2 }] } },
    ],
    nodes: [
      { id: VARIANT_TRAINING_SCENARIO_NODE_IDS.entry, title: '演练入口' },
      stageNode('owned', owned.translation, activeInit),
      stageNode('normal', normal.translation, activeInit),
      stageNode('enhanced', enhanced.translation, activeInit),
      { id: VARIANT_TRAINING_SCENARIO_NODE_IDS.exit, title: '演练出口' },
    ],
    edges: [
      { fromNodeId: VARIANT_TRAINING_SCENARIO_NODE_IDS.entry, toNodeId: VARIANT_TRAINING_SCENARIO_NODE_IDS.owned },
      { fromNodeId: VARIANT_TRAINING_SCENARIO_NODE_IDS.owned, toNodeId: VARIANT_TRAINING_SCENARIO_NODE_IDS.normal },
      { fromNodeId: VARIANT_TRAINING_SCENARIO_NODE_IDS.normal, toNodeId: VARIANT_TRAINING_SCENARIO_NODE_IDS.enhanced },
      { fromNodeId: VARIANT_TRAINING_SCENARIO_NODE_IDS.enhanced, toNodeId: VARIANT_TRAINING_SCENARIO_NODE_IDS.exit },
    ],
  });
}

export function scenarioStageSnapshot(
  stages: VariantTrainingScenarioStageTuple,
  source: VariantTrainingSource,
): VariantTranslationSnapshot {
  const stage = stages.find(candidate => candidate.source === source);
  if (!stage) return fail(`Scenario is missing the ${source} build`);
  return stage.translation;
}

/** The scenario map intentionally shares the old trusted resolver, not the static Registry. */
export { variantTrainingContent, variantTrainingRequest };
