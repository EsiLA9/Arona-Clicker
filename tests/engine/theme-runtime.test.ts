import { describe, test, expect } from 'vitest';
import { RuntimeThemeManager, type ThemeOrderScope } from '../../src/engine/core/theme-runtime';
import { ColorSystem } from '../../src/engine/system/color-system';
import { GameInstance } from '../../src/engine/game-instance';
import { baseDatapack } from '../../src/data/index';

const OFFICE = 'base:init:office';

function freshGame(): GameInstance {
  const g = new GameInstance();
  g.init([baseDatapack]);
  g.startNewGame(OFFICE);
  return g;
}

describe('RuntimeThemeManager：多 Color/场景/临时演出分层叠加', () => {
  // 用一个能按 colorId 解析 token 的解析器（模拟 ColorSystem 注入）
  function makeManager() {
    const colors: Record<string, Record<string, string>> = {
      blue: { primary: '#3b82f6', bg: '#eef4ff' },
      pink: { primary: '#ec4899', bg: '#fdeef7' },
    };
    const manager = new RuntimeThemeManager(layer => {
      const out: Record<string, string> = {};
      if (layer.colorId && colors[layer.colorId]) Object.assign(out, colors[layer.colorId]);
      if (layer.tokens) {
        for (const [k, v] of Object.entries(layer.tokens)) if (v != null) out[k] = v;
      }
      return out;
    });
    return { manager, colors };
  }

  test('RUNTIME-01 无层 → 返回默认 primary，不崩溃', () => {
    const { manager } = makeManager();
    const r = manager.resolve();
    expect(r.layers).toHaveLength(0);
    expect(r.tokens['primary']).toBeTruthy();
  });

  test('RUNTIME-02 玩家层生效：引用 color 整包 token', () => {
    const { manager } = makeManager();
    manager.setPlayer({ scope: 'player', colorId: 'blue' });
    const r = manager.resolve();
    expect(r.tokens['primary']).toBe('#3b82f6');
    expect(r.tokens['bg']).toBe('#eef4ff');
    expect(r.colorId).toBe('blue');
  });

  test('RUNTIME-03 场景层（Area）覆盖玩家层对应 token，其余保留', () => {
    const { manager } = makeManager();
    manager.setPlayer({ scope: 'player', colorId: 'blue' });
    manager.pushScene({ scope: 'area', colorId: 'pink' });
    const r = manager.resolve();
    // 后压入的场景层覆盖 player 的 primary/bg
    expect(r.tokens['primary']).toBe('#ec4899');
    expect(r.tokens['bg']).toBe('#fdeef7');
    // 场景层引用的 color 覆盖后，colorId 溯源应为 player（最底层 color）
    expect(r.colorId).toBe('blue');
  });

  test('RUNTIME-04 学生场景栈覆盖 Area：打开学生对话后关闭回退 Area', () => {
    const { manager } = makeManager();
    manager.pushScene({ scope: 'area', colorId: 'blue' });
    const before = manager.resolve();
    expect(before.tokens['primary']).toBe('#3b82f6');
    // 打开学生对话 → 压入 student 层
    manager.pushScene({ scope: 'student', tokens: { primary: '#22c55e' } });
    const inConv = manager.resolve();
    expect(inConv.tokens['primary']).toBe('#22c55e');
    // 关闭学生对话 → pop student，回退 Area
    manager.popScene('student');
    const after = manager.resolve();
    expect(after.tokens['primary']).toBe('#3b82f6');
  });

  test('RUNTIME-05 临时演出层最高优先级，且可 pop 恢复', () => {
    const { manager } = makeManager();
    manager.setPlayer({ scope: 'player', colorId: 'blue' });
    manager.pushScene({ scope: 'area', colorId: 'pink' });
    const id = manager.pushEphemeral({ scope: 'ephemeral', tokens: { primary: '#ff0000', 'player-bubble': '#ff0000' } });
    const r = manager.resolve();
    expect(r.tokens['primary']).toBe('#ff0000');
    expect(r.tokens['player-bubble']).toBe('#ff0000');
    // pop 后恢复场景层
    manager.popEphemeral(id);
    const after = manager.resolve();
    expect(after.tokens['primary']).toBe('#ec4899');
  });

  test('RUNTIME-06 局部 token 覆盖与 colorId 引用混合', () => {
    const { manager } = makeManager();
    manager.setPlayer({ scope: 'player', colorId: 'blue' });
    manager.pushScene({ scope: 'area', colorId: 'pink', tokens: { 'player-bubble': '#123456' } });
    const r = manager.resolve();
    expect(r.tokens['primary']).toBe('#ec4899'); // 来自 pink 的 color 基底
    expect(r.tokens['player-bubble']).toBe('#123456'); // 局部覆盖
    expect(r.tokens['bg']).toBe('#fdeef7'); // 保留 color 其它 token
  });

  test('RUNTIME-07 同 scope 场景重推覆盖，不重复压栈', () => {
    const { manager } = makeManager();
    manager.pushScene({ scope: 'area', colorId: 'blue' });
    manager.pushScene({ scope: 'area', colorId: 'pink' });
    expect(manager.resolve().tokens['primary']).toBe('#ec4899');
    manager.popScene('area');
    // 同 scope 已覆盖为一份，pop 后无 area 层
    expect(manager.resolve().layers).not.toContain('area');
  });

  test('RUNTIME-08 同 id 临时层覆盖式更新', () => {
    const { manager } = makeManager();
    manager.pushEphemeral({ id: 'fx', scope: 'ephemeral', tokens: { primary: '#111' } });
    manager.pushEphemeral({ id: 'fx', scope: 'ephemeral', tokens: { primary: '#222' } });
    const r = manager.resolve();
    expect(r.tokens['primary']).toBe('#222');
    manager.popEphemeral('fx');
    expect(r).not.toBe(manager.resolve()); // 覆盖后 pop 生效
    expect(manager.resolve().layers).not.toContain('fx');
  });

  test('RUNTIME-09 玩家自定义优先级：area 提到最高（player < student < area）', () => {
    const { manager } = makeManager();
    manager.setPlayer({ scope: 'player', colorId: 'blue' });
    manager.pushScene({ scope: 'area', colorId: 'pink' });
    manager.pushScene({ scope: 'student', tokens: { primary: '#22c55e', 'player-bubble': '#112233' } });
    manager.setLayerOrder(['player', 'student', 'area']);
    const r = manager.resolve();
    // area 层最高：primary/bg 取 area（pink）
    expect(r.tokens['primary']).toBe('#ec4899');
    expect(r.tokens['bg']).toBe('#fdeef7');
    // student 高于 player：player-bubble 取 student 的局部覆盖
    expect(r.tokens['player-bubble']).toBe('#112233');
    // 溯源取最底层 colorId（player）
    expect(r.colorId).toBe('blue');
    expect(r.layers).toEqual(['player', 'student', 'area']);
  });

  test('RUNTIME-10 玩家自定义优先级：player 提到最高（student < area < player）', () => {
    const { manager } = makeManager();
    manager.setPlayer({ scope: 'player', colorId: 'blue' });
    manager.pushScene({ scope: 'area', colorId: 'pink' });
    manager.pushScene({ scope: 'student', tokens: { primary: '#22c55e', 'player-bubble': '#112233' } });
    manager.setLayerOrder(['student', 'area', 'player']);
    const r = manager.resolve();
    // player 层最高：primary/bg 取 player（blue）
    expect(r.tokens['primary']).toBe('#3b82f6');
    expect(r.tokens['bg']).toBe('#eef4ff');
    // 最底层 student 的局部 token 仍保留（无更高层覆盖）
    expect(r.tokens['player-bubble']).toBe('#112233');
    expect(r.layers).toEqual(['student', 'area', 'player']);
  });

  test('RUNTIME-11 非法/不完整优先级保持现有顺序', () => {
    const { manager } = makeManager();
    manager.setPlayer({ scope: 'player', colorId: 'blue' });
    manager.pushScene({ scope: 'area', colorId: 'pink' });
    const r = manager.resolve();
    // 缺省顺序：area 覆盖 player
    expect(r.tokens['primary']).toBe('#ec4899');
    manager.setLayerOrder(['player', 'area', 'area']); // 重复
    expect(manager.resolve().tokens['primary']).toBe('#ec4899');
    manager.setLayerOrder(['player', 'area']); // 缺一个
    expect(manager.resolve().tokens['primary']).toBe('#ec4899');
    manager.setLayerOrder(['player', 'area', 'bogus'] as ThemeOrderScope[]); // 非法 scope
    expect(manager.resolve().tokens['primary']).toBe('#ec4899');
  });

  test('RUNTIME-12 演出层不受优先级排列影响，始终最高', () => {
    const { manager } = makeManager();
    manager.setPlayer({ scope: 'player', colorId: 'blue' });
    manager.pushScene({ scope: 'area', colorId: 'pink' });
    manager.setLayerOrder(['area', 'player', 'student']); // player 提到最高
    manager.pushEphemeral({ id: 'fx', scope: 'ephemeral', tokens: { primary: '#ff0000' } });
    const r = manager.resolve();
    expect(r.tokens['primary']).toBe('#ff0000');
    expect(r.layers).toEqual(['area', 'player', 'fx']);
  });

  test('RUNTIME-13 resolveScope：按 scope 取当前生效层（忽略演出层）', () => {
    const { manager } = makeManager();
    manager.setPlayer({ scope: 'player', colorId: 'blue' });
    manager.pushScene({ scope: 'area', colorId: 'pink' });
    manager.pushScene({ scope: 'student', tokens: { primary: '#22c55e' } });
    expect(manager.resolveScope('player')['primary']).toBe('#3b82f6');
    expect(manager.resolveScope('area')['primary']).toBe('#ec4899');
    expect(manager.resolveScope('student')['primary']).toBe('#22c55e');
    // 无该 scope 层 → 空表
    manager.popScene('student');
    expect(manager.resolveScope('student')).toEqual({});
    // 临时演出层不参与（其不参与排序）
    manager.pushEphemeral({ id: 'fx', scope: 'ephemeral', tokens: { primary: '#ff0000' } });
    expect(manager.resolveScope('area')['primary']).toBe('#ec4899');
  });

  test('RUNTIME-14 resolveScope：同 scope 重推后取最新层', () => {
    const { manager } = makeManager();
    manager.pushScene({ scope: 'area', colorId: 'blue' });
    manager.pushScene({ scope: 'area', colorId: 'pink' });
    expect(manager.resolveScope('area')['primary']).toBe('#ec4899');
  });
});

describe('ColorSystem 运行时主题门面 + setTheme effect', () => {
  let game: GameInstance;

  test('setTheme effect → handleThemeEffect → 临时层生效', () => {
    game = freshGame();
    game.mutations.acquireCharacter('Arona', 'gacha'); // 解锁 schale-blue
    game.mutations.activateTheme('base:color:schale-blue');
    game.colorSystem.syncPlayerThemeFromState(game.state);
    const base = game.colorSystem.runtimeTheme();
    expect(base.layers).toContain('player');
    // 剧情演出临时变色
    const handled = game.colorSystem.handleThemeEffect({
      op: 'setTheme',
      target: '',
      value: { colorId: 'base:color:coral', tokens: { 'player-bubble': '#ff0000' } },
    });
    expect(handled).toBe(true);
    const themed = game.colorSystem.runtimeTheme();
    expect(themed.tokens['primary']).toBe('#ff7a59'); // coral 的 primary
    expect(themed.tokens['player-bubble']).toBe('#ff0000');
    // 清除剧情临时层
    game.colorSystem.clearStoryTheme();
    const cleared = game.colorSystem.runtimeTheme();
    expect(cleared.layers).not.toContain(ColorSystem.STORY_EPHEMERAL_ID);
  });

  test('非 setTheme effect 不被 handleThemeEffect 消费', () => {
    game = freshGame();
    const handled = game.colorSystem.handleThemeEffect({ op: 'addResource', target: 'x', value: 1 });
    expect(handled).toBe(false);
  });

  test('多 Color 叠加：场景覆盖玩家、临时覆盖一切', () => {
    game = freshGame();
    game.mutations.acquireCharacter('Arona', 'gacha');
    game.mutations.activateTheme('base:color:schale-blue');
    game.colorSystem.syncPlayerThemeFromState(game.state);
    // 进入千年 Area → 场景层（靛蓝）
    game.colorSystem.pushSceneTheme({ scope: 'area', colorId: 'base:color:indigo' });
    expect(game.colorSystem.runtimeTheme().tokens['primary']).toBe('#6366f1');
    // 打开学生对话（无 theme 的默认学生不影响，但此处模拟千年学生有 theme）
    game.colorSystem.pushSceneTheme({ scope: 'student', colorId: 'base:color:violet' });
    expect(game.colorSystem.runtimeTheme().tokens['primary']).toBe('#8b5cf6');
    // 临时演出压栈 → 最高优先级
    game.colorSystem.pushEphemeralTheme({ scope: 'ephemeral', tokens: { primary: '#111111' } });
    expect(game.colorSystem.runtimeTheme().tokens['primary']).toBe('#111111');
  });
});
