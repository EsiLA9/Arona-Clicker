// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { GameInstance } from '../../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../../src/data/test-datapack';
import { createUIContext } from '../../../src/ui/runtime/context';
import { createSettingsWorkspaceFrame } from '../../../src/ui/components/settings/settings-workspace';
import { createServiceWorkspaceFrame } from '../../../src/ui/components/shared/service-workspace';
import { createShopWorkspaceFrame } from '../../../src/ui/components/inventory/shop';
import { createStoryWorkspaceFrame } from '../../../src/ui/components/story/story-workspace';
import { renderWorkspaceFrame, workspaceColumns } from '../../../src/ui/components/shared/workspace-frame';
import { ShopSession } from '../../../src/arona-clicker/services/economy/shop-service';
import type { PanelState, ShopWorkspaceState, StoryWorkspaceState } from '../../../src/ui/components/shared/app-shell';

const state: PanelState = {
  service: 'game', leftTab: 'area', centerTab: 'chat', rightTab: 'spot',
  chatEntries: [], chatTexts: [], selectedVariantId: null, conversationVariantId: null,
  studentChats: {}, studentChatTexts: {}, storyNavPath: [],
};

let style: HTMLStyleElement | null = null;
const mountedRoots: HTMLElement[] = [];

beforeAll(() => {
  const gameStyles = readFileSync(resolve(process.cwd(), 'src/ui/css/game.css'), 'utf8');
  const imports = [...gameStyles.matchAll(/@import\s+['"]\.\/([^'"]+\.css)['"]/g)].map(match => match[1]);
  const relevant = ['layout.css', 'cards.css', 'workspace-controls.css'];
  const order = relevant.map(file => imports.indexOf(file));
  expect(order.every(index => index >= 0)).toBe(true);
  expect(order).toEqual([...order].sort((a, b) => a - b));
  style = document.createElement('style');
  style.textContent = [
    ...relevant.map(file => readFileSync(resolve(process.cwd(), `src/ui/css/${file}`), 'utf8')),
    readFileSync(resolve(process.cwd(), 'src/ui/css/map-entry-workspace.css'), 'utf8'),
  ].join('\n');
  document.head.append(style);
});

afterAll(() => style?.remove());
afterEach(() => {
  for (const root of mountedRoots.splice(0)) root.remove();
});

function render(root: HTMLElement, spec: ReturnType<typeof createSettingsWorkspaceFrame>): void {
  root.innerHTML = renderWorkspaceFrame(createUIContext(game), spec);
  root.dataset.workspaceStructureTest = '';
  document.body.append(root);
  mountedRoots.push(root);
}

let game: GameInstance;

beforeAll(() => {
  game = new GameInstance();
  game.init([baseDatapack]);
});

describe('Workspace shared structure', () => {
  it('real Settings, Service, Story and Shop frames keep headings and fixed actions outside body scroll', () => {
    const story: StoryWorkspaceState = {
      type: 'story', navPath: [], subroute: 'overview', selectedEntryId: null,
      conversationOwner: null, mode: 'overview', returnContext: {} as StoryWorkspaceState['returnContext'],
    };
    const shop: ShopWorkspaceState = {
      type: 'shop', spotId: 'missing', shopId: 'missing', session: new ShopSession(), feed: [],
      returnContext: {} as ShopWorkspaceState['returnContext'], themeId: 'shop:test',
    };
    const specs = [
      createSettingsWorkspaceFrame(createUIContext(game), state),
      createServiceWorkspaceFrame(createUIContext(game), 'saves', state),
      createServiceWorkspaceFrame(createUIContext(game), 'datapack', {
        ...state,
        datapackWorkspace: { section: 'all', mode: 'classic', selectedPackId: null, draftEnabledIds: [], draftOrder: [], validation: null, lastResult: null },
      }),
      createStoryWorkspaceFrame(createUIContext(game), story, state),
      createShopWorkspaceFrame(createUIContext(game), shop),
    ];

    for (const spec of specs) {
      const root = document.createElement('div');
      render(root, spec);
      const columns = [...root.querySelectorAll<HTMLElement>('[data-column-instance]')];
      const specColumns = workspaceColumns(spec).filter(column => column.visible !== false);
      expect(columns.length).toBeGreaterThan(0);
      for (const [index, column] of columns.entries()) {
        const slot = column.querySelector<HTMLElement>('.workspace-column__slot')!;
        const header = slot.querySelector<HTMLElement>(':scope > .workspace-column__header');
        const body = slot.querySelector<HTMLElement>(':scope > .workspace-column__body')!;
        const footer = slot.querySelector<HTMLElement>(':scope > .workspace-column__footer');
        expect(header?.parentElement).toBe(slot);
        expect(body.parentElement).toBe(slot);
        if (specColumns[index].footer) expect(footer?.parentElement).toBe(slot);
        else expect(footer).toBeNull();
        expect(body.contains(header)).toBe(false);
        expect(body.contains(footer)).toBe(false);
      }
    }
  });

  it('real fixed shell regions and service-body flex selectors resolve through the slot', () => {
    const root = document.createElement('div');
    render(root, createServiceWorkspaceFrame(createUIContext(game), 'saves', state));
    const column = root.querySelector<HTMLElement>('.service-main')!;
    const slot = column.querySelector<HTMLElement>('.workspace-column__slot')!;
    const header = slot.querySelector<HTMLElement>(':scope > .workspace-column__header')!;
    const body = slot.querySelector<HTMLElement>(':scope > .workspace-column__body')!;

    expect(getComputedStyle(header).flexShrink).toBe('0');
    expect(getComputedStyle(body).display).toBe('flex');
    expect(getComputedStyle(body).minHeight).toBe('0');
    expect(getComputedStyle(body).flexGrow).toBe('1');

    const shopRoot = document.createElement('div');
    render(shopRoot, createShopWorkspaceFrame(createUIContext(game), {
      type: 'shop', spotId: 'missing', shopId: 'missing', session: new ShopSession(), feed: [],
      returnContext: {} as ShopWorkspaceState['returnContext'], themeId: 'shop:test',
    }));
    const shopSlot = shopRoot.querySelector<HTMLElement>('.workspace-column__slot[data-workspace-column="right"]')!;
    const shopHeader = shopSlot.querySelector<HTMLElement>(':scope > .workspace-column__header')!;
    const shopBody = shopSlot.querySelector<HTMLElement>(':scope > .workspace-column__body')!;
    const shopFooter = shopSlot.querySelector<HTMLElement>(':scope > .workspace-column__footer')!;
    expect(getComputedStyle(shopHeader).flexShrink).toBe('0');
    expect(getComputedStyle(shopBody).overflow).toBe('auto');
    expect(getComputedStyle(shopFooter).flexShrink).toBe('0');
    expect(shopBody.contains(shopFooter)).toBe(false);
  });

  it('Shell footer retains its original footer styling without leaking into a column footer', () => {
    const shell = document.createElement('div');
    shell.className = 'console-shell';
    shell.innerHTML = '<footer data-shell-footer>Shell</footer><section class="workspace-column"><footer class="workspace-column__footer" data-column-footer>Actions</footer></section>';
    document.body.append(shell);
    mountedRoots.push(shell);
    const shellFooter = getComputedStyle(shell.querySelector<HTMLElement>('[data-shell-footer]')!);
    const columnFooter = getComputedStyle(shell.querySelector<HTMLElement>('[data-column-footer]')!);

    expect(shellFooter.marginTop).toBe('20px');
    expect(shellFooter.fontSize).toBe('9px');
    expect(shellFooter.letterSpacing).toBe('0.72px');
    expect(columnFooter.marginTop).not.toBe('20px');
    expect(columnFooter.fontSize).not.toBe('9px');
    expect(columnFooter.letterSpacing).not.toBe('0.08em');
    expect(columnFooter.width).toBe('100%');
  });

  it('Workspace header, Tabs and back controls work with only public CSS and MapEntry CSS', () => {
    const root = document.createElement('div');
    root.dataset.workspaceStructureTest = '';
    root.innerHTML = `<section class="workspace-column">
      <header class="workspace-column__header">
        <div class="panel-tabs-region"><div class="switch-tabs"><div class="switch-tabs-content"><button class="switch-tab">准备</button></div></div></div>
        <button class="workspace-back conversation-back" aria-label="返回">←</button>
        <div class="workspace-heading"><div class="workspace-title">地图准备</div></div>
      </header>
      <button class="story-trigger" disabled>开始地图</button>
      <div class="workspace-column__body" data-scroll="auto">正文</div>
    </section>`;
    document.body.append(root);
    mountedRoots.push(root);

    const tab = root.querySelector<HTMLElement>('.switch-tab')!;
    const back = root.querySelector<HTMLElement>('.workspace-back')!;
    const primary = root.querySelector<HTMLElement>('.story-trigger')!;
    expect(getComputedStyle(tab).minHeight).toBe('30px');
    expect(getComputedStyle(back).width).toBe('30px');
    expect(getComputedStyle(primary).cursor).toBe('not-allowed');
    expect(getComputedStyle(primary).opacity).toBe('.5');
    expect(getComputedStyle(root.querySelector('.workspace-heading')!).display).toBe('flex');
    expect(getComputedStyle(root.querySelector('.workspace-title')!).minWidth).toBe('0');
    expect(style!.textContent).not.toContain('.chat-pane');
    expect(style!.textContent).not.toContain('.conversation-pane');
  });

  it('danger mini-actions keep their semantic color after the later cards stylesheet', () => {
    const host = document.createElement('div');
    host.className = 'workspace';
    const action = document.createElement('button');
    action.className = 'mini-action mini-action--danger';
    action.style.setProperty('--danger', 'rgb(123, 0, 0)');
    host.append(action);
    document.body.append(host);

    expect(getComputedStyle(action).color).toBe('rgb(123, 0, 0)');
    host.remove();
  });

  it('neutral workspace hover rules cannot target disabled or danger mini-actions', () => {
    const rules = [...style!.sheet!.cssRules]
      .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule)
      .map(rule => rule.selectorText)
      .filter(selector => selector.includes('button.mini-action') && selector.includes(':hover'));
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.every(selector => selector.includes(':not(:disabled)') && selector.includes(':not(.mini-action--danger)'))).toBe(true);

    const cardHoverRules = [...style!.sheet!.cssRules]
      .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule)
      .map(rule => rule.selectorText)
      .filter(selector => selector.includes('.mini-action:hover'));
    expect(cardHoverRules.length).toBeGreaterThan(0);
    expect(cardHoverRules.every(selector => selector.includes(':not(:disabled)'))).toBe(true);
  });
});
