// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest';
import { createAppRuntime } from '../../src/app/runtime-bootstrap';
import { gameplayBMapDatapack } from '../../src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
import type { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { UIController } from '../../src/ui/controller/controller';
import {
  applyGameplayBQuickTestMapOperations,
  interpretGameplayBQuickTestCommand,
  interpretGameplayBQuickTestConsoleCommand,
  mountGameplayBQuickTestConsole,
} from '../../src/ui/development/gameplay-b-quick-test-console';

describe('Gameplay B local quick-test command', () => {
  let game: GameInstance | null = null;
  let controller: UIController | null = null;

  afterEach(() => {
    controller?.destroy();
    controller = null;
    if (game?.running) game.stop();
    game = null;
    document.body.innerHTML = '';
  });

  test('interprets the Chinese sample command and de-duplicates aliases', () => {
    expect(interpretGameplayBQuickTestCommand('获得角色 星野，Serika 白子 星野')).toEqual({
      ok: true,
      variantIds: ['Hoshino', 'Serika', 'Shiroko'],
    });
  });

  test('accepts the explicit English command form', () => {
    expect(interpretGameplayBQuickTestCommand('grant characters: Hoshino Serika Shiroko')).toEqual({
      ok: true,
      variantIds: ['Hoshino', 'Serika', 'Shiroko'],
    });
  });

  test('rejects empty lists, unknown students, and non-allowlisted commands', () => {
    expect(interpretGameplayBQuickTestCommand('获得角色')).toMatchObject({ ok: false });
    expect(interpretGameplayBQuickTestCommand('获得角色 白老师')).toMatchObject({ ok: false });
    expect(interpretGameplayBQuickTestCommand('window.game.mutations.acquireCharacter()')).toMatchObject({ ok: false });
  });

  test('parses strict three-part getValue IDs and integer amounts only', () => {
    expect(interpretGameplayBQuickTestConsoleCommand('getValue base:resource:credit 25')).toEqual({
      ok: true,
      kind: 'getValue',
      modId: 'base',
      typeId: 'resource',
      itemId: 'credit',
      valueNum: 25,
      valueNumProvided: true,
    });
    expect(interpretGameplayBQuickTestConsoleCommand('getValue base:spot:credit_printer')).toMatchObject({
      ok: true,
      kind: 'getValue',
      valueNum: 1,
      valueNumProvided: false,
    });
    for (const input of [
      'getValue base:resource',
      'getValue base:resource:credit:extra',
      'getValue :resource:credit',
      'getValue base:resource:credit -1',
      'getValue base:resource:credit 1.5',
      'getValue base:resource:credit 1 extra',
    ]) {
      expect(interpretGameplayBQuickTestConsoleCommand(input)).toMatchObject({ ok: false });
    }
  });

  test('parses only complete, safe Map IDs for quick launch', () => {
    expect(interpretGameplayBQuickTestConsoleCommand('startMap gameplay-b:map:autonomous-target-battle')).toEqual({
      ok: true,
      kind: 'startMap',
      mapId: 'gameplay-b:map:autonomous-target-battle',
      enterOffice: false,
    });
    expect(interpretGameplayBQuickTestConsoleCommand('startMap gameplay-b:map:autonomous-target-battle --enter-office')).toEqual({
      ok: true,
      kind: 'startMap',
      mapId: 'gameplay-b:map:autonomous-target-battle',
      enterOffice: true,
    });
    for (const input of [
      'startMap',
      'startMap gameplay-b:map',
      'startMap gameplay-b:area:schale',
      'startMap gameplay-b:map:bad/id',
      'startMap gameplay-b:map:valid extra',
      'startMap gameplay-b:map:valid --unknown',
      'startMap gameplay-b:map:valid --enter-office extra',
    ]) {
      expect(interpretGameplayBQuickTestConsoleCommand(input)).toMatchObject({ ok: false });
    }
  });

  test('parses a bounded sequence of Map entry, movement, ability, target, and round operations', () => {
    expect(interpretGameplayBQuickTestConsoleCommand(
      'startMap gameplay-b:map:damage-reduction-example --commit-rounds 4 --target-party serika --ability cover-serika --move-to practice --enter-office',
    )).toEqual({
      ok: true,
      kind: 'startMap',
      mapId: 'gameplay-b:map:damage-reduction-example',
      enterOffice: true,
      operations: {
        moveTo: 'practice',
        abilityId: 'cover-serika',
        abilityTarget: { kind: 'partyCharacter', characterId: 'serika' },
        commitRounds: 4,
      },
    });
    expect(interpretGameplayBQuickTestConsoleCommand(
      'startMap gameplay-b:map:damage-reduction-example --ability training-shot --target-enemy training-robot',
    )).toMatchObject({
      ok: true,
      operations: { abilityId: 'training-shot', abilityTarget: { kind: 'enemy', enemyId: 'training-robot' } },
    });
    for (const input of [
      'startMap gameplay-b:map:damage-reduction-example --move-to',
      'startMap gameplay-b:map:damage-reduction-example --target-party serika',
      'startMap gameplay-b:map:damage-reduction-example --commit-rounds 0',
      'startMap gameplay-b:map:damage-reduction-example --commit-rounds 21',
      'startMap gameplay-b:map:damage-reduction-example --commit-rounds 2 --commit-rounds 3',
      'startMap gameplay-b:map:damage-reduction-example --unknown',
    ]) {
      expect(interpretGameplayBQuickTestConsoleCommand(input)).toMatchObject({ ok: false });
    }
  });

  test('applies resource, character, and Spot commands through their mutation paths', () => {
    game = createAppRuntime();
    game.init([defaultDatapack, gameplayBMapDatapack], { enterDefaultInit: true });
    let refreshes = 0;
    mountGameplayBQuickTestConsole(game, () => { refreshes += 1; });
    const command = document.querySelector<HTMLTextAreaElement>('#gameplay-b-test-console-command')!;
    const run = document.querySelector<HTMLButtonElement>('[data-test-console-run]')!;
    const result = document.querySelector<HTMLElement>('[data-test-console-result]')!;

    const creditId = 'base:resource:credit';
    const previousCredits = game.state.resources[creditId] ?? 0;
    command.value = 'getValue base:resource:credit 25';
    run.click();
    expect(game.state.resources[creditId]).toBe(previousCredits + 25);
    expect(result.textContent).toContain('信用点 +25');

    command.value = 'getValue base:chara:Hoshino';
    run.click();
    expect(game.state.roster?.Hoshino).toBeDefined();
    expect(result.textContent).toContain('本次获得：小鸟游星野');

    const spotId = 'base:spot:credit_printer';
    const previousSpotLevel = game.state.spotLevels[spotId] ?? 0;
    command.value = 'getValue base:spot:credit_printer';
    run.click();
    expect(game.state.spotLevels[spotId]).toBe(previousSpotLevel + 1);
    expect(result.textContent).toContain(`Lv.${previousSpotLevel} → Lv.${previousSpotLevel + 1}`);
    expect(refreshes).toBe(3);
  });

  test('rejects foreign owners, unsupported types, and non-stackable counts without partial writes', () => {
    game = createAppRuntime();
    game.init([defaultDatapack, gameplayBMapDatapack], { enterDefaultInit: true });
    let refreshes = 0;
    mountGameplayBQuickTestConsole(game, () => { refreshes += 1; });
    const command = document.querySelector<HTMLTextAreaElement>('#gameplay-b-test-console-command')!;
    const run = document.querySelector<HTMLButtonElement>('[data-test-console-run]')!;
    const result = document.querySelector<HTMLElement>('[data-test-console-result]')!;
    const creditId = 'base:resource:credit';
    const initialCredits = game.state.resources[creditId] ?? 0;

    command.value = 'getValue gameplay-b:chara:Hoshino';
    run.click();
    expect(result.textContent).toContain('找不到角色定义');
    expect(game.state.roster?.Hoshino).toBeUndefined();

    command.value = 'getValue base:area:schale_main';
    run.click();
    expect(result.textContent).toContain('不支持 Area');

    command.value = 'getValue base:chara:Hoshino 2';
    run.click();
    expect(result.textContent).toContain('角色 不支持数量参数');
    expect(game.state.roster?.Hoshino).toBeUndefined();

    command.value = 'getValue base:spot:credit_printer 2';
    run.click();
    expect(result.textContent).toContain('Spot 不支持数量参数');
    expect(game.state.spotLevels['base:spot:credit_printer']).toBe(1);

    command.value = 'getValue base:resource:credit 0';
    run.click();
    expect(result.textContent).toContain('数量为 0');
    expect(game.state.resources[creditId] ?? 0).toBe(initialCredits);
    expect(refreshes).toBe(0);
  });

  test('applies the memory-only roster command with the Map-only Gameplay B content loaded', () => {
    document.body.innerHTML = '<div id="app"></div>';
    game = createAppRuntime();
    game.init([defaultDatapack, gameplayBMapDatapack], { enterDefaultInit: true });
    const root = document.querySelector<HTMLElement>('#app')!;
    controller = new UIController(game, root);
    controller.started = true;
    controller.render();
    mountGameplayBQuickTestConsole(game, () => controller!.render());

    expect(game.registry.maps.has(gameplayBMapDatapack.maps![0]!.id)).toBe(true);
    expect(root.querySelector('[data-operation-start]')).toBeNull();
    const command = document.querySelector<HTMLTextAreaElement>('#gameplay-b-test-console-command')!;
    command.value = '获得角色 星野 芹香 白子';
    document.querySelector<HTMLButtonElement>('[data-test-console-run]')!.click();

    expect(document.querySelector('[data-test-console-result]')?.textContent).toContain('本次获得');
    expect(document.querySelector('[data-test-console-result]')?.textContent).toContain('界面已刷新');
    expect(game.state.roster?.Hoshino).toBeDefined();
    expect(game.registry.maps.has(gameplayBMapDatapack.maps![0]!.id)).toBe(true);
  });

  test('quick-launches a loaded Map through the existing command path and refuses to replace an active run', () => {
    document.body.innerHTML = '<div id="app"></div>';
    game = createAppRuntime();
    game.init([defaultDatapack, gameplayBMapDatapack], { enterDefaultInit: true });
    game.mutations.acquireCharacter('Shiroko', 'story');
    game.mutations.acquireCharacter('Serika', 'story');
    const root = document.querySelector<HTMLElement>('#app')!;
    controller = new UIController(game, root);
    controller.started = true;
    controller.render();
    const mapId = gameplayBMapDatapack.maps![0]!.id;
    let launches = 0;
    mountGameplayBQuickTestConsole(game, () => controller!.render(), targetMapId => {
      launches += 1;
      const run = controller!.commands.startMap(targetMapId);
      controller!.replaceWorkspaceRoute({ kind: 'map', runId: run.runId });
      controller!.render();
    });

    const command = document.querySelector<HTMLTextAreaElement>('#gameplay-b-test-console-command')!;
    const runButton = document.querySelector<HTMLButtonElement>('[data-test-console-run]')!;
    const result = document.querySelector<HTMLElement>('[data-test-console-result]')!;
    command.value = 'startMap gameplay-b:map:not-loaded';
    runButton.click();
    expect(result.textContent).toContain('当前没有加载 Map');
    expect(launches).toBe(0);
    expect(game.mapRun.getSnapshot()).toBeNull();

    command.value = `startMap ${mapId}`;
    runButton.click();
    expect(launches).toBe(1);
    expect(game.mapRun.getSnapshot()?.mapId).toBe(mapId);
    expect(root.querySelector('[data-map-workspace-region]')).not.toBeNull();
    expect(result.textContent).toContain('已快速进入 Map');
    expect(document.querySelector<HTMLDialogElement>('[data-gameplay-b-test-console]')?.open).toBe(false);

    command.value = `startMap ${mapId}`;
    runButton.click();
    expect(result.textContent).toContain('进行中的关卡');
    expect(launches).toBe(1);
    expect(game.mapRun.getSnapshot()?.mapId).toBe(mapId);
  });

  test('keeps the normal Schale Office gate unless the explicit launch option is supplied', () => {
    game = createAppRuntime();
    game.init([defaultDatapack, gameplayBMapDatapack], { enterDefaultInit: false });
    let launches = 0;
    mountGameplayBQuickTestConsole(game, undefined, () => { launches += 1; });

    const command = document.querySelector<HTMLTextAreaElement>('#gameplay-b-test-console-command')!;
    command.value = `startMap ${gameplayBMapDatapack.maps![0]!.id}`;
    document.querySelector<HTMLButtonElement>('[data-test-console-run]')!.click();

    expect(document.querySelector('[data-test-console-result]')?.textContent).toContain('先通过正常流程进入夏莱办公室');
    expect(launches).toBe(0);
    expect(game.mapRun.getSnapshot()).toBeNull();
  });

  test('enters the Schale Office through the existing flow before an explicit test launch', () => {
    document.body.innerHTML = '<div id="app"></div>';
    game = createAppRuntime();
    game.init([defaultDatapack, gameplayBMapDatapack], { enterDefaultInit: false });
    game.mutations.acquireCharacter('Shiroko', 'story');
    game.mutations.acquireCharacter('Serika', 'story');
    const root = document.querySelector<HTMLElement>('#app')!;
    controller = new UIController(game, root);
    controller.started = true;
    controller.render();
    const mapId = gameplayBMapDatapack.maps![0]!.id;
    mountGameplayBQuickTestConsole(game, undefined, mapIdToStart => {
      const run = controller!.commands.startMap(mapIdToStart);
      controller!.replaceWorkspaceRoute({ kind: 'map', runId: run.runId });
      controller!.render();
    }, () => {
      controller!.resumeInit('base:init:schale_office');
      return game!.state.activeInit === 'base:init:schale_office';
    });

    const command = document.querySelector<HTMLTextAreaElement>('#gameplay-b-test-console-command')!;
    command.value = `startMap ${mapId} --enter-office`;
    document.querySelector<HTMLButtonElement>('[data-test-console-run]')!.click();

    expect(game.state.activeInit).toBe('base:init:schale_office');
    expect(game.mapRun.getSnapshot()?.mapId).toBe(mapId);
    expect(root.querySelector('[data-map-workspace-region]')).not.toBeNull();
    expect(document.querySelector('[data-test-console-result]')?.textContent).toContain('已快速进入 Map');
  });

  test('runs the requested Map operations after the explicit quick launch', () => {
    document.body.innerHTML = '<div id="app"></div>';
    game = createAppRuntime();
    game.init([defaultDatapack, gameplayBMapDatapack], { enterDefaultInit: true });
    game.mutations.acquireCharacter('Shiroko', 'story');
    game.mutations.acquireCharacter('Serika', 'story');
    const root = document.querySelector<HTMLElement>('#app')!;
    controller = new UIController(game, root);
    controller.started = true;
    controller.render();
    const mapId = 'gameplay-b:map:damage-reduction-example';
    mountGameplayBQuickTestConsole(game, undefined, (targetMapId, operations) => {
      const run = controller!.commands.startMap(targetMapId);
      controller!.replaceWorkspaceRoute({ kind: 'map', runId: run.runId });
      const summary = applyGameplayBQuickTestMapOperations(game!.mapRun, controller!.commands, run.runId, operations);
      controller!.render();
      return summary;
    });

    const command = document.querySelector<HTMLTextAreaElement>('#gameplay-b-test-console-command')!;
    command.value = `startMap ${mapId} --enter-office --move-to practice --ability cover-serika --target-party serika --commit-rounds 4`;
    document.querySelector<HTMLButtonElement>('[data-test-console-run]')!.click();

    const run = game.mapRun.getSnapshot();
    expect(run?.mapId).toBe(mapId);
    expect(run?.currentNodeId).toBe('practice');
    expect(run?.commitVersion).toBe(4);
    expect(document.querySelector('[data-test-console-result]')?.textContent).toContain('移动到 practice');
    expect(document.querySelector('[data-test-console-result]')?.textContent).toContain('选择能力 cover-serika');
    expect(document.querySelector('[data-test-console-result]')?.textContent).toContain('提交 4 回合');
  });

  test('runs the U27 protection sample with one launch-and-commit command', () => {
    document.body.innerHTML = '<div id="app"></div>';
    game = createAppRuntime();
    game.init([defaultDatapack, gameplayBMapDatapack], { enterDefaultInit: true });
    game.mutations.acquireCharacter('Shiroko', 'story');
    game.mutations.acquireCharacter('Serika', 'story');
    const root = document.querySelector<HTMLElement>('#app')!;
    controller = new UIController(game, root);
    controller.started = true;
    controller.render();
    const mapId = 'gameplay-b:map:damage-protection-example';
    mountGameplayBQuickTestConsole(game, undefined, (targetMapId, operations) => {
      const run = controller!.commands.startMap(targetMapId);
      controller!.replaceWorkspaceRoute({ kind: 'map', runId: run.runId });
      const summary = applyGameplayBQuickTestMapOperations(game!.mapRun, controller!.commands, run.runId, operations);
      controller!.render();
      return summary;
    });

    const command = document.querySelector<HTMLTextAreaElement>('#gameplay-b-test-console-command')!;
    command.value = `startMap ${mapId} --enter-office --move-to practice --ability prepare-ward --target-party serika --commit-rounds 1`;
    document.querySelector<HTMLButtonElement>('[data-test-console-run]')!.click();

    const run = game.mapRun.getSnapshot();
    expect(run?.mapId).toBe(mapId);
    expect(run?.currentNodeId).toBe('practice');
    expect(run?.commitVersion).toBe(1);
    expect(run?.partyHp.find(row => row.characterId === 'serika')?.currentHp).toBe(6);
    expect(run?.actorResources.find(row => row.characterId === 'serika' && row.resourceId === 'guard')?.value).toBe(1);
    expect(run?.lastEncounterCommit?.effectTrace?.filter(row => row.op === 'damage')).toMatchObject([
      { amount: 0, damageProtection: { blockedAmount: 3 } },
      { amount: 3, delta: -2 },
    ]);
    expect(document.querySelector('[data-test-console-result]')?.textContent).toContain('选择能力 prepare-ward');
    expect(document.querySelector('[data-test-console-result]')?.textContent).toContain('提交 1 回合');
  });

  test('validates a requested Map before entering the Schale Office', () => {
    game = createAppRuntime();
    game.init([defaultDatapack, gameplayBMapDatapack], { enterDefaultInit: false });
    const activeInitBefore = game.state.activeInit;
    let officeEntries = 0;
    let launches = 0;
    mountGameplayBQuickTestConsole(game, undefined, () => { launches += 1; }, () => {
      officeEntries += 1;
      return true;
    });

    const command = document.querySelector<HTMLTextAreaElement>('#gameplay-b-test-console-command')!;
    command.value = 'startMap gameplay-b:map:not-loaded --enter-office';
    document.querySelector<HTMLButtonElement>('[data-test-console-run]')!.click();

    expect(document.querySelector('[data-test-console-result]')?.textContent).toContain('当前没有加载 Map');
    expect(officeEntries).toBe(0);
    expect(launches).toBe(0);
    expect(game.state.activeInit).toBe(activeInitBefore);
  });

  test('does not enter the Schale Office when a MapRun is already in progress', () => {
    game = createAppRuntime();
    game.init([defaultDatapack, gameplayBMapDatapack], { enterDefaultInit: false });
    game.mutations.acquireCharacter('Shiroko', 'story');
    game.mutations.acquireCharacter('Serika', 'story');
    const mapId = gameplayBMapDatapack.maps![0]!.id;
    controller = new UIController(game, document.createElement('div'));
    controller.started = true;
    const activeRun = controller.commands.startMap(mapId);
    let officeEntries = 0;
    mountGameplayBQuickTestConsole(game, undefined, () => undefined, () => {
      officeEntries += 1;
      return true;
    });

    const command = document.querySelector<HTMLTextAreaElement>('#gameplay-b-test-console-command')!;
    command.value = `startMap ${mapId} --enter-office`;
    document.querySelector<HTMLButtonElement>('[data-test-console-run]')!.click();

    expect(document.querySelector('[data-test-console-result]')?.textContent).toContain('进行中的关卡');
    expect(officeEntries).toBe(0);
    expect(game.state.activeInit).not.toBe('base:init:schale_office');
    expect(game.mapRun.getSnapshot()?.runId).toBe(activeRun.runId);
  });

  test('keeps normal fixed-party admission when entering through the explicit option', () => {
    game = createAppRuntime();
    game.init([defaultDatapack, gameplayBMapDatapack], { enterDefaultInit: false });
    const root = document.createElement('div');
    document.body.append(root);
    controller = new UIController(game, root);
    controller.started = true;
    controller.render();
    const mapId = gameplayBMapDatapack.maps![0]!.id;
    mountGameplayBQuickTestConsole(game, undefined, mapIdToStart => {
      const run = controller!.commands.startMap(mapIdToStart);
      controller!.replaceWorkspaceRoute({ kind: 'map', runId: run.runId });
      controller!.render();
    }, () => {
      controller!.resumeInit('base:init:schale_office');
      return game!.state.activeInit === 'base:init:schale_office';
    });

    const command = document.querySelector<HTMLTextAreaElement>('#gameplay-b-test-console-command')!;
    command.value = `startMap ${mapId} --enter-office`;
    document.querySelector<HTMLButtonElement>('[data-test-console-run]')!.click();

    expect(game.state.activeInit).toBe('base:init:schale_office');
    expect(game.mapRun.getSnapshot()).toBeNull();
    expect(document.querySelector('[data-test-console-result]')?.textContent).toContain('固定队伍准入');
  });
});
