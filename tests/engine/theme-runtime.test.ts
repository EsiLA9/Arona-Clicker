import { describe, test, expect } from 'vitest';
import { RuntimeThemeManager, type ThemeOrderScope } from '../../src/engine/core/theme-runtime';
import { ColorSystem } from '../../src/arona-clicker/services/color-system';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';

const OFFICE = 'base:init:office';

function freshGame(): GameInstance {
  const g = new GameInstance();
  g.init([baseDatapack]);
  g.inits.startNewGame(OFFICE);
  return g;
}

describe('RuntimeThemeManager：多色彩组/场景/临时演出分层叠加', () => {
  // 用一个能按 groupId 解析 token 的解析器（模拟 ColorSystem 注入）
  function makeManager() {
    const groups: Record<string, Record<string, string>> = {
      blue: { primary: '#3b82f6', bg: '#eef4ff' },
      pink: { primary: '#ec4899', bg: '#fdeef7' },
    };
    const manager = new RuntimeThemeManager(layer => {
      const out: Record<string, string> = {};
      if (layer.groupId && groups[layer.groupId]) Object.assign(out, groups[layer.groupId]);
      if (layer.tokens) {
        for (const [k, v] of Object.entries(layer.tokens)) if (v != null) out[k] = v;
      }
      return out;
    });
    return { manager, groups };
  }

  test('RUNTIME-01 无层 → 返回默认 primary，不崩溃', () => {
    const { manager } = makeManager();
    const r = manager.resolve();
    expect(r.layers).toHaveLength(0);
    expect(r.tokens['primary']).toBeTruthy();
  });

  test('RUNTIME-02 玩家层生效：引用组整包 token', () => {
    const { manager } = makeManager();
    manager.setPlayer({ scope: 'player', groupId: 'blue' });
    const r = manager.resolve();
    expect(r.tokens['primary']).toBe('#3b82f6');
    expect(r.tokens['bg']).toBe('#eef4ff');
    expect(r.groupId).toBe('blue');
  });

  test('RUNTIME-03 场景层（Area）覆盖玩家层对应 token，其余保留', () => {
    const { manager } = makeManager();
    manager.setPlayer({ scope: 'player', groupId: 'blue' });
    manager.pushScene({ scope: 'area', groupId: 'pink' });
    const r = manager.resolve();
    // 后压入的场景层覆盖 player 的 primary/bg
    expect(r.tokens['primary']).toBe('#ec4899');
    expect(r.tokens['bg']).toBe('#fdeef7');
    // 场景层引用的组覆盖后，groupId 溯源应为 player（最底层组）
    expect(r.groupId).toBe('blue');
  });

  test('RUNTIME-04 学生场景栈覆盖 Area：打开学生对话后关闭回退 Area', () => {
    const { manager } = makeManager();
    manager.pushScene({ scope: 'area', groupId: 'blue' });
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
    manager.setPlayer({ scope: 'player', groupId: 'blue' });
    manager.pushScene({ scope: 'area', groupId: 'pink' });
    const id = manager.pushEphemeral({ scope: 'ephemeral', tokens: { primary: '#ff0000', 'player-bubble': '#ff0000' } });
    const r = manager.resolve();
    expect(r.tokens['primary']).toBe('#ff0000');
    expect(r.tokens['player-bubble']).toBe('#ff0000');
    // pop 后恢复场景层
    manager.popEphemeral(id);
    const after = manager.resolve();
    expect(after.tokens['primary']).toBe('#ec4899');
  });

  test('RUNTIME-06 局部 token 覆盖与 groupId 引用混合', () => {
    const { manager } = makeManager();
    manager.setPlayer({ scope: 'player', groupId: 'blue' });
    manager.pushScene({ scope: 'area', groupId: 'pink', tokens: { 'player-bubble': '#123456' } });
    const r = manager.resolve();
    expect(r.tokens['primary']).toBe('#ec4899'); // 来自 pink 的组基底
    expect(r.tokens['player-bubble']).toBe('#123456'); // 局部覆盖
    expect(r.tokens['bg']).toBe('#fdeef7'); // 保留组其它 token
  });

  test('RUNTIME-07 同 scope 场景重推覆盖，不重复压栈', () => {
    const { manager } = makeManager();
    manager.pushScene({ scope: 'area', groupId: 'blue' });
    manager.pushScene({ scope: 'area', groupId: 'pink' });
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
    manager.setPlayer({ scope: 'player', groupId: 'blue' });
    manager.pushScene({ scope: 'area', groupId: 'pink' });
    manager.pushScene({ scope: 'student', tokens: { primary: '#22c55e', 'player-bubble': '#112233' } });
    manager.setLayerOrder(['player', 'student', 'area']);
    const r = manager.resolve();
    // area 层最高：primary/bg 取 area（pink）
    expect(r.tokens['primary']).toBe('#ec4899');
    expect(r.tokens['bg']).toBe('#fdeef7');
    // student 高于 player：player-bubble 取 student 的局部覆盖
    expect(r.tokens['player-bubble']).toBe('#112233');
    // 溯源取最底层 groupId（player）
    expect(r.groupId).toBe('blue');
    expect(r.layers).toEqual(['player', 'student', 'area']);
  });

  test('RUNTIME-10 玩家自定义优先级：player 提到最高（student < area < player）', () => {
    const { manager } = makeManager();
    manager.setPlayer({ scope: 'player', groupId: 'blue' });
    manager.pushScene({ scope: 'area', groupId: 'pink' });
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
    manager.setPlayer({ scope: 'player', groupId: 'blue' });
    manager.pushScene({ scope: 'area', groupId: 'pink' });
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
    manager.setPlayer({ scope: 'player', groupId: 'blue' });
    manager.pushScene({ scope: 'area', groupId: 'pink' });
    manager.setLayerOrder(['area', 'player', 'student']); // player 提到最高
    manager.pushEphemeral({ id: 'fx', scope: 'ephemeral', tokens: { primary: '#ff0000' } });
    const r = manager.resolve();
    expect(r.tokens['primary']).toBe('#ff0000');
    expect(r.layers).toEqual(['area', 'player', 'fx']);
  });

  test('Init 世界线层位于玩家与 Area 之间，并支持自定义优先级', () => {
    const { manager } = makeManager();
    manager.setPlayer({ scope: 'player', groupId: 'blue' });
    manager.pushScene({ scope: 'init', groupId: 'blue' });
    manager.pushScene({ scope: 'area', groupId: 'pink' });
    expect(manager.resolve().tokens['primary']).toBe('#ec4899');

    manager.setLayerOrder(['player', 'area', 'student', 'init']);
    expect(manager.resolve().tokens['primary']).toBe('#3b82f6');
  });

  test('RUNTIME-12A 编辑预览层高于用户主题且低于演出层', () => {
    const { manager } = makeManager();
    manager.setPlayer({ scope: 'player', tokens: { primary: '#101010' } });
    manager.setUser({ scope: 'player', tokens: { primary: '#202020' } });
    manager.setPreview({ scope: 'ephemeral', tokens: { primary: '#303030' } });
    expect(manager.resolve().tokens['primary']).toBe('#303030');
    manager.pushEphemeral({ id: 'story', scope: 'ephemeral', tokens: { primary: '#404040' } });
    expect(manager.resolve().tokens['primary']).toBe('#404040');
    manager.setPreview(null);
    expect(manager.resolve().tokens['primary']).toBe('#404040');
  });

  test('RUNTIME-13 resolveScope：按 scope 取当前生效层（忽略演出层）', () => {
    const { manager } = makeManager();
    manager.setPlayer({ scope: 'player', groupId: 'blue' });
    manager.pushScene({ scope: 'area', groupId: 'pink' });
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
    manager.pushScene({ scope: 'area', groupId: 'blue' });
    manager.pushScene({ scope: 'area', groupId: 'pink' });
    expect(manager.resolveScope('area')['primary']).toBe('#ec4899');
  });

  test('RUNTIME-16 主题色列表按层覆盖，语义节点按名称合并', () => {
    const { manager } = makeManager();
    manager.setPlayer({ scope: 'player', palette: ['#111111', '#222222'], nodeOverrides: { accent: '#abcdef', active: '#123456' } });
    manager.pushScene({ scope: 'area', palette: ['#aaaaaa'], nodeOverrides: { active: '#654321' } });
    const resolved = manager.resolve();
    expect(resolved.palette).toEqual(['#aaaaaa']);
    expect(resolved.nodeOverrides).toEqual({ accent: '#abcdef', active: '#654321' });
  });

  test('RUNTIME-17 作用域节点覆盖按 scope 合并并保留父级未覆盖值', () => {
    const { manager } = makeManager();
    manager.setPlayer({ scope: 'player', scopeNodeOverrides: {
      left: { panel: '#101010', text: '#ffffff' },
      'left.contacts': { active: '#00ff00' },
    } });
    const resolved = manager.resolve();
    expect(resolved.scopeNodeOverrides.left).toEqual({ panel: '#101010', text: '#ffffff' });
    expect(resolved.scopeNodeOverrides['left.contacts']).toEqual({ active: '#00ff00' });
  });

  test('RUNTIME-18 簇与区域作用域跨主题层叠加时按节点合并，区域仍可覆盖簇', () => {
    const { manager } = makeManager();
    manager.setPlayer({ scope: 'player', scopeNodeOverrides: {
      left: { active: '#111111', highlight: '#222222' },
      'left.area': { active: '#333333' },
    } });
    manager.pushScene({ scope: 'area', scopeNodeOverrides: {
      left: { active: '#aaaaaa' },
      'left.area': { highlight: '#bbbbbb' },
    } });

    const resolved = manager.resolve();
    expect(resolved.scopeNodeOverrides.left).toEqual({ active: '#aaaaaa', highlight: '#222222' });
    expect(resolved.scopeNodeOverrides['left.area']).toEqual({ active: '#333333', highlight: '#bbbbbb' });
  });

  test('RUNTIME-19 表现层按 id 叠加，支持高层替换与新组件追加', () => {
    const { manager } = makeManager();
    manager.setPlayer({ scope: 'player', presentation: {
      layers: [{ id: 'wash', region: 'centerPanel', kind: 'solid', value: '#fff' }],
      components: [{ id: 'portrait', parent: 'centerPanel', asset: 'base:pic:old', anchor: 'bottom-right' }],
    } });
    manager.pushScene({ scope: 'area', presentation: {
      layers: [{ id: 'wash', region: 'centerPanel', kind: 'gradient', value: 'linear-gradient(#fff, #def)' }],
      components: [
        { id: 'portrait', parent: 'centerPanel', asset: 'base:pic:new', anchor: 'bottom-left' },
        { id: 'triangle', parent: 'centerPanel', asset: 'base:pic:triangle', anchor: 'top-left' },
      ],
    } });
    const presentation = manager.resolve().presentation;
    expect(presentation.layers).toEqual([{ id: 'wash', region: 'centerPanel', kind: 'gradient', value: 'linear-gradient(#fff, #def)' }]);
    expect(presentation.components?.map(component => component.id)).toEqual(['portrait', 'triangle']);
    expect(presentation.components?.[0].asset).toBe('base:pic:new');
  });

  test('RUNTIME-20 控件宿主背景按 id 叠加并保留宿主图层契约', () => {
    const { manager } = makeManager();
    manager.setPlayer({ scope: 'player', presentation: {
      hosts: [{ id: 'toolbar.button', parent: 'header', layers: [{ id: 'base', kind: 'solid', value: '#fff' }] }],
    } });
    manager.pushScene({ scope: 'area', presentation: {
      hosts: [{ id: 'toolbar.button', layers: [{ id: 'base', kind: 'gradient', value: 'linear-gradient(#fff,#def)' }, { id: 'active', kind: 'empty', value: '' }], layerOrder: ['active', 'base'] }],
    } });
    const host = manager.resolve().presentation.hosts?.[0];
    expect(host?.id).toBe('toolbar.button');
    expect(host?.parent).toBe('header');
    expect(host?.layers?.map(layer => layer.id)).toEqual(['base', 'active']);
    expect(host?.layers?.[0].kind).toBe('gradient');
    expect(host?.layerOrder).toEqual(['active', 'base']);
  });

  test('RUNTIME-21 控件状态文字模式跨层合并时保留 inactive 的显式优先级', () => {
    const { manager } = makeManager();
    manager.setPlayer({ scope: 'player', presentation: {
      hosts: [{ id: 'header.button', textColorMode: 'auto', states: {
        inactive: { textColorMode: 'light' },
      } }],
    } });
    manager.pushScene({ scope: 'area', presentation: {
      hosts: [{ id: 'header.button', textColorMode: 'dark' }],
    } });
    const host = manager.resolve().presentation.hosts?.[0];
    expect(host?.textColorMode).toBe('dark');
    expect(host?.states?.inactive?.textColorMode).toBe('light');
  });

  test('RUNTIME-15 背景层按优先级合并，同 id 覆盖、匿名层追加', () => {
    const { manager } = makeManager();
    manager.setPlayer({ scope: 'player', background: [
      { id: 'scene', kind: 'gradient', value: 'linear-gradient(#fff,#def)' },
      { kind: 'image', value: 'base:background(pic):one' },
    ] });
    manager.pushScene({ scope: 'area', background: [
      { id: 'scene', kind: 'image', value: 'base:background(pic):two' },
      { kind: 'image', value: 'base:overlay(pic):triangles' },
    ] });
    expect(manager.resolve().background.map(layer => layer.value)).toEqual([
      'base:background(pic):two',
      'base:background(pic):one',
      'base:overlay(pic):triangles',
    ]);
  });

  test('RUNTIME-16 背景层按显式顺序排列，未列出的层保持合并顺序', () => {
    const { manager } = makeManager();
    manager.setPlayer({ scope: 'player', background: [
      { id: 'base', kind: 'solid', value: '#fff' },
      { id: 'system-color-background', kind: 'gradient', value: 'linear-gradient(#fff,#eee)' },
    ], backgroundLayerOrder: ['system-color-background', 'overlay', 'base'] });
    manager.pushScene({ scope: 'area', background: [{ id: 'overlay', kind: 'image', value: 'base:overlay(pic):triangles' }] });
    expect(manager.resolve().background.map(layer => layer.id)).toEqual([
      'system-color-background', 'overlay', 'base',
    ]);
  });
});

describe('ColorSystem 运行时主题门面 + setTheme effect', () => {
  let game: GameInstance;

  test('setTheme effect → handleThemeEffect → 临时层生效', () => {
    game = freshGame();
    game.mutations.acquireCharacter('Arona', 'gacha'); // 解锁 schale-solid
    game.mutations.activateTheme('base:colorgroup:schale-solid');
    game.colorSystem.syncPlayerThemeFromState(game.state);
    const base = game.colorSystem.runtimeTheme();
    expect(base.layers).toContain('player');
    // 剧情演出临时变色
    const handled = game.colorSystem.handleThemeEffect({
      op: 'setTheme',
      target: '',
      value: {
        colorGroupId: 'base:colorgroup:coral',
        tokens: { 'player-bubble': '#ff0000' },
        background: [{ id: 'story', kind: 'gradient', value: 'linear-gradient(#111,#333)' }],
      },
    });
    expect(handled).toBe(true);
    const themed = game.colorSystem.runtimeTheme();
    expect(themed.tokens['primary']).toBe('#ff7a59'); // coral 的 primary
    expect(themed.tokens['player-bubble']).toBe('#ff0000');
    expect(themed.background[0]?.value).toContain('linear-gradient');
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

  test('用户主题系统颜色层使用当前主题背景变量别名', () => {
    game = freshGame();
    game.colorSystem.setUserThemePreview({
      palette: ['#123456'],
      presentation: { hosts: [{ id: 'header.button', shape: 'rounded-parallelogram' }] },
    });
    expect(game.colorSystem.runtimeTheme().background.find(layer => layer.id === 'system-color-background')?.value)
      .toBe('linear-gradient(135deg, var(--bg) 0%, var(--bg-alt) 100%)');
  });

  test('多色彩组叠加：场景覆盖玩家、临时覆盖一切', () => {
    game = freshGame();
    game.mutations.acquireCharacter('Arona', 'gacha');
    game.mutations.activateTheme('base:colorgroup:schale-solid');
    game.colorSystem.syncPlayerThemeFromState(game.state);
    // 进入千年 Area → 场景层（靛蓝）
    game.colorSystem.pushSceneTheme({ scope: 'area', groupId: 'base:colorgroup:indigo' });
    expect(game.colorSystem.runtimeTheme().tokens['primary']).toBe('#6366f1');
    // 打开学生对话（无 theme 的默认学生不影响，但此处模拟千年学生有 theme）
    game.colorSystem.pushSceneTheme({ scope: 'student', groupId: 'base:colorgroup:violet' });
    expect(game.colorSystem.runtimeTheme().tokens['primary']).toBe('#8b5cf6');
    // 临时演出压栈 → 最高优先级
    game.colorSystem.pushEphemeralTheme({ scope: 'ephemeral', tokens: { primary: '#111111' } });
    expect(game.colorSystem.runtimeTheme().tokens['primary']).toBe('#111111');
  });
});
