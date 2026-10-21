/** 背景交接：保留不透明底层，只淡入上层，避免两层同时半透明而露出黑底。 */
export class SelectorSceneBackground {
  private stack: HTMLElement | null = null;
  private markup: string | null = null;
  private frame: number | null = null;
  private timer: number | null = null;
  private observer: MutationObserver | null = null;
  private generation = 0;
  private removeEndListener: (() => void) | null = null;
  private cancelImages: (() => void) | null = null;

  show(stack: HTMLElement, markup: string, animate: boolean): void {
    if (this.stack === stack && this.markup === markup) return;
    this.stopPending();
    this.stack = stack;
    this.markup = markup;
    const generation = this.generation;
    const previous = stack.querySelector<HTMLElement>('[data-selector-scene-slot="next"]');
    if (previous?.childElementCount) {
      // 快速切换时冻结已显现的部分，保留整个合成画面，不退回最初背景。
      const opacity = getComputedStyle(previous).opacity;
      previous.style.transition = 'none';
      previous.style.opacity = opacity;
      previous.dataset.selectorSceneSlot = 'retained';
      previous.classList.remove('selector-scene-background-next', 'is-visible');
      previous.classList.add('selector-scene-background-retained');
    } else previous?.remove();

    const template = document.createElement('template');
    template.innerHTML = markup;
    const incoming = template.content.firstElementChild as HTMLElement;
    stack.append(incoming);
    const live = (): boolean => generation === this.generation && incoming.parentNode === stack && stack.isConnected;
    this.observer = new MutationObserver(() => {
      if (!stack.isConnected || incoming.parentNode !== stack) this.cancel();
    });
    this.observer.observe(document.body, { childList: true, subtree: true });

    const promote = (): void => {
      if (!live()) return;
      this.stopPending();
      // 保留已加载的同一 DOM / 图片，不在过渡末尾重新渲染背景。
      incoming.style.transition = 'none';
      incoming.style.opacity = '1';
      incoming.dataset.selectorSceneSlot = 'current';
      incoming.classList.remove('selector-scene-background-next', 'is-visible');
      incoming.classList.add('selector-scene-background-current');
      for (const child of [...stack.children]) if (child !== incoming) child.remove();
      const placeholder = document.createElement('div');
      placeholder.className = 'selector-scene-background selector-scene-background-next';
      placeholder.dataset.selectorSceneSlot = 'next';
      placeholder.dataset.selectorTransitionKey = '';
      placeholder.setAttribute('aria-hidden', 'true');
      stack.append(placeholder);
    };
    const reveal = (): void => {
      if (!live()) return;
      if (!animate) { promote(); return; }
      // 先确定 opacity:0 的初始样式，下一帧开始覆盖旧背景。
      getComputedStyle(incoming).opacity;
      this.frame = window.requestAnimationFrame(() => {
        this.frame = null;
        if (!live()) return;
        incoming.classList.add('is-visible');
        const onEnd = (event: TransitionEvent): void => {
          if (event.target === incoming && event.propertyName === 'opacity') promote();
        };
        incoming.addEventListener('transitionend', onEnd);
        this.removeEndListener = () => incoming.removeEventListener('transitionend', onEnd);
        // transitionend 在页面后台等情况下可能缺失；留出一帧以上余量。
        this.timer = window.setTimeout(promote, 500);
      });
    };

    const images = [...incoming.querySelectorAll<HTMLElement>('.console-background-layer')].flatMap(layer => {
      const value = layer.style.backgroundImage;
      const match = /^url\(["']?(.*?)["']?\)$/.exec(value);
      return match ? [match[1]] : [];
    });
    if (images.length === 0) { reveal(); return; }
    const pending: HTMLImageElement[] = [];
    this.cancelImages = () => {
      for (const image of pending) image.onload = image.onerror = null;
    };
    // 图片未就绪时保持旧画面；加载失败则使用新背景已有的主题底色。
    void Promise.all(images.map(src => new Promise<void>(resolve => {
      const image = new Image();
      pending.push(image);
      const ready = (): void => {
        image.onload = image.onerror = null;
        if (typeof image.decode === 'function') void image.decode().catch(() => {}).then(resolve);
        else resolve();
      };
      image.onload = image.onerror = ready;
      image.src = src;
      if (image.complete) ready();
    }))).then(reveal);
  }

  cancel(): void {
    this.stopPending();
    this.stack?.querySelectorAll('[data-selector-scene-slot="retained"], [data-selector-scene-slot="next"]').forEach(layer => layer.remove());
    this.stack = null;
    this.markup = null;
  }

  private stopPending(): void {
    this.generation += 1;
    if (this.frame !== null) window.cancelAnimationFrame(this.frame);
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.frame = this.timer = null;
    this.observer?.disconnect();
    this.observer = null;
    this.removeEndListener?.();
    this.removeEndListener = null;
    this.cancelImages?.();
    this.cancelImages = null;
  }
}
