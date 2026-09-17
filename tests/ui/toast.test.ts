// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { ToastService } from '../../src/ui/components/toast';

describe('Toast 折叠控制', () => {
  afterEach(() => {
    document.querySelector('#toast-layer')?.remove();
  });

  it('可以向右收起通知并通过同一控件展开', () => {
    const toast = new ToastService();
    toast.show('创建 Area 成功', 'success');

    const layer = document.querySelector<HTMLElement>('#toast-layer')!;
    const button = layer.querySelector<HTMLButtonElement>('.toast-collapse')!;

    expect(layer.classList.contains('toast-collapsed')).toBe(false);
    expect(button.getAttribute('aria-expanded')).toBe('true');

    button.click();
    expect(layer.classList.contains('toast-collapsed')).toBe(true);
    expect(layer.querySelector('.toast-stack')?.hasAttribute('hidden')).toBe(false);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-label')).toContain('展开通知');

    button.click();
    expect(layer.classList.contains('toast-collapsed')).toBe(false);
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  it('收起后新通知保持收起，不重新遮挡弹窗', () => {
    const toast = new ToastService();
    toast.show('第一条通知');
    const layer = document.querySelector<HTMLElement>('#toast-layer')!;
    layer.querySelector<HTMLButtonElement>('.toast-collapse')!.click();

    toast.show('第二条通知');

    expect(layer.classList.contains('toast-collapsed')).toBe(true);
    expect(layer.querySelectorAll('.toast-message')).toHaveLength(2);
    expect(layer.querySelector<HTMLButtonElement>('.toast-collapse')?.getAttribute('aria-label')).toContain('2 条');
  });
});
