import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameInstance } from '../../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../../src/data/test-datapack';
import { createUIContext } from '../../../src/ui/runtime/context';
import { renderSelectorPage } from '../../../src/ui/components/navigation/selector-page';

const CREDIT = 'base:resource:credit';
const OFFICE = 'base:init:schale_office';
const MILLENNIUM = 'base:init:millennium';
const ABYDOS = 'base:init:abydos';
const TRINITY = 'base:init:trinity';
const GEHENNA = 'base:init:gehenna';

/** 提取图上世界线节点的出现顺序。 */
function nodeOrder(html: string): string[] {
  return [...html.matchAll(/data-init-select="([^"]+)"/g)].map(m => m[1]);
}

describe('renderSelectorPage 世界线节点与倾斜数值', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
    game.init([baseDatapack]);
    game.inits.startNewGame(OFFICE);
  });

  afterEach(() => {
    game.stop();
  });

  it('世界线节点按倾斜值降序排列（高在上低在下）', () => {
    // 累计产出拉满全部揭示阈值，并解锁全部世界线
    game.mutations.changeResource(CREDIT, 5000);
    for (const id of [MILLENNIUM, ABYDOS, TRINITY, GEHENNA]) game.inits.unlockInit(id);

    const html = renderSelectorPage(createUIContext(game), 'new', null, null, false, 'init');
    expect(nodeOrder(html)).toEqual([OFFICE, MILLENNIUM, TRINITY, ABYDOS, GEHENNA]);
  });

  it('工作台展示规范化 TILT 值（尾数补满 15 位），默认选中首位', () => {
    const html = renderSelectorPage(createUIContext(game), 'new', null, null, false, 'init');
    expect(html).toContain('TILT 0.999000000000000');
    expect(html).toContain(`data-init-select="${OFFICE}"`);
    expect(html).toContain('selector-detail');
  });

  it('选中项驱动工作台：有伪装展示字符串时代替数值展示', () => {
    game.mutations.changeResource(CREDIT, 5000);
    game.inits.unlockInit(GEHENNA);
    const html = renderSelectorPage(createUIContext(game), 'new', GEHENNA, null, false, 'init');
    expect(html).toContain('观测受限（伪装值）');
    expect(html).not.toContain('TILT 0.941300000000000');
  });

  it('名称未揭示前不泄露真实倾斜值', () => {
    const html = renderSelectorPage(createUIContext(game), 'new', MILLENNIUM, null, false, 'init');
    expect(html).toContain('TILT ???');
    expect(html).not.toContain('0.985000000000000');
  });

  it('selectedId 无效时回退到排序首位', () => {
    const html = renderSelectorPage(createUIContext(game), 'new', 'base:init:nonexistent', null, false, 'init');
    expect(html).toContain(`data-init-select="${OFFICE}"`);
    expect(html).toContain('aria-pressed="true"');
  });

  it('兼容非规范 worldTilt 字符串并将其排在合法值之后', () => {
    const original = game.registry.inits.get(OFFICE);
    if (!original) throw new Error('缺少测试 Init');
    const receipt = game.registry.applyInitMutation({
      operation: 'replace',
      ownerModName: 'base',
      init: { ...original, worldTilt: 'ddd', worldTiltAlias: undefined },
    });
    try {
      const html = renderSelectorPage(createUIContext(game), 'new', OFFICE, null, false, 'init');
      expect(html).toContain('TILT ddd');
      expect(() => renderSelectorPage(createUIContext(game), 'new', OFFICE, null, false, 'init')).not.toThrow();
      expect(nodeOrder(html).at(-1)).toBe(OFFICE);
    } finally {
      receipt.rollback();
    }
  });
});
