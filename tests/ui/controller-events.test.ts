// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { entityKeyOf } from '../../src/arona-clicker/services/progression/color-system';
import { UIController } from '../../src/ui/controller/controller';
import { bindEvents } from '../../src/ui/controller/controller-events';

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

  it('Runtime World Draft 批次中的 Area 事件不重复刷新日志或导航', () => {
    const refreshPanels = vi.spyOn(controller, 'refreshPanels').mockImplementation(() => undefined);
    const refreshLogPanel = vi.spyOn(controller, 'refreshLogPanel').mockImplementation(() => undefined);
    const currentAreaId = game.getView().currentAreaId!;

    controller.beginContentRefreshBatch();
    game.eventBus.emit({ type: 'areaDefinitionChanged', areaId: currentAreaId });
    game.eventBus.emit({ type: 'areaTopologyChanged', areaIds: [currentAreaId] });

    expect(refreshPanels).not.toHaveBeenCalled();
    expect(refreshLogPanel).not.toHaveBeenCalled();
    controller.endContentRefreshBatch();
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

  it('Records 对已挂载成就行定点刷新，并在事件处理完后保留节点身份', async () => {
    const areaId = game.getView().currentAreaId!;
    const makeProjection = (resource: number, item: number, completed: boolean) => [
      {
        id: 'test:achievement:resource', initId: 'base:init:schale_office', areaId,
        title: 'Resource', clue: 'Produce', rewardDescription: 'A mark', completed,
        progress: { current: resource, target: 5, comparator: '>=' as const },
      },
      {
        id: 'test:achievement:item', initId: 'base:init:schale_office', areaId,
        title: 'Item', clue: 'Collect', rewardDescription: 'A note', completed: false,
        progress: { current: item, target: 3, comparator: '>=' as const },
      },
    ];
    let projection = makeProjection(1, 0, false);
    const getAchievementView = vi.spyOn(game, 'getAchievementView').mockImplementation(() => projection);
    controller.panelState.service = 'records';
    controller.render();

    const recordsRoot = controller.root.querySelector<HTMLElement>('[data-workspace-frame="service-records"]')!;
    const resourceRow = recordsRoot.querySelector<HTMLElement>('[data-achievement-id="test:achievement:resource"]')!;
    const itemRow = recordsRoot.querySelector<HTMLElement>('[data-achievement-id="test:achievement:item"]')!;
    const resourceCurrent = resourceRow.querySelector<HTMLElement>('[data-achievement-progress-current]')!;
    const resourceStatus = resourceRow.querySelector<HTMLElement>('[data-achievement-status]')!;
    const itemCurrent = itemRow.querySelector<HTMLElement>('[data-achievement-progress-current]')!;
    const render = vi.spyOn(controller, 'render');
    controller.lastRevealCheck = Date.now();

    game.eventBus.on('resourceChanged', () => { projection = makeProjection(2, 0, true); });
    game.mutations.changeResource('test:resource:achievement-refresh', 1);
    await Promise.resolve();

    expect(resourceCurrent.textContent).toBe('2');
    expect(resourceStatus.textContent).toBe('已完成');
    expect(recordsRoot.querySelector('[data-achievement-id="test:achievement:resource"]')).toBe(resourceRow);
    expect(render).not.toHaveBeenCalled();

    game.eventBus.on('itemCollected', () => { projection = makeProjection(2, 1, true); });
    game.mutations.addItem('test:item:achievement-refresh', 1);
    await Promise.resolve();

    expect(itemCurrent.textContent).toBe('1');
    expect(recordsRoot.querySelector('[data-achievement-id="test:achievement:item"]')).toBe(itemRow);

    let sawSpotProduced = false;
    game.eventBus.on('spotProduced', () => {
      sawSpotProduced = true;
      projection = makeProjection(4, 2, true);
    });
    game.eventBus.on('tick', () => { projection = makeProjection(5, 2, true); });
    game.tick();
    await Promise.resolve();

    expect(sawSpotProduced).toBe(true);
    expect(resourceCurrent.textContent).toBe('5');
    expect(itemCurrent.textContent).toBe('2');
    expect(recordsRoot.querySelector('[data-achievement-id="test:achievement:resource"]')).toBe(resourceRow);
    expect(recordsRoot.querySelector('[data-achievement-id="test:achievement:item"]')).toBe(itemRow);
    expect(render).not.toHaveBeenCalled();

    const callsBeforeLeavingRecords = getAchievementView.mock.calls.length;
    const displayedResource = resourceCurrent.textContent;
    controller.panelState.service = 'game';
    projection = makeProjection(5, 3, true);
    game.mutations.changeResource('test:resource:achievement-refresh', 1);
    await Promise.resolve();

    expect(getAchievementView).toHaveBeenCalledTimes(callsBeforeLeavingRecords);
    expect(resourceCurrent.textContent).toBe(displayedResource);
  });
});
