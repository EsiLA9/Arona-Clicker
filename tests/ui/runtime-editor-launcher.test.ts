import { describe, expect, it } from 'vitest';
import {
  registerRuntimeEditorLauncherEntry,
  runtimeEditorLauncherEntries,
} from '../../src/ui/runtime-editor/launcher';

describe('Runtime Editor 迷你入口注册表', () => {
  it('支持未来入口注册、排序与卸载', () => {
    const dispose = registerRuntimeEditorLauncherEntry({
      id: 'atlas',
      label: '打开大图鉴',
      action: 'open-atlas',
      order: 90,
      isAvailable: () => false,
    });

    expect(runtimeEditorLauncherEntries().at(-1)).toMatchObject({
      id: 'atlas',
      action: 'open-atlas',
    });

    dispose();

    expect(runtimeEditorLauncherEntries().some((entry) => entry.id === 'atlas')).toBe(false);
  });
});
