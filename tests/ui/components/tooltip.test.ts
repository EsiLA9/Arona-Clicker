// ============================================================
// tooltip.test.ts — 统计 DSL 转义 + Hover 条件描述 + 升级消费展示
// ============================================================
import { describe, it, expect } from 'vitest';
import { GameInstance } from '../../../src/engine/game-instance';
import { baseDatapack } from '../../../src/data/index';
import { createUIContext } from '../../../src/ui/context';
import type { Condition, ConditionGroup } from '../../../src/engine/types';
import { describeCondition, describeStatDsl, renderSpotDetail } from '../../../src/ui/components/tooltip';

const OFFICE = 'base:init:schale_office';

/** 可辨识来源的 nameOf 桩：资源/物品/世界线分别带不同括符，便于断言路由正确。 */
const stubNameOf = (type: string, id: string) =>
  type === 'resource' ? `【${id}】`
    : type === 'item' ? `〈${id}〉`
      : type === 'init' ? `〖${id}〗`
        : id;

describe('describeStatDsl', () => {
  it('全局资源统计转义为正式文体', () => {
    expect(describeStatDsl('$GlobalProducedAmount base:resource:credit', stubNameOf))
      .toBe('全局累计产出 【base:resource:credit】');
  });

  it('本次游玩资源统计转义', () => {
    expect(describeStatDsl('$CurrentRunConsumedAmount base:resource:pyroxene', stubNameOf))
      .toBe('本次游玩累计消耗 【base:resource:pyroxene】');
  });

  it('Init 作用域使用 init 与资源书面名', () => {
    expect(describeStatDsl('$InitProducedAmount base:init:schale_office base:resource:credit', stubNameOf))
      .toBe('在 〖base:init:schale_office〗 累计产出 【base:resource:credit】');
  });

  it('物品统计路由到物品书面名', () => {
    expect(describeStatDsl('$GlobalCollectedAmount base:item:energy_drink', stubNameOf))
      .toBe('全局累计获得 〈base:item:energy_drink〉');
    expect(describeStatDsl('$GlobalUsedAmount base:item:energy_drink', stubNameOf))
      .toBe('全局累计使用 〈base:item:energy_drink〉');
  });

  it('无 key 计数类统计直接出文体', () => {
    expect(describeStatDsl('$CurrentRunCompletedStories', stubNameOf))
      .toBe('本次游玩已完成剧情数');
  });

  it('Init 停留帧数使用 init 书面名', () => {
    expect(describeStatDsl('$InitFramesInInit base:init:schale_office', stubNameOf))
      .toBe('在 〖base:init:schale_office〗 停留帧数');
  });

  it('未知函数原样返回', () => {
    expect(describeStatDsl('$Nope base:resource:credit', stubNameOf))
      .toBe('$Nope base:resource:credit');
  });

  it('缺参无法解析时原样返回', () => {
    expect(describeStatDsl('$GlobalProducedAmount', stubNameOf))
      .toBe('$GlobalProducedAmount');
    expect(describeStatDsl('$InitProducedAmount base:resource:credit', stubNameOf))
      .toBe('$InitProducedAmount base:resource:credit');
  });
});

describe('describeCondition', () => {
  const nameOf = (type: string, id: string) => (type === 'resource' ? '信用点' : id);

  it('stat 条件转义为正式文体', () => {
    const cond: Condition = { target: 'stat', key: '$GlobalProducedAmount base:resource:credit', comparator: '>=', value: 100 };
    expect(describeCondition(cond, nameOf)).toBe('全局累计产出 信用点 >= 100');
  });

  it('条件组内 stat 条件同样转义', () => {
    const cond: ConditionGroup = {
      type: 'AND',
      conditions: [
        { target: 'stat', key: '$InitProducedAmount base:init:schale_office base:resource:credit', comparator: '>=', value: 100 },
        { target: 'resource', key: 'base:resource:credit', comparator: '>', value: 5 },
      ],
    };
    expect(describeCondition(cond, nameOf)).toBe('在 base:init:schale_office 累计产出 信用点 >= 100 且 信用点 > 5');
  });

  it('无条件时输出 无条件', () => {
    expect(describeCondition(undefined, nameOf)).toBe('无条件');
  });
});

describe('renderSpotDetail', () => {
  it('升级消费展示资源书面名而非原始三段式 id', () => {
    const game = new GameInstance();
    game.init([baseDatapack]);
    game.startNewGame(OFFICE);
    const ctx = createUIContext(game);
    const spot = game.registry.spots.get('base:spot:credit_printer')!;
    const html = renderSpotDetail(ctx, spot, 1);
    expect(html).toContain('升级 Lv.2');
    expect(html).toContain('100 信用点');
    expect(html).not.toContain('base:resource:credit');
  });
});
