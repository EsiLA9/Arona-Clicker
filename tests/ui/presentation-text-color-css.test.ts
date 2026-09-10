import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../src/ui/css/background.css', import.meta.url), 'utf8');
const chatCss = readFileSync(new URL('../../src/ui/css/chat.css', import.meta.url), 'utf8');
const layoutCss = readFileSync(new URL('../../src/ui/css/layout.css', import.meta.url), 'utf8');
const conversationCss = readFileSync(new URL('../../src/ui/css/conversation.css', import.meta.url), 'utf8');

describe('表现宿主文字颜色 CSS 契约', () => {
  test('手动模式覆盖宿主、嵌套文字和 inline SVG', () => {
    expect(css).toContain('.presentation-host-target[data-theme-text-mode="light"]');
    expect(css).toContain('.presentation-host-target[data-theme-text-mode="dark"]');
    expect(css).toContain('[data-theme-hover-text-mode="light"]');
    expect(css).toContain('[data-theme-hover-text-mode="dark"]');
    expect(css).toContain('[data-theme-hover-text-mode="auto"]');
    expect(css).toContain('var(--ui-button-text-active, var(--ink-on-active))');
    expect(css).toContain('.presentation-host-content *');
    expect(css).toContain('fill: currentColor !important');
    expect(css).toContain('stroke: currentColor !important');
  });

  test('active 与 hover 的 auto 模式都覆盖 inline SVG 的子元素颜色', () => {
    const activeAuto = '.presentation-host-target[data-theme-state="active"][data-theme-text-mode="auto"] svg *';
    const hoverAuto = '.presentation-host-target:hover[data-theme-hover-text-mode="auto"] svg *';
    for (const selector of [activeAuto, hoverAuto]) {
      const start = css.indexOf(selector);
      expect(start).toBeGreaterThanOrEqual(0);
      const rule = css.slice(start, css.indexOf('}', start));
      expect(rule).toContain('fill: currentColor !important');
      expect(rule).toContain('stroke: currentColor !important');
    }
  });

  test('背景节点使用 transform，顶部按钮不再内置三角形背景图', () => {
    const layout = readFileSync(new URL('../../src/ui/css/layout.css', import.meta.url), 'utf8');
    expect(css).toContain('transform: skewX(var(--presentation-skew-x, -6deg))');
    expect(css).toContain('transform: skewX(var(--presentation-skew-x, 0deg))');
    expect(css).not.toContain('transform: skewX(6deg)');
    expect(css).not.toContain('clip-path: polygon');
    expect(layout).not.toContain("background-image: url('../../data/ba_triangles.svg')");
    expect(css).toContain('.console-panel-background)[data-presentation-shape="rounded-parallelogram"]');
    expect(css).toContain(':not(.console-panel-background)');
    expect(layout).toContain(':not(.presentation-host-target):hover');
    expect(layout).toContain('switch-tab.active:not(.presentation-host-target)');
    expect(layout).toContain('mini-action.is-active:not(.presentation-host-target)');
    expect(css).toContain('.presentation-host-decoration');
    expect(css).toContain('.presentation-host-hover-layer');
    expect(css).toContain(':has(> .presentation-host-background > .presentation-host-hover-layer)');
    expect(css).toContain('button.presentation-host-target');
    expect(css).toContain('border-color: transparent');
    expect(layout).not.toContain('.topbar .presentation-host-target:hover,\n.topbar .presentation-host-target.is-active,\n.topbar .theme-palette:has([data-theme-float].open) > #theme-palette-btn {\n   border-color: var(--theme-node-highlight)');
  });

  test('三栏主宿主挂载表现元数据，背景形状可以作用到实际容器', () => {
    const center = readFileSync(new URL('../../src/ui/components/center-panel.ts', import.meta.url), 'utf8');
    const right = readFileSync(new URL('../../src/ui/components/right-panels.ts', import.meta.url), 'utf8');
    const left = readFileSync(new URL('../../src/ui/components/rail.ts', import.meta.url), 'utf8');
    for (const source of [center, right, left]) {
      expect(source).toContain('presentation-host-target');
      expect(source).toContain('data-theme-host-id');
      expect(source).toContain('data-theme-text-mode');
    }
  });

  test('Tabs 区域与按钮分层，区域不再依赖固定底部横线', () => {
    const tabs = readFileSync(new URL('../../src/ui/components/tabs.ts', import.meta.url), 'utf8');
    expect(tabs).toContain('renderPanelTabsRegion');
    expect(tabs).toContain('data-theme-host-id="${tabsHost}"');
    expect(tabs).toContain('switch-tabs-content');
    expect(chatCss).toContain('.switch-tabs-content');
    expect(chatCss).toContain('var(--theme-node-primary) 10%');
    expect(chatCss).toContain('.panel-tabs-region');
    expect(chatCss).toContain('border-bottom: 1px solid var(--theme-node-line)');
    expect(chatCss).toContain('.switch-tabs.coll-switch');
    expect(chatCss).toContain('.switch-tabs[data-gacha-scope-switch]');
    expect(chatCss).not.toContain('.left-panel > .switch-tabs');
    expect(chatCss).not.toContain('.center-panel > .switch-tabs');
    expect(chatCss).not.toContain('margin: -14px -14px 14px');
    expect(chatCss).not.toContain('.switch-tabs.ui-cluster--left-tabs');
    expect(chatCss).not.toContain('.switch-tabs.ui-cluster--center-tabs');
    expect(layoutCss).toContain('.panel.presentation-host-target');
    expect(layoutCss).toContain('overflow: hidden');
    expect(layoutCss).toContain('padding: var(--panel-body-padding, 14px)');
  });

  test('游戏与商店顶栏控件共用等高 token，保持顶栏高度一致', () => {
    const regionStart = chatCss.indexOf('.panel-tabs-region {');
    expect(regionStart).toBeGreaterThanOrEqual(0);
    const regionRule = chatCss.slice(regionStart, chatCss.indexOf('}', regionStart));
    expect(regionRule).toContain('--panel-tabs-control-height: 30px');
    expect(chatCss).toContain('.panel-tabs-region .switch-tab');
    expect(chatCss).toContain('min-height: var(--panel-tabs-control-height)');
    // 商店标题与商店 Tab 都消费同一 token，不再写死高度。
    expect(layoutCss).toContain('height: var(--panel-tabs-control-height, 30px)');
    expect(layoutCss).not.toContain('height: 30px; padding: 5px 10px;');
  });

  test('聊天气泡覆盖通用宿主的透明背景规则', () => {
    expect(css).toContain('.presentation-host-target.chat-bubble-npc');
    expect(css).toContain('background: var(--theme-node-npc-bubble, #4c5b70)');
    expect(css).toContain('.presentation-host-target.chat-bubble-player');
    expect(css).toContain('background: var(--theme-node-player-bubble, #4a8aca)');
  });

  test('通讯录对话 Panel 复用统一顶栏与正文内边距契约', () => {
    const contacts = readFileSync(new URL('../../src/ui/components/contacts.ts', import.meta.url), 'utf8');
    expect(contacts).toContain('conversation-pane panel-body');
    // 顶栏不再是手写 header，而是统一结构区块（与聊天/日志顶栏同一宿主与渲染色）。
    expect(contacts).toContain("renderPanelHeaderRegion(ctx, 'center'");
    expect(contacts).not.toContain('conversation-header');
    expect(conversationCss).toContain('.conversation-panel');
    expect(conversationCss).toContain('overflow: hidden');
    expect(conversationCss).toContain('.conversation-pane.panel-body');
    expect(conversationCss).toContain('padding: var(--panel-body-padding, 14px)');
    expect(conversationCss).not.toContain('.conversation-header');
  });

  test('表现宿主保持背景节点与正文节点的直接子层级契约', () => {
    const service = readFileSync(new URL('../../src/ui/presentation-service.ts', import.meta.url), 'utf8');
    const tabs = readFileSync(new URL('../../src/ui/components/tabs.ts', import.meta.url), 'utf8');
    expect(service).toContain('>${background}<div class="presentation-host-content">');
    expect(tabs).toContain('panel-tabs-region presentation-host-target');
    expect(tabs).toContain('${renderPresentationHostBackground(ctx, tabsHost)}${inner}');
    expect(tabs).toContain('renderPanelHeaderRegion');
  });
});
