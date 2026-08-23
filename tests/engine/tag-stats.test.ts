// ============================================================
// engine/tag-stats.test.ts — 按 tag 聚合的收集统计服务
// 覆盖：声明倒排（祖先前缀）、Spot 事件增量收集/移除、
// 角色收集（roster 单一真相来源，F-04）、读档全量重建、类型间隔离。
// ============================================================
import { describe, test, expect } from 'vitest';
import { TagStatService } from '../../src/engine/tag-stats';
import { EventBus } from '../../src/engine/event-bus';
import { ConditionSystem } from '../../src/engine/condition-system';
import { ConditionDepIndex } from '../../src/engine/condition-deps';
import { AffectorEngine } from '../../src/engine/affector-engine';
import { StateMutationService } from '../../src/engine/state-mutation-service';
import type { Registry } from '../../src/engine/registry';
import { Character, cond, GameEvent, PlayerState } from '../../src/engine/types';
import { tagPath } from '../../src/engine/tag';

function makeRegistry(): import('../../src/engine/tag-stats').TagStatRegistry {
  type E = import('../../src/engine/tag-stats').TagStatEntity;
  const empty = new Map<string, E>();
  return {
    inits: empty,
    areas: empty,
    spots: new Map<string, E>([
      ['spot_printer', { id: 'spot_printer', tags: [tagPath('office', 'admin')] }],
      ['spot_field', { id: 'spot_field', tags: [tagPath('field', 'combat')] }],
      ['spot_untagged', { id: 'spot_untagged' }],
    ]),
    characters: new Map([
      ['arona', { id: 'arona', tags: [tagPath('school', 'millennium'), tagPath('office')] }],
      ['hoshino', { id: 'hoshino', tags: [tagPath('school', 'abydos'), tagPath('defense')] }],
    ]),
    enhancements: empty,
    passiveStories: new Map<string, E>([
      ['chat_office', { id: 'chat_office', tags: [tagPath('theme', 'daily')] }],
      ['chat_field', { id: 'chat_field', tags: [tagPath('theme', 'outdoor')] }],
    ]),
    activeStories: new Map<string, E>([
      ['main_1', { id: 'main_1', tags: [tagPath('chapter', 'one')] }],
    ]),
    characterVariants: new Map([
      ['Arona', { id: 'Arona', proto: 'arona' }],
      ['HoshinoSwimsuit', { id: 'HoshinoSwimsuit', proto: 'hoshino' }],
    ]),
  };
}

function emptyState() {
  return {
    spotLevels: {} as Record<string, number>,
    spotManagers: {} as Record<string, string>,
    flags: {} as Record<string, string>,
    roster: {} as Record<string, unknown>,
  };
}

function makeService() {
  const bus = new EventBus();
  const registry = makeRegistry();
  const service = new TagStatService(registry, bus);
  const state = emptyState();
  service.setState(state);
  const mutations = {
    setSpotLevel(spotId: string, level: number) {
      state.spotLevels[spotId] = level;
      bus.emit({ type: 'spotLevelChanged', spotId, newLevel: level });
    },
    setFlag(flag: string, value: string) {
      state.flags[flag] = value;
      bus.emit({ type: 'flagChanged', flag, value });
    },
    acquireVariant(variantId: string) {
      (state.roster as Record<string, unknown>)[variantId] = { variantId };
      bus.emit({
        type: 'characterAcquired',
        variantId,
        via: 'story' as const,
        duplicate: false,
        shards: 0,
        bonusResources: {},
      });
    },
  };
  return { service, mutations, state };
}

describe('TagStatService 声明侧', () => {
  test('declaredCount：父 tag 命中子声明，未标记实体不计入', () => {
    const { service } = makeService();
    expect(service.declaredCount('spots', tagPath('office'))).toBe(1); // printer(office/admin)
    expect(service.declaredCount('spots', 'office/admin')).toBe(1);
    expect(service.declaredCount('spots', 'office/nonexistent')).toBe(0);
    expect(service.declaredCount('spots', tagPath('field'))).toBe(1);
    expect(service.declaredCount('characters', tagPath('school'))).toBe(2);
    expect(service.declaredCount('characters', 'school/millennium')).toBe(1);
  });
});

describe('TagStatService 收集侧（Spot）', () => {
  test('解锁收集 / 升级不重复 / 归零移除；查询命中祖先前缀', () => {
    const { service, mutations } = makeService();
    expect(service.collectedCount('spots', 'office')).toBe(0);

    mutations.setSpotLevel('spot_printer', 1);
    expect(service.collectedCount('spots', tagPath('office'))).toBe(1);
    expect(service.collectedCount('spots', 'office/admin')).toBe(1);

    mutations.setSpotLevel('spot_printer', 3);
    expect(service.collectedCount('spots', 'office')).toBe(1);

    mutations.setSpotLevel('spot_printer', 0);
    expect(service.collectedCount('spots', 'office/admin')).toBe(0);
  });

  test('未标记实体与未知实体不影响统计', () => {
    const { service, mutations } = makeService();
    mutations.setSpotLevel('spot_untagged', 1);
    mutations.setSpotLevel('spot_unknown', 1);
    expect(service.collectedCount('spots', 'office')).toBe(0);
    expect(service.progress('spots', 'office')).toEqual({ collected: 0, declared: 1 });
  });
});

describe('TagStatService 收集侧（Character，F-04）', () => {
  test('获得差分即收集其原型；无 roster 不收集', () => {
    const { service, mutations } = makeService();

    mutations.acquireVariant('Arona');
    expect(service.collectedIds('characters', 'school/millennium')).toContain('arona');
    expect(service.collectedCount('characters', 'office')).toBe(1);

    // 差分 → 原型映射：泳装差分解锁 hoshino 原型
    mutations.acquireVariant('HoshinoSwimsuit');
    expect(service.collectedIds('characters', tagPath('defense'))).toEqual(['hoshino']);
    expect(service.collectedIds('characters', 'school/abydos')).toEqual(['hoshino']);
  });

  test('旧 flag / manager 协议不再触发角色收集（冻结）', () => {
    const { service, mutations } = makeService();
    mutations.setFlag('char_unlock_arona', 'true');
    state_manager_noop();
    function state_manager_noop() { /* manager 事件路径已移除 */ }
    expect(service.collectedCount('characters', 'school')).toBe(0);
  });
});

describe('TagStatService 状态重建与类型隔离', () => {
  test('setState 全量重建 collected（模拟读档，roster 语义）', () => {
    const bus = new EventBus();
    const service = new TagStatService(makeRegistry(), bus);
    service.setState({
      spotLevels: { spot_printer: 2 },
      roster: { HoshinoSwimsuit: {} },
      flags: {},
    } as never);
    expect(service.collectedCount('spots', 'office/admin')).toBe(1);
    expect(service.collectedCount('characters', 'defense')).toBe(1);
    expect(service.collectedCount('characters', 'school/millennium')).toBe(0);
  });

  test('各类型统计相互独立，不跨类型加和', () => {
    const { service, mutations } = makeService();
    mutations.setSpotLevel('spot_printer', 1);
    mutations.acquireVariant('Arona'); // arona 声明 office tag
    // spots 与 characters 都有 office tag 命中体，但计数各自独立
    expect(service.collectedCount('spots', 'office')).toBe(1);
    expect(service.collectedCount('characters', 'office')).toBe(1);
  });
});

describe('TagStatService 全类型覆盖', () => {
  test('inits/areas/enhancements/stories 的收集与事件增量', () => {
    const bus = new EventBus();
    const service = new TagStatService(makeRegistry(), bus);
    const state = {
      ...emptyState(),
      unlockedInits: [] as string[],
      visitedAreas: [] as string[],
      unlockedEnhancements: [] as string[],
      storyLog: [] as { storyId: string }[],
    };
    service.setState(state);
    const emit = (e: GameEvent) => bus.emit(e);

    // 初始重建：解锁世界线 + 完成闲聊
    state.unlockedInits.push('init_a');
    state.storyLog.push({ storyId: 'chat_office' });
    service.setState(state);
    expect(service.collectedCount('inits', 'office')).toBe(0); // init_a 未声明 tag
    expect(service.collectedIds('passiveStories', 'theme/daily')).toEqual(['chat_office']);
    expect(service.collectedCount('activeStories', 'chapter')).toBe(0);

    // 事件增量：进入区域 / 解锁强化 / 完成主线
    state.visitedAreas.push('area_x');
    emit({ type: 'areaEntered', areaId: 'area_x', fromAreaId: null });
    state.unlockedEnhancements.push('enh_1');
    emit({ type: 'enhancementAdded', enhancementId: 'enh_1' });
    emit({ type: 'storyCompleted', storyId: 'main_1' });

    expect(service.collectedCount('areas', 'anything')).toBe(0); // area_x 无声明
    expect(service.collectedCount('enhancements', 'school')).toBe(0);
    expect(service.collectedIds('activeStories', 'chapter/one')).toEqual(['main_1']);

    // 移除强化
    state.unlockedEnhancements.pop();
    emit({ type: 'enhancementRemoved', enhancementId: 'enh_1' });
    expect(service.collectedCount('enhancements', 'school')).toBe(0);

    // 事件增量：解锁带 tag 的实体（registry.inits 为空，改用 areas 声明验证 collect 路径）
    const tagged = new Map([...makeRegistry().areas, ['area_tagged', { id: 'area_tagged', tags: [tagPath('zone', 'campus')] }]]);
    const service2 = new TagStatService({ ...makeRegistry(), areas: tagged }, bus);
    service2.setState({ ...emptyState(), visitedAreas: ['area_tagged'] });
    expect(service2.collectedCount('areas', 'zone')).toBe(1);
  });
});

describe('tagCollectedChanged 事件与 tagCount 条件接入', () => {
  test('实际增删才发事件；升级不重复；setState 重建不发', () => {
    const bus = new EventBus();
    const registry = makeRegistry();
    const service = new TagStatService(registry, bus);
    const events: GameEvent[] = [];
    bus.on('tagCollectedChanged', e => events.push(e));
    const state = emptyState();
    service.setState(state); // 重建路径：不发
    expect(events).toHaveLength(0);

    state.spotLevels['spot_printer'] = 1;
    bus.emit({ type: 'spotLevelChanged', spotId: 'spot_printer', newLevel: 1 });
    expect(events).toEqual([{ type: 'tagCollectedChanged', kind: 'spots' }]);

    bus.emit({ type: 'spotLevelChanged', spotId: 'spot_printer', newLevel: 3 }); // 升级：无变化
    expect(events).toHaveLength(1);

    state.spotLevels['spot_printer'] = 0;
    bus.emit({ type: 'spotLevelChanged', spotId: 'spot_printer', newLevel: 0 }); // 移除：变化
    expect(events).toHaveLength(2);
  });

  test('ConditionSystem.tagCount 经注入 reader 求值', () => {
    const cs = new ConditionSystem();
    cs.setTagCountReader(key => (key === 'spots:office' ? 3 : 0));
    expect(cs.evaluate(cond('tagCount', 'spots:office', '>=', 3), emptyState() as never)).toBe(true);
    expect(cs.evaluate(cond('tagCount', 'spots:office', '>', 3), emptyState() as never)).toBe(false);
    expect(cs.evaluate(cond('tagCount', 'characters:defense', '>=', 1), emptyState() as never)).toBe(false);
  });

  test('ConditionDepIndex：tagCount 叶子按 kind 精确命中', () => {
    const idx = new ConditionDepIndex<string>();
    idx.register('gate_spots', cond('tagCount', 'spots:office', '>=', 3));
    idx.register('gate_chars', cond('tagCount', 'characters:defense', '>=', 1));

    expect(idx.affected({ type: 'tagCollectedChanged', kind: 'spots' })).toEqual(new Set(['gate_spots']));
    expect(idx.affected({ type: 'tagCollectedChanged', kind: 'characters' })).toEqual(new Set(['gate_chars']));
    // spot 解锁也会改变 spots 收集集 → 命中（经 STAT_DEP_EVENTS 的宽覆盖不适用，
    // 但 spots 收集本身由 spotLevelChanged 驱动，服务发出的 kind 事件才是精确信号）
    expect(idx.affected({ type: 'tagCollectedChanged', kind: 'other' })).toEqual(new Set());
  });

  test('端到端：Affector 条件 tagCount 在解锁 Spot 后经事件自动翻转', () => {
    const bus = new EventBus();
    const registry = makeRegistry() as unknown as Registry;
    const mutations = new StateMutationService(bus);
    const state = {
      resources: {}, spotLevels: {}, spotManagers: {}, unlockedEnhancements: [],
      activeInit: '', totalFrames: 0, storyLog: [], inventory: {}, flags: {},
    } as unknown as PlayerState;
    mutations.setState(state);

    new TagStatService(registry, bus); // 订阅收集事件并发出 tagCollectedChanged
    const cs = new ConditionSystem();
    cs.setStatReader(() => null);
    cs.setTagIndex(() => []);
    cs.setTagCountReader(key => {
      const counts: Record<string, number> = {
        'spots:field': (state.spotLevels['spot_field'] ?? 0) > 0 ? 1 : 0,
      };
      return counts[key] ?? 0;
    });

    const engine = new AffectorEngine(registry, cs, mutations, bus);
    engine.setState(state);
    engine.load([{
      id: 'pack_tagcount',
      entries: [{
        id: 'entry_gate',
        condition: { type: 'AND', conditions: [cond('tagCount', 'spots:field', '>=', 1)] },
        effects: [{ op: 'addResource' as const, target: 'credit', value: 1 }],
      }],
    }]);
    const instance = engine.mount('pack_tagcount', 'entity_a')!;
    expect(instance.state).toBe('Latent');

    // 解锁带 field/combat 标签的 Spot → 服务发 tagCollectedChanged(spots) → 定向 recheck
    state.spotLevels['spot_field'] = 1;
    bus.emit({ type: 'spotLevelChanged', spotId: 'spot_field', newLevel: 1 });
    expect(engine.getInstance(instance.instanceId)?.state).toBe('Active');
  });
});
