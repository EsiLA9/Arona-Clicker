// ============================================================
// tooltip.test.ts — 统计 DSL 转义 + Hover 条件描述 + 升级消费展示
// ============================================================
import { describe, it, expect } from 'vitest';
import { GameInstance } from '../../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../../src/data/test-datapack';
import { createUIContext } from '../../../src/ui/runtime/context';
import type { MapEncounterQueryView, MapRunWorkspaceView } from '../../../src/arona-clicker/contracts/runtime/runtime';
import type { UIContext } from '../../../src/ui/runtime/context';
import type { Condition, ConditionGroup } from '../../../src/engine/types';
import { describeCondition, describeStatDsl, getTooltipContent, renderSpotDetail } from '../../../src/ui/components/tooltip/tooltip';

const OFFICE = 'base:init:schale_office';

/** 可辨识来源的 nameOf 桩：资源/物品/世界线分别带不同括符，便于断言路由正确。 */
const stubNameOf = (type: string, id: string) =>
  type === 'resource' ? `【${id}】`
    : type === 'item' ? `〈${id}〉`
      : type === 'init' ? `〖${id}〗`
        : id;

function mapTooltipContext(view: MapRunWorkspaceView | null): UIContext {
  return {
    game: { mapRun: { getWorkspaceView: () => view } },
    formatNumber: (value: number) => String(value),
    escapeHtml: (value: string) => value.replace(/[&<>"']/g, (character: string) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[character] ?? character)),
  } as unknown as UIContext;
}

function activeMapTooltipView(options: {
  readonly kind: 'battle' | 'rest' | 'encounter' | 'shop';
  readonly title?: string;
  readonly completion?: MapEncounterQueryView['completion'];
  readonly round?: number;
  readonly rounds?: number;
  readonly enemies?: readonly { readonly enemyId: string; readonly currentHp: number; readonly maxHp: number }[];
  readonly partyHp?: readonly { readonly characterId: string; readonly currentHp: number; readonly maxHp: number }[];
  readonly locals?: { readonly counters: Readonly<Record<string, { readonly value: number; readonly min: number; readonly max: number }>>; readonly flags: Readonly<Record<string, boolean>> };
}): MapRunWorkspaceView {
  const activity = { activityId: 'current', title: options.title ?? '当前活动', kind: options.kind, index: 0, total: 1, completed: false, active: true };
  const encounter = options.kind === 'shop' ? null : {
    mapId: 'test-map', nodeId: 'current-node', activityId: 'current', title: options.title ?? '当前场景',
    ...(options.completion === undefined ? {} : { completion: options.completion }),
    ...(options.round === undefined ? {} : { round: options.round }),
    ...(options.rounds === undefined ? {} : { rounds: options.rounds }),
    partyHp: options.partyHp ?? [], enemies: options.enemies ?? [],
  };
  return {
    kind: 'active',
    activities: options.kind === 'shop' ? [activity] : [activity],
    currentEncounter: encounter,
    shop: options.kind === 'shop' ? { nodeId: 'current-node', activityId: 'current', title: options.title ?? '当前商店', draftVersion: 0, offers: [], lastPurchase: null } : null,
  } as unknown as MapRunWorkspaceView;
}

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
    game.inits.startNewGame(OFFICE);
    const ctx = createUIContext(game);
    const spot = game.registry.spots.get('base:spot:credit_printer')!;
    const html = renderSpotDetail(ctx, spot, 1);
    expect(html).toContain('升级 Lv.2');
    expect(html).toContain('100 信用点');
    expect(html).not.toContain('base:resource:credit');
  });

  it('获取条件包含 Spot 实际解锁费用，而不是误报无条件', () => {
    const game = new GameInstance();
    game.init([baseDatapack]);
    game.inits.startNewGame(OFFICE);
    const ctx = createUIContext(game);
    const spot = {
      ...game.registry.spots.get('base:spot:field_work')!,
      revealTriggers: undefined,
    };
    const html = renderSpotDetail(ctx, spot, 0);
    expect(html).toContain('获取条件');
    expect(html).toContain('花费 20 信用点');
    expect(html).not.toContain('condition-empty');
  });
});

describe('MapRun 场景结束 Tooltip', () => {
  it('递归展示条件组合、Counter / Flag 条目和当前局部值，不计算逐项状态', () => {
    const view = activeMapTooltipView({
      kind: 'encounter',
      title: '交涉与休息',
      completion: {
        kind: 'condition',
        label: '信任到 3 并确认简报状态',
        condition: {
          kind: 'all',
          conditions: [
            { kind: 'counter', counterId: 'trust', comparison: 'gte', value: 3 },
            { kind: 'not', condition: { kind: 'flag', flagId: 'briefed', value: true } },
          ],
        },
        locals: { counters: { trust: { value: 2, min: 0, max: 3 } }, flags: { briefed: false } },
      },
    });

    const html = getTooltipContent(mapTooltipContext(view), 'map-scene-end:run-1');

    expect(html).toContain('场景结束条件');
    expect(html).toContain('交涉与休息');
    expect(html).toContain('信任到 3 并确认简报状态');
    expect(html).toContain('全部满足');
    expect(html).toContain('Counter trust ≥ 3');
    expect(html).toContain('当前值 2');
    expect(html).toContain('以下条件不成立');
    expect(html).toContain('Flag briefed 为是');
    expect(html).toContain('当前值 否');
    expect(html).not.toContain('当前条件已满足');
  });

  it('按活动类型展示手动、战斗、休整与商店结束方式', () => {
    const manual = getTooltipContent(mapTooltipContext(activeMapTooltipView({
      kind: 'encounter', title: '现场调查', completion: { kind: 'manual', label: '完成调查' },
    })), 'map-scene-end:run-1');
    expect(manual).toContain('玩家手动执行「完成调查」');

    const battle = getTooltipContent(mapTooltipContext(activeMapTooltipView({
      kind: 'battle', title: '训练战斗', enemies: [{ enemyId: 'robot', currentHp: 4, maxHp: 4 }],
      partyHp: [{ characterId: 'shiroko', currentHp: 5, maxHp: 5 }],
    })), 'map-scene-end:run-1');
    expect(battle).toContain('所有敌人的 HP 均为 0');
    expect(battle).toContain('我方全员的 HP 均为 0');

    const rest = getTooltipContent(mapTooltipContext(activeMapTooltipView({ kind: 'rest', title: '休整', round: 3, rounds: 4 })), 'map-scene-end:run-1');
    expect(rest).toContain('完成第 4 回合后结束');
    expect(rest).toContain('3 / 4 回合');

    const shop = getTooltipContent(mapTooltipContext(activeMapTooltipView({ kind: 'shop', title: '补给商店' })), 'map-scene-end:run-1');
    expect(shop).toContain('补给商店');
    expect(shop).toContain('玩家选择离开商店后结束');
  });

  it('Run 缺失或已进入终态时返回空内容', () => {
    expect(getTooltipContent(mapTooltipContext(null), 'map-scene-end:missing')).toBe('');
    expect(getTooltipContent(mapTooltipContext({ kind: 'success' } as unknown as MapRunWorkspaceView), 'map-scene-end:finished')).toBe('');
  });
});
