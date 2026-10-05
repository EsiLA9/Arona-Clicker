// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest';
import { createAppRuntime } from '../../src/app/runtime-bootstrap';
import { gameplayBCarouselDatapack } from '../../src/arona-clicker/content/operation-samples/gameplay-b-datapack';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
import type { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { UIController } from '../../src/ui/controller';
import { interpretGameplayBQuickTestCommand, mountGameplayBQuickTestConsole } from '../../src/ui/development/gameplay-b-quick-test-console';

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

  test('applies the memory-only roster command and refreshes the fixed-event admission card', () => {
    document.body.innerHTML = '<div id="app"></div>';
    game = createAppRuntime();
    game.init([defaultDatapack, gameplayBCarouselDatapack], { enterDefaultInit: true });
    const root = document.querySelector<HTMLElement>('#app')!;
    controller = new UIController(game, root);
    controller.started = true;
    controller.render();
    mountGameplayBQuickTestConsole(game, () => controller!.render());

    expect(root.querySelector<HTMLButtonElement>('[data-operation-start]')?.disabled).toBe(true);
    const command = document.querySelector<HTMLTextAreaElement>('#gameplay-b-test-console-command')!;
    command.value = '获得角色 星野 芹香 白子';
    document.querySelector<HTMLButtonElement>('[data-test-console-run]')!.click();

    expect(document.querySelector('[data-test-console-result]')?.textContent).toContain('本次获得');
    expect(document.querySelector('[data-test-console-result]')?.textContent).toContain('界面已刷新');
    expect(root.querySelector<HTMLButtonElement>('[data-operation-start]')?.disabled).toBe(false);
    expect(root.querySelector('.operation-admission-reason')).toBeNull();
  });
});
