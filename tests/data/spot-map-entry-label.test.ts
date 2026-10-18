import { describe, expect, test } from 'vitest';
import { Registry } from '../../src/data-services';
import type { Datapack } from '../../src/data-services/contracts/datapack';
import type { SpotDef } from '../../src/data-services/contracts/world';
import { gameplayBMapDatapack } from '../../src/arona-clicker/content/operation-samples/gameplay-b-map-datapack';
import { baseDatapack } from '../../src/data/test-datapack';

type Functionality = NonNullable<SpotDef['functionalities']>[number];

function withEntryLabels(label: unknown): Datapack {
  const spots: SpotDef[] = gameplayBMapDatapack.spots.map(spot => ({
    ...spot,
    functionalities: (spot.functionalities ?? []).map(fn => (
      fn.kind === 'mapEntry' ? { ...fn, mapEntryLabel: label } as Functionality : fn
    )),
  }));
  return { ...gameplayBMapDatapack, spots };
}

function loadWith(datapack: Datapack): Registry {
  const registry = new Registry();
  registry.load(baseDatapack);
  registry.load(datapack);
  registry.validateShopRefs();
  return registry;
}

describe('Spot mapEntry authored label', () => {
  test('the shipped Gameplay B pack authors every Map entry as 进入…', () => {
    const entries = gameplayBMapDatapack.spots
      .flatMap(spot => spot.functionalities ?? [])
      .filter(fn => fn.kind === 'mapEntry');
    expect(entries.length).toBeGreaterThanOrEqual(6);
    for (const entry of entries) {
      expect(entry.mapEntryLabel?.trim()).toMatch(/^进入.+/);
    }
  });

  test('the Registry keeps authored labels on the loaded Spot functionalities', () => {
    const registry = loadWith(gameplayBMapDatapack);
    const spotId = gameplayBMapDatapack.spots[0].id;
    const labels = (registry.spots.get(spotId)?.functionalities ?? [])
      .filter(fn => fn.kind === 'mapEntry')
      .map(fn => fn.mapEntryLabel);
    expect(labels).toContain('进入废弃走廊战斗');
    expect(labels).toContain('进入连续调查与员工通道');
  });

  test.each(['', '   '])('rejects a blank mapEntryLabel (%j)', label => {
    expect(() => loadWith(withEntryLabels(label))).toThrow(/mapEntryLabel 必须是非空字符串/);
  });

  test('rejects a non-string mapEntryLabel', () => {
    expect(() => loadWith(withEntryLabels(42))).toThrow(/mapEntryLabel 必须是非空字符串/);
  });

  test('keeps the built-in label when no authored label exists', () => {
    const registry = loadWith(withEntryLabels(undefined));
    const spotId = gameplayBMapDatapack.spots[0].id;
    expect((registry.spots.get(spotId)?.functionalities ?? [])
      .filter(fn => fn.kind === 'mapEntry')
      .every(fn => fn.mapEntryLabel === undefined)).toBe(true);
  });
});
