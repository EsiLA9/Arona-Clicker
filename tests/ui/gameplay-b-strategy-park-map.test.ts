// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { createAppRuntime } from '../../src/app/runtime-bootstrap';
import { gameplayBCarouselDatapack } from '../../src/arona-clicker/content/operation-samples/gameplay-b-datapack';
import { CAROUSEL_SCENE_ACTION_IDS as CAROUSEL_IDS } from '../../src/arona-clicker/content/operation-samples/carousel-scene-action-slice';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
import { gameplayBStrategyParkDatapack } from '../../src/arona-clicker/content/operation-samples/gameplay-b-strategy-park';
import { GAMEPLAY_B_STRATEGY_PARK_IDS as PARK_IDS } from '../../src/arona-clicker/content/operation-samples/gameplay-b-strategy-park-ids';
import { Character } from '../../src/arona-clicker/types/ids';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { UIController } from '../../src/ui/controller';
import { createUIContext } from '../../src/ui/context';
import { renderOperationWorkspace } from '../../src/ui/components/operation-workspace';

function dragSceneCardToStudent(root: HTMLElement, face: HTMLButtonElement, actorId: string): void {
  const actor = root.querySelector<HTMLElement>('[data-operation-student="' + actorId + '"]');
  if (!actor) throw new Error('Expected a student card to receive the scene card.');
  const original = Object.getOwnPropertyDescriptor(document, 'elementFromPoint');
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => actor });
  try {
    const pointer = (type: string, x: number, y: number) => {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y });
      Object.defineProperty(event, 'pointerId', { configurable: true, value: 73 });
      return event;
    };
    face.dispatchEvent(pointer('pointerdown', 1, 1));
    root.dispatchEvent(pointer('pointermove', 20, 20));
    root.dispatchEvent(pointer('pointerup', 20, 20));
  } finally {
    if (original) Object.defineProperty(document, 'elementFromPoint', original);
    else Reflect.deleteProperty(document, 'elementFromPoint');
  }
}

describe('Gameplay B Strategy Park map UI', () => {
  let game: GameInstance | undefined;
  let controller: UIController | undefined;

  function acquireStudents(): void {
    for (const variantId of ['Hoshino', 'Serika', 'Shiroko']) game!.mutations.acquireCharacter(variantId, 'story');
  }

  afterEach(() => {
    controller?.destroy();
    controller = undefined;
    if (game?.running) game.stop();
    game = undefined;
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('shows all 13 read-only map locations and styles current exits while route buttons still use Runtime commands', () => {
    localStorage.clear();
    document.body.innerHTML = '<div id="app"></div>';
    game = createAppRuntime();
    game.init([defaultDatapack, gameplayBCarouselDatapack, gameplayBStrategyParkDatapack], { enterDefaultInit: true });
    acquireStudents();
    const root = document.querySelector<HTMLElement>('#app')!;
    controller = new UIController(game, root);
    controller.started = true;
    controller.render();

    root.querySelector<HTMLButtonElement>(`[data-operation-start="${PARK_IDS.event}"]`)!.click();
    let map = root.querySelector<HTMLElement>('[data-operation-strategy-park-map]')!;
    expect(root.querySelectorAll('[data-operation-opponent]')).toHaveLength(0);
    expect(root.querySelectorAll('[data-operation-environment-actor]')).toHaveLength(0);
    expect(map.querySelectorAll('[data-operation-map-node]')).toHaveLength(13);
    expect(map.querySelectorAll('[data-operation-map-area]')).toHaveLength(2);
    expect(map.querySelector('[data-map-location-id="' + PARK_IDS.locations.control + '"]')?.textContent).toContain('地下设备层控制室');
    expect(map.querySelector<HTMLElement>('[data-map-location-id="' + PARK_IDS.locations.westGate + '"]')?.dataset.mapStatus).toBe('current');
    expect(map.querySelectorAll('[data-map-status="unvisited"]')).toHaveLength(12);
    expect(map.querySelector('[data-operation-map-edge="' + PARK_IDS.routes.gateToCorridor + '"]')?.getAttribute('data-edge-availability')).toBe('locked');
    expect(map.querySelector('[data-operation-map-blocked-exit]')).toBeNull();
    expect(map.querySelectorAll('[data-operation-route]')).toHaveLength(0);

    for (let tries = 0; tries < 10 && game.operationEntry.getView()?.currentLocationId !== PARK_IDS.locations.kiosk; tries++) {
      const view = game.operationEntry.getView()!;
      if (view.locationProgress[view.currentLocationId]?.completed) {
        const routeId = view.currentLocationId === PARK_IDS.locations.westGate
          ? PARK_IDS.routes.gateToCorridor
          : PARK_IDS.routes.corridorToKiosk;
        root.querySelector<HTMLButtonElement>('[data-operation-route][data-route-id="' + routeId + '"]')!.click();
      } else {
        root.querySelector<HTMLButtonElement>('[data-operation-scene-submit]')!.click();
      }
    }
    expect(game.operationEntry.getView()?.currentLocationId).toBe(PARK_IDS.locations.kiosk);
    root.querySelector<HTMLButtonElement>('[data-operation-scene-submit]')!.click();
    expect(game.operationEntry.getView()?.currentLocationId).toBe(PARK_IDS.locations.kiosk);
    map = root.querySelector<HTMLElement>('[data-operation-strategy-park-map]')!;
    expect(map.querySelector<HTMLElement>('[data-map-location-id="' + PARK_IDS.locations.kiosk + '"]')?.dataset.mapStatus).toBe('current');
    expect(map.querySelector<HTMLElement>('[data-map-location-id="' + PARK_IDS.locations.westGate + '"]')?.dataset.mapStatus).toBe('visited');
    expect(game.operationEntry.getView()?.currentRoutes.map(route => route.routeId)).toEqual([PARK_IDS.routes.kioskToArcade, PARK_IDS.routes.kioskToAid]);
    expect(game.operationEntry.getView()?.map.edges.find(edge => edge.routeId === PARK_IDS.routes.kioskToArcade))
      .toMatchObject({ sourceLocationId: PARK_IDS.locations.kiosk, available: true, lockedReason: null });
    expect(map.querySelector('[data-operation-map-edge="' + PARK_IDS.routes.kioskToArcade + '"]')?.getAttribute('data-edge-availability')).toBe('available');
    expect(map.querySelector('[data-operation-map-edge="' + PARK_IDS.routes.kioskToAid + '"]')?.getAttribute('data-edge-availability')).toBe('available');
    const branchButton = root.querySelector<HTMLButtonElement>('[data-operation-route][data-route-id="' + PARK_IDS.routes.kioskToAid + '"]')!;
    expect(branchButton.disabled).toBe(false);
    branchButton.click();
    expect(game.operationEntry.getView()?.currentLocationId).toBe(PARK_IDS.locations.aid);
    expect(root.querySelector<HTMLElement>('[data-map-location-id="' + PARK_IDS.locations.aid + '"]')?.dataset.mapStatus).toBe('current');
  });

  it('does not show the Strategy Park map for the separate Carousel Operation', () => {
    localStorage.clear();
    document.body.innerHTML = '<div id="app"></div>';
    game = createAppRuntime();
    game.init([defaultDatapack, gameplayBCarouselDatapack, gameplayBStrategyParkDatapack], { enterDefaultInit: true });
    acquireStudents();
    const root = document.querySelector<HTMLElement>('#app')!;
    controller = new UIController(game, root);
    controller.started = true;
    controller.render();
    root.querySelector<HTMLButtonElement>('[data-operation-start="' + CAROUSEL_IDS.event + '"]')!.click();
    expect(root.querySelector('[data-operation-strategy-park-map]')).toBeNull();
  });

  it('opens the existing map popup from the lower-right Toast', () => {
    localStorage.clear();
    document.body.innerHTML = '<div id="app"></div>';
    game = createAppRuntime();
    game.init([defaultDatapack, gameplayBCarouselDatapack, gameplayBStrategyParkDatapack], { enterDefaultInit: true });
    acquireStudents();
    const root = document.querySelector<HTMLElement>('#app')!;
    controller = new UIController(game, root);
    controller.started = true;
    const runId = game.operationEntry.start(PARK_IDS.event, [Character.Hoshino, Character.Serika, Character.Shiroko]).runId;
    controller.panelState.workspace = { type: 'operation', runId };
    controller.render();

    const toast = root.querySelector<HTMLButtonElement>('[data-operation-map-toast-open]')!;
    const popup = root.querySelector<HTMLElement>('[data-operation-map-popup]')!;
    expect(toast.hidden).toBe(false);
    expect(popup.hidden).toBe(true);
    toast.click();
    expect(popup.hidden).toBe(false);
    expect(popup.querySelectorAll('[data-operation-map-node]')).toHaveLength(13);
    expect(toast.hidden).toBe(true);
    popup.querySelector<HTMLButtonElement>('[data-operation-map-popup-close]')!.click();
    expect(popup.hidden).toBe(true);
    expect(toast.hidden).toBe(false);
    expect(document.activeElement).toBe(toast);
  });

  it('keeps the popup and three columns stable while switching views, opening the map, and refreshing a stage', () => {
    localStorage.clear();
    document.body.innerHTML = '<div id="app"></div>';
    game = createAppRuntime();
    game.init([defaultDatapack, gameplayBCarouselDatapack, gameplayBStrategyParkDatapack], { enterDefaultInit: true });
    acquireStudents();
    const root = document.querySelector<HTMLElement>('#app')!;
    controller = new UIController(game, root);
    controller.started = true;
    controller.render();
    root.querySelector<HTMLButtonElement>('[data-operation-start="' + PARK_IDS.event + '"]')!.click();

    const left = root.querySelector<HTMLElement>('[data-workspace-column="left"]')!;
    const center = root.querySelector<HTMLElement>('[data-workspace-column="center"]')!;
    const right = root.querySelector<HTMLElement>('[data-workspace-column="right"]')!;
    const leftColumnBody = left.querySelector<HTMLElement>('.workspace-column__body')!;
    const rightColumnBody = right.querySelector<HTMLElement>('.workspace-column__body')!;
    const student = root.querySelector<HTMLElement>('[data-operation-student]')!;
    const log = root.querySelector<HTMLElement>('[data-operation-log]')!;
    const popup = root.querySelector<HTMLElement>('[data-operation-map-popup]')!;
    const mapCard = root.querySelector<HTMLElement>('[data-operation-map-intro]')!;
    const opener = root.querySelector<HTMLButtonElement>('[data-operation-map-open]')!;
    const toast = root.querySelector<HTMLButtonElement>('[data-operation-map-toast-open]')!;
    const beforeLocalInteractions = controller.getRefreshStats();
    expect(popup.hidden).toBe(true);
    expect(mapCard.hidden).toBe(false);
    expect(toast.hidden).toBe(false);
    expect(leftColumnBody.dataset.scroll).toBe('none');
    expect(rightColumnBody.dataset.scroll).toBe('none');
    expect(leftColumnBody.querySelector('[data-scroll-owner="content-region"]')).toBe(root.querySelector('[data-operation-party]'));
    expect(rightColumnBody.querySelector('[data-scroll-owner="content-region"]')).toBe(root.querySelector('[data-operation-right-view="enemies"]'));
    expect(leftColumnBody.querySelector('[data-scroll-owner="content-region"]')?.contains(leftColumnBody.querySelector('.workspace-column__header'))).toBe(false);
    expect(rightColumnBody.querySelector('[data-scroll-owner="content-region"]')?.contains(rightColumnBody.querySelector('.workspace-column__header'))).toBe(false);

    const backgroundTab = root.querySelector<HTMLButtonElement>('[data-operation-right-tab="background"]')!;
    backgroundTab.click();
    expect(backgroundTab.getAttribute('aria-selected')).toBe('true');
    expect(root.querySelector('[data-operation-right-view="background"]')?.hasAttribute('hidden')).toBe(false);
    expect(root.querySelector('[data-workspace-column="left"]')).toBe(left);
    expect(root.querySelector('[data-workspace-column="center"]')).toBe(center);
    expect(root.querySelector('[data-workspace-column="right"]')).toBe(right);
    expect(controller.getRefreshStats()).toMatchObject({
      fullRenders: beforeLocalInteractions.fullRenders,
      regionRefreshes: beforeLocalInteractions.regionRefreshes,
      workspaceRenders: beforeLocalInteractions.workspaceRenders,
    });

    opener.click();
    expect(popup.hidden).toBe(false);
    const handle = popup.querySelector<HTMLElement>('[data-operation-map-drag-handle]')!;
    handle.focus();
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    expect(root.querySelector('[data-operation-map-popup]')).toBe(popup);
    expect(controller.getRefreshStats()).toMatchObject({
      fullRenders: beforeLocalInteractions.fullRenders,
      regionRefreshes: beforeLocalInteractions.regionRefreshes,
      workspaceRenders: beforeLocalInteractions.workspaceRenders,
    });

    const current = game.operationEntry.getView()!;
    const anotherLocation = Object.keys(current.map.nodes).length > 0
      ? current.map.nodes.find(node => node.locationId !== current.currentLocationId)?.locationId
      : undefined;
    expect(anotherLocation).toBeDefined();
    controller.requestOperationWorkspaceRefresh({ ...current, currentLocationId: anotherLocation! }, null);

    expect(root.querySelector('[data-operation-student]')).toBe(student);
    expect(root.querySelector('[data-operation-log]')).toBe(log);
    expect(root.querySelector('[data-operation-map-intro]')).toBe(mapCard);
    expect(root.querySelector('[data-operation-map-popup]')).toBe(popup);
    expect(root.querySelector('[data-operation-right-tab="enemies"]')?.getAttribute('aria-selected')).toBe('true');

    mapCard.querySelector<HTMLButtonElement>('[data-operation-map-card-close]')!.click();
    expect(mapCard.hidden).toBe(true);
    controller.requestOperationWorkspaceRefresh({ ...current, currentLocationId: anotherLocation! }, null);
    expect(root.querySelector('[data-operation-map-intro]')).toBeNull();
    expect(root.querySelector('[data-operation-map-popup]')).toBe(popup);

    popup.querySelector<HTMLButtonElement>('[data-operation-map-popup-close]')!.click();
    expect(popup.hidden).toBe(true);
    expect(document.activeElement).toBe(opener);

    toast.click();
    expect(popup.hidden).toBe(false);
    expect(toast.hidden).toBe(true);
    popup.querySelector<HTMLButtonElement>('[data-operation-map-popup-close]')!.click();
    expect(popup.hidden).toBe(true);
    expect(toast.hidden).toBe(false);
    expect(document.activeElement).toBe(toast);
  });

  it('追踪车轮印可点击打开行内执行者选择器，也可拖拽分配学生', () => {
    localStorage.clear();
    document.body.innerHTML = '<div id="app"></div>';
    game = createAppRuntime();
    game.init([defaultDatapack, gameplayBStrategyParkDatapack], { enterDefaultInit: true });
    acquireStudents();
    const root = document.querySelector<HTMLElement>('#app')!;
    controller = new UIController(game, root);
    controller.started = true;
    controller.render();
    root.querySelector<HTMLButtonElement>('[data-operation-start="' + PARK_IDS.event + '"]')!.click();
    const brief = root.querySelector<HTMLButtonElement>('[data-operation-scene-choice][data-scene-action-id="' + PARK_IDS.sceneActions.brief + '"]')!;
    brief.click();
    root.querySelector<HTMLButtonElement>('[data-operation-scene-submit]')!.click();
    root.querySelector<HTMLButtonElement>('[data-operation-route][data-route-id="' + PARK_IDS.routes.gateToCorridor + '"]')!.click();
    expect(game.operationEntry.getView()?.currentLocationId).toBe(PARK_IDS.locations.corridor);

    const tracks = root.querySelector<HTMLButtonElement>('[data-operation-scene-choice][data-scene-action-id="' + PARK_IDS.sceneActions.tracks + '"]')!;
    expect(tracks.textContent).toContain('追踪车轮印');
    expect(tracks.getAttribute('aria-pressed')).toBe('false');
    tracks.click();
    expect(root.querySelector('[data-operation-card-choice-tray]')).toBeNull();
    expect(tracks.getAttribute('aria-pressed')).toBe('true');
    expect(tracks.closest('[data-operation-scene-option]')?.querySelector<HTMLDetailsElement>('[data-operation-performer-picker]')?.open).toBe(true);
    dragSceneCardToStudent(root, tracks, PARK_IDS.actors.hoshino);
    const attached = root.querySelector<HTMLElement>('[data-operation-student="' + PARK_IDS.actors.hoshino + '"] [data-operation-scene-choice][aria-pressed="true"]')!;
    expect(attached.dataset.sceneActionId).toBe(PARK_IDS.sceneActions.tracks);
    expect(root.querySelector('[data-operation-card-choice-tray]')).toBeNull();
  });

  it('shows fixed scene inclusion as locked and keeps actorless selectable actions in the card flow', () => {
    game = createAppRuntime();
    game.init([defaultDatapack, gameplayBStrategyParkDatapack], { enterDefaultInit: true });
    acquireStudents();
    const runId = game.operationEntry.start(PARK_IDS.event, [Character.Hoshino, Character.Serika, Character.Shiroko]).runId;
    const view = game.operationEntry.getView(runId)!;
    const sample = view.currentSceneActions[0];
    expect(sample).toBeDefined();
    const fixed = {
      ...sample!, id: 'test:fixed-brief', title: '固定简报', description: '自动写入，不可撤销。', scope: 'global' as const,
      selectionPolicy: 'fixed' as const, performerPolicy: 'none' as const, eligibleActorIds: [],
      legalTargetActorIdsByActorId: {}, legalActorlessTargetActorIds: [],
    };
    const selectable = {
      ...sample!, id: 'test:actorless-choice', title: '现场直接处理', description: '无需学生代为执行。', scope: 'global' as const,
      selectionPolicy: 'required' as const, performerPolicy: 'none' as const, eligibleActorIds: [],
      legalTargetActorIdsByActorId: {}, legalActorlessTargetActorIds: [],
    };
    const syntheticView = { ...view, currentActionMode: 'global' as const, currentSceneActions: [fixed, selectable] };
    const host = document.createElement('div');
    host.innerHTML = renderOperationWorkspace(createUIContext(game), syntheticView);

    const fixedCard = host.querySelector<HTMLElement>('[data-operation-fixed-scene-action="test:fixed-brief"]');
    expect(fixedCard?.classList.contains('is-selected')).toBe(true);
    expect(fixedCard?.textContent).toContain('不可取消');
    expect(fixedCard?.textContent).toContain('固定简报');
    expect(host.querySelector('[data-operation-scene-choice][data-scene-action-id="test:fixed-brief"]')).toBeNull();
    const choice = host.querySelector<HTMLButtonElement>('[data-operation-scene-choice][data-scene-action-id="test:actorless-choice"]');
    expect(choice?.dataset.actorId).toBe('');
    expect(choice?.dataset.performerPolicy).toBe('none');
    expect(choice?.textContent).toContain('现场直接处理');
    expect(host.querySelector('.operation-card-type')).toBeNull();
  });

  it('shows Strategy Park credentials, local visit locks, and takeover text when a completed location has no open exit', () => {
    game = createAppRuntime();
    game.init([defaultDatapack, gameplayBStrategyParkDatapack], { enterDefaultInit: true });
    acquireStudents();
    const runId = game.operationEntry.start(PARK_IDS.event, [Character.Hoshino, Character.Serika, Character.Shiroko]).runId;
    const view = game.operationEntry.getView(runId)!;
    const ferrisToControl = view.currentRoutes[0];
    const mapView = {
      ...view,
      currentLocationId: PARK_IDS.locations.ferris,
      locationProgress: {
        ...view.locationProgress,
        [PARK_IDS.locations.ferris]: { visitCount: 1, completed: true, beatCount: 1, result: null },
      },
      currentRoutes: [{
        ...ferrisToControl,
        routeId: PARK_IDS.routes.ferrisToControl,
        targetLocationId: PARK_IDS.locations.control,
        label: '进入地下设备层控制室',
        available: false,
        lockedReason: 'operation:route:any-of-held-items-missing',
        requiredHeldItemId: null,
        anyOfHeldItemIds: [PARK_IDS.items.maintenancePass, PARK_IDS.items.staffRadio],
      }],
      map: {
        nodes: view.map.nodes.map(node => ({ ...node, current: node.locationId === PARK_IDS.locations.ferris,
          visited: node.visited || node.locationId === PARK_IDS.locations.ferris, completed: node.completed || node.locationId === PARK_IDS.locations.ferris })),
        edges: view.map.edges.map(edge => edge.routeId === PARK_IDS.routes.ferrisToControl
          ? { ...edge, available: false, lockedReason: 'operation:route:any-of-held-items-missing' }
          : { ...edge, available: null, lockedReason: null }),
      },
    };
    const host = document.createElement('div');
    host.innerHTML = renderOperationWorkspace(createUIContext(game), mapView);
    expect(host.querySelector('[data-operation-route-requirement]')?.textContent).toBe('需要其一：维修通行证 / 员工广播凭证');
    expect(host.querySelector('[data-operation-routes]')?.textContent).toContain('需要至少一种所列凭证才能通过。');
    expect(host.querySelector('[data-operation-map-edge="' + PARK_IDS.routes.ferrisToControl + '"]')?.getAttribute('aria-label'))
      .toContain('需要其一：维修通行证 / 员工广播凭证');
    expect(host.querySelector('[data-operation-map-blocked-exit]')?.textContent).toBe('检修廊出口关闭；园区广播通知全员就地待援。');
  });
});
