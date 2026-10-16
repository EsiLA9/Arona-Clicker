// @vitest-environment happy-dom
import { describe, expect, test, vi } from 'vitest';
import { patchCodexPane } from '../../src/ui/runtime-editor/codex/dom-updates';

describe('内容工具局部更新的浮层边界', () => {
  test('重排保留条目和外部锚点，仅在被移除节点范围关闭浮层', () => {
    document.body.innerHTML = `<main><aside data-codex-pane="mods"><span class="hover-wrap" data-tooltip="outside">范围</span></aside>
      <section data-codex-pane="entries"><input data-codex-query value=""><div class="runtime-editor-codex__entries-wrap">
      <button data-codex-entry="A"><span class="hover-wrap" data-tooltip="A">A</span></button>
      <button data-codex-entry="B">B</button><button data-codex-entry="C">C</button></div></section></main>`;
    const root = document.querySelector<HTMLElement>('main')!;
    const a = root.querySelector('[data-codex-entry="A"]');
    const b = root.querySelector('[data-codex-entry="B"]');
    const c = root.querySelector('[data-codex-entry="C"]');
    const outside = root.querySelector('[data-tooltip="outside"]');
    const input = root.querySelector<HTMLInputElement>('input')!;
    const scroll = root.querySelector<HTMLElement>('.runtime-editor-codex__entries-wrap')!;
    input.focus(); scroll.scrollTop = 53;
    const overlays = { dismissBeforeRootMutation: vi.fn(), retainIfAnchored: vi.fn() };
    patchCodexPane(root, 'entries', `<section data-codex-pane="entries"><input data-codex-query value=""><div class="runtime-editor-codex__entries-wrap"><button data-codex-entry="C">C</button><button data-codex-entry="A"><span class="hover-wrap" data-tooltip="A">A</span></button></div></section>`, overlays);
    expect([...root.querySelectorAll('[data-codex-entry]')]).toEqual([c, a]);
    expect(document.activeElement).toBe(input);
    expect(scroll.scrollTop).toBe(53);
    expect(root.querySelector('[data-tooltip="outside"]')).toBe(outside);
    expect(overlays.dismissBeforeRootMutation).toHaveBeenCalledWith(b);
    expect(overlays.dismissBeforeRootMutation.mock.calls.every(([scope]) => !scope.contains(outside))).toBe(true);
    expect(overlays.retainIfAnchored).toHaveBeenCalledOnce();
  });

  test('相同节点的提示目标改变时先关闭旧浮层', () => {
    document.body.innerHTML = '<main><section data-codex-pane="detail"><span class="hover-wrap" data-tooltip="old">旧目标</span></section></main>';
    const root = document.querySelector<HTMLElement>('main')!;
    const anchor = root.querySelector('.hover-wrap');
    const overlays = { dismissBeforeRootMutation: vi.fn(), retainIfAnchored: vi.fn() };
    patchCodexPane(root, 'detail', '<section data-codex-pane="detail"><span class="hover-wrap" data-tooltip="new">新目标</span></section>', overlays);
    expect(root.querySelector('.hover-wrap')).toBe(anchor);
    expect(anchor?.getAttribute('data-tooltip')).toBe('new');
    expect(overlays.dismissBeforeRootMutation).toHaveBeenCalledWith(anchor);
  });

  test('缺失 Pane 恢复到导航、列表、详情的原始顺序', () => {
    document.body.innerHTML = `<main><div class="runtime-editor-codex__grid">
      <aside data-codex-pane="mods">分类</aside>
      <article data-codex-pane="detail">详情</article>
    </div></main>`;
    const root = document.querySelector<HTMLElement>('main')!;
    const mods = root.querySelector('[data-codex-pane="mods"]');
    const detail = root.querySelector('[data-codex-pane="detail"]');
    const overlays = { dismissBeforeRootMutation: vi.fn(), retainIfAnchored: vi.fn() };

    patchCodexPane(root, 'entries', '<section data-codex-pane="entries">列表</section>', overlays);

    const panes = [...root.querySelector('.runtime-editor-codex__grid')!.children];
    expect(panes.map(pane => pane.getAttribute('data-codex-pane'))).toEqual(['mods', 'entries', 'detail']);
    expect(panes[0]).toBe(mods);
    expect(panes[2]).toBe(detail);
    expect(panes[1].textContent).toBe('列表');
    expect(overlays.retainIfAnchored).toHaveBeenCalledOnce();
  });
});
