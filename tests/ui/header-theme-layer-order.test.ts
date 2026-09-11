// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { createUIContext } from '../../src/ui/context';
import { renderHeader } from '../../src/ui/components/header';

describe('主题浮窗层级优先级', () => {
  it('每个层级项显示主题名、作用区域与无障碍描述', () => {
    const game = new GameInstance();
    game.init([baseDatapack]);
    const root = document.createElement('div');
    root.innerHTML = renderHeader(createUIContext(game), { studentVariantId: 'Hoshino' });

    const rows = [...root.querySelectorAll<HTMLElement>('.layer-order-row')];
    expect(rows).toHaveLength(4);
    expect(rows.map(row => row.querySelector('.layer-order-theme-name')?.textContent)).toEqual([
      '未设置',
      '夏莱蓝',
      '局部主题',
      '系统默认',
    ]);
    expect(rows[0].querySelector('.layer-order-region')?.textContent).toBe('学生层 · 当前学生剧情 · 小鸟游星野');
    expect(rows[1].querySelector('.layer-order-region')?.textContent).toMatch(/^场景层 · 当前区域 · /);
    expect(rows[2].querySelector('.layer-order-region')?.textContent).toMatch(/^世界线层 · 当前世界线 · /);
    expect(rows[3].querySelector('.layer-order-region')?.textContent).toBe('玩家层 · 全局界面');
    for (const row of rows) {
      expect(row.getAttribute('aria-label')).toContain('作用区域：');
    }
  });
});
