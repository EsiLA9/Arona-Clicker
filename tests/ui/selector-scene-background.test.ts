// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SelectorSceneBackground } from '../../src/ui/selector-scene-background';

describe('选择页背景无空档交接', () => {
  let scene: SelectorSceneBackground;
  let stack: HTMLElement;
  let style: HTMLStyleElement;
  const markup = (id: string, image = false) => `<div class="selector-scene-background selector-scene-background-next" data-selector-scene-slot="next" data-selector-transition-key="${id}"><div class="selector-background"><div class="console-background-layer" style="background-image:${image ? 'url(&quot;/new-background.png&quot;)' : 'linear-gradient(red, blue)'}"></div></div></div>`;
  const next = () => stack.querySelector<HTMLElement>('[data-selector-scene-slot="next"]')!;
  const current = () => stack.querySelector<HTMLElement>('[data-selector-scene-slot="current"]')!;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => window.setTimeout(() => callback(performance.now()), 16));
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => window.clearTimeout(id));
    style = document.createElement('style');
    style.textContent = '.selector-scene-background {opacity:0}.selector-scene-background-current,.selector-scene-background-next.is-visible {opacity:1}';
    document.head.append(style);
    document.body.innerHTML = '<div id="stack"><div class="selector-scene-background selector-scene-background-current" data-selector-scene-slot="current" data-selector-transition-key="old"></div><div data-selector-scene-slot="next"></div></div>';
    stack = document.querySelector('#stack')!;
    scene = new SelectorSceneBackground();
  });

  afterEach(() => {
    scene.cancel();
    style.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('始终保留不透明旧底，淡入完成后把同一个新背景升为 current', async () => {
    const old = current();
    scene.show(stack, markup('new'), true);
    const incoming = next();
    expect(getComputedStyle(old).opacity).toBe('1');
    expect(incoming.classList.contains('is-visible')).toBe(false);
    await vi.advanceTimersByTimeAsync(16);
    expect(incoming.classList.contains('is-visible')).toBe(true);
    expect(old.isConnected).toBe(true);
    expect(getComputedStyle(old).opacity).toBe('1');
    await vi.advanceTimersByTimeAsync(500);
    expect(current()).toBe(incoming);
    expect(old.isConnected).toBe(false);
    expect(getComputedStyle(current()).opacity).toBe('1');
    expect(stack.children).toHaveLength(2);
  });

  it('快速连续切换保留中间合成画面，最后一次完成后清理所有旧层', async () => {
    const old = current();
    scene.show(stack, markup('first'), true);
    await vi.advanceTimersByTimeAsync(16);
    const partial = next();
    partial.style.opacity = '0.4';
    scene.show(stack, markup('second'), true);
    expect(partial.dataset.selectorSceneSlot).toBe('retained');
    expect(partial.style.opacity).toBe('0.4');
    expect(partial.style.transition).toBe('none');
    expect(old.isConnected).toBe(true);
    expect(getComputedStyle(old).opacity).toBe('1');
    await vi.advanceTimersByTimeAsync(516);
    expect(current().dataset.selectorTransitionKey).toBe('second');
    expect(partial.isConnected).toBe(false);
    expect(old.isConnected).toBe(false);
    expect(stack.children).toHaveLength(2);
  });

  it('相同背景刷新不重新开始淡入，关闭动态效果时同步完成交接', async () => {
    scene.show(stack, markup('same'), true);
    const incoming = next();
    await vi.advanceTimersByTimeAsync(200);
    scene.show(stack, markup('same'), true);
    expect(next()).toBe(incoming);
    await vi.advanceTimersByTimeAsync(316);
    expect(current()).toBe(incoming);
    scene.show(stack, markup('immediate'), false);
    expect(current().dataset.selectorTransitionKey).toBe('immediate');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('图片加载解码前保持旧背景；解码后才开始淡入', async () => {
    const images: Array<{ complete: boolean; src: string; onload: (() => void) | null; onerror: (() => void) | null; decode(): Promise<void> }> = [];
    vi.stubGlobal('Image', class {
      complete = false;
      src = '';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      decode = vi.fn(() => Promise.resolve());
      constructor() { images.push(this); }
    });
    const old = current();
    scene.show(stack, markup('image', true), true);
    expect(images).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(old.isConnected).toBe(true);
    expect(next().classList.contains('is-visible')).toBe(false);
    images[0].onload!();
    await vi.advanceTimersByTimeAsync(16);
    expect(images[0].decode).toHaveBeenCalledOnce();
    expect(next().classList.contains('is-visible')).toBe(true);
    expect(old.isConnected).toBe(true);
    await vi.advanceTimersByTimeAsync(500);
    expect(current().dataset.selectorTransitionKey).toBe('image');
  });

  it('卸载背景层后取消待执行的淡入，不在新页面继续更新', async () => {
    scene.show(stack, markup('new'), true);
    stack.remove();
    await vi.advanceTimersByTimeAsync(516);
    expect(vi.getTimerCount()).toBe(0);
    expect(stack.querySelector('[data-selector-scene-slot="next"]')).toBeNull();
  });
});
