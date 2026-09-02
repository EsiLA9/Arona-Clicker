// ============================================================
// ui/components/global-enhancement-select.test.ts — GlobalEnhancement 选择页渲染
// 与右侧强化面板的 global 过滤
// ============================================================
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameInstance } from '../../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../../src/data/test-datapack';
import { createUIContext } from '../../../src/ui/context';
import { renderSelectorPage } from '../../../src/ui/components/selector-page';
import { renderEnhancements } from '../../../src/ui/components/enhancements';

const OFFICE = 'base:init:schale_office';
const PYROXENE = 'base:resource:pyroxene';
const FOUNDATION = 'base:enhancement:foundation';
const UNIFIED = 'base:enhancement:unified_logistics';
const ETERNAL = 'base:enhancement:eternal_contract';
const CREDIT_SYSTEM = 'base:enhancement:credit_system';

/** 渲染整页（Enh 面），提取轮盘卡片 id。 */
function enhIds(html: string): string[] {
  return [...html.matchAll(/data-global-enh-select="([^"]+)"/g)].map(m => m[1]);
}

describe('GlobalEnhancement 选择界面', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
    game.init([baseDatapack]);
    game.inits.startNewGame(OFFICE);
  });

  afterEach(() => {
    game.stop();
  });

  it('轮盘只列出 attachment kind=global 的强化，普通强化不入列', () => {
    const html = renderSelectorPage(createUIContext(game), 'new', null, null, false, 'global-enh');
    expect(enhIds(html)).toEqual(expect.arrayContaining([FOUNDATION, UNIFIED, ETERNAL]));
    expect(enhIds(html)).not.toContain(CREDIT_SYSTEM);
  });

  it('右侧强化面板不再展示 global 挂靠强化（仅经选择页购买），并提供选择页入口', () => {
    const html = renderEnhancements(createUIContext(game));
    expect(html).not.toContain(FOUNDATION);
    expect(html).not.toContain(ETERNAL);
    expect(html).toContain(CREDIT_SYSTEM);
    expect(html).toContain('data-open-global-enh-select');
  });

  it('已拥有的 global 强化在轮盘中标记「已激活」', () => {
    game.state.resources[PYROXENE] = 100;
    expect(game.enhancements.purchaseEnhancement(FOUNDATION).success).toBe(true);
    const html = renderSelectorPage(createUIContext(game), 'new', null, FOUNDATION, false, 'global-enh');
    expect(html).toContain('已激活');
  });

  it('不可撤回的 global 强化详情展示 IRREVERSIBLE 标记与无操作 CTA', () => {
    game.state.resources[PYROXENE] = 200;
    game.enhancements.purchaseEnhancement(ETERNAL);
    const html = renderSelectorPage(createUIContext(game), 'new', null, ETERNAL, false, 'global-enh');
    expect(html).toContain('IRREVERSIBLE');
    expect(html).toContain('不可撤回');
    expect(html).not.toContain(`data-global-enh-deactivate="${ETERNAL}"`);
  });
});
