import { describe, expect, test } from 'vitest';
import { validateEntityId } from '../../src/engine/core/entity-id';

describe('Gameplay B map entity IDs', () => {
  test('accepts the registered map entity type', () => {
    expect(validateEntityId('base:map:strategy_path')).toBeNull();
  });

  test('continues rejecting unregistered entity types', () => {
    expect(validateEntityId('base:unknown-map:strategy_path')).toBe('type');
  });
});
