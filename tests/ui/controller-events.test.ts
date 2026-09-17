// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { UIController } from '../../src/ui/controller';
import { bindEvents } from '../../src/ui/controller-events';

describe('UI Controller Area 事件刷新', () => {
  let game: GameInstance;
  let controller: UIController;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    game = new GameInstance();
    game.init([baseDatapack]);
    game.inits.startNewGame('base:init:schale_office');
    controller = new UIController(game, document.querySelector('#app')!);
    controller.started = true;
    bindEvents(controller);
  });

  afterEach(() => {
    controller.destroy();
    game.stop();
  });

  it('当前 Area 拓扑变化时刷新左侧可前往区域', () => {
    const refreshPanels = vi.spyOn(controller, 'refreshPanels').mockImplementation(() => undefined);
    const currentAreaId = game.getView().currentAreaId!;

    game.eventBus.emit({ type: 'areaDefinitionChanged', areaId: currentAreaId });

    expect(refreshPanels).toHaveBeenCalledWith(['left']);
  });

  it('Runtime 拓扑 Overlay 变化时刷新当前导航', () => {
    const refreshPanels = vi.spyOn(controller, 'refreshPanels').mockImplementation(() => undefined);
    const currentAreaId = game.getView().currentAreaId!;

    game.eventBus.emit({ type: 'areaTopologyChanged', areaIds: [currentAreaId] });

    expect(refreshPanels).toHaveBeenCalledWith(['left']);
  });

  it('其它 Area 变化时不刷新当前导航', () => {
    const refreshPanels = vi.spyOn(controller, 'refreshPanels').mockImplementation(() => undefined);
    const currentAreaId = game.getView().currentAreaId!;
    const otherAreaId = [...game.registry.areas.keys()].find(areaId => areaId !== currentAreaId)!;

    game.eventBus.emit({ type: 'areaDefinitionChanged', areaId: otherAreaId });

    expect(refreshPanels).not.toHaveBeenCalledWith(['left']);
  });
});
