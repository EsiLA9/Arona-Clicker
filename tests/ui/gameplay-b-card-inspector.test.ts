// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createAppRuntime } from '../../src/app/runtime-bootstrap';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
import { CAROUSEL_SCENE_ACTION_IDS } from '../../src/arona-clicker/content/operation-samples/carousel-scene-action-slice';
import { gameplayBCarouselDatapack } from '../../src/arona-clicker/content/operation-samples/gameplay-b-datapack';
import { CAROUSEL_SAFETY_IDS } from '../../src/arona-clicker/content/operation-samples/carousel-safety-ids';
import type { SaveData } from '../../src/arona-clicker/contracts/save-data';
import type { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { SaveSystem } from '../../src/data-services/persistence/storage';
import { UIController } from '../../src/ui/controller';
import {
  mountGameplayBCardInspector,
  shouldMountGameplayBCardInspector,
  type GameplayBCardInspectorMount,
} from '../../src/ui/development/gameplay-b-card-inspector';

describe('Gameplay B card inspector entry', () => {
  let game: GameInstance | null = null;
  let controller: UIController | null = null;
  let inspector: GameplayBCardInspectorMount | null = null;

  afterEach(() => {
    inspector?.destroy();
    inspector = null;
    controller?.destroy();
    controller = null;
    if (game?.running) game.stop();
    game = null;
    localStorage.clear();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  test('mount gate requires both a development build and the explicit query value', () => {
    expect(shouldMountGameplayBCardInspector(false, '?gameplayBCardInspector=1')).toBe(false);
    expect(shouldMountGameplayBCardInspector(true, '')).toBe(false);
    expect(shouldMountGameplayBCardInspector(true, '?gameplayBCardInspector=true')).toBe(false);
    expect(shouldMountGameplayBCardInspector(true, '?gameplayBCardInspector=1')).toBe(true);
    expect(shouldMountGameplayBCardInspector(true, '?other=1&gameplayBCardInspector=1')).toBe(true);
  });

  function createPrimaryFixture(): { game: GameInstance; controller: UIController; root: HTMLElement } {
    document.body.innerHTML = '<div id="app"></div>';
    game = createAppRuntime();
    game.init([defaultDatapack, gameplayBCarouselDatapack], { enterDefaultInit: true });
    const root = document.querySelector<HTMLElement>('#app')!;
    controller = new UIController(game, root);
    controller.started = true;
    controller.render();
    return { game, controller, root };
  }

  test('runs the official sample in an isolated Runtime and keeps a pre-existing SaveData unchanged when the real save UI is used', () => {
    const primary = createPrimaryFixture();
    const { game, controller, root } = primary;
    game.mutations.acquireCharacter('Hoshino', 'gacha');
    controller.render();
    controller.navigateToService('saves');
    controller.render();

    const baseline = controller.withHistories(controller.commands.save());
    expect(SaveSystem.save(baseline)).toBe(true);
    const baselineSerialized = SaveSystem.export();
    expect(baselineSerialized).not.toBeNull();
    const baselineData = SaveSystem.load<SaveData>()!;
    const existingHoshino = structuredClone(game.state.roster?.Hoshino);

    inspector = mountGameplayBCardInspector();
    expect(SaveSystem.export()).toBe(baselineSerialized);
    document.querySelector<HTMLButtonElement>('[data-gameplay-b-card-inspector] button')!.click();

    const overlay = document.querySelector<HTMLElement>('[data-gameplay-b-card-inspector-surface]');
    const operationRoot = overlay?.querySelector<HTMLElement>('[data-gameplay-b-card-inspector-operation-root]');
    expect(overlay).not.toBeNull();
    expect(operationRoot?.querySelector('[data-workspace-frame="operation"]')).not.toBeNull();
    expect(overlay?.querySelector('.topbar')).toBeNull();
    expect(overlay?.querySelector('#save-game')).toBeNull();
    expect(overlay?.querySelector('[data-operation-back]')).toBeNull();
    const commit = operationRoot?.querySelector<HTMLButtonElement>('[data-operation-commit]');
    expect(commit).not.toBeNull();
    const inspectorRunId = commit!.dataset.runId;
    expect(inspectorRunId).toBeTruthy();
    expect(operationRoot?.querySelector('[data-operation-student]')).not.toBeNull();
    expect(game.operationEntry.getView()).toBeNull();
    expect(game.state.roster?.Hoshino).toEqual(existingHoshino);
    expect(game.state.roster?.Serika).toBeUndefined();
    expect(game.state.roster?.Shiroko).toBeUndefined();
    expect(SaveSystem.export()).toBe(baselineSerialized);

    // Continue through the isolated formal Run to verify its real Individual / hand / target / Global surfaces.
    operationRoot!.querySelector<HTMLButtonElement>(
      `[data-operation-action][data-action-id="${CAROUSEL_SAFETY_IDS.actions.emergencyStop}"]`,
    )!.click();
    operationRoot!.querySelector<HTMLButtonElement>('[data-operation-commit]')!.click();
    expect(operationRoot!.querySelectorAll('[data-operation-scene-card][data-actor-id]')).toHaveLength(3);
    expect(overlay!.querySelector('.topbar')).toBeNull();
    expect(overlay!.querySelector('#save-game')).toBeNull();
    expect(operationRoot!.querySelector('[data-operation-player-hand]')).not.toBeNull();
    expect(operationRoot!.querySelector('[data-operation-player-card]')).not.toBeNull();
    expect(operationRoot!.querySelector('[data-operation-card-target]')).not.toBeNull();

    operationRoot!.querySelector<HTMLButtonElement>('[data-operation-scene-submit]')!.click();
    operationRoot!.querySelector<HTMLButtonElement>(
      `[data-operation-route][data-route-id="${CAROUSEL_SCENE_ACTION_IDS.routes.staffGate}"]`,
    )!.click();
    expect(operationRoot!.querySelector('[data-global-scene-card]')).not.toBeNull();
    expect(overlay!.querySelector('.topbar')).toBeNull();
    expect(overlay!.querySelector('#save-game')).toBeNull();
    expect(operationRoot!.querySelector('[data-operation-player-hand]')).not.toBeNull();
    expect(operationRoot!.querySelector('[data-operation-card-target]')).not.toBeNull();

    // Exercise the existing primary Game Save button while the isolated Run is open.
    const saveButton = root.querySelector<HTMLButtonElement>('#save-game');
    expect(saveButton).not.toBeNull();
    vi.spyOn(Date, 'now').mockReturnValue(baselineData.timestamp);
    saveButton!.click();
    const afterSave = SaveSystem.load<SaveData>()!;
    expect(SaveSystem.export()).toBe(baselineSerialized);
    expect(afterSave).toEqual(baselineData);
    expect(afterSave.operationRun?.run.runId).not.toBe(inspectorRunId);
    expect(afterSave.playerState.roster?.Serika).toBeUndefined();
    expect(afterSave.playerState.roster?.Shiroko).toBeUndefined();
    expect(game.operationEntry.getView()).toBeNull();
    overlay!.querySelector<HTMLButtonElement>('[data-gameplay-b-card-inspector-close]')!.click();
    expect(document.querySelector('[data-gameplay-b-card-inspector-surface]')).toBeNull();
    expect(SaveSystem.export()).toBe(baselineSerialized);
  });

  test('closing the inspector discards its temporary Runtime; reopening creates a fresh Run', () => {
    createPrimaryFixture();
    inspector = mountGameplayBCardInspector();
    const launcher = document.querySelector<HTMLButtonElement>('[data-gameplay-b-card-inspector] button')!;
    launcher.click();
    const firstRunId = document.querySelector<HTMLElement>('[data-operation-commit]')?.dataset.runId;
    expect(firstRunId).toBeTruthy();

    document.querySelector<HTMLButtonElement>('[data-gameplay-b-card-inspector-close]')!.click();
    expect(document.querySelector('[data-gameplay-b-card-inspector-surface]')).toBeNull();
    expect(launcher.disabled).toBe(false);
    launcher.click();
    const nextRunId = document.querySelector<HTMLElement>('[data-operation-commit]')?.dataset.runId;
    expect(nextRunId).toBeTruthy();
    expect(nextRunId).not.toBe(firstRunId);
    expect(game?.operationEntry.getView()).toBeNull();
  });

  test('Operation 消费的 Escape 只关闭局部牌面交互；退出按钮与未消费 Escape 仍退出检查器', () => {
    createPrimaryFixture();
    inspector = mountGameplayBCardInspector();
    const launcher = document.querySelector<HTMLButtonElement>('[data-gameplay-b-card-inspector] button')!;
    launcher.click();

    let overlay = document.querySelector<HTMLElement>('[data-gameplay-b-card-inspector-surface]')!;
    const operationRoot = overlay.querySelector<HTMLElement>('[data-gameplay-b-card-inspector-operation-root]')!;
    const currentFace = operationRoot.querySelector<HTMLButtonElement>(
      '[data-operation-action-current-toggle], [data-operation-action-current][aria-pressed="true"]',
    )!;
    currentFace.click();
    expect(currentFace.getAttribute('aria-expanded')).toBe('true');

    const consumedEscape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    currentFace.dispatchEvent(consumedEscape);
    expect(consumedEscape.defaultPrevented).toBe(true);
    expect(currentFace.getAttribute('aria-expanded')).toBe('false');
    expect(overlay.isConnected).toBe(true);

    overlay.querySelector<HTMLButtonElement>('[data-gameplay-b-card-inspector-close]')!.click();
    expect(document.querySelector('[data-gameplay-b-card-inspector-surface]')).toBeNull();

    launcher.click();
    overlay = document.querySelector<HTMLElement>('[data-gameplay-b-card-inspector-surface]')!;
    const unconsumedEscape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    overlay.dispatchEvent(unconsumedEscape);
    expect(unconsumedEscape.defaultPrevented).toBe(true);
    expect(document.querySelector('[data-gameplay-b-card-inspector-surface]')).toBeNull();
  });
});
