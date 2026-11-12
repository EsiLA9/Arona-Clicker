// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { GameInstance } from '../../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../../src/data/test-datapack';
import { createUIContext } from '../../../src/ui/runtime/context';
import { renderWorkspaceFrame, type WorkspaceColumnSpec } from '../../../src/ui/components/shared/workspace-frame';
import { WorkspaceColumns } from '../../../src/ui/workspace/workspace-columns';
import { createChatColumn } from '../../../src/ui/columns/index';

function setup() {
  const game = new GameInstance();
  game.init([baseDatapack]);
  const ctx = createUIContext(game);
  const root = document.createElement('div');
  document.body.append(root);
  return { ctx, root };
}
const column = (key: string, width?: string): WorkspaceColumnSpec => ({ key, hostId: 'centerPanel.chat', width, content: `<input value="${key}"><button data-column-back>返回</button>`, scroll: 'auto' });

describe('reusable workspace columns', () => {
  it('keeps two instances of one workspace design and its overlay independent', () => {
    const { ctx, root } = setup();
    const other = document.createElement('div'); root.after(other);
    const runtime = new WorkspaceColumns();
    const a = { id: 'same-design', instanceId: 'first', columns: [column('chat')], overlay: '<aside data-overlay>overlay</aside>' };
    runtime.mount(root, ctx, a);
    runtime.mount(other, ctx, { ...a, instanceId: 'second' });
    const first = runtime.node('first/chat');
    const overlay = root.querySelector('[data-overlay]');
    runtime.mount(root, ctx, { ...a, columns: [{ ...column('chat'), width: '2fr' }] });
    expect(runtime.node('first/chat')).toBe(first);
    expect(runtime.node('second/chat')).not.toBe(first);
    expect(root.querySelector('[data-overlay]')).toBe(overlay);
    runtime.dispose();
  });
  it.each([1, 2, 4])('renders %i tracks in declared order and filters hidden columns with their tracks', count => {
    const { ctx, root } = setup();
    const columns = Array.from({ length: count }, (_, i) => column(String(i), i ? 'minmax(0, 1fr)' : '260px'));
    root.innerHTML = renderWorkspaceFrame(ctx, { id: 'custom', columns: [...columns, { ...column('hidden'), visible: false }] });
    const frame = root.querySelector<HTMLElement>('[data-workspace-frame]')!;
    expect([...frame.querySelectorAll<HTMLElement>('[data-column-key]')].map(node => node.dataset.columnKey)).toEqual(columns.map(item => item.key));
    expect(frame.style.gridTemplateColumns).toBe(['260px', ...Array(count - 1).fill('minmax(0, 1fr)')].join(' '));
  });

  it('moves the original root on reorder and width changes, retaining input, focus, scroll and a single binding', () => {
    const { ctx, root } = setup();
    const back = vi.fn();
    const bind = vi.fn();
    const dispose = vi.fn();
    const a = { ...column('a'), onBack: back, bind: () => { bind(); return dispose; } };
    const b = column('b');
    const runtime = new WorkspaceColumns();
    runtime.mount(root, ctx, { id: 'one', columns: [a, b] });
    const first = root.querySelector<HTMLElement>('[data-column-key="a"]')!;
    const input = first.querySelector('input')!;
    input.value = 'unfinished';
    input.focus();
    first.querySelector('.workspace-column__body')!.scrollTop = 91;
    runtime.mount(root, ctx, { id: 'one', columns: [b, { ...a, width: '2fr' }] });
    expect(root.querySelector('[data-column-key="a"]')).toBe(first);
    expect(root.querySelector('[data-column-key]')?.getAttribute('data-column-key')).toBe('b');
    expect(input.value).toBe('unfinished');
    expect(document.activeElement).toBe(input);
    expect(first.querySelector('.workspace-column__body')!.scrollTop).toBe(91);
    first.querySelector<HTMLButtonElement>('[data-column-back]')!.click();
    expect(back).toHaveBeenCalledTimes(1);
    expect(bind).toHaveBeenCalledTimes(1);
    runtime.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
    first.querySelector<HTMLButtonElement>('[data-column-back]')!.click();
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('isolates targets sharing a theme, invalidates removed/rebound instances and updates only the requested column', () => {
    const { ctx, root } = setup();
    const runtime = new WorkspaceColumns();
    const a = { ...column('a'), bindingKey: 'owner-a' };
    const b = { ...column('b'), bindingKey: 'owner-b' };
    runtime.mount(root, ctx, { id: 'test', columns: [a, b] });
    const token = runtime.token('test/a')!;
    const bRoot = root.querySelector('[data-column-key="b"]');
    expect(runtime.update('test/a', { ...a, content: 'changed' }, token)).toBe(true);
    expect(root.querySelector('[data-column-key="b"]')).toBe(bRoot);
    expect(root.textContent).toContain('changed');
    runtime.mount(root, ctx, { id: 'test', columns: [{ ...a, bindingKey: 'new-owner' }, b] });
    expect(runtime.update('test/a', { ...a, content: 'stale' }, token)).toBe(false);
    runtime.mount(root, ctx, { id: 'test', columns: [b] });
    expect(runtime.update('test/a', a, token)).toBe(false);
  });

  it('restores main and auxiliary scroll owners by semantic key when their order changes', () => {
    const { ctx, root } = setup();
    const runtime = new WorkspaceColumns();
    const content = (order: 'party-first' | 'context-first') => order === 'party-first'
      ? '<div data-scroll-owner="content-region" data-scroll-key="party">party</div><div data-scroll-owner="content-region" data-map-region-key="context-scroll">context</div>'
      : '<div data-scroll-owner="content-region" data-map-region-key="context-scroll">context</div><div data-scroll-owner="content-region" data-scroll-key="party">party</div>';
    const spec = (order: 'party-first' | 'context-first'): WorkspaceColumnSpec => ({
      ...column('scroll'), definitionId: 'scroll-test', content: content(order), scroll: 'auto',
    });
    runtime.mount(root, ctx, { id: 'scroll-test', columns: [spec('party-first')] });
    const id = 'scroll-test/scroll';
    const original = runtime.node(id)!;
    original.querySelector<HTMLElement>('.workspace-column__body')!.scrollTop = 23;
    original.querySelector<HTMLElement>('[data-scroll-key="party"]')!.scrollTop = 91;
    original.querySelector<HTMLElement>('[data-map-region-key="context-scroll"]')!.scrollTop = 147;

    expect(runtime.update(id, spec('context-first'), runtime.token(id), ctx)).toBe(true);
    const next = runtime.node(id)!;
    expect(next.querySelector<HTMLElement>('.workspace-column__body')!.scrollTop).toBe(23);
    expect(next.querySelector<HTMLElement>('[data-scroll-key="party"]')!.scrollTop).toBe(91);
    expect(next.querySelector<HTMLElement>('[data-map-region-key="context-scroll"]')!.scrollTop).toBe(147);
  });

  it('uses stable class identity for unlabelled scroll owners when a new owner is inserted', () => {
    const { ctx, root } = setup();
    const runtime = new WorkspaceColumns();
    const content = (order: 'first' | 'reversed') => order === 'first'
      ? '<div class="resources-list" data-scroll-owner="content-region">resources</div><div class="context-pane" data-scroll-owner="content-region">context</div>'
      : '<div class="context-pane" data-scroll-owner="content-region">context</div><div class="resources-list" data-scroll-owner="content-region">resources</div><div class="help-pane" data-scroll-owner="content-region">help</div>';
    const spec = (order: 'first' | 'reversed'): WorkspaceColumnSpec => ({
      ...column('unlabelled-scroll'), definitionId: 'unlabelled-scroll-test', content: content(order), scroll: 'auto',
    });
    runtime.mount(root, ctx, { id: 'unlabelled-scroll-test', columns: [spec('first')] });
    const id = 'unlabelled-scroll-test/unlabelled-scroll';
    const original = runtime.node(id)!;
    original.querySelector<HTMLElement>('.resources-list')!.scrollTop = 64;
    original.querySelector<HTMLElement>('.context-pane')!.scrollTop = 128;

    expect(runtime.update(id, spec('reversed'), runtime.token(id), ctx)).toBe(true);
    const next = runtime.node(id)!;
    expect(next.querySelector<HTMLElement>('.resources-list')!.scrollTop).toBe(64);
    expect(next.querySelector<HTMLElement>('.context-pane')!.scrollTop).toBe(128);
    expect(next.querySelector<HTMLElement>('.help-pane')!.scrollTop).toBe(0);
  });

  it('keeps chat reading position on same-flow updates and does not carry it across owners', () => {
    const { ctx: initialContext, root } = setup();
    const game = initialContext.game as GameInstance;
    expect(game.inits.startNewGame('base:init:schale_office')).toBe(true);
    game.mutations.acquireCharacter('Hoshino', 'story');
    const ctx = createUIContext(game);
    const runtime = new WorkspaceColumns();
    const global = createChatColumn(ctx, {
      owner: null, entries: [], sendState: { mode: 'idle', reason: 'noStory' },
    });
    runtime.mount(root, ctx, { id: 'chat-update', columns: [global] });
    const id = 'chat-update/chat';
    let stream = runtime.node(id)!.querySelector<HTMLElement>('.chat-stream')!;
    stream.scrollTop = 157;

    expect(runtime.update(id, global, runtime.token(id), ctx)).toBe(true);
    stream = runtime.node(id)!.querySelector<HTMLElement>('.chat-stream')!;
    expect(stream.scrollTop).toBe(157);

    const student = createChatColumn(ctx, {
      owner: 'Hoshino', entries: [], sendState: { mode: 'idle', reason: 'noStory' },
    });
    expect(runtime.update(id, student, runtime.token(id), ctx)).toBe(true);
    stream = runtime.node(id)!.querySelector<HTMLElement>('.chat-stream')!;
    expect(stream.dataset.flowStreamKey).toBe('conversation:Hoshino');
    expect(stream.scrollTop).toBe(0);

    stream.scrollTop = 94;
    expect(runtime.update(id, student, runtime.token(id), ctx)).toBe(true);
    expect(runtime.node(id)!.querySelector<HTMLElement>('.chat-stream')!.scrollTop).toBe(94);
    runtime.dispose();
    root.remove();
    game.stop();
  });

  it('invalidates the stable display group when its content definition changes', () => {
    const { ctx, root } = setup();
    const runtime = new WorkspaceColumns();
    const chat = { ...column('activity'), definitionId: 'chat', bindingKey: '#global' };
    runtime.mount(root, ctx, { id: 'game', columns: [chat] });
    const token = runtime.token('game/activity')!;
    runtime.mount(root, ctx, { id: 'game', columns: [{ ...chat, definitionId: 'log', bindingKey: 'runtime-log', content: '<ol class="log-list"></ol>' }] });
    expect(runtime.token('game/activity')?.generation).toBeGreaterThan(token.generation);
    expect(runtime.node('game/activity')?.dataset.columnDefinition).toBe('log');
    expect(runtime.update('game/activity', { ...chat, content: 'stale' }, token)).toBe(false);
  });

  it('mounts a column outside a workspace and resolves explicit, local and workspace back actions without double navigation', () => {
    const { ctx, root } = setup();
    const local = vi.fn();
    const workspace = vi.fn();
    const override = vi.fn();
    const runtime = new WorkspaceColumns();
    runtime.mountColumn(root, ctx, 'editor/preview', { ...column('chat'), onBack: local }, { onBack: override });
    expect(root.querySelector('[data-workspace-frame]')).toBeNull();
    root.querySelector<HTMLButtonElement>('[data-column-back]')!.click();
    expect(override).toHaveBeenCalledTimes(1);
    expect(local).not.toHaveBeenCalled();
    runtime.mount(root, ctx, { id: 'other', onBack: workspace, columns: [{ ...column('chat'), onBack: local }] });
    root.querySelector<HTMLButtonElement>('[data-column-back]')!.click();
    expect(local).toHaveBeenCalledTimes(1);
    expect(workspace).not.toHaveBeenCalled();
    runtime.mount(root, ctx, { id: 'other', onBack: workspace, columns: [column('chat')] });
    root.querySelector<HTMLButtonElement>('[data-column-back]')!.click();
    expect(workspace).toHaveBeenCalledTimes(1);
  });

  it('rejects duplicate instance keys, has an explicit empty state and hides unbound back actions', () => {
    const { ctx, root } = setup();
    expect(() => renderWorkspaceFrame(ctx, { id: 'bad', columns: [column('a'), column('a')] })).toThrow(/duplicate/i);
    expect(() => renderWorkspaceFrame(ctx, { id: 'bad', columns: [column('a', '1fr 2fr')] })).toThrow(/one CSS column track/);
    root.innerHTML = renderWorkspaceFrame(ctx, { id: 'empty', columns: [] });
    expect(root.querySelector('[data-workspace-empty]')).not.toBeNull();
    const runtime = new WorkspaceColumns();
    runtime.mountColumn(root, ctx, 'single', column('a'));
    expect(root.querySelector<HTMLButtonElement>('[data-column-back]')?.hidden).toBe(true);
  });
});
