import type { AchievementDef, Datapack, MilestoneListenerDef } from '../contracts/datapack';
import { validateOperationDatapackContent, type OperationContentValidationContext } from './operation-content-validation';
// ============================================================
// data-services/registry-validate.ts — 数据包静态校验（纯函数）
// 从 registry.ts 拆出：只读检查 Datapack，不触碰注册表实例状态。
// 校验项：ID 唯一性、引用完整性（init/area/spot/story）、Extra 合法性。
// ============================================================

import { ExtraValue } from '../../engine/types';
import { parsePicId } from '../contracts/pic';
import { isTagRef } from '../../engine/core/tag';
import type { TagPath } from '../../engine/core/tag';
import { parseEntityId, validateEntityId } from '../../engine/core/entity-id';
import { assertValidExtra, expandFlatKeys, ExtraError } from '../../engine/extra/index';
import type { EntityPresentationDef } from '../contracts/entity-presentation';
import type { GameplayMapDef } from '../contracts/gameplay-map';
import { validateAreaMapShapes } from './area-map-validation';
import type { ItemDef } from '../contracts/item';
import type { EffectOp } from '../../engine/types/expression';
import { validateGameplayMapEffectContext } from '../validation/gameplay-map-effect-context';

export class RegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegistryError';
  }
}

/**
 * 三段式 id 校验：formatOnly = true 时只查格式，否则同时校验 typeName 已登记。
 * 当前规则与数据契约见 docs/docs-829/03-data-structures/datapack-contracts.md。
 */
const checkEntityIds = (
  items: { id: string }[] | undefined,
  expectedType: string,
  label: string,
  formatOnly = false,
) => {
  if (!items) return;
  for (const item of items) {
    const issue = validateEntityId(item.id);
    if (issue === 'format') {
      throw new RegistryError(
        `${label} id "${item.id}" 不符合三段式格式 modName:typeName:idName（段字符集 [a-z0-9-_]）`,
      );
    }
    if (formatOnly || issue === null) continue;
    throw new RegistryError(
      `${label} id "${item.id}" 的 typeName 段须为 "${expectedType}"（注册表见 core/entity-id.ts ENTITY_TYPES）`,
    );
  }
};

/** Operation tables require the exact registered typeName for their own definition table. */
const checkExpectedEntityType = (items: { id: string }[] | undefined, expectedType: string, label: string): void => {
  for (const item of items ?? []) {
    if (parseEntityId(item.id)?.type !== expectedType) {
      throw new RegistryError(`${label} id "${item.id}" 的 typeName 段须为 "${expectedType}"`);
    }
  }
};

/** Validate the static topology embedded in each Gameplay B Map. */
function validateMapTopologies(maps: readonly GameplayMapDef[] | undefined): void {
  for (const map of maps ?? []) {
    if (!Number.isSafeInteger(map.resumeVersion) || map.resumeVersion < 1) {
      throw new RegistryError(`Map "${map.id}" resumeVersion must be a positive safe integer`);
    }
    if (!Array.isArray(map.nodes) || map.nodes.length === 0) {
      throw new RegistryError(`Map "${map.id}" nodes 必须是非空数组`);
    }
    if (!Array.isArray(map.exitNodeIds) || map.exitNodeIds.length === 0) {
      throw new RegistryError(`Map "${map.id}" 至少需要一个 exitNodeId`);
    }
    if (!Array.isArray(map.edges)) {
      throw new RegistryError(`Map "${map.id}" edges 必须是数组`);
    }

    const nodeIds = new Set<string>();
    for (const node of map.nodes) {
      if (!node.id) throw new RegistryError(`Map "${map.id}" 的 Node id 不能为空`);
      if (nodeIds.has(node.id)) {
        throw new RegistryError(`Map "${map.id}" 含重复 Node id "${node.id}"`);
      }
      nodeIds.add(node.id);
    }

    if (!nodeIds.has(map.startNodeId)) {
      throw new RegistryError(`Map "${map.id}" references unknown start Node "${map.startNodeId ?? ''}"`);
    }
    const exitIds = new Set<string>();
    for (const exitNodeId of map.exitNodeIds) {
      if (!nodeIds.has(exitNodeId)) {
        throw new RegistryError(`Map "${map.id}" references unknown exit Node "${exitNodeId}"`);
      }
      if (exitIds.has(exitNodeId)) {
        throw new RegistryError(`Map "${map.id}" 含重复 exitNodeId "${exitNodeId}"`);
      }
      exitIds.add(exitNodeId);
    }

    const edges = new Set<string>();
    for (const edge of map.edges) {
      if (!nodeIds.has(edge.fromNodeId)) {
        throw new RegistryError(`Map "${map.id}" Edge references unknown source Node "${edge.fromNodeId ?? ''}"`);
      }
      if (!nodeIds.has(edge.toNodeId)) {
        throw new RegistryError(`Map "${map.id}" Edge references unknown destination Node "${edge.toNodeId ?? ''}"`);
      }
      if (edge.fromNodeId === edge.toNodeId) {
        throw new RegistryError(`Map "${map.id}" Edge cannot connect Node "${edge.fromNodeId}" to itself`);
      }
      const key = JSON.stringify([edge.fromNodeId, edge.toNodeId]);
      if (edges.has(key)) {
        throw new RegistryError(`Map "${map.id}" 含重复 Edge "${edge.fromNodeId}" → "${edge.toNodeId}"`);
      }
      edges.add(key);
    }
  }
}

/** Validate fixed MapRun party references and the explicit starting PlayerCost. */
function validateMapRunContent(
  maps: readonly GameplayMapDef[] | undefined,
  knownCharacterIds: ReadonlySet<string>,
): void {
  const isNonEmptyString = (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0;
  for (const map of maps ?? []) {
    const partyCharacterIds: unknown = map.partyCharacterIds;
    if (!Array.isArray(partyCharacterIds) || partyCharacterIds.length === 0) {
      throw new RegistryError(`Map "${map.id}" partyCharacterIds 必须是非空数组`);
    }

    const seenCharacterIds = new Set<string>();
    for (const [index, characterId] of partyCharacterIds.entries()) {
      if (typeof characterId !== 'string' || characterId.trim().length === 0) {
        throw new RegistryError(`Map "${map.id}" partyCharacterIds[${index}] 必须是非空 Character ID`);
      }
      if (seenCharacterIds.has(characterId)) {
        throw new RegistryError(`Map "${map.id}" partyCharacterIds 含重复 Character ID "${characterId}"`);
      }
      seenCharacterIds.add(characterId);
      if (!knownCharacterIds.has(characterId)) {
        throw new RegistryError(`Map "${map.id}" references unknown Character "${characterId}"`);
      }
    }

    if (!Number.isSafeInteger(map.initialPlayerCost) || map.initialPlayerCost < 0) {
      throw new RegistryError(`Map "${map.id}" initialPlayerCost must be a non-negative safe integer`);
    }

    const rawInitialPartyHp: unknown = map.initialPartyHp;
    if (!Array.isArray(rawInitialPartyHp)) {
      throw new RegistryError(`Map "${map.id}" initialPartyHp 必须显式配置固定队伍每名角色的 HP`);
    }
    const configuredCharacterIds = new Set<string>();
    for (const [index, rawHp] of rawInitialPartyHp.entries()) {
      const hpPath = `Map "${map.id}" initialPartyHp[${index}]`;
      if (!isRecord(rawHp)) throw new RegistryError(`${hpPath} 必须是 HP 配置对象`);
      const extraField = Object.keys(rawHp).find(field => !['characterId', 'initialHp', 'maxHp'].includes(field));
      if (extraField !== undefined) throw new RegistryError(`${hpPath} 含合同外字段 "${extraField}"`);
      if (!isNonEmptyString(rawHp.characterId)) {
        throw new RegistryError(`${hpPath}.characterId 必须是非空 Character ID`);
      }
      if (!knownCharacterIds.has(rawHp.characterId)) {
        throw new RegistryError(`${hpPath}.characterId references unknown Character "${rawHp.characterId}"`);
      }
      if (!seenCharacterIds.has(rawHp.characterId)) {
        throw new RegistryError(`${hpPath}.characterId 必须属于 Map partyCharacterIds`);
      }
      if (configuredCharacterIds.has(rawHp.characterId)) {
        throw new RegistryError(`Map "${map.id}" initialPartyHp 含重复 Character "${rawHp.characterId}"`);
      }
      if (!Number.isSafeInteger(rawHp.maxHp) || (rawHp.maxHp as number) <= 0) {
        throw new RegistryError(`${hpPath}.maxHp 必须是正安全整数`);
      }
      if (!Number.isSafeInteger(rawHp.initialHp)
        || (rawHp.initialHp as number) < 1
        || (rawHp.initialHp as number) > (rawHp.maxHp as number)) {
        throw new RegistryError(`${hpPath}.initialHp 必须在 1..maxHp 范围内`);
      }
      configuredCharacterIds.add(rawHp.characterId);
    }
    for (const characterId of seenCharacterIds) {
      if (!configuredCharacterIds.has(characterId)) {
        throw new RegistryError(`Map "${map.id}" 缺少固定队员 "${characterId}" 的 initialPartyHp 配置`);
      }
    }
  }
}

/** Validate Map-local actions, encounter candidates, and explicit MapRun resources. */
function validateMapActionContent(
  maps: readonly GameplayMapDef[] | undefined,
  knownCharacterIds: ReadonlySet<string>,
  knownItemTypes: ReadonlyMap<string, ItemDef['type']>,
): void {
  const isNonEmptyString = (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0;
  const isResourceScope = (value: unknown): value is 'actor' | 'team' =>
    value === 'actor' || value === 'team';
  const targetKinds = new Set(['none', 'self', 'partyCharacter', 'enemy', 'card']);
  const tendencyRoleTargetCompatible = (action: Record<string, unknown>, actorKind: 'Character' | 'Enemy'): boolean => {
    const role = action.tendencyRole;
    const targetKind = isRecord(action.target) ? action.target.kind : undefined;
    if (role === undefined || role === 'defense') return true;
    if (role === 'attack') return actorKind === 'Character' ? targetKind === 'enemy' : targetKind === 'partyCharacter';
    if (role === 'recovery') {
      return actorKind === 'Character'
        ? targetKind === 'self' || targetKind === 'partyCharacter'
        : targetKind === 'self' || targetKind === 'enemy';
    }
    return false;
  };
  const assertNoExtraFields = (
    value: Record<string, unknown>,
    allowedFields: readonly string[],
    path: string,
  ): void => {
    const allowed = new Set(allowedFields);
    const extraField = Object.keys(value).find(field => !allowed.has(field));
    if (extraField !== undefined) {
      throw new RegistryError(`${path} 含合同外字段 "${extraField}"`);
    }
  };

  for (const map of maps ?? []) {
    const partyIds = new Set(map.partyCharacterIds);
    const rawActions: unknown = map.actions;
    if (rawActions !== undefined && !Array.isArray(rawActions)) {
      throw new RegistryError(`Map "${map.id}" actions 必须是数组`);
    }

    const actionIds = new Set<string>();
    const actionEligibility = new Map<string, Set<string>>();
    const actionDefinitions = new Map<string, Record<string, unknown>>();
    /** Team resource IDs that receive a MapRun balance from Actions or initial values. */
    const knownTeamResourceIds = new Set<string>();
    for (const [actionIndex, rawAction] of ((rawActions ?? []) as unknown[]).entries()) {
      const actionPath = `Map "${map.id}" actions[${actionIndex}]`;
      if (!isRecord(rawAction)) throw new RegistryError(`${actionPath} 必须是 Action 对象`);
      assertNoExtraFields(rawAction, [
        'id', 'name', 'description', 'eligibleCharacterIds', 'target', 'tendencyRole',
        'costs', 'effects', 'hpEffects', 'cardEffects', 'effectProgram',
      ], actionPath);

      const actionId = rawAction.id;
      if (!isNonEmptyString(actionId)) throw new RegistryError(`${actionPath}.id 必须是非空 Map-local Action ID`);
      if (actionIds.has(actionId)) throw new RegistryError(`Map "${map.id}" 含重复 Action id "${actionId}"`);
      actionIds.add(actionId);
      actionDefinitions.set(actionId, rawAction);

      if (!isNonEmptyString(rawAction.name)) throw new RegistryError(`${actionPath}.name 必须是非空展示名称`);
      if (rawAction.description !== undefined && typeof rawAction.description !== 'string') {
        throw new RegistryError(`${actionPath}.description 必须是字符串`);
      }

      const rawEligibleCharacterIds = rawAction.eligibleCharacterIds;
      if (!Array.isArray(rawEligibleCharacterIds)) {
        throw new RegistryError(`${actionPath}.eligibleCharacterIds 必须是 Character ID 数组；actorless Action 使用空数组`);
      }
      const eligibleCharacterIds = new Set<string>();
      for (const [eligibleIndex, characterId] of rawEligibleCharacterIds.entries()) {
        const eligiblePath = `${actionPath}.eligibleCharacterIds[${eligibleIndex}]`;
        if (!isNonEmptyString(characterId)) throw new RegistryError(`${eligiblePath} 必须是非空 Character ID`);
        if (eligibleCharacterIds.has(characterId)) throw new RegistryError(`${actionPath}.eligibleCharacterIds 含重复 Character "${characterId}"`);
        if (!knownCharacterIds.has(characterId)) throw new RegistryError(`${eligiblePath} references unknown Character "${characterId}"`);
        if (!partyIds.has(characterId)) throw new RegistryError(`${eligiblePath} 必须属于 Map partyCharacterIds`);
        eligibleCharacterIds.add(characterId);
      }
      actionEligibility.set(actionId, eligibleCharacterIds);

      const target = rawAction.target;
      if (!isRecord(target)) {
        throw new RegistryError(`${actionPath}.target 必须是目标规则对象`);
      }
      assertNoExtraFields(target, target.kind === 'card'
        ? ['kind', 'side', 'preference']
        : ['kind', 'preference'], `${actionPath}.target`);
      if (typeof target.kind !== 'string' || !targetKinds.has(target.kind)) {
        throw new RegistryError(`${actionPath}.target.kind 必须是 none、self、partyCharacter、enemy 或 card`);
      }
      if (target.preference !== undefined) {
        const allowedPreferences = target.kind === 'enemy' || target.kind === 'partyCharacter'
          ? ['stableOrder', 'lowestHpRatio', 'highestMissingHpRatio']
            : target.kind === 'card'
              ? ['stableOrder']
              : [];
        if (typeof target.preference !== 'string' || !allowedPreferences.includes(target.preference)) {
          throw new RegistryError(`${actionPath}.target.preference 与 target.kind 不兼容`);
        }
      }
      const tendencyRole = rawAction.tendencyRole;
      if (tendencyRole !== undefined
        && (typeof tendencyRole !== 'string' || !['recovery', 'defense', 'attack'].includes(tendencyRole))) {
        throw new RegistryError(`${actionPath}.tendencyRole 必须是 recovery、defense 或 attack`);
      }
      if (target.kind === 'card' && (typeof target.side !== 'string' || !['self', 'ally', 'opponent', 'any'].includes(target.side))) {
        throw new RegistryError(`${actionPath}.target.side 必须是 self、ally、opponent 或 any`);
      }
      const cardEffects: unknown = rawAction.cardEffects;
      if (cardEffects !== undefined && !Array.isArray(cardEffects)) throw new RegistryError(`${actionPath}.cardEffects 必须是数组`);
      const rawProgram: unknown = rawAction.effectProgram;
      const prepareLeaves = isRecord(rawProgram) && Array.isArray(rawProgram.prepare) ? rawProgram.prepare : [];
      const hasPrepare = prepareLeaves.length > 0;
      if (target.kind === 'card' && (!Array.isArray(cardEffects) || cardEffects.length === 0) && !hasPrepare) {
        throw new RegistryError(`${actionPath} card target 必须声明实际 cardEffects 或 effectProgram.prepare`);
      }
      if (Array.isArray(cardEffects) && cardEffects.length > 0 && target.kind !== 'card') {
        throw new RegistryError(`${actionPath}.cardEffects 必须使用 card target`);
      }
      for (const [index, effect] of ((cardEffects ?? []) as unknown[]).entries()) {
        const path = `${actionPath}.cardEffects[${index}]`;
        if (!isRecord(effect)) throw new RegistryError(`${path} 必须是卡牌效果对象`);
        assertNoExtraFields(effect, ['kind', 'amount'], path);
        if (effect.kind !== 'scostDiscount') throw new RegistryError(`${path}.kind 必须是 scostDiscount`);
        if (!Number.isSafeInteger(effect.amount) || (effect.amount as number) <= 0) {
          throw new RegistryError(`${path}.amount 必须是正安全整数`);
        }
      }

      const rawCosts: unknown = rawAction.costs;
      if (rawCosts !== undefined && !Array.isArray(rawCosts)) {
        throw new RegistryError(`${actionPath}.costs 必须是数组`);
      }
      const costKeys = new Set<string>();
      for (const [costIndex, rawCost] of ((rawCosts ?? []) as unknown[]).entries()) {
        const costPath = `${actionPath}.costs[${costIndex}]`;
        if (!isRecord(rawCost)) throw new RegistryError(`${costPath} 必须是资源费用对象`);
        assertNoExtraFields(rawCost, ['scope', 'resourceId', 'amount'], costPath);
        if (!isResourceScope(rawCost.scope)) throw new RegistryError(`${costPath}.scope 必须是 actor 或 team`);
        if (!isNonEmptyString(rawCost.resourceId)) throw new RegistryError(`${costPath}.resourceId 必须是非空字符串`);
        if (!Number.isSafeInteger(rawCost.amount) || (rawCost.amount as number) <= 0) {
          throw new RegistryError(`${costPath}.amount 必须是正安全整数`);
        }
        const key = JSON.stringify([rawCost.scope, rawCost.resourceId]);
        if (costKeys.has(key)) throw new RegistryError(`${actionPath}.costs 含重复 ${rawCost.scope} resourceId "${rawCost.resourceId}"`);
        costKeys.add(key);
        if (rawCost.scope === 'team') knownTeamResourceIds.add(rawCost.resourceId);
      }

      const rawEffects: unknown = rawAction.effects;
      if (rawEffects !== undefined && !Array.isArray(rawEffects)) {
        throw new RegistryError(`${actionPath}.effects 必须是数组`);
      }
      const effectKeys = new Set<string>();
      for (const [effectIndex, rawEffect] of ((rawEffects ?? []) as unknown[]).entries()) {
        const effectPath = `${actionPath}.effects[${effectIndex}]`;
        if (!isRecord(rawEffect)) throw new RegistryError(`${effectPath} 必须是资源效果对象`);
        assertNoExtraFields(rawEffect, ['scope', 'resourceId', 'amount', 'recipient'], effectPath);
        if (!isResourceScope(rawEffect.scope)) throw new RegistryError(`${effectPath}.scope 必须是 actor 或 team`);
        if (!isNonEmptyString(rawEffect.resourceId)) throw new RegistryError(`${effectPath}.resourceId 必须是非空字符串`);
        if (!Number.isSafeInteger(rawEffect.amount) || (rawEffect.amount as number) === 0) {
          throw new RegistryError(`${effectPath}.amount 必须是非零安全整数`);
        }
        const recipient = rawEffect.recipient;
        if (rawEffect.scope === 'team' && recipient !== undefined) {
          throw new RegistryError(`${effectPath}.recipient 仅适用于 actor resource effect`);
        }
        if (rawEffect.scope === 'actor' && recipient !== undefined && recipient !== 'actor' && recipient !== 'target') {
          throw new RegistryError(`${effectPath}.recipient 必须是 actor 或 target`);
        }
        if (rawEffect.scope === 'actor' && recipient === 'target'
          && target.kind !== 'self' && target.kind !== 'partyCharacter' && target.kind !== 'enemy') {
          throw new RegistryError(`${effectPath}.recipient 为 target 时 Action 必须声明单位 target`);
        }
        if (rawEffect.scope === 'team') knownTeamResourceIds.add(rawEffect.resourceId);
        const key = JSON.stringify([rawEffect.scope, rawEffect.resourceId, recipient ?? 'actor']);
        if (effectKeys.has(key)) {
          throw new RegistryError(`${actionPath}.effects 含重复 ${rawEffect.scope} resourceId "${rawEffect.resourceId}" recipient "${String(recipient ?? 'actor')}"`);
        }
        effectKeys.add(key);
      }

      const rawHpEffects: unknown = rawAction.hpEffects;
      if (rawHpEffects !== undefined && !Array.isArray(rawHpEffects)) {
        throw new RegistryError(`${actionPath}.hpEffects 必须是数组`);
      }
      if (Array.isArray(rawHpEffects) && rawHpEffects.length > 0
        && target.kind !== 'enemy' && target.kind !== 'partyCharacter') {
        throw new RegistryError(`${actionPath} HP 效果必须选择 Enemy 或 partyCharacter target`);
      }
      for (const [hpEffectIndex, rawHpEffect] of ((rawHpEffects ?? []) as unknown[]).entries()) {
        const hpEffectPath = `${actionPath}.hpEffects[${hpEffectIndex}]`;
        if (!isRecord(rawHpEffect)) throw new RegistryError(`${hpEffectPath} 必须是 HP 效果对象`);
        assertNoExtraFields(rawHpEffect, ['amount'], hpEffectPath);
        if (!Number.isSafeInteger(rawHpEffect.amount) || (rawHpEffect.amount as number) === 0) {
          throw new RegistryError(`${hpEffectPath}.amount 必须是非零安全整数`);
        }
      }
    }

    const rawInitialActorResources: unknown = map.initialActorResources;
    if (rawInitialActorResources !== undefined && !Array.isArray(rawInitialActorResources)) {
      throw new RegistryError(`Map "${map.id}" initialActorResources 必须是数组`);
    }
    const initialActorResourceKeys = new Set<string>();
    for (const [resourceIndex, rawResource] of ((rawInitialActorResources ?? []) as unknown[]).entries()) {
      const resourcePath = `Map "${map.id}" initialActorResources[${resourceIndex}]`;
      if (!isRecord(rawResource)) throw new RegistryError(`${resourcePath} 必须是资源初值对象`);
      assertNoExtraFields(rawResource, ['characterId', 'resourceId', 'value'], resourcePath);
      if (!isNonEmptyString(rawResource.characterId)) throw new RegistryError(`${resourcePath}.characterId 必须是非空 Character ID`);
      if (!knownCharacterIds.has(rawResource.characterId)) {
        throw new RegistryError(`${resourcePath}.characterId references unknown Character "${rawResource.characterId}"`);
      }
      if (!partyIds.has(rawResource.characterId)) {
        throw new RegistryError(`${resourcePath}.characterId 必须属于 Map partyCharacterIds`);
      }
      if (!isNonEmptyString(rawResource.resourceId)) throw new RegistryError(`${resourcePath}.resourceId 必须是非空字符串`);
      if (!Number.isSafeInteger(rawResource.value) || (rawResource.value as number) < 0) {
        throw new RegistryError(`${resourcePath}.value 必须是非负安全整数`);
      }
      const key = JSON.stringify([rawResource.characterId, rawResource.resourceId]);
      if (initialActorResourceKeys.has(key)) {
        throw new RegistryError(`Map "${map.id}" initialActorResources 含重复 Character "${rawResource.characterId}" resourceId "${rawResource.resourceId}"`);
      }
      initialActorResourceKeys.add(key);
    }

    const rawInitialTeamResources: unknown = map.initialTeamResources;
    if (rawInitialTeamResources !== undefined && !Array.isArray(rawInitialTeamResources)) {
      throw new RegistryError(`Map "${map.id}" initialTeamResources 必须是数组`);
    }
    const initialTeamResourceIds = new Set<string>();
    for (const [resourceIndex, rawResource] of ((rawInitialTeamResources ?? []) as unknown[]).entries()) {
      const resourcePath = `Map "${map.id}" initialTeamResources[${resourceIndex}]`;
      if (!isRecord(rawResource)) throw new RegistryError(`${resourcePath} 必须是资源初值对象`);
      assertNoExtraFields(rawResource, ['resourceId', 'value'], resourcePath);
      if (!isNonEmptyString(rawResource.resourceId)) throw new RegistryError(`${resourcePath}.resourceId 必须是非空字符串`);
      if (!Number.isSafeInteger(rawResource.value) || (rawResource.value as number) < 0) {
        throw new RegistryError(`${resourcePath}.value 必须是非负安全整数`);
      }
      if (initialTeamResourceIds.has(rawResource.resourceId)) {
        throw new RegistryError(`Map "${map.id}" initialTeamResources 含重复 resourceId "${rawResource.resourceId}"`);
      }
      initialTeamResourceIds.add(rawResource.resourceId);
      knownTeamResourceIds.add(rawResource.resourceId);
    }

    const validateEncounter = (rawEncounter: unknown, encounterPath: string): void => {
      if (!isRecord(rawEncounter)) throw new RegistryError(`${encounterPath} 必须是对象`);
      assertNoExtraFields(rawEncounter,
        ['title', 'description', 'completion', 'locals', 'rounds', 'enemies', 'initialEnemyTeamResources', 'abilityActionIds', 'itemActions', 'participants'],
        encounterPath);

      const rawEnemies: unknown = rawEncounter.enemies;
      const enemyCandidateActionIds = new Set<string>();
      let isBattle = false;
      if (rawEnemies !== undefined) {
        if (!Array.isArray(rawEnemies) || rawEnemies.length === 0) {
          throw new RegistryError(`${encounterPath}.enemies 必须是非空 Enemy roster；非战斗 Encounter 应省略此字段`);
        }
        isBattle = true;
        if (rawEncounter.completion !== undefined) {
          throw new RegistryError(`${encounterPath} Battle 不允许声明手动 completion`);
        }
        const enemyIds = new Set<string>();
        for (const [enemyIndex, rawEnemy] of rawEnemies.entries()) {
          const enemyPath = `${encounterPath}.enemies[${enemyIndex}]`;
          if (!isRecord(rawEnemy)) throw new RegistryError(`${enemyPath} 必须是 Enemy 对象`);
          assertNoExtraFields(rawEnemy, ['id', 'initialHp', 'maxHp', 'actions', 'initialResources'], enemyPath);
          const enemyId = rawEnemy.id;
          if (!isNonEmptyString(enemyId)) {
            throw new RegistryError(`${enemyPath}.id 必须是非空 Encounter-local Enemy ID`);
          }
          if (enemyIds.has(enemyId)) throw new RegistryError(`${encounterPath}.enemies 含重复 Enemy ID "${enemyId}"`);
          enemyIds.add(enemyId);
          if (!Number.isSafeInteger(rawEnemy.maxHp) || (rawEnemy.maxHp as number) <= 0) {
            throw new RegistryError(`${enemyPath}.maxHp 必须是正安全整数`);
          }
          if (!Number.isSafeInteger(rawEnemy.initialHp)
            || (rawEnemy.initialHp as number) < 1
            || (rawEnemy.initialHp as number) > (rawEnemy.maxHp as number)) {
            throw new RegistryError(`${enemyPath}.initialHp 必须在 1..maxHp 范围内`);
          }
          const rawInitialResources: unknown = rawEnemy.initialResources;
          if (rawInitialResources !== undefined && !Array.isArray(rawInitialResources)) {
            throw new RegistryError(`${enemyPath}.initialResources 必须是资源初值数组`);
          }
          const initialResourceIds = new Set<string>();
          for (const [resourceIndex, rawResource] of ((rawInitialResources ?? []) as unknown[]).entries()) {
            const resourcePath = `${enemyPath}.initialResources[${resourceIndex}]`;
            if (!isRecord(rawResource)) throw new RegistryError(`${resourcePath} 必须是资源初值对象`);
            assertNoExtraFields(rawResource, ['resourceId', 'value'], resourcePath);
            if (!isNonEmptyString(rawResource.resourceId)) throw new RegistryError(`${resourcePath}.resourceId 必须是非空字符串`);
            if (!Number.isSafeInteger(rawResource.value) || (rawResource.value as number) < 0) {
              throw new RegistryError(`${resourcePath}.value 必须是非负安全整数`);
            }
            if (initialResourceIds.has(rawResource.resourceId)) {
              throw new RegistryError(`${enemyPath}.initialResources 含重复 resourceId "${rawResource.resourceId}"`);
            }
            initialResourceIds.add(rawResource.resourceId);
          }

          const rawCandidates: unknown = rawEnemy.actions;
          if (rawCandidates !== undefined && !Array.isArray(rawCandidates)) {
            throw new RegistryError(`${enemyPath}.actions 必须是候选 Action 数组`);
          }
          const candidateActionIds = new Set<string>();
          for (const [candidateIndex, rawCandidate] of ((rawCandidates ?? []) as unknown[]).entries()) {
            const candidatePath = `${enemyPath}.actions[${candidateIndex}]`;
            if (!isRecord(rawCandidate)) throw new RegistryError(`${candidatePath} 必须是候选 Action 对象`);
            assertNoExtraFields(rawCandidate, ['actionId', 'tendencyWeight'], candidatePath);
            const actionId = rawCandidate.actionId;
            if (!isNonEmptyString(actionId)) throw new RegistryError(`${candidatePath}.actionId 必须是非空 Map-local Action ID`);
            if (!actionIds.has(actionId)) {
              throw new RegistryError(`${candidatePath}.actionId 引用了 Map "${map.id}" 未定义的 Action "${actionId}"`);
            }
            if (candidateActionIds.has(actionId)) {
              throw new RegistryError(`${enemyPath}.actions 含重复 Action id "${actionId}"`);
            }
            candidateActionIds.add(actionId);
            enemyCandidateActionIds.add(actionId);
            if (!Number.isSafeInteger(rawCandidate.tendencyWeight) || (rawCandidate.tendencyWeight as number) <= 0) {
              throw new RegistryError(`${candidatePath}.tendencyWeight 必须是正安全整数`);
            }
            const action = actionDefinitions.get(actionId);
            if (action && !tendencyRoleTargetCompatible(action, 'Enemy')) {
              throw new RegistryError(`${candidatePath}.actionId "${actionId}" tendencyRole 与 Enemy target 不兼容`);
            }
          }
        }
      }

      const rawEnemyTeamResources: unknown = rawEncounter.initialEnemyTeamResources;
      if (rawEnemyTeamResources !== undefined) {
        if (!isBattle) throw new RegistryError(`${encounterPath}.initialEnemyTeamResources 只允许用于 Battle Encounter`);
        if (!Array.isArray(rawEnemyTeamResources)) {
          throw new RegistryError(`${encounterPath}.initialEnemyTeamResources 必须是资源初值数组`);
        }
      }
      const enemyTeamResourceIds = new Set<string>();
      for (const [resourceIndex, rawResource] of ((rawEnemyTeamResources ?? []) as unknown[]).entries()) {
        const resourcePath = `${encounterPath}.initialEnemyTeamResources[${resourceIndex}]`;
        if (!isRecord(rawResource)) throw new RegistryError(`${resourcePath} 必须是资源初值对象`);
        assertNoExtraFields(rawResource, ['resourceId', 'value'], resourcePath);
        if (!isNonEmptyString(rawResource.resourceId)) throw new RegistryError(`${resourcePath}.resourceId 必须是非空字符串`);
        if (!Number.isSafeInteger(rawResource.value) || (rawResource.value as number) < 0) {
          throw new RegistryError(`${resourcePath}.value 必须是非负安全整数`);
        }
        if (enemyTeamResourceIds.has(rawResource.resourceId)) {
          throw new RegistryError(`${encounterPath}.initialEnemyTeamResources 含重复 resourceId "${rawResource.resourceId}"`);
        }
        enemyTeamResourceIds.add(rawResource.resourceId);
        knownTeamResourceIds.add(rawResource.resourceId);
      }

      const assertActorlessSourceAction = (actionId: string, actionPath: string): void => {
        const action = actionDefinitions.get(actionId);
        if (!action) throw new RegistryError(`${actionPath} 引用了 Map "${map.id}" 未定义的 Action "${actionId}"`);
        if (enemyCandidateActionIds.has(actionId)) {
          throw new RegistryError(`${actionPath} 的 Action "${actionId}" 已属于 Enemy 行动池，不能作为 Ability / Item 来源`);
        }
        if (!Array.isArray(action.eligibleCharacterIds) || action.eligibleCharacterIds.length > 0) {
          throw new RegistryError(`${actionPath} 的 Action "${actionId}" 是 Character Action，不能作为 Ability / Item 来源`);
        }
        const target = action.target;
        if (!isRecord(target) || (target.kind !== 'enemy' && target.kind !== 'partyCharacter')) {
          throw new RegistryError(`${actionPath} 的 Action "${actionId}" 必须明确选择 enemy 或 partyCharacter target，不能使用 none / self`);
        }
        const costs: unknown = action.costs;
        if (Array.isArray(costs) && costs.length > 0) {
          throw new RegistryError(`${actionPath} 的 Action "${actionId}" 不允许额外 Action cost`);
        }
        const effects: unknown = action.effects;
        if (Array.isArray(effects) && effects.some(effect => isRecord(effect) && effect.scope === 'actor')) {
          throw new RegistryError(`${actionPath} 的 Action "${actionId}" 不允许 actor-relative effect`);
        }
      };

      const rawAbilityActionIds: unknown = rawEncounter.abilityActionIds;
      if (rawAbilityActionIds !== undefined) {
        if (!isBattle) throw new RegistryError(`${encounterPath}.abilityActionIds 只允许用于 Battle Encounter`);
        if (!Array.isArray(rawAbilityActionIds)) throw new RegistryError(`${encounterPath}.abilityActionIds 必须是 Action ID 数组`);
        const seenAbilityIds = new Set<string>();
        for (const [abilityIndex, rawActionId] of rawAbilityActionIds.entries()) {
          const abilityPath = `${encounterPath}.abilityActionIds[${abilityIndex}]`;
          if (!isNonEmptyString(rawActionId)) throw new RegistryError(`${abilityPath} 必须是非空 Map-local Action ID`);
          if (seenAbilityIds.has(rawActionId)) throw new RegistryError(`${encounterPath}.abilityActionIds 含重复 Action ID "${rawActionId}"`);
          seenAbilityIds.add(rawActionId);
          if (!actionIds.has(rawActionId)) {
            throw new RegistryError(`${abilityPath} 引用了 Map "${map.id}" 未定义的 Action "${rawActionId}"`);
          }
          assertActorlessSourceAction(rawActionId, abilityPath);
        }
      }

      const rawItemActions: unknown = rawEncounter.itemActions;
      if (rawItemActions !== undefined) {
        if (!isBattle) throw new RegistryError(`${encounterPath}.itemActions 只允许用于 Battle Encounter`);
        if (!Array.isArray(rawItemActions)) throw new RegistryError(`${encounterPath}.itemActions 必须是 Item / Action 映射数组`);
        const mappedItemIds = new Set<string>();
        for (const [itemActionIndex, rawItemAction] of rawItemActions.entries()) {
          const itemActionPath = `${encounterPath}.itemActions[${itemActionIndex}]`;
          if (!isRecord(rawItemAction)) throw new RegistryError(`${itemActionPath} 必须是 Item / Action 映射对象`);
          assertNoExtraFields(rawItemAction, ['itemId', 'actionId'], itemActionPath);
          if (!isNonEmptyString(rawItemAction.itemId)) throw new RegistryError(`${itemActionPath}.itemId 必须是非空 Item ID`);
          if (!isNonEmptyString(rawItemAction.actionId)) throw new RegistryError(`${itemActionPath}.actionId 必须是非空 Map-local Action ID`);
          const itemType = knownItemTypes.get(rawItemAction.itemId);
          if (itemType === undefined) {
            throw new RegistryError(`${itemActionPath}.itemId 引用了未定义的 Item "${rawItemAction.itemId}"`);
          }
          if (itemType !== 'consumable') {
            throw new RegistryError(`${itemActionPath}.itemId "${rawItemAction.itemId}" 必须引用 Consumable Item`);
          }
          if (mappedItemIds.has(rawItemAction.itemId)) {
            throw new RegistryError(`${encounterPath}.itemActions 含重复 Item ID "${rawItemAction.itemId}"`);
          }
          mappedItemIds.add(rawItemAction.itemId);
          if (!actionIds.has(rawItemAction.actionId)) {
            throw new RegistryError(`${itemActionPath}.actionId 引用了 Map "${map.id}" 未定义的 Action "${rawItemAction.actionId}"`);
          }
          assertActorlessSourceAction(rawItemAction.actionId, itemActionPath);
        }
      }

      const rawParticipants: unknown = rawEncounter.participants;
      if (rawParticipants === undefined) return;
      if (!Array.isArray(rawParticipants)) throw new RegistryError(`${encounterPath}.participants 必须是数组`);

      const participantIds = new Set<string>();
      for (const [participantIndex, rawParticipant] of rawParticipants.entries()) {
        const participantPath = `${encounterPath}.participants[${participantIndex}]`;
        if (!isRecord(rawParticipant)) throw new RegistryError(`${participantPath} 必须是参与者对象`);
        assertNoExtraFields(rawParticipant, ['characterId', 'actions'], participantPath);
        const characterId = rawParticipant.characterId;
        if (!isNonEmptyString(characterId)) throw new RegistryError(`${participantPath}.characterId 必须是非空 Character ID`);
        if (!knownCharacterIds.has(characterId)) {
          throw new RegistryError(`${participantPath}.characterId references unknown Character "${characterId}"`);
        }
        if (!partyIds.has(characterId)) {
          throw new RegistryError(`${participantPath}.characterId 必须属于 Map partyCharacterIds`);
        }
        if (participantIds.has(characterId)) {
          throw new RegistryError(`${encounterPath}.participants 含重复 Character "${characterId}"`);
        }
        participantIds.add(characterId);

        const rawCandidates: unknown = rawParticipant.actions;
        if (!Array.isArray(rawCandidates)) throw new RegistryError(`${participantPath}.actions 必须是数组`);
        const candidateActionIds = new Set<string>();
        for (const [candidateIndex, rawCandidate] of rawCandidates.entries()) {
          const candidatePath = `${participantPath}.actions[${candidateIndex}]`;
          if (!isRecord(rawCandidate)) throw new RegistryError(`${candidatePath} 必须是候选 Action 对象`);
          assertNoExtraFields(rawCandidate, ['actionId', 'tendencyWeight'], candidatePath);
          const actionId = rawCandidate.actionId;
          if (!isNonEmptyString(actionId)) throw new RegistryError(`${candidatePath}.actionId 必须是非空 Map-local Action ID`);
          if (!actionIds.has(actionId)) {
            throw new RegistryError(`${candidatePath}.actionId 引用了 Map "${map.id}" 未定义的 Action "${actionId}"`);
          }
          if (candidateActionIds.has(actionId)) {
            throw new RegistryError(`${participantPath}.actions 含重复 Action id "${actionId}"`);
          }
          candidateActionIds.add(actionId);
          if (!Number.isSafeInteger(rawCandidate.tendencyWeight) || (rawCandidate.tendencyWeight as number) <= 0) {
            throw new RegistryError(`${candidatePath}.tendencyWeight 必须是正安全整数`);
          }
          if (!actionEligibility.get(actionId)?.has(characterId)) {
            throw new RegistryError(`${candidatePath}.actionId "${actionId}" 不允许 Character "${characterId}" 执行`);
          }
          const action = actionDefinitions.get(actionId);
          if (action && !tendencyRoleTargetCompatible(action, 'Character')) {
            throw new RegistryError(`${candidatePath}.actionId "${actionId}" tendencyRole 与 Character target 不兼容`);
          }
          if (isRecord(action?.target) && action.target.kind === 'enemy' && !isBattle) {
            throw new RegistryError(`${candidatePath}.actionId "${actionId}" 选择 Enemy target 但 Encounter 没有 Battle roster`);
          }
        }
      }
    };

    for (const node of map.nodes) {
      const nodePath = `Map "${map.id}" Node "${node.id}"`;
      if (node.encounter !== undefined) validateEncounter(node.encounter, `${nodePath} encounter`);
      const rawActivities: unknown = node.activities;
      if (rawActivities === undefined) continue;
      if (node.encounter !== undefined) {
        throw new RegistryError(`${nodePath} 不能同时声明 encounter 与 activities`);
      }
      if (!Array.isArray(rawActivities) || rawActivities.length === 0) {
        throw new RegistryError(`${nodePath} activities 必须是非空活动数组；无活动 Node 应省略该字段`);
      }
      const activityIds = new Set<string>();
      for (const [activityIndex, rawActivity] of rawActivities.entries()) {
        const activityPath = `${nodePath} activities[${activityIndex}]`;
        if (!isRecord(rawActivity)) throw new RegistryError(`${activityPath} 必须是活动对象`);
        assertNoExtraFields(rawActivity, ['id', 'title', 'encounter', 'shop'], activityPath);
        if (!isNonEmptyString(rawActivity.id)) {
          throw new RegistryError(`${activityPath}.id 必须是非空 Node-local Activity ID`);
        }
        if (activityIds.has(rawActivity.id)) {
          throw new RegistryError(`${nodePath} activities 含重复 Activity id "${rawActivity.id}"`);
        }
        activityIds.add(rawActivity.id);
        if (rawActivity.title !== undefined && typeof rawActivity.title !== 'string') {
          throw new RegistryError(`${activityPath}.title 必须是字符串`);
        }
        if ((rawActivity.encounter === undefined) === (rawActivity.shop === undefined)) {
          throw new RegistryError(`${activityPath} 必须且只能声明 encounter 或 shop`);
        }
        if (rawActivity.encounter !== undefined) {
          validateEncounter(rawActivity.encounter, `${activityPath}.encounter`);
          const rawRoundEncounter = rawActivity.encounter as Record<string, unknown>;
          if (rawRoundEncounter.rounds !== undefined) {
            if (!Number.isSafeInteger(rawRoundEncounter.rounds) || (rawRoundEncounter.rounds as number) < 1) {
              throw new RegistryError(`${activityPath}.encounter.rounds 必须是正安全整数`);
            }
            if (rawRoundEncounter.enemies !== undefined) {
              throw new RegistryError(`${activityPath}.encounter.rounds 只允许用于没有 Enemy roster 的 Rest`);
            }
            if (rawRoundEncounter.completion !== undefined) {
              throw new RegistryError(`${activityPath}.encounter.rounds 与手动 completion 互斥`);
            }
          }
          continue;
        }
        const rawShop: unknown = rawActivity.shop;
        if (!isRecord(rawShop)) throw new RegistryError(`${activityPath}.shop 必须是对象`);
        assertNoExtraFields(rawShop, ['title', 'description', 'offers'], `${activityPath}.shop`);
        if (rawShop.title !== undefined && typeof rawShop.title !== 'string') {
          throw new RegistryError(`${activityPath}.shop.title 必须是字符串`);
        }
        if (rawShop.description !== undefined && typeof rawShop.description !== 'string') {
          throw new RegistryError(`${activityPath}.shop.description 必须是字符串`);
        }
        const rawOffers: unknown = rawShop.offers;
        if (!Array.isArray(rawOffers) || rawOffers.length === 0) {
          throw new RegistryError(`${activityPath}.shop.offers 必须是非空数组`);
        }
        const offerIds = new Set<string>();
        for (const [offerIndex, rawOffer] of rawOffers.entries()) {
          const offerPath = `${activityPath}.shop.offers[${offerIndex}]`;
          if (!isRecord(rawOffer)) throw new RegistryError(`${offerPath} 必须是商店报价对象`);
          assertNoExtraFields(rawOffer, ['id', 'name', 'description', 'costs', 'effects', 'heal'], offerPath);
          if (!isNonEmptyString(rawOffer.id)) throw new RegistryError(`${offerPath}.id 必须是非空 Shop-local Offer ID`);
          if (offerIds.has(rawOffer.id)) throw new RegistryError(`${activityPath}.shop.offers 含重复 Offer id "${rawOffer.id}"`);
          offerIds.add(rawOffer.id);
          if (!isNonEmptyString(rawOffer.name)) throw new RegistryError(`${offerPath}.name 必须是非空展示名称`);
          if (rawOffer.description !== undefined && typeof rawOffer.description !== 'string') {
            throw new RegistryError(`${offerPath}.description 必须是字符串`);
          }
          const rawCosts: unknown = rawOffer.costs;
          if (rawCosts !== undefined && !Array.isArray(rawCosts)) throw new RegistryError(`${offerPath}.costs 必须是数组`);
          const seenCostResourceIds = new Set<string>();
          for (const [costIndex, rawCost] of ((rawCosts ?? []) as unknown[]).entries()) {
            const costPath = `${offerPath}.costs[${costIndex}]`;
            if (!isRecord(rawCost)) throw new RegistryError(`${costPath} 必须是资源费用对象`);
            assertNoExtraFields(rawCost, ['resourceId', 'amount'], costPath);
            if (!isNonEmptyString(rawCost.resourceId)) throw new RegistryError(`${costPath}.resourceId 必须是非空字符串`);
            if (!Number.isSafeInteger(rawCost.amount) || (rawCost.amount as number) <= 0) {
              throw new RegistryError(`${costPath}.amount 必须是正安全整数`);
            }
            if (seenCostResourceIds.has(rawCost.resourceId)) {
              throw new RegistryError(`${offerPath}.costs 含重复 resourceId "${rawCost.resourceId}"`);
            }
            seenCostResourceIds.add(rawCost.resourceId);
            if (!knownTeamResourceIds.has(rawCost.resourceId)) {
              throw new RegistryError(`${costPath}.resourceId "${rawCost.resourceId}" 没有对应的 MapRun Team 资源余额`);
            }
          }
          const rawEffects: unknown = rawOffer.effects;
          if (rawEffects !== undefined && !Array.isArray(rawEffects)) throw new RegistryError(`${offerPath}.effects 必须是数组`);
          const seenEffectResourceIds = new Set<string>();
          for (const [effectIndex, rawEffect] of ((rawEffects ?? []) as unknown[]).entries()) {
            const effectPath = `${offerPath}.effects[${effectIndex}]`;
            if (!isRecord(rawEffect)) throw new RegistryError(`${effectPath} 必须是资源效果对象`);
            assertNoExtraFields(rawEffect, ['resourceId', 'amount'], effectPath);
            if (!isNonEmptyString(rawEffect.resourceId)) throw new RegistryError(`${effectPath}.resourceId 必须是非空字符串`);
            if (!Number.isSafeInteger(rawEffect.amount) || (rawEffect.amount as number) === 0) {
              throw new RegistryError(`${effectPath}.amount 必须是非零安全整数`);
            }
            if (seenEffectResourceIds.has(rawEffect.resourceId)) {
              throw new RegistryError(`${offerPath}.effects 含重复 resourceId "${rawEffect.resourceId}"`);
            }
            seenEffectResourceIds.add(rawEffect.resourceId);
            if (!knownTeamResourceIds.has(rawEffect.resourceId)) {
              throw new RegistryError(`${effectPath}.resourceId "${rawEffect.resourceId}" 没有对应的 MapRun Team 资源余额`);
            }
          }
          const rawHeal: unknown = rawOffer.heal;
          if (rawHeal !== undefined) {
            if (!isRecord(rawHeal)) throw new RegistryError(`${offerPath}.heal 必须是对象`);
            assertNoExtraFields(rawHeal, ['characterId', 'amount'], `${offerPath}.heal`);
            if (!isNonEmptyString(rawHeal.characterId)) throw new RegistryError(`${offerPath}.heal.characterId 必须是非空 Character ID`);
            if (!partyIds.has(rawHeal.characterId)) {
              throw new RegistryError(`${offerPath}.heal.characterId 必须属于 Map partyCharacterIds`);
            }
            if (!Number.isSafeInteger(rawHeal.amount) || (rawHeal.amount as number) <= 0) {
              throw new RegistryError(`${offerPath}.heal.amount 必须是正安全整数`);
            }
          }
        }
      }
    }

    for (const edge of map.edges) {
      const condition = edge.condition;
      if (condition === undefined) continue;
      const edgePath = `Map "${map.id}" Edge "${edge.fromNodeId}" → "${edge.toNodeId}"`;
      if (!isRecord(condition)) throw new RegistryError(`${edgePath}.condition 必须是对象`);
      assertNoExtraFields(condition, ['kind', 'resourceId', 'amount'], `${edgePath}.condition`);
      if (condition.kind !== 'teamResourceAtLeast') {
        throw new RegistryError(`${edgePath}.condition.kind 只支持 teamResourceAtLeast`);
      }
      if (!isNonEmptyString(condition.resourceId)) throw new RegistryError(`${edgePath}.condition.resourceId 必须是非空字符串`);
      if (!Number.isSafeInteger(condition.amount) || (condition.amount as number) <= 0) {
        throw new RegistryError(`${edgePath}.condition.amount 必须是正安全整数`);
      }
      if (!knownTeamResourceIds.has(condition.resourceId)) {
        throw new RegistryError(`${edgePath}.condition.resourceId "${condition.resourceId}" 没有对应的 MapRun Team 资源余额`);
      }
    }
    const effectContextIssues = validateGameplayMapEffectContext(map);
    if (effectContextIssues.length > 0) {
      const issue = effectContextIssues[0];
      throw new RegistryError(`${issue.path}: ${issue.message}`);
    }
  }
}

const PRESENTATION_OPTION_ID = /^[a-z0-9][a-z0-9_-]*$/;
const CONDITION_COMPARATORS = new Set(['==', '!=', '>=', '<=', '>', '<']);
const MILESTONE_LISTENER_EXECUTABLE_OPS: ReadonlySet<EffectOp> = new Set([
  'setResource',
  'addResource',
  'setSpotLevel',
  'addSpotLevel',
  'setManager',
  'addEnhancement',
  'addItem',
  'unlockInit',
  'setFlag',
  'triggerStory',
  'setExtra',
  'addExtra',
  'removeExtra',
  'grantCharacter',
  'addAffectionExp',
  'setTheme',
  'setEntityPresentation',
  'clearEntityPresentation',
  'clearAllChatFlow',
  'showChatText',
  'clearIdChatFlow',
  'clearAllChatText',
  'showOpeningTitle',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateMilestoneListenerEffects(listener: MilestoneListenerDef): void {
  const effects: unknown = listener.then;
  if (!Array.isArray(effects)) {
    throw new RegistryError(`MilestoneListener "${listener.id}" then 必须是效果数组`);
  }
  for (const [index, effect] of effects.entries()) {
    const op = isRecord(effect) ? effect.op : undefined;
    if (typeof op !== 'string' || !MILESTONE_LISTENER_EXECUTABLE_OPS.has(op as EffectOp)) {
      throw new RegistryError(`MilestoneListener "${listener.id}" then[${index}] op "${String(op)}" is not executable in milestone listener context`);
    }
  }
}

function isCondition(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return typeof value.target === 'string'
    && typeof value.key === 'string'
    && typeof value.comparator === 'string'
    && CONDITION_COMPARATORS.has(value.comparator)
    && typeof value.value === 'number'
    && Number.isFinite(value.value);
}

function isConditionExpression(value: unknown): boolean {
  if (isCondition(value)) return true;
  if (!isRecord(value) || (value.type !== 'AND' && value.type !== 'OR') || !Array.isArray(value.conditions)) return false;
  return value.conditions.length > 0 && value.conditions.every(isConditionExpression);
}

function checkEntityPresentation(items: Array<{ id: string; presentation?: EntityPresentationDef }> | undefined, label: string): void {
  for (const item of items ?? []) {
    const presentation = item.presentation;
    if (presentation === undefined) continue;
    const base = presentation.default as unknown as Record<string, unknown> | undefined;
    if (!isRecord(base) || typeof base.name !== 'string' || base.name.length === 0 || typeof base.description !== 'string') {
      throw new RegistryError(`${label} "${item.id}" 的 presentation.default 必须包含非空 name 与 description`);
    }
    if (base.theme !== undefined && !isRecord(base.theme)) {
      throw new RegistryError(`${label} "${item.id}" 的 presentation.default.theme 必须是对象`);
    }
    if (presentation.additions === undefined) continue;
    if (!Array.isArray(presentation.additions)) {
      throw new RegistryError(`${label} "${item.id}" 的 presentation.additions 必须是数组`);
    }
    const ids = new Set<string>();
    for (const [index, option] of presentation.additions.entries()) {
      const optionValue = option as unknown as Record<string, unknown>;
      if (!isRecord(optionValue)) throw new RegistryError(`${label} "${item.id}" 的 presentation.additions[${index}] 必须是对象`);
      const optionId = optionValue.id;
      if (typeof optionId !== 'string' || !PRESENTATION_OPTION_ID.test(optionId)) {
        throw new RegistryError(`${label} "${item.id}" 的 presentation option ID "${String(optionId)}" 非法`);
      }
      if (ids.has(optionId)) throw new RegistryError(`${label} "${item.id}" 的 presentation option ID 重复："${optionId}"`);
      ids.add(optionId);
      if (typeof optionValue.label !== 'string' || optionValue.label.length === 0) {
        throw new RegistryError(`${label} "${item.id}" 的 presentation option "${optionId}" 缺少非空 label`);
      }
      const override = optionValue.override;
      if (!isRecord(override)) throw new RegistryError(`${label} "${item.id}" 的 presentation option "${optionId}" 缺少 override 对象`);
      const overrideKeys = Object.keys(override);
      const allowedKeys = new Set(['name', 'description', 'theme']);
      if (overrideKeys.length === 0 || overrideKeys.some(key => !allowedKeys.has(key))) {
        throw new RegistryError(`${label} "${item.id}" 的 presentation option "${optionId}" override 只能覆盖 name、description、theme，且至少一项`);
      }
      if (override.name !== undefined && typeof override.name !== 'string') {
        throw new RegistryError(`${label} "${item.id}" 的 presentation option "${optionId}" name 覆盖必须是字符串`);
      }
      if (override.description !== undefined && typeof override.description !== 'string') {
        throw new RegistryError(`${label} "${item.id}" 的 presentation option "${optionId}" description 覆盖必须是字符串`);
      }
      if (override.theme !== undefined && !isRecord(override.theme)) {
        throw new RegistryError(`${label} "${item.id}" 的 presentation option "${optionId}" theme 覆盖必须是对象`);
      }
      if (optionValue.availableWhen !== undefined && !isConditionExpression(optionValue.availableWhen)) {
        throw new RegistryError(`${label} "${item.id}" 的 presentation option "${optionId}" availableWhen 非法`);
      }
    }
  }
}

/** 校验数据包；非法即抛 RegistryError。 */
export interface DatapackValidationContext extends OperationContentValidationContext {
  readonly itemTypes?: ReadonlyMap<string, ItemDef['type']>;
  readonly areaIds?: ReadonlySet<string>;
  readonly storyEntryIds?: ReadonlySet<string>;
  readonly milestoneIds?: ReadonlySet<string>;
  readonly milestoneListeners?: ReadonlyMap<string, MilestoneListenerDef>;
  readonly achievements?: ReadonlyMap<string, AchievementDef>;
}

export function validateDatapack(dp: Datapack, context: DatapackValidationContext = {}): void {
  validateAreaMapShapes(dp.areaMaps, message => { throw new RegistryError(`[${dp.modName ?? dp.name}] ${message}`); });
  for (const area of dp.areas ?? []) {
    if (area.quickPassage !== undefined && typeof area.quickPassage !== 'boolean') throw new RegistryError(`Area "${area.id}" quickPassage 必须是布尔值`);
  }
  if (dp.modName !== undefined && !/^[a-z0-9-]+$/.test(dp.modName)) {
    throw new RegistryError(`Datapack modName "${dp.modName}" 格式无效`);
  }
  // 检查 ID 唯一性
  const checkDup = <T extends { id: string }>(items: T[], label: string) => {
    const seen = new Set<string>();
    for (const item of items) {
      if (seen.has(item.id)) {
        throw new RegistryError(`Duplicate ${label} id: "${item.id}"`);
      }
      seen.add(item.id);
    }
  };

  checkDup(dp.inits, 'init');
  checkDup(dp.areas, 'area');
  checkDup(dp.spots, 'spot');
  if (dp.maps) checkDup(dp.maps, 'map');
  checkDup(dp.enhancements, 'enhancement');
  checkDup(dp.stories, 'story');
  checkDup(dp.activeStories, 'active story entry');
  checkDup(dp.passiveStories, 'passive story entry');
  checkDup(dp.items, 'item');
  if (dp.shops) checkDup(dp.shops, 'shop');
  if (dp.dropTables) checkDup(dp.dropTables, 'drop table');
  if (dp.milestones) checkDup(dp.milestones, 'milestone');
  if (dp.operationEvents) checkDup(dp.operationEvents, 'operation event');
  if (dp.operationLocations) checkDup(dp.operationLocations, 'operation location');
  if (dp.operationActions) checkDup(dp.operationActions, 'operation action');
  if (dp.studentOperationProfiles) checkDup(dp.studentOperationProfiles, 'student operation profile');
  if (dp.operationStrategyProfiles) checkDup(dp.operationStrategyProfiles, 'operation strategy profile');
  if (dp.operationCardPools) checkDup(dp.operationCardPools, 'operation card pool');
  if (dp.milestoneListeners) checkDup(dp.milestoneListeners, 'milestone listener');
  if (dp.achievements) checkDup(dp.achievements, 'achievement');
  if (dp.funcletDefs) checkDup(dp.funcletDefs, 'funclet');
  if (dp.characters) checkDup(dp.characters, 'character');
  if (dp.characterVariants) checkDup(dp.characterVariants, 'character variant');
  if (dp.resourceDisplays) {
    checkDup(
      dp.resourceDisplays.map(rd => ({ id: rd.resourceId })),
      'resource display',
    );
    for (const rd of dp.resourceDisplays) {
      if (!rd.resourceId) {
        throw new RegistryError('Resource display entry missing resourceId');
      }
    }
  }
  if (dp.tags) {
    checkDup(dp.tags, 'tag');
    for (const t of dp.tags) {
      if (!t.id) {
        throw new RegistryError('Tag def missing id');
      }
      if (t.id.includes(':') && !isTagRef(t.id)) {
        throw new RegistryError(`Tag id "${t.id}" 不符合 modName:tagPath 格式`);
      }
      if (t.parent !== undefined && !isTagRef(t.parent)) {
        throw new RegistryError(`Tag "${t.id}" 的 parent 必须是完整 TagRef`);
      }
    }
  }
  checkTaggedItems(dp.inits, 'Init');
  checkTaggedItems(dp.areas, 'Area');
  checkTaggedItems(dp.spots, 'Spot');
  checkTaggedItems(dp.enhancements, 'Enhancement');
  checkTaggedItems(dp.activeStories, 'Active story entry');
  checkTaggedItems(dp.passiveStories, 'Passive story entry');
  checkTaggedItems(dp.passivePools, 'Passive pool');
  checkTaggedItems(dp.characters, 'Character');
  checkEntityPresentation(dp.inits, 'Init');
  checkEntityPresentation(dp.areas, 'Area');
  checkEntityPresentation(dp.spots, 'Spot');
  checkEntityPresentation(dp.enhancements, 'Enhancement');
  checkEntityPresentation(dp.characterVariants, 'CharacterVariant');
  for (const pack of dp.affectorPacks ?? []) for (const entry of pack.entries) {
    for (const modifier of entry.zoneModifiers ?? []) if (modifier.target.kind === 'tag') {
      checkTagPath(modifier.target.tag, `Affector pack "${pack.id}" zone modifier tag`);
    }
  }
  if (dp.pics) {
    checkDup(dp.pics, 'pic');
    for (const p of dp.pics) {
      if (!p.id) throw new RegistryError('Pic def missing id');
      const parsed = parsePicId(p.id);
      if (!parsed) {
        throw new RegistryError(`Pic id "${p.id}" 不符合三段式格式（modName:typeName(pic):idName，中段须以 (pic) 结尾）`);
      }
      if (!p.src) {
        throw new RegistryError(`Pic "${p.id}" missing src`);
      }
    }
  }
  if (dp.charaProfiles) {
    checkDup(dp.charaProfiles, 'chara profile');    for (const cp of dp.charaProfiles) {
      if (!cp.names || cp.names.length === 0) {
        throw new RegistryError(`Chara profile "${cp.id}" name 表至少一条`);
      }
      for (const n of cp.names) {
        if (!n.id || !n.text) {
          throw new RegistryError(`Chara profile "${cp.id}" name 条目缺 id 或 text`);
        }
      }
      const nameIds = new Set(cp.names.map(n => n.id));
      if (cp.activeName !== undefined && !nameIds.has(cp.activeName)) {
        throw new RegistryError(`Chara profile "${cp.id}" activeName "${cp.activeName}" 不在 name 表`);
      }
      const avatarIds = new Set((cp.avatars ?? []).map(a => a.id));
      if (cp.activeAvatar !== undefined && !avatarIds.has(cp.activeAvatar)) {
        throw new RegistryError(`Chara profile "${cp.id}" activeAvatar "${cp.activeAvatar}" 不在 avatar 表`);
      }
      for (const a of cp.avatars ?? []) {
        if (!a.id || !a.pic) {
          throw new RegistryError(`Chara profile "${cp.id}" avatar 条目缺 id 或 pic`);
        }
        if (!parsePicId(a.pic)) {
          throw new RegistryError(`Chara profile "${cp.id}" avatar "${a.id}" 的 pic 非 PicId（须为 mod:type(pic):id，不得持有裸 URL）`);
        }
      }
    }
  }

  if (dp.colorGroups) checkDup(dp.colorGroups, 'color group');
  if (dp.colorEquipments) checkDup(dp.colorEquipments, 'color equipment');
  if (dp.gears) checkDup(dp.gears, 'gear');
  if (dp.favoriteItems) checkDup(dp.favoriteItems, 'favorite item');
  if (dp.uniqueWeapons) checkDup(dp.uniqueWeapons, 'unique weapon');
  if (dp.traits) checkDup(dp.traits, 'trait');

  // 三段式 id 规范校验（§2）：强校验表按表名核对 typeName；
  // story / character 域 S1b/c 归位前仅查格式。
  checkEntityIds(dp.inits, 'init', 'Init');
  checkEntityIds(dp.areas, 'area', 'Area');
  checkEntityIds(dp.spots, 'spot', 'Spot');
  checkEntityIds(dp.maps, 'map', 'Map');
  checkExpectedEntityType(dp.maps, 'map', 'Map');
  validateMapTopologies(dp.maps);
  validateMapRunContent(
    dp.maps,
    new Set([
      ...(context.characterIds ?? []),
      ...(dp.characters ?? []).map(character => character.id),
    ]),
  );
  validateMapActionContent(
    dp.maps,
    new Set([
      ...(context.characterIds ?? []),
      ...(dp.characters ?? []).map(character => character.id),
    ]),
    new Map([
      ...(context.itemTypes ?? []),
      ...(dp.items ?? []).map(item => [item.id, item.type] as const),
    ]),
  );
  checkEntityIds(dp.enhancements, 'enhancement', 'Enhancement');
  checkEntityIds(dp.items, 'item', 'Item');
  checkEntityIds(dp.shops, 'shop', 'Shop');
  checkEntityIds(dp.dropTables, 'droptable', 'Drop table');
  checkEntityIds(dp.milestones, 'milestone', 'Milestone');
  checkEntityIds(dp.operationEvents, 'operation-event', 'Operation Event');
  checkEntityIds(dp.operationLocations, 'operation-location', 'Operation Location');
  checkEntityIds(dp.operationActions, 'operation-action', 'Operation Action');
  checkEntityIds(dp.studentOperationProfiles, 'student-operation-profile', 'StudentOperationProfile');
  checkEntityIds(dp.operationStrategyProfiles, 'operation-strategy-profile', 'OperationStrategyProfile');
  checkEntityIds(dp.operationCardPools, 'operation-card-pool', 'OperationCardPool');
  checkExpectedEntityType(dp.operationEvents, 'operation-event', 'Operation Event');
  checkExpectedEntityType(dp.operationLocations, 'operation-location', 'Operation Location');
  checkExpectedEntityType(dp.operationActions, 'operation-action', 'Operation Action');
  checkExpectedEntityType(dp.studentOperationProfiles, 'student-operation-profile', 'StudentOperationProfile');
  checkExpectedEntityType(dp.operationStrategyProfiles, 'operation-strategy-profile', 'OperationStrategyProfile');
  checkExpectedEntityType(dp.operationCardPools, 'operation-card-pool', 'OperationCardPool');
  for (const milestone of dp.milestones ?? []) {
    if (parseEntityId(milestone.id)?.type !== 'milestone') {
      throw new RegistryError(`Milestone id "${milestone.id}" 的 typeName 段须为 "milestone"`);
    }
  }
  checkEntityIds(dp.milestoneListeners, 'milestone-listener', 'MilestoneListener');
  for (const listener of dp.milestoneListeners ?? []) {
    if (parseEntityId(listener.id)?.type !== 'milestone-listener') {
      throw new RegistryError(`MilestoneListener id "${listener.id}" 的 typeName 段须为 "milestone-listener"`);
    }
  }
  checkEntityIds(dp.achievements, 'achievement', 'Achievement');
  for (const achievement of dp.achievements ?? []) {
    if (parseEntityId(achievement.id)?.type !== 'achievement') {
      throw new RegistryError(`Achievement id "${achievement.id}" 的 typeName 段须为 "achievement"`);
    }
  }
  // 匿名 Trigger（id 缺省 / anon: 派生前缀）不参与三段式校验
  checkEntityIds(
    dp.triggerDefs?.filter(t => t.id !== undefined && !t.id.startsWith('anon:')) as { id: string }[] | undefined,
    'trigger',
    'Trigger',
  );
  checkEntityIds(dp.affectorPacks, 'affectorpack', 'Affector pack');
  checkEntityIds(dp.funcletDefs, 'funclet', 'Funclet');
  checkEntityIds(dp.passivePools, 'passivepool', 'Passive pool');
  checkEntityIds(dp.gachaPools, 'gachapool', 'Gacha pool');
  checkEntityIds(dp.cultivateCurves, 'cultivatecurve', 'Cultivate curve');
  checkEntityIds(dp.colorGroups, 'colorgroup', 'Color group');
  checkEntityIds(dp.colorEquipments, 'colorequipment', 'Color equipment');
  checkEntityIds(dp.gears, 'gear', 'Gear');
  checkEntityIds(dp.themeDesigns, 'themedesign', 'Theme design');
  checkEntityIds(dp.resourceDisplays?.map(rd => ({ id: rd.resourceId })), 'resource', 'Resource display');
  // story 三表强校验（S1b 落地）：本体 / 主动投放位 / 被动投放位各自中段归位；
  // characters / characterVariants 裸名（S1c 命名空间化）暂不校验。
  checkEntityIds(dp.stories, 'story', 'Story');
  checkEntityIds(dp.activeStories, 'activestory', 'Active story entry');
  checkEntityIds(dp.passiveStories, 'passivestory', 'Passive story entry');

  // 检查引用完整性
  const initIds = new Set([...context.initIds ?? [], ...dp.inits.map(i => i.id)]);
  const areaIds = new Set([...context.areaIds ?? [], ...dp.areas.map(a => a.id)]);
  const storyEntryIds = new Set([
    ...context.storyEntryIds ?? [],
    ...dp.activeStories.map(entry => entry.id),
    ...dp.passiveStories.map(entry => entry.id),
  ]);
  const milestoneIds = new Set([...context.milestoneIds ?? [], ...(dp.milestones ?? []).map(milestone => milestone.id)]);
  const listenersById = new Map(context.milestoneListeners ?? []);
  for (const listener of dp.milestoneListeners ?? []) listenersById.set(listener.id, listener);
  const achievementsById = new Map(context.achievements ?? []);
  for (const achievement of dp.achievements ?? []) achievementsById.set(achievement.id, achievement);

  for (const area of dp.areas) {
    if (!initIds.has(area.initId)) {
      throw new RegistryError(`Area "${area.id}" references unknown init: "${area.initId}"`);
    }
  }
  for (const spot of dp.spots) {
    if (!areaIds.has(spot.areaId)) {
      throw new RegistryError(`Spot "${spot.id}" references unknown area: "${spot.areaId}"`);
    }
    validateSpotPayments(spot);
  }
  for (const init of dp.inits) {
    for (const aid of init.defaultAreas) {
      if (!areaIds.has(aid)) {
        throw new RegistryError(`Init "${init.id}" references unknown default area: "${aid}"`);
      }
    }
  }
  for (const area of dp.areas) {
    for (const sid of area.defaultSpots) {
      const spotExists = dp.spots.some(s => s.id === sid);
      if (!spotExists) {
        throw new RegistryError(`Area "${area.id}" references unknown default spot: "${sid}"`);
      }
    }
  }
  const listenerByMilestone = new Map<string, string>();
  for (const listener of listenersById.values()) {
    if (!milestoneIds.has(listener.milestoneId)) {
      throw new RegistryError(`MilestoneListener "${listener.id}" references unknown milestone: "${listener.milestoneId}"`);
    }
    if (!areaIds.has(listener.areaId)) {
      throw new RegistryError(`MilestoneListener "${listener.id}" references unknown area: "${listener.areaId}"`);
    }
    const otherListenerId = listenerByMilestone.get(listener.milestoneId);
    if (otherListenerId && otherListenerId !== listener.id) {
      throw new RegistryError(`MilestoneListeners "${otherListenerId}" and "${listener.id}" reference the same Milestone "${listener.milestoneId}"`);
    }
    listenerByMilestone.set(listener.milestoneId, listener.id);
    validateMilestoneListenerEffects(listener);
  }
  const achievementByListener = new Map<string, string>();
  for (const achievement of achievementsById.values()) {
    if (!listenersById.has(achievement.listenerId)) {
      throw new RegistryError(`Achievement "${achievement.id}" references unknown MilestoneListener: "${achievement.listenerId}"`);
    }
    const otherAchievementId = achievementByListener.get(achievement.listenerId);
    if (otherAchievementId && otherAchievementId !== achievement.id) {
      throw new RegistryError(`Achievements "${otherAchievementId}" and "${achievement.id}" reference the same MilestoneListener "${achievement.listenerId}"`);
    }
    achievementByListener.set(achievement.listenerId, achievement.id);
  }
  for (const pack of dp.affectorPacks ?? []) {
    for (const entry of pack.entries) {
      for (const network of entry.areaTransitNetworks ?? []) {
        if (!network.name?.trim() || !Array.isArray(network.areaIds) || network.areaIds.length < 2 ||
          new Set(network.areaIds).size !== network.areaIds.length || network.areaIds.some(id => !areaIds.has(id))) {
          throw new RegistryError(`Affector "${pack.id}" entry "${entry.id}" 的交通网络名称或成员非法`);
        }
      }
      for (const connection of entry.areaConnections ?? []) {
        if (!areaIds.has(connection.fromAreaId)) {
          throw new RegistryError(`Affector pack "${pack.id}" entry "${entry.id}" references unknown source area: "${connection.fromAreaId}"`);
        }
        if (!areaIds.has(connection.toAreaId)) {
          throw new RegistryError(`Affector pack "${pack.id}" entry "${entry.id}" references unknown target area: "${connection.toAreaId}"`);
        }
        if (connection.fromAreaId === connection.toAreaId) {
          throw new RegistryError(`Affector pack "${pack.id}" entry "${entry.id}" cannot connect an Area to itself`);
        }
      }
    }
  }
  // StoryEntry.storyId 引用完整性：必须能解析到 stories 表中的纯演出 Story
  const storyIds = new Set(dp.stories.map(s => s.id));
  for (const entry of [...dp.activeStories, ...dp.passiveStories]) {
    if (!storyIds.has(entry.storyId)) {
      throw new RegistryError(`Story entry "${entry.id}" references unknown story: "${entry.storyId}"`);
    }
    const followUpIds = new Set<string>();
    for (const followUp of entry.followUps ?? []) {
      if (!followUp.id || followUpIds.has(followUp.id)) {
        throw new RegistryError(`Story entry "${entry.id}" contains duplicate or missing FollowUp id: "${followUp.id ?? ''}"`);
      }
      followUpIds.add(followUp.id);
      if (followUp.waitFor?.kind !== 'next-enter-area' || !areaIds.has(followUp.waitFor.areaId)) {
        throw new RegistryError(`Story entry "${entry.id}" FollowUp "${followUp.id}" references an invalid area: "${followUp.waitFor?.areaId ?? ''}"`);
      }
      if (followUp.outcome?.kind !== 'start-story-entry' || !storyEntryIds.has(followUp.outcome.storyEntryId)) {
        throw new RegistryError(`Story entry "${entry.id}" FollowUp "${followUp.id}" references an invalid StoryEntry: "${followUp.outcome?.storyEntryId ?? ''}"`);
      }
    }
  }

  // 校验 Extra 数据：各 Def 的 extra 字段 + 数据包 extras 常量表（统一规则，见 docs/13 §8）
  const checkDefExtras = <T extends { id?: unknown; extra?: ExtraValue }>(
    items: T[] | undefined,
    label: string,
  ): void => {
    if (!items) return;
    for (const item of items) {
      if (item.extra === undefined) continue;
      try {
        assertValidExtra(item.extra);
      } catch (e) {
        if (e instanceof ExtraError) {
          throw new RegistryError(`Invalid extra on ${label} "${item.id ?? '<anonymous>'}": ${e.message}`);
        }
        throw e;
      }
    }
  };
  checkDefExtras(dp.inits, 'init');
  checkDefExtras(dp.areas, 'area');
  checkDefExtras(dp.spots, 'spot');
  checkDefExtras(dp.enhancements, 'enhancement');
  checkDefExtras(dp.stories, 'story');
  checkDefExtras(dp.activeStories, 'active story entry');
  checkDefExtras(dp.passiveStories, 'passive story entry');
  checkDefExtras(dp.items, 'item');
  checkDefExtras(dp.dropTables, 'drop table');
  checkDefExtras(dp.funcletDefs, 'funclet');
  checkDefExtras(dp.characters, 'character');
  checkDefExtras(dp.affectorPacks, 'affector pack');
  checkDefExtras(dp.triggerDefs, 'trigger');
  if (dp.extras) {
    try {
      assertValidExtra(expandFlatKeys(dp.extras));
    } catch (e) {
      if (e instanceof ExtraError) {
        throw new RegistryError(`Invalid datapack extras: ${e.message}`);
      }
      throw e;
    }
  }
  const operationIssues = validateOperationDatapackContent(dp, context);
  if (operationIssues.length > 0) {
    throw new RegistryError(operationIssues.join('\n'));
  }
}

function validateSpotPayments(spot: Datapack['spots'][number]): void {
  const check = (options: unknown, path: string, allowEmpty = false): void => {
    if (!Array.isArray(options)) {
      throw new RegistryError(`Spot "${spot.id}" 的 ${path} 必须显式声明为支付方案数组`);
    }
    if (!allowEmpty && options.length === 0) {
      throw new RegistryError(`Spot "${spot.id}" 的 ${path} 至少需要一个支付方案；免费支付请声明 costs: []`);
    }
    const ids = new Set<string>();
    for (const [index, option] of options.entries()) {
      if (!option || typeof option !== 'object') throw new RegistryError(`Spot "${spot.id}" 的 ${path}[${index}] 必须是支付方案对象`);
      const id = (option as { id?: unknown }).id;
      if (typeof id !== 'string' || !id || ids.has(id)) throw new RegistryError(`Spot "${spot.id}" 的 ${path}[${index}] 支付方案 ID 重复或为空`);
      ids.add(id);
      if (!Array.isArray((option as { costs?: unknown }).costs)) throw new RegistryError(`Spot "${spot.id}" 的 ${path}[${index}].costs 必须是数组`);
    }
  };
  check(spot.purchaseOptions, 'purchaseOptions', true);
  for (const upgrade of spot.levelUpgrades ?? []) check(upgrade.paymentOptions, `Lv.${upgrade.level}.paymentOptions`);
}

function checkTagPath(path: TagPath, label: string): void {
  if (!Array.isArray(path) || path.length === 0 || path.some(segment => typeof segment !== 'string' || segment.length === 0)) {
    throw new RegistryError(`${label} 必须是非空 TagPath`);
  }
  const key = path.join('/');
  if (path.some((segment, index) => segment.includes(':') && index !== 0) || (path[0].includes(':') && !isTagRef(key))) {
    throw new RegistryError(`${label} 不符合 modName:tagPath 格式`);
  }
  const normalized = path[0].includes(':') ? key : `base:${key}`;
  if (!isTagRef(normalized)) throw new RegistryError(`${label} 含非法 TagPath 段`);
}

function checkTaggedItems(items: Array<{ id: string; tags?: TagPath[] }> | undefined, label: string): void {
  for (const item of items ?? []) for (const [index, path] of (item.tags ?? []).entries()) {
    checkTagPath(path, `${label} "${item.id}" tags[${index}]`);
  }
}
