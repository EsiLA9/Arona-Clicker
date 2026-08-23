import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameInstance } from '../../../src/engine/game-instance';
import { baseDatapack } from '../../../src/data/index';
import { createUIContext } from '../../../src/ui/context';
import { renderInitSelect } from '../../../src/ui/components/init-select';

const CREDIT = 'base:resource:credit';
const OFFICE = 'base:init:schale_office';
const MILLENNIUM = 'base:init:millennium';
const ABYDOS = 'base:init:abydos';
const TRINITY = 'base:init:trinity';
const GEHENNA = 'base:init:gehenna';

/** 提取右侧列表行的出现顺序。 */
function railOrder(html: string): string[] {
  return [...html.matchAll(/data-init-select="([^"]+)"/g)].map(m => m[1]);
}

describe('renderInitSelect 世界倾斜数值', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
    game.init([baseDatapack]);
    game.startNewGame(OFFICE);
  });

  afterEach(() => {
    game.stop();
  });

  it('右列按倾斜值降序排列（高在上低在下）', () => {
    // 累计产出拉满全部揭示阈值，并解锁全部世界线
    game.mutations.changeResource(CREDIT, 5000);
    for (const id of [MILLENNIUM, ABYDOS, TRINITY, GEHENNA]) game.unlockInit(id);

    const html = renderInitSelect(createUIContext(game), 'new');
    expect(railOrder(html)).toEqual([OFFICE, MILLENNIUM, TRINITY, ABYDOS, GEHENNA]);
  });

  it('左侧详情展示规范化 TILT 值（尾数补满 15 位），默认选中首位', () => {
    const html = renderInitSelect(createUIContext(game), 'new');
    expect(html).toContain('TILT 0.999000000000000');
    expect(html).toContain(`data-init-select="${OFFICE}"`);
    expect(html).toContain('init-orb-copy');
  });

  it('选中项驱动左侧详情：有伪装展示字符串时代替数值展示', () => {
    game.mutations.changeResource(CREDIT, 5000);
    game.unlockInit(GEHENNA);
    const html = renderInitSelect(createUIContext(game), 'new', GEHENNA);
    expect(html).toContain('观测受限（伪装值）');
    expect(html).not.toContain('TILT 0.941300000000000');
  });

  it('名称未揭示前不泄露真实倾斜值', () => {
    // 千禧年可见但名称阈值（50 credit）未达 → 详情与行内均显示 ???
    const html = renderInitSelect(createUIContext(game), 'new', MILLENNIUM);
    expect(html).toContain('TILT ???');
    expect(html).not.toContain('0.985000000000000');
  });

  it('selectedId 无效时回退到排序首位', () => {
    const html = renderInitSelect(createUIContext(game), 'new', 'base:init:nonexistent');
    expect(html).toContain(`data-init-select="${OFFICE}"`);
  });
});
