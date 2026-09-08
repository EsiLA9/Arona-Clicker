// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest';
import { clearInjectedThemeVars } from '../../src/ui/controller-theme';

describe('主题 CSS 注入清理', () => {
  test('删除连续的旧变量时不会跳过后一个变量', () => {
    const style = document.documentElement.style;
    style.cssText = '';
    style.setProperty('--ac-old-a', '1');
    style.setProperty('--ac-old-b', '2');
    style.setProperty('--theme-node-old', '3');
    style.setProperty('--ui-button-bg', '4');
    style.setProperty('--keep-user-variable', '5');

    clearInjectedThemeVars(style);

    expect(style.getPropertyValue('--ac-old-a')).toBe('');
    expect(style.getPropertyValue('--ac-old-b')).toBe('');
    expect(style.getPropertyValue('--theme-node-old')).toBe('');
    expect(style.getPropertyValue('--ui-button-bg')).toBe('');
    expect(style.getPropertyValue('--keep-user-variable')).toBe('5');
  });
});
