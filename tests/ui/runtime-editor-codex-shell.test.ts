// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  codexEntryKey,
  createCodexShellState,
  getCodexVisibleEntries,
  getCodexVisibleKinds,
  reduceCodexShellState,
  renderCodexShell,
  type RuntimeContentBrowserShellView,
} from '../../src/ui/runtime-editor/codex';

const view: RuntimeContentBrowserShellView = {
  loadedMods: [
    { id: 'base', label: '基础包', version: '1.0.0', statusLabel: '当前 Runtime' },
    { id: 'addition-test', label: '扩展测试包', version: '0.4.0', badges: ['已加载'] },
  ],
  kinds: [
    { definitionKind: 'spot', label: 'Spot', groupLabel: '世界' },
    { definitionKind: 'story', label: 'Story', groupLabel: '剧情' },
    { definitionKind: 'pic', label: 'Pic', groupLabel: '表现' },
  ],
  entries: [
    { definitionKind: 'spot', fullId: 'base:spot:main', modId: 'base', label: '主厅', summary: '默认入口设施', tags: ['入口'], searchText: 'field.defaultSpots' },
    { definitionKind: 'story', fullId: 'base:story:intro', modId: 'base', label: '开场', summary: '初次进入时播放', tags: ['开幕'] },
    { definitionKind: 'spot', fullId: 'addition-test:spot:observatory', modId: 'addition-test', label: '观测台', summary: '扩展区域设施', tags: ['实验'] },
    { definitionKind: 'pic', fullId: 'addition-test:pic:observatory', modId: 'addition-test', label: '观测台立绘', summary: '图片资源', searchText: 'assets/observatory.webp' },
  ],
};

function mount(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  const root = host.firstElementChild;
  if (!(root instanceof HTMLElement)) throw new Error('expected codex root');
  return root;
}

describe('RuntimeEditor Codex shell', () => {
  test('renders the three read-only panes with runtime scope and ARIA landmarks', () => {
    const root = mount(renderCodexShell(view, createCodexShellState()));

    expect(root.matches('[data-runtime-editor-codex]')).toBe(true);
    expect(root.querySelectorAll('[data-codex-pane]')).toHaveLength(3);
    expect(root.querySelector('[data-codex-pane="mods"] [role="listbox"]')).not.toBeNull();
    expect(root.querySelector('[data-codex-pane="entries"] [data-codex-query]')?.getAttribute('type')).toBe('search');
    expect(root.querySelector('[data-codex-pane="detail"] [data-codex-empty="detail"]')).not.toBeNull();
    expect(root.querySelector('[data-codex-kind-filter]')).toBeInstanceOf(HTMLDetailsElement);
    expect((root.querySelector('[data-codex-kind-filter]') as HTMLDetailsElement).open).toBe(false);
    expect(root.querySelector('.runtime-editor-codex__head')).toBeNull();
    expect(root.getAttribute('aria-label')).toBe('超级图鉴');
    expect(root.textContent).toContain('基础包');
    expect(root.textContent).toContain('addition-test:spot:observatory');
  });

  test('selection state filters Mod and type without reaching outside the injected view', () => {
    const initial = createCodexShellState();
    const selectedMod = reduceCodexShellState(view, initial, { type: 'select-mod', modId: 'addition-test' });
    expect(getCodexVisibleEntries(view, selectedMod).map(entry => entry.fullId)).toEqual([
      'addition-test:spot:observatory',
      'addition-test:pic:observatory',
    ]);
    expect(getCodexVisibleKinds(view, selectedMod).map(kind => kind.definitionKind)).toEqual(['spot', 'pic']);

    const selectedKind = reduceCodexShellState(view, selectedMod, { type: 'select-kind', definitionKind: 'pic' });
    expect(getCodexVisibleEntries(view, selectedKind).map(entry => entry.fullId)).toEqual(['addition-test:pic:observatory']);
    expect(selectedKind.mobilePane).toBe('entries');
  });

  test('search matches IDs, tags and injected field summaries, then clears stale selection', () => {
    const base = reduceCodexShellState(view, createCodexShellState(), { type: 'select-entry', entryKey: codexEntryKey(view.entries[0]) });
    const filtered = reduceCodexShellState(view, base, { type: 'set-query', query: 'defaultSpots' });

    expect(getCodexVisibleEntries(view, filtered).map(entry => entry.fullId)).toEqual(['base:spot:main']);
    expect(filtered.selectedEntryKey).toBeNull();
    expect(filtered.query).toBe('defaultSpots');
  });

  test('关系导航维护有限的返回 / 前进查看栈，列表选择不压栈', () => {
    const first = codexEntryKey(view.entries[0]);
    const second = codexEntryKey(view.entries[1]);
    const third = codexEntryKey(view.entries[2]);
    const selected = reduceCodexShellState(view, createCodexShellState(), { type: 'select-entry', entryKey: first });
    const opened = reduceCodexShellState(view, selected, { type: 'open-entry', entryKey: second });
    expect(opened.selectedEntryKey).toBe(second);
    expect(opened.backStack).toEqual([first]);
    expect(opened.forwardStack).toEqual([]);

    const next = reduceCodexShellState(view, opened, { type: 'open-entry', entryKey: third });
    expect(next.backStack).toEqual([first, second]);

    const backed = reduceCodexShellState(view, next, { type: 'go-back' });
    expect(backed.selectedEntryKey).toBe(second);
    expect(backed.backStack).toEqual([first]);
    expect(backed.forwardStack).toEqual([third]);

    const forwarded = reduceCodexShellState(view, backed, { type: 'go-forward' });
    expect(forwarded.selectedEntryKey).toBe(third);
    expect(forwarded.backStack).toEqual([first, second]);
    expect(forwarded.forwardStack).toEqual([]);

    const fresh = reduceCodexShellState(view, backed, { type: 'open-entry', entryKey: first });
    expect(fresh.forwardStack).toEqual([]);
  });

  test('renders selected identity into the injected detail slot and supports narrow-pane state', () => {
    const selected = view.entries[3];
    const state = reduceCodexShellState(view, createCodexShellState(), { type: 'select-entry', entryKey: codexEntryKey(selected) });
    const root = mount(renderCodexShell(view, state, { renderDetail: entry => `<div data-test-detail>${entry.fullId}</div>` }));

    expect(root.getAttribute('data-codex-mobile-pane')).toBe('detail');
    expect(root.querySelector('[data-codex-detail-slot]')?.textContent).toBe('addition-test:pic:observatory');
    expect(root.querySelector(`[data-codex-entry="${codexEntryKey(selected)}"]`)?.getAttribute('aria-selected')).toBe('true');
    expect(root.querySelector('[data-codex-mobile-pane="detail"]')?.getAttribute('aria-selected')).toBe('true');
  });

  test('escapes injected labels and exposes useful empty states', () => {
    const unsafe: RuntimeContentBrowserShellView = {
      loadedMods: [{ id: 'unsafe', label: '<Mod>', entryCount: 1 }],
      kinds: [{ definitionKind: 'item', label: 'Item', groupLabel: '物品' }],
      entries: [{ definitionKind: 'item', fullId: 'unsafe:item:<x>', modId: 'unsafe', label: '<危险>', summary: '"quoted"' }],
    };
    const root = mount(renderCodexShell(unsafe, createCodexShellState()));
    expect(root.innerHTML).toContain('&lt;Mod&gt;');
    expect(root.innerHTML).toContain('&lt;危险&gt;');
    expect(root.innerHTML).not.toContain('<Mod>');

    const empty = mount(renderCodexShell({ loadedMods: [], kinds: [], entries: [] }, createCodexShellState()));
    expect(empty.querySelector('[data-codex-empty="mods"]')).not.toBeNull();
    expect(empty.querySelector('[data-codex-empty="entries"]')).not.toBeNull();
  });

  test('standalone CSS defines the three-column and narrow-screen collapse contract', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/ui/runtime-editor/codex/codex.css'), 'utf8');
    expect(css).toContain('grid-template-columns: minmax(176px, .78fr) minmax(238px, 1.08fr) minmax(300px, 1.72fr);');
    expect(css).toContain('@media (max-width: 860px)');
    expect(css).toContain('data-codex-mobile-pane="mods"');
    expect(css).toContain('position: sticky;');
    expect(css).toContain('.runtime-editor-codex__kind-filter-summary');
    expect(css).toContain('.runtime-editor-codex .codex-related-item > *');
    expect(css).toContain('font-size: 11px;');
    expect(css).toContain('overflow-wrap: anywhere;');
    expect(css).toContain('white-space: normal;');
    expect(css).toContain(':focus-visible');
    expect(css).toContain('prefers-reduced-motion');
  });
});
