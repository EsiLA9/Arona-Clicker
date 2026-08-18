// ============================================================
// ui/modal.test.ts — 弹窗母版骨架
// ============================================================
import { describe, test, expect } from 'vitest';
import { renderModalShell } from './modal';

describe('renderModalShell (弹窗母版)', () => {
  test('renders overlay, panel, close button, title and body', () => {
    const html = renderModalShell({
      title: '帮助',
      body: '<p>内容体</p>',
      footer: '<button class="primary-button">确定</button>',
    });
    expect(html).toContain('modal-overlay');
    expect(html).toContain('modal-panel');
    expect(html).toContain('modal-close');
    expect(html).toContain('帮助');
    expect(html).toContain('<p>内容体</p>');
    expect(html).toContain('modal-foot');
    expect(html).toContain('<button class="primary-button">确定</button>');
  });

  test('escapes the title and omits footer when absent', () => {
    const html = renderModalShell({ title: '<script>', body: '<b>x</b>' });
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('modal-foot');
  });

  test('marks overlay dismissable unless disabled', () => {
    expect(renderModalShell({ body: 'x' })).toContain('data-modal-overlay');
    expect(renderModalShell({ body: 'x', dismissable: false })).not.toContain('data-modal-overlay');
  });
});
