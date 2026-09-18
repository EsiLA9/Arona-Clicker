// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { entityKeyOf } from '../../src/arona-clicker/services/color-system';
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

  it('当前 Area 主题槽变化时无需离开 Area 即更新主题，并可立即恢复声明默认', async () => {
    controller.render();
    const areaId = game.getView().currentAreaId!;
    const entityKey = entityKeyOf('area', areaId);
    const defaultPrimary = document.documentElement.style.getPropertyValue('--ac-primary');

    game.mutations.setEntityThemeSlot(entityKey, {
      kind: 'custom',
      customTheme: { colorGroupId: 'base:colorgroup:ink' },
    });
    await Promise.resolve();

    expect(document.documentElement.style.getPropertyValue('--ac-primary')).toBe('#1e3a5f');
    expect(document.documentElement.style.getPropertyValue('--ac-primary')).not.toBe(defaultPrimary);

    game.mutations.setEntityThemeSlot(entityKey, null);
    await Promise.resolve();

    expect(document.documentElement.style.getPropertyValue('--ac-primary')).toBe(defaultPrimary);
  });

  it('其它 Area 变化时不刷新当前导航', () => {
    const refreshPanels = vi.spyOn(controller, 'refreshPanels').mockImplementation(() => undefined);
    const currentAreaId = game.getView().currentAreaId!;
    const otherAreaId = [...game.registry.areas.keys()].find(areaId => areaId !== currentAreaId)!;

    game.eventBus.emit({ type: 'areaDefinitionChanged', areaId: otherAreaId });

    expect(refreshPanels).not.toHaveBeenCalledWith(['left']);
  });

  it('不可见实体的表现变化不触发整页刷新', () => {
    controller.render();
    const render = vi.spyOn(controller, 'render');
    const currentAreaId = game.getView().currentAreaId!;
    const offscreenSpotId = [...game.registry.spots.values()]
      .find(spot => spot.areaId !== currentAreaId)?.id;
    expect(offscreenSpotId).toBeDefined();

    game.eventBus.emit({
      type: 'entityPresentationChanged',
      entityKey: `spot:${offscreenSpotId}`,
      optionId: null,
    });

    expect(render).not.toHaveBeenCalled();
  });

  it('没有新增日志的外部事件不替换 Log Panel', () => {
    controller.panelState.centerTab = 'log';
    controller.render();
    const log = document.querySelector<HTMLElement>('.log-panel')!;

    game.eventBus.emit({ type: 'chatReadChanged', messageId: 'message-not-in-log' });

    expect(document.querySelector<HTMLElement>('.log-panel')).toBe(log);
  });
});
