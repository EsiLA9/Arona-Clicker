// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoryDef } from '../../src/data-services/contracts/story';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { UIController } from '../../src/ui/controller/controller';

const OFFICE = 'base:init:schale_office';
const WELCOME_STORY = 'base:story:schale_welcome';
const WELCOME_ENTRY = 'base:activestory:schale_welcome';
const TARGET_AREA = 'base:area:schale_library';

const oneBodyWelcome: StoryDef = {
  id: WELCOME_STORY,
  name: '自动结束的欢迎剧情',
  stages: { body: { advance: 'auto' } },
  nodes: [{ id: 'body', type: 'talklet', stageId: 'body', content: { kind: 'narration', text: '欢迎来到夏莱。' } }],
};

describe('UIController Story movement lock rail refresh', () => {
  let game: GameInstance;
  let controller: UIController;
  let root: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    const datapack = {
      ...baseDatapack,
      stories: baseDatapack.stories.map(story => story.id === WELCOME_STORY ? oneBodyWelcome : story),
    };
    game = new GameInstance();
    game.init([datapack]);
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector<HTMLElement>('#app')!;
    controller = new UIController(game, root);
    controller.mount();
    controller.startNewGame(OFFICE);
  });

  afterEach(() => {
    controller.destroy();
    game.stop();
    localStorage.clear();
    vi.useRealTimers();
  });

  it('auto-completing the opening body unlocks the rail note and area button with only local refreshes', async () => {
    await Promise.resolve();
    expect(game.getView().currentStory?.storyId).toBe(WELCOME_ENTRY);
    expect(root.querySelector('.rail-note p')?.textContent).toContain('剧情演出中，暂不可移动区域。');
    const lockedButton = root.querySelector<HTMLButtonElement>(`[data-ui-area-nav="reachable:${TARGET_AREA}"]`);
    expect(lockedButton?.getAttribute('aria-disabled')).toBe('true');

    const centerPanel = root.querySelector('.center-panel');
    const render = vi.spyOn(controller, 'render');
    await vi.advanceTimersByTimeAsync(2_000);
    await Promise.resolve();

    expect(game.getView().currentStory).toBeNull();
    expect(root.querySelector('.rail-note p')?.textContent).toContain('点击区域即可前往');
    const unlockedButton = root.querySelector<HTMLButtonElement>(`[data-ui-area-nav="reachable:${TARGET_AREA}"]`);
    expect(unlockedButton?.getAttribute('aria-disabled')).toBe('false');
    expect(unlockedButton?.hasAttribute('data-locked')).toBe(false);
    expect(render).not.toHaveBeenCalled();
    expect(root.querySelector('.center-panel')).toBe(centerPanel);
  });

  it('replacing an active run never exposes an intermediate unlocked rail state', async () => {
    await Promise.resolve();
    expect(game.story.isBlockingMovement()).toBe(true);
    const refreshPanels = vi.spyOn(controller, 'refreshPanels');
    const render = vi.spyOn(controller, 'render');

    const replacement = game.story.startCardStory(WELCOME_ENTRY, null);
    expect(replacement.success).toBe(true);
    expect(game.story.isBlockingMovement()).toBe(true);
    await Promise.resolve();

    expect(root.querySelector('.rail-note p')?.textContent).toContain('剧情演出中，暂不可移动区域。');
    expect(refreshPanels).not.toHaveBeenCalledWith(['left']);
    expect(render).not.toHaveBeenCalled();
  });
});
