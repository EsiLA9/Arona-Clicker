// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest';
import { captureFocusWithin, restoreFocusWithin } from '../../src/ui/focus';

describe('focus continuity helpers', () => {
  test('captures and restores focus by a unique control identity', () => {
    const current = document.createElement('section');
    current.innerHTML = '<div><button>操作</button></div>';
    document.body.appendChild(current);
    const button = current.querySelector('button')!;
    button.focus();

    const snapshot = captureFocusWithin(current);
    const replacement = current.cloneNode(true) as HTMLElement;
    current.replaceWith(replacement);

    expect(restoreFocusWithin(replacement, snapshot)).toBe(true);
    expect(document.activeElement).toBe(replacement.querySelector('button'));
  });

  test('does not restore focus when the replacement structure no longer matches', () => {
    const current = document.createElement('section');
    current.innerHTML = '<button>操作</button>';
    document.body.appendChild(current);
    current.querySelector('button')!.focus();

    const snapshot = captureFocusWithin(current);
    const replacement = document.createElement('section');
    replacement.innerHTML = '<p>已完成</p>';

    expect(restoreFocusWithin(replacement, snapshot)).toBe(false);
  });

  test('does not guess between repeated unlabeled controls when the path shifts', () => {
    const current = document.createElement('section');
    current.innerHTML = '<div><button>重复操作</button><button>重复操作</button></div>';
    document.body.appendChild(current);
    current.querySelectorAll('button')[1].focus();

    const snapshot = captureFocusWithin(current);
    const replacement = document.createElement('section');
    replacement.innerHTML = '<div><span></span><button>重复操作</button><button>重复操作</button></div>';
    current.replaceWith(replacement);

    expect(restoreFocusWithin(replacement, snapshot)).toBe(false);
    expect(document.activeElement).not.toBe(replacement.querySelector('button'));
  });
});
