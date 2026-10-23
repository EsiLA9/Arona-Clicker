// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { renderCurrentStory } from '../../src/ui/components/story/story';
import { renderSendButton } from '../../src/ui/components/shared/center-panel';
import type { UIContext } from '../../src/ui/runtime/context';
import type { StoryView } from '../../src/arona-clicker/contracts/runtime/results';

const ctx = { escapeHtml: (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;') } as UIContext;
const view: StoryView = { storyId: 'entry:test', storyDefId: 'story:test', type: 'active', pageIndex: 1, totalPages: 2,
  nodeId: 'choice', token: 'player-1:2', phase: 'input', runId: 'run-1', availableChoiceIndexes: [1],
  page: { kind: 'click', text: '', choices: [{ id: 'closed', text: '锁定' }, { id: 'stable-id', text: '继续' }] } };
describe('new node input uses the existing reply/card/button surfaces', () => {
  it('renders stable choice identity and wait token while retaining unavailable options', () => {
    document.body.innerHTML = renderCurrentStory(ctx, view);
    const choices = document.querySelectorAll<HTMLButtonElement>('[data-story-choice]');
    expect(choices[0].disabled).toBe(true);
    expect(choices[1].dataset.storyChoiceId).toBe('stable-id');
    expect(choices[1].dataset.storyToken).toBe(view.token);
    expect(renderCurrentStory(ctx, { ...view, phase: 'delivery' })).toBe('');
  });
  it('renders a current input card with a submit token instead of a detached Entry launch', () => {
    document.body.innerHTML = renderCurrentStory(ctx, { ...view, page: { kind: 'click', text: '', kizuna: { storyId: 'entry:next' } } });
    expect(document.querySelector('[data-story-card-token]')?.getAttribute('data-story-card-token')).toBe(view.token);
    expect(document.querySelector('[data-kizuna]')).toBeNull();
  });
  it('carries the captured token on the existing work button', () => {
    document.body.innerHTML = renderSendButton({ mode: 'advance', storyId: view.storyId, pageIndex: 1, text: '按下', token: view.token,
      clickWork: { total: 3, done: 2 } });
    expect(document.querySelector<HTMLButtonElement>('[data-send]')?.dataset.storyToken).toBe(view.token);
    expect(document.querySelector('.send-work-count')?.textContent).toBe('2/3');
  });
});
