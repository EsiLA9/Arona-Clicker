import { describe, expect, test, vi } from 'vitest';
import { EventBus } from '../../src/engine/core/event-bus';
import type { RevealRegistryContext } from '../../src/engine/contracts/reveal';
import type { ConditionState } from '../../src/engine/contracts/state-query';
import type { SpotDef } from '../../src/data-services/contracts/world';
import { ConditionSystem } from '../../src/engine/expression/condition-system';
import { VisibilityEngine } from '../../src/engine/visibility/visibility-engine';
import { VisibilityIndex } from '../../src/engine/visibility/visibility-index';

const SPOT_ID = 'base:spot:temporary';
const AREA_ID = 'base:area:temporary';

const createState = (): ConditionState => ({
  resources: { credit: 0 },
  spotLevels: {},
  spotManagers: {},
  unlockedEnhancements: [],
  flags: {},
  storyLog: [],
});

const gatedByCredit = (credit: number) => ({
  reveal: 'existence' as const,
  condition: { target: 'resource' as const, key: 'credit', comparator: '>=' as const, value: credit },
});

const spot = (revealTriggers?: SpotDef['revealTriggers']): SpotDef => ({
  id: SPOT_ID,
  areaId: AREA_ID,
  name: 'Temporary Spot',
  description: '',
  purchaseOptions: [{ id: 'free', costs: [] }],
  tags: [],
  revealTriggers,
});

const fixture = (initialSpot?: SpotDef) => {
  const spots = new Map<string, SpotDef>();
  if (initialSpot) spots.set(initialSpot.id, initialSpot);
  const registry: RevealRegistryContext = {
    inits: new Map(),
    areas: new Map([[AREA_ID, {}]]),
    spots,
    enhancements: new Map(),
    items: new Map(),
    storyEntries: new Map(),
    activeStories: new Map(),
    passiveStories: new Map(),
  };
  const eventBus = new EventBus();
  const engine = new VisibilityEngine(registry, new ConditionSystem(), eventBus);
  const state = createState();
  engine.rebuild(state);
  return { registry, spots, eventBus, engine, state };
};

describe('Visibility Spot 热 CRUD', () => {
  test('replaceSpot 只替换目标 Spot 的 existence 反向索引，removeSpot 清理索引', () => {
    const { registry, spots } = fixture();
    spots.set(SPOT_ID, spot([gatedByCredit(10)]));
    const index = new VisibilityIndex(registry);
    index.build();

    const resourceEvent = { type: 'resourceChanged' as const, resource: 'credit', delta: 0, newValue: 0 };
    expect(index.collectAffected(resourceEvent)).toEqual(new Set([`spots:${SPOT_ID}`]));

    spots.set(SPOT_ID, spot());
    expect(index.replaceSpot(SPOT_ID)).toBe(true);
    expect(index.collectAffected(resourceEvent)).toEqual(new Set());

    index.removeSpot(SPOT_ID);
    expect(index.collectAffected(resourceEvent)).toEqual(new Set());
  });

  test('create 通过事件登记新 Spot，并在读取时只重算该 Spot', () => {
    const { spots, eventBus, engine, state } = fixture();
    const recomputeAll = vi.spyOn(engine, 'recomputeAll');
    const rebuild = vi.spyOn(engine, 'rebuild');
    spots.set(SPOT_ID, spot([gatedByCredit(10)]));

    eventBus.emit({ type: 'spotDefinitionChanged', spotId: SPOT_ID, operation: 'create' });

    expect(engine.getVisibility(state).spots[SPOT_ID]).toBe(false);
    expect(recomputeAll).not.toHaveBeenCalled();
    expect(rebuild).not.toHaveBeenCalled();

    state.resources.credit = 10;
    eventBus.emit({ type: 'resourceChanged', resource: 'credit', delta: 10, newValue: 10 });
    expect(engine.getVisibility(state).spots[SPOT_ID]).toBe(true);
  });

  test('replace 使用提交后的新 Definition 重算 snapshot，并切换 revealTriggers 索引', () => {
    const { spots, eventBus, engine, state } = fixture(spot([gatedByCredit(10)]));
    state.resources.credit = 10;
    eventBus.emit({ type: 'resourceChanged', resource: 'credit', delta: 10, newValue: 10 });
    expect(engine.getVisibility(state).spots[SPOT_ID]).toBe(true);

    spots.set(SPOT_ID, spot([gatedByCredit(20)]));
    eventBus.emit({ type: 'spotDefinitionChanged', spotId: SPOT_ID, operation: 'replace' });
    expect(engine.getVisibility(state).spots[SPOT_ID]).toBe(false);

    state.resources.credit = 20;
    eventBus.emit({ type: 'resourceChanged', resource: 'credit', delta: 10, newValue: 20 });
    expect(engine.getVisibility(state).spots[SPOT_ID]).toBe(true);
  });

  test('delete 删除 snapshot，并清理后续资源事件的反向索引命中', () => {
    const { spots, eventBus, engine, state } = fixture(spot([gatedByCredit(10)]));
    expect(engine.getVisibility(state).spots[SPOT_ID]).toBe(false);

    spots.delete(SPOT_ID);
    eventBus.emit({ type: 'spotDefinitionChanged', spotId: SPOT_ID, operation: 'delete' });

    expect(engine.getVisibility(state).spots[SPOT_ID]).toBeUndefined();
    state.resources.credit = 10;
    eventBus.emit({ type: 'resourceChanged', resource: 'credit', delta: 10, newValue: 10 });
    expect(engine.getVisibility(state).spots[SPOT_ID]).toBeUndefined();
  });
});
