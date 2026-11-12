// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameInstance } from '../../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../../src/data/test-datapack';
import { UIController } from '../../../src/ui/controller/controller';
import type { StoryDef } from '../../../src/data-services/contracts/story';

const storyId = 'base:story:schale_welcome';
describe('consecutive Choice input', () => {
  let game: GameInstance;
  let controller: UIController;
  afterEach(() => { controller?.destroy(); game?.dispose(); localStorage.clear(); vi.useRealTimers(); });
  // Advancing the fake clock also runs real game ticks and UI updates under parallel load.
  it.each(['none', 'flag', 'notices'] as const)('submits consecutive Choices sharing a stage and option ID (%s)', async effect => {
    vi.useFakeTimers(); localStorage.clear();
    const story: StoryDef = { startContext: { type: 'area', areaId: 'base:area:schale_main' }, id: storyId, name: 'Two choices', stages: { shared: { advance: 'input' }, end: { advance: 'auto' } }, nodes: [
      { id: 'intro', type: 'talklet', stageId: 'shared', content: { kind: 'narration', text: 'choose twice' } },
      ...['first', 'second'].flatMap(id => {
        const mark = `consecutive-${id}`;
        const effectNode = effect === 'none' ? [] : [{
          id: `${id}-effect`, type: 'operation' as const, requiresFlag: mark,
          action: { kind: 'state' as const, effects: effect === 'flag' ? [
            { op: 'setFlag' as const, flagId: 'choice_check', value: id },
          ] : [
            { op: 'addResource' as const, resourceId: 'base:resource:credit', amount: 1 },
            { op: 'addResource' as const, resourceId: 'base:resource:credit', amount: 2 },
          ] },
        }];
        return [
          { id, type: 'click' as const, stageId: 'shared', interaction: { kind: 'choice' as const, options: [
            { id: 'option1', text: id, ...(effect !== 'none' ? { marks: [mark] } : {}) },
            { id: 'other', text: `${id} alternative` },
          ] } },
          ...effectNode,
        ];
      }),
      { id: 'end', type: 'talklet', stageId: 'end', content: { kind: 'narration', text: 'finished' } },
    ] };
    game = new GameInstance();
    game.init([{ ...baseDatapack, stories: baseDatapack.stories.map(item => item.id === storyId ? story : item) }]);
    document.body.innerHTML = '<div id="app"></div>';
    const root = document.querySelector<HTMLElement>('#app')!;
    controller = new UIController(game, root); controller.mount(); controller.startNewGame('base:init:schale_office');
    await Promise.resolve();
    expect(game.story.getCurrentStoryView()?.nodeId).toBe('first');
    const first = root.querySelector<HTMLButtonElement>('[data-chat-owner=""] [data-story-choice]')!;
    const oldToken = first.dataset.storyToken!;
    expect(game.story.submitStoryInput(null, oldToken, 'missing')).toMatchObject({ success: false, error: 'InvalidChoice' });
    expect(game.story.getPlaybackView().entries.some(entry => entry.choice)).toBe(false);
    first.click();
    await vi.advanceTimersByTimeAsync(400);
    expect(game.story.getCurrentStoryView()?.nodeId).toBe('second');
    const cards = () => [...root.querySelectorAll<HTMLElement>('[data-chat-owner=""] .choice-card')];
    expect(cards()).toHaveLength(2);
    expect([...cards()[0]!.querySelectorAll('button')].every(button => button.disabled)).toBe(true);
    expect(cards()[0]!.textContent).toContain('first alternative');
    expect(cards()[0]!.textContent).toContain('已选择');
    expect(cards()[0]!.querySelector('[data-story-choice], [data-story-token]')).toBeNull();
    cards()[0]!.querySelector('button')!.click();
    expect(game.story.getCurrentStoryView()?.nodeId).toBe('second');
    expect(game.story.getPlaybackView().entries.filter(entry => entry.choice)).toHaveLength(1);
    if (effect === 'notices') {
      const entries = game.story.getPlaybackView().entries;
      expect(entries.findIndex(entry => entry.choice)).toBeLessThan(entries.findIndex(entry => entry.kind === 'reward'));
    }
    if (effect === 'none') {
      const saved = JSON.parse(JSON.stringify(game.save()));
      game.load(saved);
      controller.resetSessionPanel();
      controller.render();
      expect(cards()).toHaveLength(2);
      expect(cards()[0]!.querySelector('button')?.disabled).toBe(true);
    }
    const second = root.querySelector<HTMLButtonElement>('[data-chat-owner=""] [data-story-choice]');
    expect(second?.textContent).toContain('second');
    expect(second?.disabled).toBe(false);
    expect(second?.dataset.storyToken).not.toBe(oldToken);
    expect(game.story.submitStoryInput(null, oldToken, 'option1')).toMatchObject({ success: false, error: 'StaleToken' });
    expect(game.story.getPlaybackView().entries.filter(entry => entry.choice)).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(game.story.getCurrentStoryView()?.nodeId).toBe('second');
    second!.click(); await vi.advanceTimersByTimeAsync(400);
    expect(game.story.getCurrentStoryView()?.nodeId).toBe('end');
    expect(cards()).toHaveLength(2);
    expect(cards().every(card => [...card.querySelectorAll('button')].every(button => button.disabled))).toBe(true);
    expect(game.story.getPlaybackView().phase).toBe('continue');
    root.querySelector<HTMLButtonElement>('[data-chat-owner=""] [data-send]')!.click();
    expect(game.story.getCurrentStoryView()).toBeNull();
    expect(cards()).toHaveLength(2);
  }, 15_000);
});
