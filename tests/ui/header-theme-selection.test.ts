import { describe, expect, it } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { createUIContext } from '../../src/ui/runtime/context';
import { renderHeader } from '../../src/ui/components/shared/header';

describe('主题单选入口', () => {
  it('显示场景默认选项并移除玩家层级优先级控制', () => {
    const game = new GameInstance();
    game.init([baseDatapack]);

    const html = renderHeader(createUIContext(game));

    expect(html).toContain('使用当前场景主题');
    expect(html).toContain('当前场景');
    expect(html).not.toContain('data-theme-layer-order-rows');
    expect(html).not.toContain('层级优先级');
    game.stop();
  });
});
