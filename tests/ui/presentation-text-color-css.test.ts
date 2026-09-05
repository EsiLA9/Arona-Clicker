import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../src/ui/css/background.css', import.meta.url), 'utf8');

describe('表现宿主文字颜色 CSS 契约', () => {
  test('手动模式覆盖宿主、嵌套文字和 inline SVG', () => {
    expect(css).toContain('.presentation-host-target[data-theme-text-mode="light"]');
    expect(css).toContain('.presentation-host-target[data-theme-text-mode="dark"]');
    expect(css).toContain('.presentation-host-content *');
    expect(css).toContain('fill: currentColor !important');
    expect(css).toContain('stroke: currentColor !important');
  });
});
