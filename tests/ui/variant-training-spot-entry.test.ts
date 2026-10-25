// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createAppRuntime } from '../../src/app/runtime-bootstrap';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
import type { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { UIController } from '../../src/ui/controller/controller';

const SPOT_ID = 'base:spot:variant_training';
const FUNCTIONALITY_ID = 'base:funclet:variant_training_entry';

describe('formal Variant training Spot entry', () => {
  let game: GameInstance | null = null;
  let controller: UIController | null = null;

  afterEach(() => {
    controller?.destroy();
    controller = null;
    if (game?.running) game.stop();
    game = null;
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  function boot(): { game: GameInstance; controller: UIController; root: HTMLElement } {
    document.body.innerHTML = '<div id="app"></div>';
    game = createAppRuntime();
    game.init([defaultDatapack], { enterDefaultInit: true });
    const root = document.querySelector<HTMLElement>('#app')!;
    controller = new UIController(game, root);
    controller.started = true;
    controller.render();
    return { game, controller, root };
  }

  function acquireTrainingSpot(root: HTMLElement): HTMLButtonElement {
    const acquire = root.querySelector<HTMLButtonElement>(`[data-ui-spot-card="${SPOT_ID}"] [data-upgrade="${SPOT_ID}"]`);
    if (!acquire) throw new Error('演练场 Spot 未显示在当前区域。');
    acquire.click();
    const entry = root.querySelector<HTMLButtonElement>(`[data-open-variant-training="${SPOT_ID}"]`);
    if (!entry) throw new Error('获取演练场后没有显示入口。');
    return entry;
  }

  function enterMap(root: HTMLElement): void {
    const entry = root.querySelector<HTMLButtonElement>(`[data-open-variant-training="${SPOT_ID}"]`);
    if (!entry) throw new Error('当前没有演练场入口。');
    entry.click();
  }

  function currentRoute(ctrl: UIController) {
    return ctrl.panelState.workspaceNavigation?.current;
  }

  function heroTitle(root: HTMLElement): string {
    return root.querySelector<HTMLElement>('[data-map-region-key="map-hero"] h1')?.textContent?.trim() ?? '';
  }

  test('one Spot click enters the real first battle without a training Modal or MapEntry', () => {
    const booted = boot();
    booted.game.mutations.acquireCharacter('Hoshino', 'story');
    const entry = acquireTrainingSpot(booted.root);
    const enterCommand = vi.spyOn(booted.controller.commands, 'enterVariantTraining');
    const rosterBefore = JSON.stringify(booted.game.state.roster ?? {});

    entry.click();

    const run = booted.game.mapRun.getSnapshot();
    expect(enterCommand).toHaveBeenCalledOnce();
    expect(enterCommand).toHaveBeenCalledWith(SPOT_ID, FUNCTIONALITY_ID);
    expect(run).not.toBeNull();
    expect(currentRoute(booted.controller)).toEqual({ kind: 'map', runId: run?.runId });
    expect(booted.root.querySelector('[data-workspace-frame="map"]')).not.toBeNull();
    expect(booted.root.querySelector('[data-map-entry-workspace]')).toBeNull();
    expect(document.querySelector('.app-modal')).toBeNull();
    expect(booted.controller.panelState.mapEntrySource).toBeUndefined();
    expect(heroTitle(booted.root)).toMatch(/第\s*1\s*\/\s*3\s*战/);
    expect(booted.root.querySelector('[data-map-region-key="action-dock"]')).not.toBeNull();
    expect(booted.root.querySelector('[data-map-encounter-region]')).not.toBeNull();
    expect(booted.root.querySelector('[data-map-hand-picker]')).not.toBeNull();
    expect(booted.root.querySelector('[data-map-action-swap], [data-map-player-command]')).not.toBeNull();
    expect(booted.root.querySelector('[data-map-target-enemy], [data-map-card-target]')).not.toBeNull();
    expect(booted.root.querySelector('[data-map-commit]')).not.toBeNull();
    expect(JSON.stringify(booted.game.state.roster ?? {})).toBe(rosterBefore);
  });

  test('domain rejection stays at the Spot and surfaces the command reason', () => {
    const booted = boot();
    const entry = acquireTrainingSpot(booted.root);
    const reason = new Error('未持有准确的 Hoshino Variant。');
    vi.spyOn(booted.controller.commands, 'enterVariantTraining').mockImplementation(() => { throw reason; });
    const toast = vi.spyOn(booted.controller.toast, 'show');
    const routeBefore = currentRoute(booted.controller);
    const rosterBefore = JSON.stringify(booted.game.state.roster ?? {});
    const resourcesBefore = JSON.stringify(booted.game.state.resources);

    entry.click();

    expect(toast).toHaveBeenCalledWith(reason.message, 'error');
    expect(currentRoute(booted.controller)).toEqual(routeBefore);
    expect(booted.root.querySelector('[data-workspace-frame="map"]')).toBeNull();
    expect(document.querySelector('.app-modal')).toBeNull();
    expect(JSON.stringify(booted.game.state.roster ?? {})).toBe(rosterBefore);
    expect(JSON.stringify(booted.game.state.resources)).toBe(resourcesBefore);
  });

  test('fast Spot validation stops an unavailable function before invoking the domain command', () => {
    const booted = boot();
    const entry = acquireTrainingSpot(booted.root);
    const enterCommand = vi.spyOn(booted.controller.commands, 'enterVariantTraining');
    vi.spyOn(booted.game.spotFunctionalitySystem, 'functionalitiesOf').mockReturnValue([]);
    const toast = vi.spyOn(booted.controller.toast, 'show');

    entry.click();

    expect(enterCommand).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('演练场功能当前不可用，请检查设施状态。', 'error');
    expect(currentRoute(booted.controller)?.kind).not.toBe('map');
    expect(booted.root.querySelector('[data-workspace-frame="map"]')).toBeNull();
  });

  test('return goes straight to the Spot and the next click resumes the same MapRun', () => {
    const booted = boot();
    booted.game.mutations.acquireCharacter('Hoshino', 'story');
    acquireTrainingSpot(booted.root);
    enterMap(booted.root);
    const runId = booted.game.mapRun.getSnapshot()?.runId;
    expect(runId).toBeTruthy();
    expect(currentRoute(booted.controller)).toEqual({ kind: 'map', runId });

    booted.root.querySelector<HTMLButtonElement>('[data-map-back-to-entry]')!.click();

    expect(currentRoute(booted.controller)?.kind).not.toBe('map-entry');
    expect(currentRoute(booted.controller)?.kind).not.toBe('map');
    expect(booted.root.querySelector('[data-workspace-frame="map"]')).toBeNull();
    expect(booted.root.querySelector(`[data-open-variant-training="${SPOT_ID}"]`)).not.toBeNull();

    enterMap(booted.root);

    expect(currentRoute(booted.controller)).toEqual({ kind: 'map', runId });
    expect(booted.game.mapRun.getSnapshot()?.runId).toBe(runId);
    expect(heroTitle(booted.root)).toMatch(/第\s*1\s*\/\s*3\s*战/);
  });

  test('restart stays on the direct Map route and returns to the first battle', () => {
    const booted = boot();
    booted.game.mutations.acquireCharacter('Hoshino', 'story');
    acquireTrainingSpot(booted.root);
    enterMap(booted.root);

    booted.root.querySelector<HTMLButtonElement>('[data-map-restart]')!.click();
    document.querySelector<HTMLButtonElement>('[data-modal-action="restart-map-run"]')!.click();

    expect(currentRoute(booted.controller)?.kind).toBe('map');
    expect(booted.controller.panelState.mapEntrySource).toBeUndefined();
    expect(heroTitle(booted.root)).toMatch(/第\s*1\s*\/\s*3\s*战/);
    expect(booted.root.querySelector('[data-map-region-key="action-dock"]')).not.toBeNull();
    expect(booted.controller.modal.isOpen()).toBe(false);
    expect(document.querySelector('[data-modal-action="restart-map-run"]')).toBeNull();
  });
});
