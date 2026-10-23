import { describe, expect, it } from 'vitest';
import { Registry } from '../../src/data-services/registry/registry';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
import { GAMEPLAY_B_MAP_SPOT_ID, gameplayBMapDatapack } from '../../src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack';

describe('Spot 统一行动入口引用', () => {
  it('装载后拒绝缺失和未知关卡引用', () => {
    for (const operationEventId of [undefined, 'gameplay-b:operation-event:missing']) {
      const registry = new Registry();
      registry.load(defaultDatapack);
      registry.load({ ...gameplayBMapDatapack, spots: gameplayBMapDatapack.spots.map(spot => ({
        ...spot, functionalities: [{ id: 'entry', kind: 'operationEntry', operationEventId }],
      })) });
      expect(() => registry.validateShopRefs()).toThrow(/operationEntry.*未定义的 OperationEvent/);
    }
  });

  it('局部编辑拒绝未知目标且保留原 Spot', () => {
    const registry = new Registry();
    registry.load(defaultDatapack);
    registry.load(gameplayBMapDatapack);
    const original = registry.spots.get(GAMEPLAY_B_MAP_SPOT_ID)!;
    expect(() => registry.applySpotMutation({
      operation: 'replace', ownerModName: 'gameplay-b',
      spot: { ...original, functionalities: [{ id: 'entry', kind: 'operationEntry', operationEventId: 'gameplay-b:operation-event:missing' }] },
    })).toThrow(/operationEntry.*未定义的 OperationEvent/);
    expect(registry.spots.get(GAMEPLAY_B_MAP_SPOT_ID)).toBe(original);
  });
});
