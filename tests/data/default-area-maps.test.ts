import { describe, expect, test } from 'vitest';
import { baseDatapackSource } from '../../src/arona-clicker/content/base-datapack-source';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';

describe('默认内容的 Init 区域图', () => {
  test('发布包与内容源一致，每个 Area 均有同 Init 的完整地图入口', () => {
    expect(defaultDatapack.areaMaps).toEqual(baseDatapackSource.areaMaps);
    for (const area of defaultDatapack.areas) {
      expect(area.navigationMapId).toBe(baseDatapackSource.areas.find(item => item.id === area.id)?.navigationMapId);
      const map = defaultDatapack.areaMaps!.find(item => item.id === area.navigationMapId)!;
      expect(map).toBeDefined();
      const siblings = defaultDatapack.areas.filter(item => item.initId === area.initId);
      expect(map.nodes.map(node => node.action?.kind === 'attemptAreaTravel' ? node.action.areaId : null).sort())
        .toEqual(siblings.map(item => item.id).sort());
      const byNode = new Map(map.nodes.map(node => [node.id, node.action!.kind === 'attemptAreaTravel' ? node.action!.areaId : '']));
      for (const edge of map.edges) {
        const from = siblings.find(item => item.id === byNode.get(edge.fromNodeId))!;
        const to = siblings.find(item => item.id === byNode.get(edge.toNodeId))!;
        expect(from.adjacentAreaIds?.includes(to.id) || to.adjacentAreaIds?.includes(from.id)).toBe(true);
      }
    }
  });

  test('所有入口可加载，区域名称揭示与正式移动预检仍由原机制决定', () => {
    const game = new GameInstance();
    try {
      game.init([defaultDatapack]);
      for (const area of defaultDatapack.areas) {
        expect(game.areaMap.getEntryView(area.id)).toMatchObject({ ready: true, mapId: area.navigationMapId });
      }
      const map = game.areaMap.getView('base:area-map:schale_office')!;
      const hangar = map.nodes.find(node => node.id === 'schale_hangar')!;
      expect(hangar.name).not.toBe('夏莱机库');
      expect(hangar.ready).toBe(game.getAreaTravelStatus('base:area:schale_hangar').success);
      expect(map.nodes.find(node => node.id === 'schale_main')?.name).toBe('夏莱主厅');
    } finally {
      game.dispose();
    }
  });
});
