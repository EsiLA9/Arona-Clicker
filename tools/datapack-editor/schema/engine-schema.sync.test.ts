/**
 * engine-schema.sync.test.ts —— 引擎类型 ↔ editor schema 三向一致性
 *
 * 复用 scripts/gen-engine-schema.mjs 的解析器重新解析数据包类型与 engine/contracts，
 * 与提交的 engine-defs.gen.json 及 merge 后的 TABLES 对比，防"引擎新增字段/枚举
 * 但 editor 未同步"的漂移（error 红灯）。
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseEngineSchema } from '../../../scripts/gen-engine-schema';
import { TABLE_META } from './editor-extras';
import { getTable, TABLES } from './datapack.schema';
import type { FieldDef, FieldType } from './types';

const schema = parseEngineSchema();
const generatedSchema = JSON.parse(readFileSync(new URL('./engine-defs.gen.json', import.meta.url), 'utf8'));
const VALID_KEYS = new Set<string>(TABLES.map((t) => t.key));

function withoutGeneratedAt(value: Record<string, unknown>): Record<string, unknown> {
  const { generatedAt: _generatedAt, ...semantic } = value;
  return semantic;
}

function schemaField(fields: Array<{ key: string; [key: string]: any }>, key: string): any {
  const found = fields.find((candidate) => candidate.key === key);
  expect(found, `authoring schema missing ${key}`).toBeDefined();
  return found;
}

function collectAuthoringTypeNodes(value: unknown, type: string, found: unknown[] = []): unknown[] {
  if (!value || typeof value !== 'object') return found;
  if (!Array.isArray(value) && (value as { type?: unknown }).type === type) found.push(value);
  for (const child of Array.isArray(value) ? value : Object.values(value)) collectAuthoringTypeNodes(child, type, found);
  return found;
}

function collectTaggedVariants(value: unknown, tag: string, found: any[] = []): any[] {
  if (!value || typeof value !== 'object') return found;
  if (!Array.isArray(value) && (value as { tag?: unknown }).tag === tag) found.push(value);
  for (const child of Array.isArray(value) ? value : Object.values(value)) collectTaggedVariants(child, tag, found);
  return found;
}

function assertSupportedGenFields(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  const field = value as { kind?: unknown; item?: unknown; value?: unknown; fields?: unknown[] };
  const supported = new Set(['string', 'int', 'float', 'bool', 'enum', 'ref', 'extra', 'flexible', 'hand', 'array', 'object', 'record']);
  if (field.kind !== undefined) expect(supported.has(String(field.kind)), `unsupported GenField.kind: ${String(field.kind)}`).toBe(true);
  if (field.item) assertSupportedGenFields(field.item);
  if (field.value) assertSupportedGenFields(field.value);
  for (const child of field.fields ?? []) assertSupportedGenFields(child);
}

/**
 * 递归收集 FieldType 中的所有 ref 表引用。
 * 递归结构（conditionsField / valueExpressionField）通过指纹去重防循环，
 * 深度上限兜底（引擎不允许过深的条件嵌套）。
 */
function collectRefs(type: FieldType, out: Set<string>, seen: Set<string>, depth = 0): void {
  if (depth > 25) return;
  switch (type.kind) {
    case 'ref':
      out.add(type.table);
      break;
    case 'array': {
      const sig = `array:${type.item.key}:${type.item.label}`;
      if (seen.has(sig)) return;
      seen.add(sig);
      collectRefs(type.item.type, out, seen, depth + 1);
      break;
    }
    case 'object': {
      const sig = `object:${type.fields.map((f) => f.key).join(',')}`;
      if (seen.has(sig)) return;
      seen.add(sig);
      for (const f of type.fields) collectRefs(f.type, out, seen, depth + 1);
      break;
    }
    case 'record':
      collectRefs(type.value.type, out, seen, depth + 1);
      break;
    case 'union': {
      const sig = `union:${type.tagField}:${type.variants.map((v) => v.tag).join('|')}`;
      if (seen.has(sig)) return;
      seen.add(sig);
      for (const v of type.variants) {
        const fields = typeof v.fields === 'function' ? v.fields() : v.fields;
        for (const f of fields) collectRefs(f.type, out, seen, depth + 1);
      }
      break;
    }
    case 'tagged':
      collectRefs(type.tagField.type, out, seen, depth + 1);
      for (const c of type.combos) for (const f of c.fields) collectRefs(f.type, out, seen, depth + 1);
      for (const f of type.after ?? []) collectRefs(f.type, out, seen, depth + 1);
      break;
    default:
      break;
  }
}

describe('Schema 描述协议：defMap 派生自 Datapack', () => {
  it('区域地图使用独立表，Area 入口引用该表', () => {
    expect(schema.defMap.areaMaps?.type).toBe('AreaMapDef');
    expect(getTable('areaMaps')).toBeDefined();
    expect(getTable('areas').fields.find(field => field.key === 'navigationMapId')?.type).toEqual({ kind: 'ref', table: 'areaMaps' });
  });
  it('TableKey 覆盖现行 Datapack 表 gachaPools 与 shops', () => {
    const legacyEditorTables = {
      gachaPools: 'GachaPoolDef',
      shops: 'ShopDef',
    } as const;
    const registeredTables = new Set(TABLE_META.map((meta) => meta.key));
    for (const [table, type] of Object.entries(legacyEditorTables)) {
      expect(registeredTables.has(table as keyof typeof legacyEditorTables), `${table} 未注册到独立 Editor`).toBe(true);
      expect(schema.defMap[table]?.type, `${table} 未从 Datapack 声明生成`).toBe(type);
      expect(TABLES.some((candidate) => candidate.key === table), `${table} 未进入最终 TABLES`).toBe(true);
    }
  });

  it('defMap 覆盖 editor 的所有生成表（非自定义表均有类型映射）', () => {
    for (const meta of TABLE_META) {
      if (meta.custom) continue;
      expect(schema.defMap[meta.key], `${meta.key} 未出现在 defMap（Datapack 接口缺失？）`).toBeDefined();
      expect(schema.defMap[meta.key].type, `${meta.key} 类型映射缺失`).toBe(meta.type);
    }
  });

  it('生成 defs 非空（解析到字段）', () => {
    for (const meta of TABLE_META) {
      if (meta.custom) continue;
      const entity = schema.defs[meta.type!];
      expect(entity, `${meta.type} 无 defs（类型解析失败？）`).toBeDefined();
      expect(entity.fields?.length, `${meta.type} 字段为空`).toBeGreaterThan(0);
    }
  });

  it('在生成的 Datapack Schema 中包含全部六张 Gameplay B Operation 表', () => {
    const gameplayBTables = {
      operationEvents: 'OperationEventContentDef',
      operationLocations: 'OperationLocationDef',
      operationActions: 'OperationActionDef',
      studentOperationProfiles: 'StudentOperationProfileDef',
      operationStrategyProfiles: 'OperationStrategyProfileDef',
      operationCardPools: 'OperationCardPoolDef',
    } as const;
    const registeredTables = new Set(TABLE_META.map((meta) => meta.key));
    for (const [table, type] of Object.entries(gameplayBTables)) {
      expect(registeredTables.has(table as keyof typeof gameplayBTables), `${table} 未注册到独立 Editor`).toBe(true);
      expect(schema.defMap[table]?.type, `${table} 未从 Datapack 声明生成`).toBe(type);
      expect(schema.defs[type]?.fields?.length, `${type} 没有生成字段`).toBeGreaterThan(0);
      expect(TABLES.some((candidate) => candidate.key === table), `${table} 未进入最终 TABLES`).toBe(true);
    }
  });

  it('PB24 Scene、SceneAction、PurchaseOffer、M/N 和 Route 用字段表单与引用类型描述', () => {
    const field = (fields: FieldDef[], key: string): FieldDef => {
      const found = fields.find((candidate) => candidate.key === key);
      expect(found, `缺少字段 ${key}`).toBeDefined();
      return found!;
    };
    const objectFields = (candidate: FieldDef): FieldDef[] => {
      expect(candidate.type.kind).toBe('object');
      return candidate.type.kind === 'object' ? candidate.type.fields : [];
    };
    const arrayItemFields = (candidate: FieldDef): FieldDef[] => {
      expect(candidate.type.kind).toBe('array');
      if (candidate.type.kind !== 'array') return [];
      return objectFields(candidate.type.item);
    };
    const refTable = (candidate: FieldDef): string | undefined =>
      candidate.type.kind === 'ref' ? candidate.type.table : undefined;
    const operationLocation = getTable('operationLocations').fields;
    const sceneFields = arrayItemFields(field(operationLocation, 'scenes'));
    const sceneActionFields = arrayItemFields(field(sceneFields, 'sceneActions'));
    const choiceFields = objectFields(field(sceneFields, 'sceneActionChoice'));
    const purchaseFields = arrayItemFields(field(sceneFields, 'purchaseOffers'));
    const routeFields = arrayItemFields(field(operationLocation, 'routeEdges'));

    expect(refTable(field(operationLocation, 'enabledActionIds').type.kind === 'array'
      ? field(operationLocation, 'enabledActionIds').type.item : field(operationLocation, 'enabledActionIds'))).toBe('operationActions');
    expect(refTable(field(sceneActionFields, 'actionId'))).toBe('operationActions');
    expect(field(choiceFields, 'candidateSceneActionIds').type.kind).toBe('array');
    expect(field(choiceFields, 'chooseExactly').type.kind).toBe('int');
    expect(refTable(field(purchaseFields, 'actionId'))).toBe('operationActions');
    expect(refTable(field(routeFields, 'targetLocationId'))).toBe('operationLocations');
  });
});

describe('Schema 描述协议：字段覆盖一致性', () => {
  it('checked-in protocol matches generated schema and keeps a valid generatedAt timestamp', () => {
    expect(typeof generatedSchema.generatedAt).toBe('string');
    expect(Number.isFinite(Date.parse(generatedSchema.generatedAt))).toBe(true);
    expect(typeof schema.generatedAt).toBe('string');
    expect(withoutGeneratedAt(generatedSchema)).toEqual(withoutGeneratedAt(schema));
  });

  it('Gameplay Map keeps finite E1-E5 authoring structure in hand-compatible metadata', () => {
    const mapFields = schema.defs.GameplayMapDef.fields;
    for (const fields of Object.values(schema.defs)) for (const field of fields.fields ?? []) assertSupportedGenFields(field);
    const actions = schemaField(mapFields, 'actions');
    expect(actions.kind).toBe('hand');
    expect(actions.description).toContain('Map-local reusable actions');
    expect(actions.authoringSchema.type).toBe('array'); // readonly arrays are unwrapped in metadata
    const actionFields = actions.authoringSchema.item.fields;
    for (const legacyField of ['effects', 'hpEffects', 'cardEffects']) {
      expect(actionFields.some((field: any) => field.key === legacyField), `Action Schema 不应暴露 ${legacyField}`).toBe(false);
    }
    const actionTarget = schemaField(actionFields, 'target').schema;
    const partyTarget = actionTarget.variants.find((variant: any) => variant.tag === 'partyCharacter');
    expect(schemaField(partyTarget.fields, 'includeDefeated')).toMatchObject({
      required: false, schema: { type: 'boolean' },
    });
    const additionalTarget = schemaField(actionFields, 'additionalTarget');
    expect(additionalTarget.required).toBe(false);
    expect(additionalTarget.schema).toEqual({ type: 'stringUnion', values: ['partyCharacter', 'enemy'] });
    const effectProgram = schemaField(actionFields, 'effectProgram');
    expect(effectProgram.required).toBe(false);
    expect(effectProgram.description).toContain('Optional finite E1-E4 program');
    const programFields = effectProgram.schema.fields;
    const prepare = schemaField(programFields, 'prepare').schema.item.fields;
    expect(schemaField(prepare, 'op').schema).toEqual({ type: 'literal', value: 'discountSCost' });
    expect(schemaField(prepare, 'amount')).toMatchObject({ required: true, description: 'Positive safe-integer discount; stacked discounts are clamped at zero cost.' });
    const triggers = schemaField(programFields, 'triggers');
    expect(triggers.required).toBe(false);
    expect(triggers.schema.item.type).toBe('union');
    const [primaryResultTrigger, enemyDefeatedTrigger] = triggers.schema.item.variants;
    const primaryResultFields = primaryResultTrigger.fields;
    const enemyDefeatedFields = enemyDefeatedTrigger.fields;
    expect(primaryResultFields.map((field: any) => field.key)).toEqual(['id', 'event', 'minimumActualAmount', 'effect']);
    expect(schemaField(primaryResultFields, 'event').schema).toEqual({ type: 'stringUnion', values: ['healApplied', 'damageApplied'] });
    expect(schemaField(primaryResultFields, 'minimumActualAmount')).toMatchObject({
      required: false,
      description: 'Optional positive threshold compared with final actual HP change, after clamping/reduction/Shield.',
      schema: { type: 'number' },
    });
    const primaryTriggerEffectFields = schemaField(primaryResultFields, 'effect').schema.fields;
    expect(primaryTriggerEffectFields.map((field: any) => field.key)).toEqual(['op', 'account', 'resourceId', 'delta']);
    expect(schemaField(primaryTriggerEffectFields, 'op').schema).toEqual({ type: 'literal', value: 'resourceChange' });
    expect(schemaField(primaryTriggerEffectFields, 'account').schema).toEqual({ type: 'literal', value: 'primaryActor' });
    expect(enemyDefeatedFields.map((field: any) => field.key)).toEqual(['id', 'event', 'effect']);
    expect(schemaField(enemyDefeatedFields, 'event').schema).toEqual({ type: 'literal', value: 'enemyDefeated' });
    const enemyDefeatedEffectFields = schemaField(enemyDefeatedFields, 'effect').schema.fields;
    expect(schemaField(enemyDefeatedEffectFields, 'account').schema).toEqual({ type: 'literal', value: 'sourceActor' });

    const resolve = schemaField(programFields, 'resolve').schema.item;
    expect(resolve.type).toBe('union');
    expect(resolve.discriminator).toBe('op');
    expect(resolve.sourceType).toBe('GameplayMapEffectStatementDef');
    expect(resolve.variants.map((variant: any) => variant.tag)).toEqual([
      'damage', 'heal', 'revive', 'hpChange', 'resourceChange', 'counterAdd', 'flagSet', 'statusApply', 'statusRemove', 'statusConsume', 'statusRemoveCategory', 'shieldAdd', 'when',
      'forTargets', 'mapRunCounterAdd', 'mapRunFlagSet', 'cardEffectModifier',
    ]);
    const revive = resolve.variants.find((variant: any) => variant.tag === 'revive');
    expect(revive.fields.map((field: any) => field.key)).toEqual(['op', 'target', 'amount']);
    expect(schemaField(revive.fields, 'op').schema).toEqual({ type: 'literal', value: 'revive' });
    expect(schemaField(revive.fields, 'target').schema).toEqual({ type: 'literal', value: 'primary' });
    const shieldAdd = resolve.variants.find((variant: any) => variant.tag === 'shieldAdd');
    expect(shieldAdd.fields.map((field: any) => field.key)).toEqual(['op', 'target', 'amount']);
    expect(schemaField(shieldAdd.fields, 'op').schema).toEqual({ type: 'literal', value: 'shieldAdd' });
    expect(schemaField(shieldAdd.fields, 'target').schema).toMatchObject({ type: 'stringUnion', values: ['source', 'primary'] });
    const cardEffectModifier = resolve.variants.find((variant: any) => variant.tag === 'cardEffectModifier');
    expect(cardEffectModifier.fields.map((field: any) => field.key)).toEqual(['op', 'path', 'operation', 'delta']);
    expect(schemaField(cardEffectModifier.fields, 'op').schema).toEqual({ type: 'literal', value: 'cardEffectModifier' });
    expect(schemaField(cardEffectModifier.fields, 'path').schema).toEqual({ type: 'literal', value: 'resolve[0].amount' });
    expect(schemaField(cardEffectModifier.fields, 'operation').schema).toEqual({ type: 'literal', value: 'add' });
    const resourceChange = resolve.variants.find((variant: any) => variant.tag === 'resourceChange');
    const resourceWriteAccount = schemaField(resourceChange.fields, 'account');
    const accountSchema = resourceWriteAccount.schema;
    const writeAccountValues = accountSchema.type === 'stringUnion'
      ? accountSchema.values
      : accountSchema.variants.flatMap((variant: any) => variant.type === 'stringUnion'
        ? variant.values : variant.type === 'literal' ? [variant.value] : []);
    expect(writeAccountValues).toEqual(['sourceActor', 'primaryActor', 'sourceTeam', 'additionalActor', 'loopTargetActor']);
    const statusApply = resolve.variants.find((variant: any) => variant.tag === 'statusApply');
    expect(['target', 'statusId', 'stacks', 'durationRounds'].every(key => statusApply.fields.some((field: any) => field.key === key))).toBe(true);
    const statusRemove = resolve.variants.find((variant: any) => variant.tag === 'statusRemove');
    expect(['target', 'statusId'].every(key => statusRemove.fields.some((field: any) => field.key === key))).toBe(true);
    const statusConsume = resolve.variants.find((variant: any) => variant.tag === 'statusConsume');
    expect(['target', 'statusId', 'stacks'].every(key => statusConsume.fields.some((field: any) => field.key === key))).toBe(true);
    expect(schemaField(statusConsume.fields, 'target').schema).toMatchObject({ type: 'stringUnion', values: ['source', 'primary'] });
    const statusRemoveCategory = resolve.variants.find((variant: any) => variant.tag === 'statusRemoveCategory');
    expect(['target', 'category'].every(key => statusRemoveCategory.fields.some((field: any) => field.key === key))).toBe(true);
    expect(schemaField(statusRemoveCategory.fields, 'target').schema).toMatchObject({ type: 'stringUnion', values: ['source', 'primary'] });
    expect(schemaField(statusRemoveCategory.fields, 'category').schema).toMatchObject({ type: 'stringUnion', values: ['harmful', 'beneficial'] });
    const when = resolve.variants.find((variant: any) => variant.tag === 'when');
    const whenFields = when.fields;
    expect(schemaField(whenFields, 'then').required).toBe(true);
    expect(schemaField(whenFields, 'else').required).toBe(false);
    expect(schemaField(whenFields, 'then').schema.item).toEqual({ type: 'recursive', name: 'GameplayMapEffectStatementDef' });
    const forTargets = resolve.variants.find((variant: any) => variant.tag === 'forTargets');
    expect(schemaField(forTargets.fields, 'targetSet').required).toBe(true);
    expect(schemaField(forTargets.fields, 'body').required).toBe(true);
    const targetSet = schemaField(forTargets.fields, 'targetSet').schema.fields;
    expect(schemaField(targetSet, 'order').schema.values).toContain('random');
    expect(schemaField(targetSet, 'limit')).toMatchObject({ required: false, description: expect.stringContaining('Truncate') });
    const loopBody = schemaField(forTargets.fields, 'body').schema.item;
    expect(collectAuthoringTypeNodes(loopBody, 'recursive').map((node: any) => node.name)).toContain('GameplayMapEffectLoopStatementDef');
    expect(collectAuthoringTypeNodes(resolve, 'recursive').map((node: any) => node.name)).toEqual(
      expect.arrayContaining(['GameplayMapEffectStatementDef', 'GameplayMapEffectConditionDef', 'GameplayMapEffectValueDef']),
    );
    const condition = schemaField(whenFields, 'condition').schema;
    expect(condition.discriminator).toBe('kind');
    expect(condition.sourceType).toBe('GameplayMapEffectConditionDef');
    expect(condition.variants.map((variant: any) => variant.tag)).toEqual([
      'all', 'any', 'not', 'hpAtLeast', 'hpAtMost', 'hpRatioAtLeast', 'hpRatioAtMost', 'preparedTagCount', 'counter', 'flag',
      'mapRunCounter', 'mapRunFlag', 'resourceAtLeast',
    ]);
    const preparedTagCount = condition.variants.find((variant: any) => variant.tag === 'preparedTagCount');
    expect(['side', 'tag', 'comparison', 'value'].every(key => preparedTagCount.fields.some((field: any) => field.key === key))).toBe(true);
    expect(schemaField(preparedTagCount.fields, 'side').schema).toEqual({ type: 'literal', value: 'party' });
    const all = condition.variants.find((variant: any) => variant.tag === 'all');
    expect(schemaField(all.fields, 'kind').schema.values).toEqual(['all', 'any']);
    expect(schemaField(all.fields, 'conditions').schema.item).toEqual({ type: 'recursive', name: 'GameplayMapEffectConditionDef' });

    const resourceBalance = collectTaggedVariants(resolve, 'resourceBalance')[0];
    expect(['account', 'resourceId'].every(key => resourceBalance.fields.some((field: any) => field.key === key))).toBe(true);
    const account = schemaField(resourceBalance.fields, 'account').schema;
    expect(collectAuthoringTypeNodes(account, 'literal').map((node: any) => node.value)).toEqual(
      expect.arrayContaining(['additionalActor', 'loopTargetActor']),
    );
    const mapRunCounter = collectTaggedVariants(resolve, 'mapRunCounter').find((variant: any) =>
      variant.fields.some((field: any) => field.key === 'kind'));
    expect(['counterId'].every(key => mapRunCounter.fields.some((field: any) => field.key === key))).toBe(true);
    const resourceAtLeast = condition.variants.find((variant: any) => variant.tag === 'resourceAtLeast');
    expect(['account', 'resourceId', 'value'].every(key => resourceAtLeast.fields.some((field: any) => field.key === key))).toBe(true);
    const mapRunCounterCondition = condition.variants.find((variant: any) => variant.tag === 'mapRunCounter');
    expect(['counterId', 'comparison', 'value'].every(key => mapRunCounterCondition.fields.some((field: any) => field.key === key))).toBe(true);
    const mapRunFlagCondition = condition.variants.find((variant: any) => variant.tag === 'mapRunFlag');
    expect(['flagId', 'value'].every(key => mapRunFlagCondition.fields.some((field: any) => field.key === key))).toBe(true);

    const facts = schemaField(mapFields, 'mapRunFacts').authoringSchema.fields;
    const factCounters = schemaField(facts, 'counters').schema.item.fields;
    expect(['id', 'initial', 'min', 'max'].every(key => schemaField(factCounters, key).required)).toBe(true);
    const factFlags = schemaField(facts, 'flags').schema.item.fields;
    expect(['id', 'initial'].every(key => schemaField(factFlags, key).required)).toBe(true);

    const candidatePoolFields = schemaField(mapFields, 'candidatePools').authoringSchema.item.fields;
    const candidatePoolGate = schemaField(candidatePoolFields, 'gate');
    expect(candidatePoolGate.required).toBe(false);
    expect(candidatePoolGate.schema.discriminator).toBe('kind');
    expect(candidatePoolGate.schema.variants.map((variant: any) => variant.tag)).toEqual(['counter', 'flag']);
    const counterGate = candidatePoolGate.schema.variants.find((variant: any) => variant.tag === 'counter');
    expect(['counterId', 'comparison', 'value'].every(key => schemaField(counterGate.fields, key).required)).toBe(true);
    expect(schemaField(counterGate.fields, 'comparison').schema.values).toEqual(['eq', 'lt', 'lte', 'gt', 'gte']);
    const flagGate = candidatePoolGate.schema.variants.find((variant: any) => variant.tag === 'flag');
    expect(['flagId', 'value'].every(key => schemaField(flagGate.fields, key).required)).toBe(true);
    expect(schemaField(flagGate.fields, 'value').schema.type).toBe('boolean');

  });

  it('exposes closed Map-local Status authoring fields', () => {
    const statuses = schemaField(schema.defs.GameplayMapDef.fields, 'statuses').authoringSchema.item;
    expect(statuses.type).toBe('union');
    expect(statuses.discriminator).toBe('kind');
    expect(statuses.variants.map((variant: any) => variant.tag)).toEqual(['burn', 'regen', 'damageReduction', 'damageProtection']);
    for (const variant of statuses.variants) {
      expect(schemaField(variant.fields, 'lifetime')).toMatchObject({ required: false });
      expect(schemaField(variant.fields, 'lifetime').schema).toMatchObject({ type: 'stringUnion', values: ['encounter', 'mapRun'] });
      const onDamageTaken = schemaField(variant.fields, 'onDamageTaken');
      expect(onDamageTaken.required).toBe(false);
      expect(onDamageTaken.schema.fields.map((field: any) => field.key)).toEqual(['resourceId', 'delta']);
      expect(['resourceId', 'delta'].every(key => schemaField(onDamageTaken.schema.fields, key).required)).toBe(true);
    }
    for (const kind of ['burn', 'regen']) {
      const variant = statuses.variants.find((candidate: any) => candidate.tag === kind);
      expect(['id', 'name', 'kind', 'hpPerStack', 'maxStacks'].every(key => schemaField(variant.fields, key).required)).toBe(true);
      expect(schemaField(variant.fields, 'description').required).toBe(false);
      expect(schemaField(variant.fields, 'category')).toMatchObject({ required: false });
      expect(schemaField(variant.fields, 'category').schema).toMatchObject({ type: 'stringUnion', values: ['harmful', 'beneficial'] });
      const onExpire = schemaField(variant.fields, 'onExpire');
      expect(onExpire.required).toBe(false);
      expect(onExpire.schema.fields.map((field: any) => field.key)).toEqual(['resourceId', 'delta']);
      expect(['resourceId', 'delta'].every(key => schemaField(onExpire.schema.fields, key).required)).toBe(true);
      expect(variant.fields.some((field: any) => field.key === 'damageReductionPerStack')).toBe(false);
    }
    const damageReduction = statuses.variants.find((variant: any) => variant.tag === 'damageReduction');
    expect(['id', 'name', 'kind', 'category', 'damageReductionPerStack', 'maxStacks']
      .every(key => schemaField(damageReduction.fields, key).required)).toBe(true);
    expect(schemaField(damageReduction.fields, 'kind').schema).toMatchObject({ type: 'literal', value: 'damageReduction' });
    expect(schemaField(damageReduction.fields, 'category').schema).toMatchObject({ type: 'literal', value: 'beneficial' });
    expect(schemaField(damageReduction.fields, 'description').required).toBe(false);
    expect(damageReduction.fields.some((field: any) => field.key === 'hpPerStack')).toBe(false);
    const damageReductionOnExpire = schemaField(damageReduction.fields, 'onExpire');
    expect(damageReductionOnExpire.required).toBe(false);
    expect(damageReductionOnExpire.schema.fields.map((field: any) => field.key)).toEqual(['resourceId', 'delta']);
    const damageProtection = statuses.variants.find((variant: any) => variant.tag === 'damageProtection');
    expect(['id', 'name', 'kind', 'category', 'maxStacks']
      .every(key => schemaField(damageProtection.fields, key).required)).toBe(true);
    expect(schemaField(damageProtection.fields, 'kind').schema).toMatchObject({ type: 'literal', value: 'damageProtection' });
    expect(schemaField(damageProtection.fields, 'category').schema).toMatchObject({ type: 'literal', value: 'beneficial' });
    expect(schemaField(damageProtection.fields, 'description').required).toBe(false);
    expect(damageProtection.fields.some((field: any) => field.key === 'hpPerStack' || field.key === 'damageReductionPerStack')).toBe(false);
    const damageProtectionOnExpire = schemaField(damageProtection.fields, 'onExpire');
    expect(damageProtectionOnExpire.required).toBe(false);
    expect(damageProtectionOnExpire.schema.fields.map((field: any) => field.key)).toEqual(['resourceId', 'delta']);
  });

  it('Encounter locals and both completion variants preserve required fields and descriptions', () => {
    const nodes = schemaField(schema.defs.GameplayMapDef.fields, 'nodes').authoringSchema.item;
    const activities = schemaField(nodes.fields, 'activities').schema.item;
    const encounter = schemaField(activities.fields, 'encounter').schema;
    const locals = schemaField(encounter.fields, 'locals').schema;
    const counters = schemaField(locals.fields, 'counters').schema.item.fields;
    expect(['id', 'initial', 'min', 'max'].every((key) => schemaField(counters, key).required)).toBe(true);
    expect(schemaField(counters, 'initial').description).toContain('Initial safe-integer value');
    const flags = schemaField(locals.fields, 'flags').schema.item.fields;
    expect(schemaField(flags, 'initial').schema.type).toBe('boolean');

    const completion = schemaField(encounter.fields, 'completion').schema;
    expect(completion.discriminator).toBe('kind');
    expect(completion.variants.map((variant: any) => variant.tag)).toEqual(['manual', 'condition']);
    for (const variant of completion.variants) expect(schemaField(variant.fields, 'label').required).toBe(true);
    const conditionVariant = completion.variants.find((variant: any) => variant.tag === 'condition');
    expect(schemaField(conditionVariant.fields, 'condition').required).toBe(true);
  });

  it('每个生成字段在最终 TABLES 中都有 FieldDef（新增字段未同步 → error）', () => {
    for (const meta of TABLE_META) {
      if (meta.custom) continue;
      const genFields = schema.defs[meta.type!].fields ?? [];
      const finalKeys = new Set(getTable(meta.key).fields.map((f) => f.key));
      for (const gf of genFields) {
        expect(
          finalKeys.has(gf.key),
          `${meta.key}.${gf.key} 已在 engine 类型中，但 editor schema 未同步（运行 npm run gen:schema 或补 editor-extras 覆盖）`,
        ).toBe(true);
      }
    }
  });

  it('复杂 hand 字段有可编辑的结构化描述或通用 JSON 编辑器', () => {
    for (const meta of TABLE_META) {
      if (meta.custom) continue;
      const genFields = schema.defs[meta.type!].fields ?? [];
      const ov = meta.overrides ?? {};
      for (const gf of genFields) {
        if (gf.kind === 'hand') {
          const field = getTable(meta.key).fields.find((candidate) => candidate.key === gf.key);
          expect(field, `${meta.key}.${gf.key} 没有最终 FieldDef`).toBeDefined();
          if (ov[gf.key]) {
            expect(field!.type.kind).not.toBe('hand');
          } else {
            expect(field!.type.kind, `${meta.key}.${gf.key} 应使用通用 JSON 编辑器`).toBe('json');
          }
        }
      }
    }
  });

  it('覆盖字段 key 必须存在于生成 defs（防 editor 侧私加引擎不认的字段）', () => {
    for (const meta of TABLE_META) {
      if (meta.custom) continue;
      const genKeys = new Set((schema.defs[meta.type!].fields ?? []).map((f) => f.key));
      for (const key of Object.keys(meta.overrides ?? {})) {
        expect(
          genKeys.has(key),
          `${meta.key}.${key} 覆盖了 engine 类型中不存在的字段（请先补 types 或移除该覆盖）`,
        ).toBe(true);
      }
    }
  });
});

describe('Schema 描述协议：引用与枚举合法性', () => {
  it('所有 ref 目标 ∈ editor TableKey', () => {
    for (const t of TABLES) {
      for (const f of t.fields) {
        const refs = new Set<string>();
        collectRefs(f.type, refs, new Set<string>());
        for (const ref of refs) {
          expect(VALID_KEYS.has(ref), `${t.key}.${f.key} 引用了未知表 "${ref}"`).toBe(true);
        }
      }
    }
  });

  it('生成枚举字段（未覆盖时）保留全部类型选项', () => {
    for (const meta of TABLE_META) {
      if (meta.custom) continue;
      const genFields = schema.defs[meta.type!].fields ?? [];
      const ov = meta.overrides ?? {};
      const finalMap = new Map(getTable(meta.key).fields.map((f) => [f.key, f]));
      for (const gf of genFields) {
        if (gf.kind !== 'enum' || !gf.options?.length || ov[gf.key]) continue;
        const final = finalMap.get(gf.key);
        if (!final || final.type.kind !== 'enum' || final.type.optionsFrom) continue;
        for (const o of gf.options) {
          expect(
            (final.type.options ?? []).includes(o),
            `${meta.key}.${gf.key} 枚举选项 "${o}" 在 editor schema 中缺失`,
          ).toBe(true);
        }
      }
    }
  });
});
