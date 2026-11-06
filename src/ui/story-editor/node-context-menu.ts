/** One body-level menu; scrolling or replacing its anchor dismisses it. */
export class StoryNodeContextMenu {
  private element?: HTMLElement;
  private anchor?: HTMLElement;
  open(anchor: HTMLElement, x: number, y: number, label: string, disabled: boolean, run: () => void): void {
    this.close(); this.anchor = anchor;
    const menu = document.createElement('div'); menu.className = 'story-editor-node-menu'; menu.setAttribute('role','menu');
    menu.setAttribute('aria-label','Story 节点操作');
    const style = getComputedStyle(anchor);
    for (const name of ['--panel-light','--ink-on-panel-light','--line','--panel-shadow']) menu.style.setProperty(name,style.getPropertyValue(name));
    const button = document.createElement('button'); button.type = 'button'; button.className = 'mini-action';
    button.textContent = label; button.setAttribute('role','menuitem'); button.disabled = disabled;
    button.addEventListener('click', () => { this.close(); if (!button.disabled) run(); });
    menu.append(button); document.body.append(menu); this.element = menu;
    const rect = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(4,Math.min(x,window.innerWidth-rect.width-4))}px`;
    menu.style.top = `${Math.max(4,Math.min(y,window.innerHeight-rect.height-4))}px`;
    document.addEventListener('pointerdown',this.outside,true);
    document.addEventListener('keydown',this.keydown,true);
    document.addEventListener('scroll',this.scroll,true);
    window.addEventListener('resize',this.scroll);
    if (!disabled) button.focus({preventScroll:true});
  }
  dismissBeforeMutation(scope: ParentNode): void { if (this.anchor && scope.contains(this.anchor)) this.close(); }
  retainIfAnchored(): void { if (this.anchor && !this.anchor.isConnected) this.close(); }
  close(): void {
    this.element?.remove(); this.element = undefined; this.anchor = undefined;
    document.removeEventListener('pointerdown',this.outside,true);
    document.removeEventListener('keydown',this.keydown,true);
    document.removeEventListener('scroll',this.scroll,true);
    window.removeEventListener('resize',this.scroll);
  }
  private outside = (event: Event): void => { if (event.target instanceof Node && !this.element?.contains(event.target)) this.close(); };
  private scroll = (): void => this.close();
  private keydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') { const anchor = this.anchor; event.preventDefault(); this.close(); anchor?.focus({preventScroll:true}); }
  };
}
