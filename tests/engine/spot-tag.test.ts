// ============================================================
// engine/spot-tag.test.ts — Spot 动态 Tag（撤出/新加入）
// ============================================================
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { tagPath } from '../../src/engine/core/tag';

const CREDIT = 'base:resource:credit';
const OFFICE = 'base:init:schale_office';
const PRINTER = 'base:spot:credit_printer';
const TACTICAL = 'base:spot:tactical_desk';
const OFFICE_LAYOUT = 'base:enhancement:office_layout';

describe('Spot 动态 Tag（撤出/新加入）', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
    game.init([baseDatapack]);
    game.inits.startNewGame(OFFICE);
  });

  afterEach(() => {
    game.stop();
  });

  test('addSpotTag / removeSpotTag mutate the spot and its tag index', () => {
    // tactical_desk 原本无 'support' tag
    expect(game.registry.spotsWithTag(tagPath('support'), game.state.spotTagOverrides)).not.toContain(TACTICAL);

    expect(game.spot.addSpotTag(TACTICAL, tagPath('support'))).toBe(true);
    expect(game.registry.spotsWithTag(tagPath('support'), game.state.spotTagOverrides)).toContain(TACTICAL);
    // 运行时增撤落状态层覆盖表（Registry 恒只读，docs-824/08 T6）
    expect(game.state.spotTagOverrides?.[TACTICAL]?.added.some(t => t.join('/') === 'support')).toBe(true);

    // 重复加入 → 无操作
    expect(game.spot.addSpotTag(TACTICAL, tagPath('support'))).toBe(false);

    // 撤出 → 索引同步移除
    expect(game.spot.removeSpotTag(TACTICAL, tagPath('support'))).toBe(true);
    expect(game.registry.spotsWithTag(tagPath('support'), game.state.spotTagOverrides)).not.toContain(TACTICAL);
    expect(game.spot.removeSpotTag(TACTICAL, tagPath('support'))).toBe(false);
  });

  test('child tag indexing updates when a tag is added/removed', () => {
    game.spot.addSpotTag(PRINTER, tagPath('support', 'backline'));
    // 父前缀 'support' 也应命中
    expect(game.registry.spotsWithTag(tagPath('support'), game.state.spotTagOverrides)).toContain(PRINTER);
    expect(game.registry.spotsWithTag(tagPath('support', 'backline'), game.state.spotTagOverrides)).toContain(PRINTER);

    game.spot.removeSpotTag(PRINTER, tagPath('support', 'backline'));
    expect(game.registry.spotsWithTag(tagPath('support'), game.state.spotTagOverrides)).not.toContain(PRINTER);
    expect(game.registry.spotsWithTag(tagPath('support', 'backline'), game.state.spotTagOverrides)).not.toContain(PRINTER);
  });

  test('removing a tag disables a tag-scoped Enhancement for that spot', () => {
    // 满足 office_layout 解锁条件并购买（×1.25 作用于 office tag）
    game.state.spotLevels[PRINTER] = 2;
    game.state.resources[CREDIT] = 500;
    expect(game.enhancements.purchaseEnhancement(OFFICE_LAYOUT).success).toBe(true);

    // 单独结算 credit_printer（tags: credit/office → 命中 office）
    for (const key of Object.keys(game.state.spotLevels)) delete game.state.spotLevels[key];
    game.state.spotLevels[PRINTER] = 1;
    game.state.resources[CREDIT] = 0;
    game.tick();
    // base 5 ×1.25 + 功能 2 = 8.25
    expect(game.state.resources[CREDIT]).toBe(5 * 1.25 + 2);

    // 撤出 office tag → office_layout 不再作用于它（回到 5 + 功能 2 = 7）
    game.state.resources[CREDIT] = 0;
    expect(game.spot.removeSpotTag(PRINTER, tagPath('office'))).toBe(true);
    game.tick();
    expect(game.state.resources[CREDIT]).toBe(7);
  });

  test('adding a tag enables a tag-scoped Enhancement for that spot', () => {
    // field_work（tags: field/combat）本无 office；购买 office_layout
    game.state.spotLevels[PRINTER] = 2;
    game.state.resources[CREDIT] = 500;
    expect(game.enhancements.purchaseEnhancement(OFFICE_LAYOUT).success).toBe(true);

    for (const key of Object.keys(game.state.spotLevels)) delete game.state.spotLevels[key];
    game.state.spotLevels['base:spot:field_work'] = 1;
    game.state.resources[CREDIT] = 0;

    // 尚无 office tag → 8（无倍率；条件功能未触发）
    game.tick();
    expect(game.state.resources[CREDIT]).toBe(8);

    // 加入 office tag → office_layout 生效：8 ×1.25
    game.state.resources[CREDIT] = 0;
    expect(game.spot.addSpotTag('base:spot:field_work', tagPath('office'))).toBe(true);
    game.tick();
    expect(game.state.resources[CREDIT]).toBe(10);
  });

  test('spotTagChanged event fires with tag and added flag', () => {
    const events: Array<{ type: string; spotId: string; tag: string; added: boolean }> = [];
    const unsub = game.eventBus.on('spotTagChanged', e => events.push(e as never));
    game.spot.addSpotTag(PRINTER, tagPath('field'));
    game.spot.removeSpotTag(PRINTER, tagPath('field'));
    unsub();

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ spotId: PRINTER, tag: 'field', added: true });
    expect(events[1]).toMatchObject({ spotId: PRINTER, tag: 'field', added: false });
  });
});
