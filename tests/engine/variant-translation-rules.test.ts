import { describe, expect, test } from 'vitest';
import { tagRef } from '../../src/engine/core/tag';
import {
  VariantTranslationMode,
  type GameplayBVariantTranslationRules,
  type VariantTranslationProfile,
} from '../../src/arona-clicker/contracts/character/variant-translation';
import {
  canonical,
  exact,
  immutable,
  normalizeOwned,
  normalizeSlice,
  translateGameplayB,
  validRef,
  validateTranslationEntry,
  validateTranslationRules,
} from '../../src/arona-clicker/services/character/variant-translation-rules';

const rules: GameplayBVariantTranslationRules = {
  id: 'test:translation:rules',
  revision: 1,
  mode: VariantTranslationMode.GameplayB,
  dimensions: [
    {
      id: 'test:attribute:power',
      min: 0,
      max: 100,
      grades: [
        { id: 'low', minInclusive: 0 },
        { id: 'high', minInclusive: 50 },
      ],
    },
    {
      id: 'test:attribute:vitality',
      min: 0,
      max: 100,
      grades: [
        { id: 'low', minInclusive: 0 },
        { id: 'high', minInclusive: 50 },
      ],
    },
  ],
  parameters: {
    maxHp: {
      attributeId: 'test:attribute:vitality',
      values: [{ gradeId: 'low', value: 10 }, { gradeId: 'high', value: 20 }],
    },
    baseAgility: {
      attributeId: 'test:attribute:power',
      values: [{ gradeId: 'low', value: 2 }, { gradeId: 'high', value: 4 }],
    },
    maxAgility: {
      attributeId: 'test:attribute:power',
      values: [{ gradeId: 'low', value: 3 }, { gradeId: 'high', value: 5 }],
    },
  },
};

const profile: VariantTranslationProfile = {
  id: 'test:profile:student',
  revision: 2,
  variantId: 'student-a',
  capabilityIds: ['capability:guard'],
  tags: [tagRef('base', ['student', 'guard'])],
  candidateSourceIds: ['source:basic'],
  attributes: [
    { id: 'test:attribute:power', base: 40, perLevel: 2, perStar: 1, perAffectionLevel: 0 },
    { id: 'test:attribute:vitality', base: 45, perLevel: 0, perStar: 2, perAffectionLevel: 1 },
  ],
};

describe('Variant translation pure rules', () => {
  test('normalizes owned growth with exact dimensions and applies the finite Gameplay B mapping', () => {
    const input = normalizeOwned(profile, { level: 5, stars: 2, affectionLevel: 3 }, rules);
    expect(input.attributes).toEqual([
      { id: 'test:attribute:power', value: 50 },
      { id: 'test:attribute:vitality', value: 51 },
    ]);
    expect(input.capabilityIds).toEqual(['capability:guard']);
    expect(translateGameplayB(input, rules)).toEqual({
      mode: 'gameplay-b',
      grades: [
        { attributeId: 'test:attribute:power', rawValue: 50, gradeId: 'high' },
        { attributeId: 'test:attribute:vitality', rawValue: 51, gradeId: 'high' },
      ],
      parameters: { maxHp: 20, baseAgility: 4, maxAgility: 5 },
      capabilityIds: ['capability:guard'],
      tags: ['base:student/guard'],
      candidateSourceIds: ['source:basic'],
    });
  });

  test('normalizes a fixed slice with no progression inheritance and matches owned output', () => {
    const input = normalizeSlice({
      id: 'test:slice:student',
      revision: 3,
      variantId: 'student-a',
      attributes: [
        { id: 'test:attribute:power', value: 50 },
        { id: 'test:attribute:vitality', value: 51 },
      ],
      capabilityIds: ['capability:guard'],
      tags: ['base:student/guard'],
      candidateSourceIds: ['source:basic'],
    }, rules);
    const owned = normalizeOwned(profile, { level: 5, stars: 2, affectionLevel: 3 }, rules);
    expect(translateGameplayB(input, rules)).toEqual(translateGameplayB(owned, rules));
    const reversed = normalizeOwned({ ...profile, attributes: [...profile.attributes].reverse() },
      { level: 5, stars: 2, affectionLevel: 3 }, rules);
    expect(reversed.attributes.map(row => row.id)).toEqual(rules.dimensions.map(dimension => dimension.id));
  });

  test('rejects unknown fields, unknown modes, duplicate IDs, and incomplete dimension sets', () => {
    expect(() => validateTranslationRules({ ...rules, dynamic: true })).toThrow(/dynamic.*not an allowed field/);
    expect(() => validateTranslationRules({ ...rules, mode: 'custom-script' })).toThrow(/only gameplay-b/);
    expect(() => validateTranslationRules({ ...rules, dimensions: [rules.dimensions[0], rules.dimensions[0]] })).toThrow(/duplicate id/);
    expect(() => normalizeOwned({ ...profile, extra: 1 }, { level: 1, stars: 0, affectionLevel: 1 }, rules)).toThrow(/extra.*not an allowed field/);
    expect(() => normalizeOwned({ ...profile, tags: ['student/guard'] },
      { level: 1, stars: 0, affectionLevel: 1 }, rules)).toThrow(/valid complete TagRef/);
    expect(() => translateGameplayB({
      attributes: [{ id: 'test:attribute:power', value: 50 }],
      capabilityIds: [], tags: [], candidateSourceIds: [],
    }, rules)).toThrow(/exactly one value for every declared dimension/);
  });

  test('requires ordered covering thresholds and complete grade parameter tables', () => {
    const unordered = {
      ...rules,
      dimensions: rules.dimensions.map((dimension, index) => index === 0 ? {
        ...dimension,
        grades: [{ id: 'low', minInclusive: 0 }, { id: 'high', minInclusive: 0 }],
      } : dimension),
    };
    expect(() => validateTranslationRules(unordered)).toThrow(/strictly ascending/);
    const missing = {
      ...rules,
      parameters: {
        ...rules.parameters,
        maxHp: { ...rules.parameters.maxHp, values: rules.parameters.maxHp.values.slice(0, 1) },
      },
    };
    expect(() => validateTranslationRules(missing)).toThrow(/exactly one value for each grade/);
    const wrongStart = {
      ...rules,
      dimensions: rules.dimensions.map((dimension, index) => index === 0 ? {
        ...dimension,
        grades: [{ ...dimension.grades[0]!, minInclusive: 1 }, dimension.grades[1]!],
      } : dimension),
    };
    expect(() => validateTranslationRules(wrongStart)).toThrow(/first threshold must equal/);
  });

  test('enforces positive HP, non-negative agility, and max agility at least base agility', () => {
    const noHp = { ...rules, parameters: { ...rules.parameters,
      maxHp: { ...rules.parameters.maxHp, values: [{ ...rules.parameters.maxHp.values[0]!, value: 0 }, rules.parameters.maxHp.values[1]!] },
    } };
    expect(() => validateTranslationRules(noHp)).toThrow(/maxHp must be greater than zero/);
    const negativeAgility = { ...rules, parameters: { ...rules.parameters,
      baseAgility: { ...rules.parameters.baseAgility, values: [{ ...rules.parameters.baseAgility.values[0]!, value: -1 }, rules.parameters.baseAgility.values[1]!] },
    } };
    expect(() => validateTranslationRules(negativeAgility)).toThrow(/baseAgility must be non-negative/);
    const invertedAgility = { ...rules, parameters: { ...rules.parameters,
      maxAgility: { ...rules.parameters.maxAgility, values: [rules.parameters.maxAgility.values[0]!, { ...rules.parameters.maxAgility.values[1]!, value: 3 }] },
    } };
    expect(() => validateTranslationRules(invertedAgility)).toThrow(/at least baseAgility/);
  });

  test('checks BigInt growth overflow before converting back to number', () => {
    const overflowing = {
      ...profile,
      attributes: profile.attributes.map(attribute => attribute.id === 'test:attribute:power'
        ? { ...attribute, base: Number.MAX_SAFE_INTEGER, perLevel: 1 }
        : attribute),
    };
    expect(() => normalizeOwned(overflowing, { level: 2, stars: 0, affectionLevel: 1 }, rules)).toThrow(/growth calculation exceeds/);
    expect(() => normalizeOwned(profile, { level: 0, stars: 0, affectionLevel: 1 }, rules)).toThrow(/at least 1/);
    expect(normalizeOwned(profile, { level: 5, stars: 2, affectionLevel: 3 }, rules).attributes[0]?.value).toBe(50);
  });

  test('validates complete entries and references with closed nested fields', () => {
    const entry = {
      id: 'test:entry:scene', revision: 1, mode: VariantTranslationMode.GameplayB,
      rules: { id: rules.id, revision: rules.revision }, minPartySize: 1, maxPartySize: 2,
      allowDuplicateVariants: false,
      owned: [{ variantId: profile.variantId, profile: { id: profile.id, revision: profile.revision } }],
      slices: [{ slice: { id: 'test:slice:student', revision: 3 }, ownership: 'scene-provided' }],
    };
    expect(() => validateTranslationEntry(entry)).not.toThrow();
    expect(() => validateTranslationEntry({ ...entry, owned: [...entry.owned, ...entry.owned] })).toThrow(/duplicate id/);
    expect(() => validateTranslationEntry({ ...entry, rules: { id: rules.id, revision: 1, fallback: true } })).toThrow(/fallback.*not an allowed field/);
    expect(() => validRef({ id: 'rules', revision: 0 })).toThrow(/positive revision/);
  });

  test('canonical is stable and immutable returns a deeply frozen independent copy', () => {
    expect(canonical({ b: 1, a: { y: 2, x: 3 } })).toBe(canonical({ a: { x: 3, y: 2 }, b: 1 }));
    expect(() => canonical({ value: Number.NaN })).toThrow(/finite JSON number/);
    expect(() => canonical([1, undefined])).toThrow(/not a JSON value/);
    expect(() => canonical([1, , 3])).toThrow(/sparse arrays/);
    const fakeNumericArrayKey: unknown[] = [];
    Object.defineProperty(fakeNumericArrayKey, '999999999999999999999', { value: 'hidden', enumerable: true });
    expect(fakeNumericArrayKey.length).toBe(0);
    expect(() => canonical(fakeNumericArrayKey)).toThrow(/extra array fields/);
    expect(() => immutable(fakeNumericArrayKey)).toThrow(/extra array fields/);
    expect(() => canonical(Object.assign({ visible: 1 }, { [Symbol('hidden')]: true }))).toThrow(/symbol fields/);
    const protoKey = JSON.parse('{"__proto__":{"admin":true}}') as Record<string, unknown>;
    expect(canonical(protoKey)).toBe('{"__proto__":{"admin":true}}');
    const frozenProtoKey = immutable(protoKey);
    expect(Object.prototype.hasOwnProperty.call(frozenProtoKey, '__proto__')).toBe(true);
    expect((frozenProtoKey as Record<string, unknown>)['__proto__']).toEqual({ admin: true });
    expect(() => exact({ id: 'a', hidden: true }, ['id'])).toThrow(/hidden.*not an allowed field/);
    expect(() => validRef({ id: ' spaced ', revision: 1 })).toThrow(/trimmed string/);
    const original = { nested: [{ value: 1 }] };
    const frozen = immutable(original);
    expect(frozen).not.toBe(original);
    expect(frozen.nested).not.toBe(original.nested);
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen.nested)).toBe(true);
    expect(Object.isFrozen(frozen.nested[0])).toBe(true);
  });
});

