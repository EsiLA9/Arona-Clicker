// ============================================================
// engine/affection-system.test.ts — 好感系统（§1 数值 / §2 轴 B 队列 / §3 尾巴挂靠推送）
//
// 覆盖 docs-828/06-adr/planning.md 测试清单（2026-08-29 修订：轴 A 消息成分移除）：
//   §1  默认阶梯（bondDict）、跨级推演、星级锁、save/load 往返、
//       addAffectionExp effect、acquireCharacter 初始化、affectionLevel 条件
//   §2B 就绪队列：达标入队、需求值升序、推送时机、闲聊回落、聊天空间壁垒、readyStepCount
//   §3  尾巴挂靠：完结即入队、强制优先、triggerTailPush 定向推送、owner 隔离、退出随机抽取
// ============================================================
import { describe, test, expect } from 'vitest';
import { GameInstance } from '../../src/engine/game-instance';
import type { CharacterVariantDef, Datapack, GameEvent, PlayerState } from '../../src/engine/types';
import {
  activeStory,
  Character,
  CharacterRarity,
  CharacterSchool,
  line,
  narrate,
  passiveStory,
  story,
} from '../../src/engine/types';
import { DEFAULT_AFFECTION_EXP_CURVE, affectionLevelCapOf, resolveAffectionConfig } from '../../src/engine/system/affection-system';

// --- 测试数据 ---

function makeVariant(id: string, proto: Character): CharacterVariantDef[] {
  return [{
    id,
    proto,
    name: id,
    displayName: `学生${id}`,
    school: CharacterSchool.Abydos,
    rarity: CharacterRarity.Rare,
    description: '',
  }];
}

const stepStory1 = story('test:story:s1', '台阶一').scene(
  line('星野', '台阶一 · 第一页'),
  line('星野', '台阶一 · 完').effects({ op: 'addAffectionExp', target: 'Hoshino', value: 50 }),
).build();

const stepStory2 = story('test:story:s2', '台阶二').scene(
  line('星野', '台阶二 · 完').effects({ op: 'addAffectionExp', target: 'Hoshino', value: 50 }),
).build();

const stepStoryA = story('test:story:sa', '台阶A').scene(line('星野', '台阶A · 完')).build();
const stepStoryB = story('test:story:sb', '台阶B').scene(line('星野', '台阶B · 完')).build();

const chatterStory = story('test:story:chatter', '日常闲聊').scene(line('星野', '唔……闲聊……')).build();

const kizunaStory = story('test:story:kizuna_story', '羁绊剧情').scene(
  narrate('——羁绊演出——', 'center'),
  line('星野', '羁绊剧情 · 完'),
).build();

const tailStory = story('test:story:tail', '羁绊尾巴').scene(
  narrate('——归途——', 'center'),
  line('星野', '尾巴 · 完'),
).build();

function makePack(overrides: Partial<Datapack> = {}): Datapack {
  return {
    name: 'affection-test',
    version: '0',
    inits: [],
    areas: [],
    spots: [],
    enhancements: [],
    activeStories: [
      activeStory('test:activestory:kizuna', 'test:story:kizuna_story').owner('Hoshino').build(),
    ],
    passiveStories: [
      // 台阶：需求值升序 2 → 3
      passiveStory('test:passivestory:s1', 'test:story:s1').owner('Hoshino').repeatable(false).affectionRequired(2).build(),
      passiveStory('test:passivestory:s2', 'test:story:s2').owner('Hoshino').repeatable(false).affectionRequired(3).build(),
      // 普通闲聊（owner 归属星野，参与随机抽取）
      passiveStory('test:passivestory:chatter', 'test:story:chatter').owner('Hoshino').repeatable(true).build(),
      // §3 羁绊尾巴：kizuna 剧情完结后强制优先推送
      passiveStory('test:passivestory:tail', 'test:story:tail').owner('Hoshino').repeatable(false).pushAfterStory('test:story:kizuna_story').build(),
    ],
    stories: [stepStory1, stepStory2, chatterStory, kizunaStory, tailStory],
    items: [],
    funcletDefs: [],
    characters: [],
    characterBonuses: [],
    characterVariants: [
      ...makeVariant('Hoshino', Character.Hoshino),
      ...makeVariant('Serika', Character.Serika),
    ],
    ...overrides,
  };
}

/** 事件收集器。 */
function collectEvents(game: GameInstance): GameEvent[] {
  const events: GameEvent[] = [];
  game.eventBus.on('affectionChanged', e => {
    if (e.type === 'affectionChanged') events.push(e);
  });
  return events;
}

/** 连续推进当前 owner 沙盒的剧情直到结束。 */
function finishStory(game: GameInstance, owner?: string | null): void {
  for (let guard = 0; guard < 50; guard++) {
    const r = game.story.advanceStory(undefined, owner);
    if (r.success && 'finished' in r && r.finished) return;
    if (!r.success && r.error === 'ChoiceRequired') {
      game.story.advanceStory(0, owner);
      continue;
    }
    if (!r.success) return;
  }
}

// ============================================================
// §1 好感数值
// ============================================================

describe('§1 默认阶梯（bondDict）', () => {
  test('默认阶梯与蔚蓝档案参考表一致（抽查 1/10/50/100 级）', () => {
    expect(DEFAULT_AFFECTION_EXP_CURVE.length).toBe(100);
    expect(DEFAULT_AFFECTION_EXP_CURVE[0]).toBe(15);
    expect(DEFAULT_AFFECTION_EXP_CURVE[9]).toBe(60);
    expect(DEFAULT_AFFECTION_EXP_CURVE[49]).toBe(1815);
    expect(DEFAULT_AFFECTION_EXP_CURVE[99]).toBe(7365);
  });

  test('resolveAffectionConfig：未声明用默认；部分声明缺省字段补齐', () => {
    expect(resolveAffectionConfig(undefined).maxLevel).toBe(100);
    const view = resolveAffectionConfig({ expCurve: [10, 20], expBeyond: 25 });
    expect(view.maxLevel).toBe(2);
    expect(view.expBeyond).toBe(25);
    expect(view.defaultLevelCapByStar).toEqual([20, 20, 20, 20, 20, 100]);
  });

  test('星级锁：min(星级锁(stars), maxLevel)；星级越界取表尾；per-variant 覆盖优先', () => {
    const config = resolveAffectionConfig(undefined);
    const variant = { affectionLevelCapByStar: [1, 5, 100] } as never;
    expect(affectionLevelCapOf(config, undefined, 0)).toBe(20);
    expect(affectionLevelCapOf(config, undefined, 5)).toBe(100);
    expect(affectionLevelCapOf(config, undefined, 9)).toBe(100); // 越界取表尾
    expect(affectionLevelCapOf(config, variant as never, 0)).toBe(1);
    expect(affectionLevelCapOf(config, variant as never, 2)).toBe(100);
  });
});

describe('§1 addAffectionExp 推演', () => {
  test('acquireCharacter 初始化好感 1 级 / 0 小值；未拥有拒绝', () => {
    const game = new GameInstance();
    game.init([makePack()]);
    game.mutations.acquireCharacter('Hoshino', 'gacha');
    expect(game.rosterSystem.affectionLevelOf(game.state, 'Hoshino')).toBe(1);
    expect(game.rosterSystem.affectionExpOf(game.state, 'Hoshino')).toBe(0);
    expect(game.mutations.addAffectionExp('Serika', 10).ok).toBe(false);
    expect(game.mutations.addAffectionExp('Hoshino', 0).ok).toBe(false);
    expect(game.mutations.addAffectionExp('Hoshino', -5).ok).toBe(false);
  });

  test('阶梯边界：整级 / 跨级一次到位；cap 截断不保留溢出', () => {
    const game = new GameInstance();
    game.init([makePack()]);
    game.mutations.acquireCharacter('Hoshino', 'gacha');
    // 1→2 需 15：整级
    expect(game.mutations.addAffectionExp('Hoshino', 15)).toEqual({ ok: true, newLevel: 2, newExp: 0 });
    // 2→3 需 30：跨级一次到位（45 = 30 + 15 剩余 → level 3 exp 15）
    expect(game.mutations.addAffectionExp('Hoshino', 45)).toEqual({ ok: true, newLevel: 3, newExp: 15 });
    // cap 截断：星级锁 20 级，小值清零
    expect(game.mutations.addAffectionExp('Hoshino', 1_000_000).ok).toBe(true);
    expect(game.rosterSystem.affectionLevelOf(game.state, 'Hoshino')).toBe(20);
    expect(game.rosterSystem.affectionExpOf(game.state, 'Hoshino')).toBe(0);
  });

  test('星级锁：5 星前锁 20；突破解锁；等级高于新 cap 时只升不降', () => {
    const game = new GameInstance();
    game.init([makePack({
      affectionConfig: { defaultLevelCapByStar: [2, 100] },
    })]);
    game.mutations.acquireCharacter('Hoshino', 'gacha');
    // cap = 2：一次跨到 2 级后截断
    expect(game.mutations.addAffectionExp('Hoshino', 500)).toEqual({ ok: true, newLevel: 2, newExp: 0 });
    // 星级突破（直接改 stars，绕过培养曲线）→ cap 解锁到 100
    const state = game.state as PlayerState;
    state.roster!['Hoshino'].stars = 1;
    expect(game.rosterSystem.affectionLevelCapOf(game.state, 'Hoshino')).toBe(100);
    expect(game.mutations.addAffectionExp('Hoshino', 40).ok).toBe(true);
    expect(game.rosterSystem.affectionLevelOf(game.state, 'Hoshino')).toBe(3);
    // 人为把等级抬到 cap 之上 → 只升不降，仅阻止继续积累
    state.roster!['Hoshino'].stars = 0;
    state.roster!['Hoshino'].affectionLevel = 5;
    expect(game.mutations.addAffectionExp('Hoshino', 10).ok).toBe(false);
    expect(game.rosterSystem.affectionLevelOf(game.state, 'Hoshino')).toBe(5);
  });

  test('save → load 往返保留 affectionLevel/affectionExp', () => {
    const game = new GameInstance();
    game.init([makePack()]);
    game.mutations.acquireCharacter('Hoshino', 'gacha');
    game.mutations.addAffectionExp('Hoshino', 20); // 1→2(15) + 5 剩余
    const saved = game.save();

    const restored = new GameInstance();
    restored.init([makePack()]);
    restored.load(saved);
    expect(restored.rosterSystem.affectionLevelOf(restored.state, 'Hoshino')).toBe(2);
    expect(restored.rosterSystem.affectionExpOf(restored.state, 'Hoshino')).toBe(5);
  });

  test('addAffectionExp effect 生效并发 affectionChanged（跨级）', () => {
    const game = new GameInstance();
    game.init([makePack()]);
    game.mutations.acquireCharacter('Hoshino', 'gacha');
    const events = collectEvents(game);
    game.mutations.applyEffects([{ op: 'addAffectionExp', target: 'Hoshino', value: 15 }]);
    expect(game.rosterSystem.affectionLevelOf(game.state, 'Hoshino')).toBe(2);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ variantId: 'Hoshino', delta: 15, newLevel: 2, newExp: 0, leveledUp: true });
  });

  test('affectionLevel 条件：达标前后翻转；未拥有 → 0', () => {
    const game = new GameInstance();
    game.init([makePack()]);
    const cond = { target: 'affectionLevel' as const, key: 'Hoshino', comparator: '>=' as const, value: 2 };
    expect(game.conditionSystem.evaluate(cond, game.state)).toBe(false);
    game.mutations.acquireCharacter('Hoshino', 'gacha');
    game.mutations.addAffectionExp('Hoshino', 15);
    expect(game.conditionSystem.evaluate(cond, game.state)).toBe(true);
    expect(game.conditionSystem.evaluate(
      { target: 'affectionLevel', key: 'Nobody', comparator: '>=', value: 0 },
      game.state,
    )).toBe(true); // 0 >= 0
    expect(game.conditionSystem.evaluate(
      { target: 'affectionLevel', key: 'Nobody', comparator: '>=', value: 1 },
      game.state,
    )).toBe(false);
  });
});

// ============================================================
// §2 轴 B 就绪队列
// ============================================================

describe('§2 轴 B：好感台阶剧情', () => {
  test('好感未达标不入队；达标后推送队列顶；完结奖励入账跨级', () => {
    const game = new GameInstance();
    game.init([makePack()]);
    game.mutations.acquireCharacter('Hoshino', 'gacha');
    // 好感 1 级：台阶（req 2/3）均未达标
    expect(game.story.triggerAffectionPush('Hoshino')).toMatchObject({ success: false, error: 'NoAvailableStory' });

    const events = collectEvents(game);
    game.mutations.addAffectionExp('Hoshino', 15); // → 2 级，台阶一入队
    const push = game.story.triggerAffectionPush('Hoshino');
    expect(push.success).toBe(true);
    expect(game.getStoryView('Hoshino')!.storyDefId).toBe('test:story:s1');

    finishStory(game, 'Hoshino');
    expect(game.getStoryView('Hoshino')).toBeNull();
    // 完结奖励 +50：2→3(30) + 3→4(30) 不够 → 3 级 20 小值
    expect(game.rosterSystem.affectionLevelOf(game.state, 'Hoshino')).toBe(3);
    expect(game.rosterSystem.affectionExpOf(game.state, 'Hoshino')).toBe(20);
    expect(events.some(e => e.type === 'affectionChanged' && e.newLevel === 3)).toBe(true);
  });

  test('多条同时达标按需求值升序逐条放出（并列按声明序）', () => {
    const pack = makePack({
      passiveStories: [
        passiveStory('test:passivestory:sb', 'test:story:sb').owner('Hoshino').repeatable(false).affectionRequired(2).build(), // 声明在前
        passiveStory('test:passivestory:sa', 'test:story:sa').owner('Hoshino').repeatable(false).affectionRequired(2).build(), // 同需求
        passiveStory('test:passivestory:s2', 'test:story:s2').owner('Hoshino').repeatable(false).affectionRequired(3).build(), // 需求更高
      ],
      stories: [stepStoryA, stepStoryB, stepStory2, kizunaStory, tailStory],
    });
    const game = new GameInstance();
    game.init([pack]);
    game.mutations.acquireCharacter('Hoshino', 'gacha');
    game.mutations.addAffectionExp('Hoshino', 100_000); // 直达 20 级，三条全部达标

    expect(game.story.triggerAffectionPush('Hoshino').success).toBe(true);
    expect(game.getStoryView('Hoshino')!.storyDefId).toBe('test:story:sb'); // 并列取声明序
    finishStory(game, 'Hoshino');
    expect(game.story.triggerAffectionPush('Hoshino').success).toBe(true);
    expect(game.getStoryView('Hoshino')!.storyDefId).toBe('test:story:sa');
    finishStory(game, 'Hoshino');
    expect(game.story.triggerAffectionPush('Hoshino').success).toBe(true);
    expect(game.getStoryView('Hoshino')!.storyDefId).toBe('test:story:s2'); // 需求值更高者殿后
  });

  test('台阶退出随机抽取；队列空时点击发送回落日常闲聊', () => {
    const game = new GameInstance();
    game.init([makePack()]);
    game.mutations.acquireCharacter('Hoshino', 'gacha');
    // 好感 1 级：队列空 → 点击发送回落闲聊（chatter 可用）
    const r = game.story.clickSend('Hoshino');
    expect(r).toMatchObject({ type: 'idle', started: true });
    expect(game.getStoryView('Hoshino')!.storyDefId).toBe('test:story:chatter');
    finishStory(game, 'Hoshino');

    // 直达高好感后：点击发送必中台阶（队列优先），不再随机
    game.mutations.addAffectionExp('Hoshino', 100_000);
    const r2 = game.story.clickSend('Hoshino');
    expect(r2).toMatchObject({ type: 'idle', started: true });
    expect(game.getStoryView('Hoshino')!.storyDefId).toBe('test:story:s1');
  });

  test('readyStepCount = 就绪队列条数（未拥有 → 0；消费后递减）', () => {
    const game = new GameInstance();
    game.init([makePack()]);
    game.mutations.acquireCharacter('Hoshino', 'gacha');
    expect(game.story.readyStepCount('Hoshino')).toBe(0);
    game.mutations.addAffectionExp('Hoshino', 100_000); // 两级台阶全部达标
    expect(game.story.readyStepCount('Hoshino')).toBe(2);
    game.story.triggerAffectionPush('Hoshino');
    expect(game.story.readyStepCount('Hoshino')).toBe(1); // 播出中不计未读
    finishStory(game, 'Hoshino');
    expect(game.story.readyStepCount('Hoshino')).toBe(1);
    game.story.triggerAffectionPush('Hoshino');
    finishStory(game, 'Hoshino');
    expect(game.story.readyStepCount('Hoshino')).toBe(0);
    expect(game.story.readyStepCount('Serika')).toBe(0);
  });

  test('壁垒：其他角色对话空间与全局闲聊均抽不到台阶；完成前重复推送被拒', () => {
    const game = new GameInstance();
    game.init([makePack()]);
    game.mutations.acquireCharacter('Hoshino', 'gacha');
    game.mutations.acquireCharacter('Serika', 'gacha');
    game.mutations.addAffectionExp('Hoshino', 100_000);

    expect(game.story.triggerAffectionPush('Serika')).toMatchObject({ success: false, error: 'NoAvailableStory' });
    // 全局闲聊（owner 空）：Hoshino 的台阶/闲聊都不可见（无 owner 为空的全局闲聊条目）
    expect(game.story.triggerPassiveStory(undefined, undefined)).toMatchObject({ success: false, error: 'NoAvailableStory' });
    // 台阶进行中：重复推送 AlreadyActive
    game.story.triggerAffectionPush('Hoshino');
    expect(game.story.triggerAffectionPush('Hoshino')).toMatchObject({ success: false, error: 'AlreadyActive' });
  });
});

// ============================================================
// §3 尾巴挂靠推送（pushAfterStory）
// ============================================================

describe('§3 羁绊尾巴（pushAfterStory）', () => {
  test('关联剧情完结后尾巴即入队；triggerTailPush 定向推送；播过即出队', () => {
    const game = new GameInstance();
    game.init([makePack()]);
    game.mutations.acquireCharacter('Hoshino', 'gacha');
    // 羁绊剧情未完结：尾巴不入队，定向推送无可用
    expect(game.story.readyStepCount('Hoshino')).toBe(0);
    expect(game.story.triggerTailPush('Hoshino', 'test:story:kizuna_story')).toMatchObject({ success: false, error: 'NoAvailableStory' });

    // 完结羁绊剧情（startCardStory 语义，skipConditions）
    expect(game.story.startCardStory('test:activestory:kizuna', 'Hoshino').success).toBe(true);
    finishStory(game, 'Hoshino');
    expect(game.story.readyStepCount('Hoshino')).toBe(1); // 尾巴入队（台阶未达标）

    // 定向推送尾巴；播过后出队，再推被拒
    expect(game.story.triggerTailPush('Hoshino', 'test:story:kizuna_story').success).toBe(true);
    expect(game.getStoryView('Hoshino')!.storyDefId).toBe('test:story:tail');
    finishStory(game, 'Hoshino');
    expect(game.story.triggerTailPush('Hoshino', 'test:story:kizuna_story')).toMatchObject({ success: false, error: 'NoAvailableStory' });
    expect(game.story.readyStepCount('Hoshino')).toBe(0);
  });

  test('尾巴强制优先于好感台阶（队列顶先尾巴，其后按需求值）', () => {
    const game = new GameInstance();
    game.init([makePack()]);
    game.mutations.acquireCharacter('Hoshino', 'gacha');
    game.mutations.addAffectionExp('Hoshino', 100_000); // 台阶全部达标
    // 完结羁绊剧情 → 尾巴入队，且排在台阶之前
    game.story.startCardStory('test:activestory:kizuna', 'Hoshino');
    finishStory(game, 'Hoshino');
    expect(game.story.readyStepCount('Hoshino')).toBe(3); // 尾巴 + 台阶一 + 台阶二

    expect(game.story.triggerAffectionPush('Hoshino').success).toBe(true);
    expect(game.getStoryView('Hoshino')!.storyDefId).toBe('test:story:tail'); // 强制优先
    finishStory(game, 'Hoshino');
    expect(game.story.triggerAffectionPush('Hoshino').success).toBe(true);
    expect(game.getStoryView('Hoshino')!.storyDefId).toBe('test:story:s1'); // 其后按需求值
  });

  test('尾巴退出随机抽取；owner 不匹配不触发', () => {
    const game = new GameInstance();
    game.init([makePack()]);
    game.mutations.acquireCharacter('Hoshino', 'gacha');
    game.mutations.acquireCharacter('Serika', 'gacha');
    game.story.startCardStory('test:activestory:kizuna', 'Hoshino');
    finishStory(game, 'Hoshino'); // 尾巴就绪（Hoshino）

    // 点击发送在队列有尾巴时必中尾巴（不走随机）
    const r = game.story.clickSend('Hoshino');
    expect(r).toMatchObject({ type: 'idle', started: true });
    expect(game.getStoryView('Hoshino')!.storyDefId).toBe('test:story:tail');
    finishStory(game, 'Hoshino');

    // owner 不匹配：Serika 的空间推不到 Hoshino 的尾巴
    expect(game.story.triggerTailPush('Serika', 'test:story:kizuna_story')).toMatchObject({ success: false, error: 'NoAvailableStory' });
    // 游标占用：进行中剧情拒绝推送
    game.story.clickSend('Hoshino'); // 台阶一（队列优先）
    expect(game.story.triggerTailPush('Hoshino', 'test:story:kizuna_story')).toMatchObject({ success: false, error: 'AlreadyActive' });
  });
});
