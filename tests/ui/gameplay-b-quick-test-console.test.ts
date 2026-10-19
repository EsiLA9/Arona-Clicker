// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest';
import { createAppRuntime } from '../../src/app/runtime-bootstrap';
import { gameplayBMapDatapack } from '../../src/arona-clicker/content/gameplay-b-map-datapack';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
import type { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { UIController } from '../../src/ui/controller';
import {
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
});
