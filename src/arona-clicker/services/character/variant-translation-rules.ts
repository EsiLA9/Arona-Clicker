import { isTagRef, type TagRef } from '../../../engine/core/tag';
import {
  VariantTranslationMode,
  type GameplayBVariantBuild,
  type GameplayBVariantTranslationRules,
  type VariantRawInput,
  type VariantRawValue,
  type VariantTranslationEntry,
  type VariantTranslationRef,
  type VariantTranslationProfile,
} from '../../contracts/character/variant-translation';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

function fail(path: string, reason: string): never {
  throw new Error(`${path}: ${reason}`);
}

function nonEmptyString(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
    fail(path, 'must be a non-empty trimmed string');
  }
}

function safeInteger(value: unknown, path: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) fail(path, 'must be a safe integer');
}

function nonNegativeSafeInteger(value: unknown, path: string): asserts value is number {
  safeInteger(value, path);
  if (value < 0) fail(path, 'must be non-negative');
}

function positiveRevision(value: unknown, path: string): asserts value is number {
  safeInteger(value, path);
  if (value < 1) fail(path, 'must be a positive revision');
}

function array(value: unknown, path: string): asserts value is unknown[] {
  if (!Array.isArray(value)) fail(path, 'must be an array');
}

function uniqueIds(values: readonly unknown[], path: string): asserts values is readonly string[] {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    nonEmptyString(value, `${path}[${index}]`);
    if (seen.has(value)) fail(`${path}[${index}]`, `duplicate id "${value}"`);
    seen.add(value);
  });
}

/** Assert a plain object has every required key and no key outside the closed contract. */
export function exact(
  value: unknown,
  required: string[],
  optional: string[] = [],
): asserts value is Record<string, unknown> {
  if (!isPlainRecord(value)) fail('value', 'must be a plain object');
  const allowed = new Set([...required, ...optional]);
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) fail(key, 'is required');
  }
  for (const ownKey of Reflect.ownKeys(value)) {
    if (typeof ownKey !== 'string') fail('value', 'symbol fields are not allowed');
    const key = ownKey;
    if (!allowed.has(key)) fail(key, 'is not an allowed field');
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!descriptor.enumerable || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      fail(key, 'must be a plain enumerable data field');
    }
  }
}

/** Validate the stable identity used to resolve one exact trusted content revision. */
export function validRef(value: unknown): asserts value is VariantTranslationRef {
  exact(value, ['id', 'revision']);
  nonEmptyString(value.id, 'id');
  positiveRevision(value.revision, 'revision');
}

function validFacts(value: unknown, path: string): asserts value is {
  capabilityIds: readonly string[];
  tags: readonly TagRef[];
  candidateSourceIds: readonly string[];
} {
  exact(value, ['capabilityIds', 'tags', 'candidateSourceIds']);
  for (const key of ['capabilityIds', 'tags', 'candidateSourceIds'] as const) {
    const values = value[key];
    array(values, `${path}.${key}`);
    uniqueIds(values, `${path}.${key}`);
    if (key === 'tags') {
      values.forEach((tag, index) => {
        if (typeof tag !== 'string' || !isTagRef(tag)) fail(`${path}.tags[${index}]`, 'must be a valid complete TagRef');
      });
    }
  }
}

function validateRulesInternal(value: unknown): asserts value is GameplayBVariantTranslationRules {
  exact(value, ['id', 'revision', 'mode', 'dimensions', 'parameters']);
  nonEmptyString(value.id, 'id');
  positiveRevision(value.revision, 'revision');
  if (value.mode !== VariantTranslationMode.GameplayB) fail('mode', 'only gameplay-b is supported');

  array(value.dimensions, 'dimensions');
  if (value.dimensions.length === 0) fail('dimensions', 'must contain at least one dimension');
  const dimensionIds: string[] = [];
  const gradeIdsByDimension = new Map<string, string[]>();
  value.dimensions.forEach((dimension, index) => {
    const path = `dimensions[${index}]`;
    exact(dimension, ['id', 'min', 'max', 'grades']);
    nonEmptyString(dimension.id, `${path}.id`);
    safeInteger(dimension.min, `${path}.min`);
    safeInteger(dimension.max, `${path}.max`);
    const dimensionMin = dimension.min as number;
    const dimensionMax = dimension.max as number;
    if (dimensionMin > dimensionMax) fail(path, 'min must not exceed max');
    dimensionIds.push(dimension.id);
    array(dimension.grades, `${path}.grades`);
    if (dimension.grades.length === 0) fail(`${path}.grades`, 'must contain at least one grade');
    const gradeIds: string[] = [];
    let priorThreshold: number | undefined;
    dimension.grades.forEach((grade, gradeIndex) => {
      const gradePath = `${path}.grades[${gradeIndex}]`;
      exact(grade, ['id', 'minInclusive']);
      nonEmptyString(grade.id, `${gradePath}.id`);
      safeInteger(grade.minInclusive, `${gradePath}.minInclusive`);
      const threshold = grade.minInclusive as number;
      if (threshold < dimensionMin || threshold > dimensionMax) {
        fail(`${gradePath}.minInclusive`, 'must be within the dimension range');
      }
      if (priorThreshold !== undefined && threshold <= priorThreshold) {
        fail(`${gradePath}.minInclusive`, 'grade thresholds must be strictly ascending');
      }
      if (gradeIndex === 0 && threshold !== dimensionMin) {
        fail(`${gradePath}.minInclusive`, 'the first threshold must equal the dimension minimum');
      }
      priorThreshold = threshold;
      gradeIds.push(grade.id);
    });
    uniqueIds(gradeIds, `${path}.grades`);
    gradeIdsByDimension.set(dimension.id, gradeIds);
  });
  uniqueIds(dimensionIds, 'dimensions');

  exact(value.parameters, ['maxHp', 'baseAgility', 'maxAgility']);
  const validatedParameters = new Map<string, { attributeId: string; values: Map<string, number> }>();
  for (const parameterId of ['maxHp', 'baseAgility', 'maxAgility'] as const) {
    const parameter = value.parameters[parameterId];
    const path = `parameters.${parameterId}`;
    exact(parameter, ['attributeId', 'values']);
    nonEmptyString(parameter.attributeId, `${path}.attributeId`);
    const expectedGrades = gradeIdsByDimension.get(parameter.attributeId);
    if (!expectedGrades) fail(`${path}.attributeId`, 'must reference a declared dimension');
    array(parameter.values, `${path}.values`);
    if (parameter.values.length !== expectedGrades.length) {
      fail(`${path}.values`, `must contain exactly one value for each grade of ${parameter.attributeId}`);
    }
    const seen = new Set<string>();
    const parameterValues = new Map<string, number>();
    parameter.values.forEach((row, index) => {
      const rowPath = `${path}.values[${index}]`;
      exact(row, ['gradeId', 'value']);
      nonEmptyString(row.gradeId, `${rowPath}.gradeId`);
      safeInteger(row.value, `${rowPath}.value`);
      if (row.gradeId !== expectedGrades[index]) {
        fail(`${rowPath}.gradeId`, 'values must follow and exactly cover the bound dimension grades');
      }
      if (seen.has(row.gradeId)) fail(`${rowPath}.gradeId`, `duplicate grade "${row.gradeId}"`);
      seen.add(row.gradeId);
      parameterValues.set(row.gradeId, row.value);
      if (parameterId === 'maxHp' && row.value <= 0) fail(`${rowPath}.value`, 'maxHp must be greater than zero');
      if ((parameterId === 'baseAgility' || parameterId === 'maxAgility') && row.value < 0) {
        fail(`${rowPath}.value`, `${parameterId} must be non-negative`);
      }
    });
    validatedParameters.set(parameterId, { attributeId: parameter.attributeId, values: parameterValues });
  }

  const base = validatedParameters.get('baseAgility')!;
  const maximum = validatedParameters.get('maxAgility')!;
  if (base.attributeId === maximum.attributeId) {
    for (const [gradeId, baseValue] of base.values) {
      if (baseValue > maximum.values.get(gradeId)!) {
        fail('parameters.maxAgility', 'must be at least baseAgility for every grade');
      }
    }
  } else {
    for (const baseValue of base.values.values()) {
      for (const maxValue of maximum.values.values()) {
        if (baseValue > maxValue) fail('parameters.maxAgility', 'must be at least baseAgility for every valid grade combination');
      }
    }
  }
}

/** Assert the finite, author-data-only Gameplay B rules shape and complete mappings. */
export function validateTranslationRules(value: unknown): asserts value is GameplayBVariantTranslationRules {
  validateRulesInternal(value);
}

/** Assert a trusted entry policy with unique and complete source declarations. */
export function validateTranslationEntry(value: unknown): asserts value is VariantTranslationEntry {
  exact(value, ['id', 'revision', 'mode', 'rules', 'minPartySize', 'maxPartySize', 'allowDuplicateVariants', 'owned', 'slices']);
  nonEmptyString(value.id, 'id');
  positiveRevision(value.revision, 'revision');
  if (value.mode !== VariantTranslationMode.GameplayB) fail('mode', 'only gameplay-b is supported');
  validRef(value.rules);
  safeInteger(value.minPartySize, 'minPartySize');
  safeInteger(value.maxPartySize, 'maxPartySize');
  if (value.minPartySize < 1 || value.maxPartySize < value.minPartySize) fail('partySize', 'party size bounds are invalid');
  if (typeof value.allowDuplicateVariants !== 'boolean') fail('allowDuplicateVariants', 'must be boolean');
  array(value.owned, 'owned');
  const ownedIds: string[] = [];
  value.owned.forEach((row, index) => {
    exact(row, ['variantId', 'profile']);
    nonEmptyString(row.variantId, `owned[${index}].variantId`);
    validRef(row.profile);
    ownedIds.push(row.variantId);
  });
  uniqueIds(ownedIds, 'owned.variantId');
  array(value.slices, 'slices');
  const sliceIds: string[] = [];
  value.slices.forEach((row, index) => {
    exact(row, ['slice', 'ownership']);
    validRef(row.slice);
    if (row.ownership !== 'required' && row.ownership !== 'scene-provided') {
      fail(`slices[${index}].ownership`, 'must be required or scene-provided');
    }
    sliceIds.push(`${row.slice.id}@${row.slice.revision}`);
  });
  uniqueIds(sliceIds, 'slices.slice');
}

function validateRawInput(value: unknown, rules: GameplayBVariantTranslationRules): asserts value is VariantRawInput {
  exact(value, ['attributes', 'capabilityIds', 'tags', 'candidateSourceIds']);
  array(value.attributes, 'attributes');
  const ids: string[] = [];
  const values = new Map<string, number>();
  value.attributes.forEach((row, index) => {
    const path = `attributes[${index}]`;
    exact(row, ['id', 'value']);
    nonEmptyString(row.id, `${path}.id`);
    safeInteger(row.value, `${path}.value`);
    const dimension = rules.dimensions.find(candidate => candidate.id === row.id);
    if (!dimension) fail(`${path}.id`, `unknown dimension "${row.id}"`);
    if (row.value < dimension.min || row.value > dimension.max) fail(`${path}.value`, 'is outside the declared dimension range');
    ids.push(row.id);
    values.set(row.id, row.value);
  });
  uniqueIds(ids, 'attributes');
  if (ids.length !== rules.dimensions.length || rules.dimensions.some(dimension => !values.has(dimension.id))) {
    fail('attributes', 'must contain exactly one value for every declared dimension');
  }
  validFacts({
    capabilityIds: value.capabilityIds,
    tags: value.tags,
    candidateSourceIds: value.candidateSourceIds,
  }, 'input');
}

/** Normalize trusted profile plus the frozen consumed progression tracks. */
export function normalizeOwned(profile: unknown, progress: unknown, rules: GameplayBVariantTranslationRules): VariantRawInput {
  validateTranslationRules(rules);
  exact(profile, ['id', 'revision', 'variantId', 'capabilityIds', 'tags', 'candidateSourceIds', 'attributes']);
  nonEmptyString(profile.id, 'profile.id');
  positiveRevision(profile.revision, 'profile.revision');
  nonEmptyString(profile.variantId, 'profile.variantId');
  validFacts({
    capabilityIds: profile.capabilityIds,
    tags: profile.tags,
    candidateSourceIds: profile.candidateSourceIds,
  }, 'profile');
  array(profile.attributes, 'profile.attributes');
  exact(progress, ['level', 'stars', 'affectionLevel']);
  for (const key of ['level', 'affectionLevel'] as const) {
    safeInteger(progress[key], `progress.${key}`);
    if (progress[key] < 1) fail(`progress.${key}`, 'must be at least 1');
  }
  nonNegativeSafeInteger(progress.stars, 'progress.stars');
  const level = progress.level as number;
  const stars = progress.stars as number;
  const affectionLevel = progress.affectionLevel as number;

  const attributes: VariantRawValue[] = [];
  const ids: string[] = [];
  profile.attributes.forEach((attribute, index) => {
    const path = `profile.attributes[${index}]`;
    exact(attribute, ['id', 'base', 'perLevel', 'perStar', 'perAffectionLevel']);
    nonEmptyString(attribute.id, `${path}.id`);
    safeInteger(attribute.base, `${path}.base`);
    safeInteger(attribute.perLevel, `${path}.perLevel`);
    safeInteger(attribute.perStar, `${path}.perStar`);
    safeInteger(attribute.perAffectionLevel, `${path}.perAffectionLevel`);
    ids.push(attribute.id);
    const raw = BigInt(attribute.base)
      + BigInt(level - 1) * BigInt(attribute.perLevel)
      + BigInt(stars) * BigInt(attribute.perStar)
      + BigInt(affectionLevel - 1) * BigInt(attribute.perAffectionLevel);
    if (raw > BigInt(Number.MAX_SAFE_INTEGER) || raw < BigInt(Number.MIN_SAFE_INTEGER)) {
      fail(`${path}.value`, 'growth calculation exceeds the safe integer range');
    }
    attributes.push({ id: attribute.id, value: Number(raw) });
  });
  uniqueIds(ids, 'profile.attributes');
  if (ids.length !== rules.dimensions.length || rules.dimensions.some(dimension => !ids.includes(dimension.id))) {
    fail('profile.attributes', 'must contain exactly one growth declaration for every rule dimension');
  }
  const input: VariantRawInput = {
    attributes,
    capabilityIds: profile.capabilityIds as string[],
    tags: profile.tags as TagRef[],
    candidateSourceIds: profile.candidateSourceIds as string[],
  };
  const checkedInput: VariantRawInput = {
    ...input,
    attributes: rules.dimensions.map(dimension => attributes.find(attribute => attribute.id === dimension.id)!),
  };
  validateRawInput(checkedInput, rules);
  return immutable(checkedInput);
}

/** Validate a complete fixed slice; no player progression is read or inherited. */
export function normalizeSlice(slice: unknown, rules: GameplayBVariantTranslationRules): VariantRawInput {
  validateTranslationRules(rules);
  exact(slice, ['id', 'revision', 'variantId', 'attributes', 'capabilityIds', 'tags', 'candidateSourceIds']);
  nonEmptyString(slice.id, 'slice.id');
  positiveRevision(slice.revision, 'slice.revision');
  nonEmptyString(slice.variantId, 'slice.variantId');
  const input = {
    attributes: slice.attributes,
    capabilityIds: slice.capabilityIds,
    tags: slice.tags,
    candidateSourceIds: slice.candidateSourceIds,
  } as VariantRawInput;
  validateRawInput(input, rules);
  const orderedInput: VariantRawInput = {
    ...input,
    attributes: rules.dimensions.map(dimension => input.attributes.find(attribute => attribute.id === dimension.id)!),
  };
  return immutable(orderedInput);
}

/** Convert a normalized raw input through the finite Gameplay B grade/parameter table. */
export function translateGameplayB(input: unknown, rules: GameplayBVariantTranslationRules): GameplayBVariantBuild {
  validateTranslationRules(rules);
  validateRawInput(input, rules);
  const inputById = new Map(input.attributes.map(attribute => [attribute.id, attribute.value]));
  const grades = rules.dimensions.map(dimension => {
    const rawValue = inputById.get(dimension.id)!;
    let gradeId = dimension.grades[0]!.id;
    for (const grade of dimension.grades) {
      if (rawValue < grade.minInclusive) break;
      gradeId = grade.id;
    }
    return { attributeId: dimension.id, rawValue, gradeId };
  });
  const parameterValue = (parameterId: keyof GameplayBVariantTranslationRules['parameters']): number => {
    const parameter = rules.parameters[parameterId];
    const grade = grades.find(candidate => candidate.attributeId === parameter.attributeId)!;
    return parameter.values.find(row => row.gradeId === grade.gradeId)!.value;
  };
  return immutable({
    mode: VariantTranslationMode.GameplayB,
    grades,
    parameters: {
      maxHp: parameterValue('maxHp'),
      baseAgility: parameterValue('baseAgility'),
      maxAgility: parameterValue('maxAgility'),
    },
    capabilityIds: input.capabilityIds,
    tags: input.tags,
    candidateSourceIds: input.candidateSourceIds,
  });
}

function toJsonValue(value: unknown, path: string, active: Set<object>): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail(path, 'must be a finite JSON number');
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value !== 'object') fail(path, 'is not a JSON value');
  if (active.has(value)) fail(path, 'contains a cycle');
  active.add(value);
  try {
    if (Array.isArray(value)) {
      for (const ownKey of Reflect.ownKeys(value)) {
        if (typeof ownKey !== 'string') fail(path, 'symbol array fields are not JSON values');
        if (ownKey !== 'length') {
          const index = Number(ownKey);
          if (!Number.isSafeInteger(index) || index < 0 || index >= value.length || String(index) !== ownKey) {
            fail(`${path}.${ownKey}`, 'extra array fields are not JSON values');
          }
        }
      }
      const result: JsonValue[] = [];
      for (let index = 0; index < value.length; index++) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) fail(`${path}[${index}]`, 'sparse arrays are not JSON values');
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index))!;
        if (!descriptor.enumerable || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
          fail(`${path}[${index}]`, 'must be a plain enumerable data element');
        }
        result.push(toJsonValue(descriptor.value, `${path}[${index}]`, active));
      }
      return result;
    }
    if (!isPlainRecord(value)) fail(path, 'must contain only plain objects and arrays');
    const result = Object.create(null) as Record<string, JsonValue>;
    const keys = Reflect.ownKeys(value);
    if (keys.some(key => typeof key !== 'string')) fail(path, 'symbol fields are not JSON values');
    for (const key of (keys as string[]).sort()) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if (!descriptor.enumerable || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
        fail(`${path}.${key}`, 'must be a plain enumerable data field');
      }
      result[key] = toJsonValue(descriptor.value, `${path}.${key}`, active);
    }
    return result;
  } finally {
    active.delete(value);
  }
}

/** Stable JSON serialization with sorted object keys and preserved array order. */
export function canonical(value: unknown): string {
  return JSON.stringify(toJsonValue(value, '$', new Set()));
}

function cloneFreeze<T>(value: T, active: Set<object>): T {
  if (value === null || typeof value !== 'object') return value;
  if (active.has(value)) throw new Error('immutable: cyclic value');
  active.add(value);
  try {
    if (Array.isArray(value)) return Object.freeze(value.map(item => cloneFreeze(item, active))) as T;
    if (!isPlainRecord(value)) throw new Error('immutable: only plain objects and arrays are supported');
    const copy: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      Object.defineProperty(copy, key, {
        value: cloneFreeze(value[key], active), enumerable: true, writable: true, configurable: true,
      });
    }
    return Object.freeze(copy) as T;
  } finally {
    active.delete(value);
  }
}

/** Return an independent deep-frozen copy suitable for read-only projections. */
export function immutable<T>(value: T): T {
  canonical(value);
  return cloneFreeze(value, new Set());
}
