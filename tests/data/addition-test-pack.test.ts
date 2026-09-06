import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parsePack } from '../../src/data-services/datapack/pack-parser';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';

const ROOT = join(process.cwd(), 'datapack', 'addition_test');
const FILES = [
  'datapack.json', '00-world.json', '01-content.json', '02-story.json', '03-systems.json', '04-records.json',
  'assets/addition-test.svg',
];

async function loadAdditionPack() {
  return parsePack({
    kind: 'folder',
    list: async () => FILES.map(path => ({ path, read: () => readFile(join(ROOT, path)).then(bytes => new Uint8Array(bytes)) })),
  });
}

describe('addition_test 综合数据包', () => {
  it('解析 manifest、所有扩展表、Tag、Extra 和图片资源', async () => {
    const parsed = await loadAdditionPack();

    expect(parsed.manifest.modName).toBe('addition-test');
    expect(parsed.datapack.modName).toBe('addition-test');
    expect(parsed.datapack.inits).toHaveLength(1);
    expect(parsed.datapack.inits[0].purchaseCost).toEqual([{ resourceId: 'base:resource:pyroxene', amount: 1 }]);
    expect(parsed.datapack.inits[0].revealTriggers?.[0]).toMatchObject({
      reveal: 'name',
      condition: { type: 'AND', conditions: [{ target: 'resource', key: 'base:resource:pyroxene', comparator: '>=', value: 1 }] },
    });
    expect(parsed.datapack.passivePools).toHaveLength(1);
    expect(parsed.datapack.characterVariants).toHaveLength(1);
    expect(parsed.datapack.colorGroups).toHaveLength(1);
    expect(parsed.datapack.colorEquipments).toHaveLength(1);
    expect(parsed.datapack.themeDesigns).toHaveLength(1);
    expect(parsed.datapack.gachaPools).toHaveLength(1);
    expect(parsed.datapack.tags).toHaveLength(3);
    expect(parsed.datapack.extras?.['addition-test/coverage/cross-pack']).toEqual({ t: 'bool', v: true });
    expect(parsed.images).toHaveLength(1);
  });

  it('可以和 base 一起构建 Registry，并保留跨包引用', async () => {
    const parsed = await loadAdditionPack();
    const game = new GameInstance();

    expect(() => game.init([baseDatapack, parsed.datapack])).not.toThrow();
    expect(game.registry.inits.has('addition-test:init:observatory')).toBe(true);
    expect(game.registry.spots.has('addition-test:spot:scanner')).toBe(true);
    expect(game.registry.items.has('addition-test:item:signal-chip')).toBe(true);
    expect(game.registry.gachaPools.has('addition-test:gachapool:observer')).toBe(true);
    expect(game.registry.tagDefs.has('addition-test:experimental')).toBe(true);
  });
});
