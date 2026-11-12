// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { renderChatEntry, renderCurrentStory, renderStoryClickPreview, renderChatTexts, type ChatTextEntry } from '../../../src/ui/components/story/story';
import { renderSendButton } from '../../../src/ui/columns/chat-content';
import type { UIContext } from '../../../src/ui/runtime/context';
import type { StoryView } from '../../../src/arona-clicker/contracts/runtime/results';
import { bindStoryActions } from '../../../src/ui/controller/controller-actions-story';
import type { UIController } from '../../../src/ui/controller/controller';
import { presentation } from './story-playback-fixtures';

const ctx = { escapeHtml: (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;') } as UIContext;
const view: StoryView = { storyId: 'entry:test', storyDefId: 'story:test', pageIndex: 1, totalPages: 2,
  nodeId: 'choice', token: 'player-1:2', phase: 'input', runId: 'run-1', availableChoiceIndexes: [1],
  page: { kind: 'click', text: '', choices: [{ id: 'closed', text: '锁定' }, { id: 'stable-id', text: '继续' }] }, type: 'active' };
describe('new node input uses the existing choice/card/button surfaces', () => {
  it('hides unavailable choices while preserving the original option identity, index and token', () => {
    document.body.innerHTML = renderCurrentStory(ctx, view);
    const choices = document.querySelectorAll<HTMLButtonElement>('[data-story-choice]');
    expect(choices).toHaveLength(1);
    expect(choices[0].disabled).toBe(false);
    expect(choices[0].dataset.storyChoice).toBe('1');
    expect(choices[0].dataset.storyChoiceId).toBe('stable-id');
    expect(choices[0].dataset.storyToken).toBe(view.token);
    expect(document.body.textContent).not.toContain('锁定');
    expect(renderCurrentStory(ctx, { ...view, availableChoiceIndexes: [] })).toBe('');
    expect(renderCurrentStory(ctx, { ...view, phase: 'delivery' })).toBe('');
  });
  it('renders a current input card with a submit token instead of a detached Entry launch', () => {
    document.body.innerHTML = renderCurrentStory(ctx, { ...view, page: { kind: 'click', text: '', kizuna: { storyId: 'entry:next' } } });
    expect(document.querySelector('[data-story-card-token]')?.getAttribute('data-story-card-token')).toBe(view.token);
    expect(document.querySelector('[data-kizuna]')).toBeNull();
  });
  it('keeps all authored options in preview and the recorded options in completed history', () => {
    document.body.innerHTML = renderStoryClickPreview(ctx, { kind: 'choice', options: [
      { id: 'closed', text: '条件选项', requiresFlag: 'not-present' }, { id: 'stable-id', text: '继续' },
    ] });
    expect(document.querySelectorAll('[data-story-editor-click-option]')).toHaveLength(2);
    expect(document.querySelector('[data-story-choice]')).toBeNull();
    document.body.innerHTML = renderChatEntry(ctx, { kind: 'narration', text: '', choice: {
      options: [{ id: 'stable-id', text: '当时可见' }], selectedOptionId: 'stable-id',
    } });
    expect(document.querySelectorAll('.choice-option')).toHaveLength(1);
    expect(document.querySelector<HTMLButtonElement>('.choice-option')?.disabled).toBe(true);
    expect(document.body.textContent).toContain('已选择');
    expect(document.querySelector('[data-story-choice]')).toBeNull();
  });
  it('carries the captured token on the existing work button', () => {
    document.body.innerHTML = renderSendButton({ mode: 'advance', storyId: view.storyId, pageIndex: 1, text: '按下', token: view.token,
      clickWork: { total: 3, done: 2 } });
    expect(document.querySelector<HTMLButtonElement>('[data-send]')?.dataset.storyToken).toBe(view.token);
    expect(document.querySelector('.send-work-count')?.textContent).toBe('2/3');
  });
  it('renders Operation and other blocking presentation phases as disabled buttons', () => {
    for (const state of [
      { mode: 'advance' as const, storyId: 'entry', pageIndex: 0, text: '', checkpoint: 'operation' as const, token: 'operation-intent' },
      { mode: 'idle' as const, reason: 'noStory' as const },
    ]) {
      document.body.innerHTML = renderSendButton(state, 'pause');
      expect(document.querySelector<HTMLButtonElement>('.send-button')?.disabled).toBe(true);
      expect(document.querySelector('[data-send]')).toBeNull();
    }
    document.body.innerHTML = renderSendButton({ mode: 'advance', storyId: 'entry', pageIndex: 0, text: '旧的确认文案', checkpoint: 'operation', token: 'operation-intent' });
    expect(document.querySelector<HTMLButtonElement>('.send-button')?.disabled).toBe(true);
    expect(document.querySelector('[data-send]')).toBeNull();
    expect(document.querySelector('.send-text')?.textContent).toBe('正在逐项呈现效果');
  });
});

describe('Story input submits explicit Runtime intents', () => {
  function fixture(phase: ReturnType<typeof presentation>['phase'], token = 'captured') {
    document.body.innerHTML = '<div id="root"><div data-chat-owner="background"><button data-send data-story-token="captured"></button><button data-story-choice="1" data-story-choice-id="stable-option" data-story-token="choice-captured"></button></div></div>';
    const commands = {
      continueStory: vi.fn(() => ({ success: true })),
      submitStoryInput: vi.fn(() => ({ success: true })),
      accelerateStoryPresentation: vi.fn(() => true),
      triggerPassiveStory: vi.fn(() => ({ success: true })),
      clickSend: vi.fn(() => ({ type: 'idle', started: true })),
    };
    const ctrl = {
      root: document.querySelector('#root'), panelState: { conversationVariantId: 'watching' }, commands,
      game: { story: { getPlaybackView: () => presentation({ owner: 'background', phase, token }) }, getView: () => ({ activeInit: 'init' }) },
      chat: { bannerBlocking: () => false }, refreshChatPanel: vi.fn(), deliverPendingRewardsBeforeStory: vi.fn(),
    } as unknown as UIController;
    bindStoryActions(ctrl);
    return { ctrl, commands,
      click: () => document.querySelector<HTMLButtonElement>('[data-send]')!.click(),
      choice: () => document.querySelector<HTMLButtonElement>('[data-story-choice]')!.click() };
  }

  it('continues the clicked display owner with its captured token, independent of the selected student', () => {
    const f = fixture('continue', 'newer-runtime-token');
    f.click();
    expect(f.commands.continueStory).toHaveBeenCalledWith('background', 'captured');
    expect(f.commands.submitStoryInput).not.toHaveBeenCalled();
    expect(f.ctrl.panelState.conversationVariantId).toBe('watching');
  });

  it.each(['typing', 'thinking'] as const)('accelerates %s without submitting input or continuing', phase => {
    const f = fixture(phase);
    f.click();
    expect(f.commands.accelerateStoryPresentation).toHaveBeenCalledWith('background', 'captured');
    expect(f.commands.continueStory).not.toHaveBeenCalled();
    expect(f.commands.submitStoryInput).not.toHaveBeenCalled();
  });

  it('submits the stable option identity and the captured input token', () => {
    const f = fixture('input');
    f.choice();
    expect(f.commands.submitStoryInput).toHaveBeenCalledWith('background', 'choice-captured', 'stable-option');
    expect(f.commands.continueStory).not.toHaveBeenCalled();
  });

  it.each(['\n', 'selected elsewhere'])('submits an explicit button even with an unrelated text selection (%j)', text => {
    const f = fixture('continue');
    const outside = document.createElement('p');
    outside.textContent = text;
    document.body.append(outside);
    const range = document.createRange();
    range.selectNodeContents(outside);
    const selection = document.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    expect(selection.isCollapsed).toBe(false);
    try {
      f.click();
      expect(f.commands.continueStory).toHaveBeenCalledWith('background', 'captured');
    } finally { selection.removeAllRanges(); }
  });

  it('delegates idle starts to the existing owner-aware affection and passive selection', () => {
    const f = fixture('idle');
    f.click();
    expect(f.commands.clickSend).toHaveBeenCalledWith('background');
    expect(f.commands.triggerPassiveStory).not.toHaveBeenCalled();
    expect(f.commands.continueStory).not.toHaveBeenCalled();
    expect(f.commands.submitStoryInput).not.toHaveBeenCalled();
  });

  it.each(['operation', 'banner', 'finishing', 'failed'] as const)('rejects obsolete clickable DOM during %s', phase => {
    const f = fixture(phase);
    f.click(); f.choice();
    expect(f.commands.continueStory).not.toHaveBeenCalled();
    expect(f.commands.submitStoryInput).not.toHaveBeenCalled();
    expect(f.commands.accelerateStoryPresentation).not.toHaveBeenCalled();
  });
});


describe('Story author overlay preview isolation',()=>{
  it('author previews never produce detached Entry launch bindings',()=>{
    const values:ChatTextEntry[]=[{id:'preview',x:.5,y:.5,align:'left',timestamp:0,kind:'kizuna',targetStoryId:'test:activestory:target',talklet:{kind:'click',text:'',kizuna:{storyId:'test:activestory:target',align:'right'}}}];
    expect(renderChatTexts(ctx,values)).toContain('data-kizuna=');
    const preview=renderChatTexts(ctx,values,{preview:true});
    expect(preview).not.toContain('data-kizuna=');
    expect(preview).toContain('data-story-editor-click-card');
    expect(preview).toContain('align-right');
  });
});
