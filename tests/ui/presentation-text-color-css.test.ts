import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../src/ui/css/background.css', import.meta.url), 'utf8');

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

  test('聊天气泡覆盖通用宿主的透明背景规则', () => {
    expect(css).toContain('.presentation-host-target.chat-bubble-npc');
    expect(css).toContain('background: var(--theme-node-npc-bubble, #4c5b70)');
    expect(css).toContain('.presentation-host-target.chat-bubble-player');
    expect(css).toContain('background: var(--theme-node-player-bubble, #4a8aca)');
  });
});
