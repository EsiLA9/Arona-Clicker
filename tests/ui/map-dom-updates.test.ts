// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { patchMapDOM } from '../../src/ui/workspace/map-dom-updates';

function markup(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host.firstElementChild as HTMLElement;
}

afterEach(() => document.body.replaceChildren());

describe('Map DOM interaction continuity', () => {
  it('keeps a column and its controls when runtime theme backgrounds change sibling positions', () => {
    const current = markup('<section><div class="presentation-host-background"></div><div class="presentation-host-content"><div data-workspace-column="left"><button data-map-focus-key="swap">换牌</button></div></div></section>');
    document.body.append(current);
    const column = current.querySelector('[data-workspace-column]');
    const button = current.querySelector('button')!;
    button.focus();
    patchMapDOM(current, markup('<section><div class="presentation-host-content"><div data-workspace-column="left"><button data-map-focus-key="swap" aria-pressed="true">换牌</button></div></div></section>'), vi.fn());
    expect(current.querySelector('[data-workspace-column]')).toBe(column);
    expect(current.querySelector('button')).toBe(button);
    expect(document.activeElement).toBe(button);
  });

  it('reorders keyed candidates while retaining focus, scrolling and unrelated controls', () => {
    const current = markup('<section><div data-map-region-key="party-scroll"><button data-map-focus-key="a">A</button><button data-map-focus-key="b">B</button></div><aside data-map-region-key="context-scroll">背景</aside></section>');
    document.body.append(current);
    const scroll = current.firstElementChild as HTMLElement;
    const selected = scroll.firstElementChild as HTMLButtonElement;
    const background = current.lastElementChild;
    selected.focus();
    scroll.scrollTop = 83;
    const beforeRemove = vi.fn();
    patchMapDOM(current, markup('<section><div data-map-region-key="party-scroll"><button data-map-focus-key="b">B</button><button data-map-focus-key="c">C</button><button data-map-focus-key="a" aria-pressed="true">选中 A</button></div><aside data-map-region-key="context-scroll">背景</aside></section>'), beforeRemove);
    expect(current.firstElementChild).toBe(scroll);
    expect(scroll.lastElementChild).toBe(selected);
    expect(selected.textContent).toBe('选中 A');
    expect(selected.getAttribute('aria-pressed')).toBe('true');
    expect(document.activeElement).toBe(selected);
    expect(scroll.scrollTop).toBe(83);
    expect(current.lastElementChild).toBe(background);
    expect(beforeRemove).not.toHaveBeenCalled();
  });

  it('dismisses only removed ranges, before detaching their anchors', () => {
    const current = markup('<section><div data-map-region-key="old"><button>离开的目标</button></div><div data-map-region-key="kept"><button>仍在的目标</button></div></section>');
    document.body.append(current);
    const removed = current.firstElementChild;
    const retained = current.lastElementChild;
    const beforeRemove = vi.fn(range => expect(range.isConnected).toBe(true));
    patchMapDOM(current, markup('<section><div data-map-region-key="kept"><button>仍在的目标</button></div></section>'), beforeRemove);
    expect(current.firstElementChild).toBe(retained);
    expect(beforeRemove).toHaveBeenCalledTimes(1);
    expect(beforeRemove).toHaveBeenCalledWith(removed);
    expect(removed?.isConnected).toBe(false);
  });

  it('does not reuse a removed action button for a different action at the same position', () => {
    const current = markup('<section><button data-map-focus-key="old">旧行动</button></section>');
    document.body.append(current);
    const old = current.firstElementChild;
    const beforeRemove = vi.fn();
    patchMapDOM(current, markup('<section><button data-map-focus-key="new">新行动</button></section>'), beforeRemove);
    expect(current.firstElementChild).not.toBe(old);
    expect(current.firstElementChild?.textContent).toBe('新行动');
    expect(beforeRemove).toHaveBeenCalledTimes(1);
    expect(beforeRemove).toHaveBeenCalledWith(old);
  });
});
