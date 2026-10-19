// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { MapActionRelation, MapRelationScope, MapTargetRef } from '../../src/arona-clicker/contracts/map-relations';
import { MapRelationInteraction } from '../../src/ui/workspace/map-relation-interaction';
import { mapObjectKey, mapUnitKey } from '../../src/ui/workspace/map-relation-presentation';

const scope: MapRelationScope = { runId: 'run', mapId: 'map', nodeId: 'node', activityId: null, round: 1 };
function relation(id: string, target: string): MapActionRelation {
  return { key: id, scope, draft: { nodeId: 'node', round: 1, draftVersion: 0 }, phase: 'preparation', visibility: 'public',
    source: { kind: 'preparedAction', id, actionId: id, performer: { scope, kind: 'partyCharacter', id } },
    selectedTarget: { scope, kind: 'enemy', id: target }, targetState: 'determined', selectionMode: 'selectable',
    candidates: ['robot', 'robot-b'].map(id => ({ scope, kind: 'enemy' as const, id })), canSelectTarget: true, canReplaceAction: true, effectRecipients: [],
  };
}

describe('Map relation interaction priority', () => {
  const sessions: MapRelationInteraction[] = [];
  afterEach(() => { sessions.splice(0).forEach(session => session.dispose()); document.body.innerHTML = ''; vi.restoreAllMocks(); });
  function setup(preview?: (relation: MapActionRelation, actionId: string) => readonly MapActionRelation[], confirm?: (relation: MapActionRelation, target: MapTargetRef) => void) {
    const root = document.createElement('div');
    root.innerHTML = `<main data-map-workspace-region data-map-run-id="run">
      <button data-map-relation-key="a" data-map-hand-stack-toggle aria-expanded="false">A</button>
      <button data-map-relation-key="b" data-map-hand-stack-toggle aria-expanded="false">B</button>
      <button data-map-relation-pin="a">Pin</button><article data-map-actor-face tabindex="0"></article><section tabindex="0"></section>
      <p data-map-relation-status></p></main>`;
    const a = root.querySelectorAll<HTMLButtonElement>('button')[0];
    const b = root.querySelectorAll<HTMLButtonElement>('button')[1];
    const pin = root.querySelectorAll<HTMLButtonElement>('button')[2];
    const actorFace = root.querySelector<HTMLElement>('[data-map-actor-face]')!;
    const target = root.querySelector<HTMLElement>('section')!;
    actorFace.dataset.mapObjectKey = mapUnitKey(scope, 'partyCharacter', 'a');
    target.dataset.mapObjectKey = mapUnitKey(scope, 'enemy', 'robot');
    document.body.append(root);
    let relations = [relation('a', 'robot'), relation('b', 'robot-b')];
    const query = () => relations;
    const session = new MapRelationInteraction(root, query, preview, confirm);
    sessions.push(session);
    session.reconcile();
    return { root, a, b, pin, actorFace, target, session, set: (next: MapActionRelation[]) => { relations = next; session.reconcile(); } };
  }
  const over = (element: HTMLElement) => element.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));

  test('pointer inspection and reverse target inspection are read-only attribute updates', () => {
    const { root, a, b, actorFace, target } = setup();
    over(a);
    expect(a.dataset.mapRoleSource).toBe('发起');
    expect(target.dataset.mapRoleRecipient).toBe('接收');
    over(actorFace);
    expect(actorFace.dataset.mapRoleSource).toBeUndefined();
    expect(a.dataset.mapRoleSource).toBe('发起');
    over(b);
    expect(a.dataset.mapRoleSource).toBeUndefined();
    over(target);
    expect(a.dataset.mapRoleSource).toBe('发起');
    expect(b.dataset.mapRoleSource).toBeUndefined();
    expect(root.querySelector('[data-map-workspace-region]')?.getAttribute('data-map-relation-mode')).toBe('pointer');
  });

  test('pin outranks Hover and open replacement outranks pin, then restores lower priority', async () => {
    const { a, b, pin, session } = setup();
    pin.click(); await Promise.resolve();
    over(b);
    expect(a.dataset.mapRoleSource).toBe('发起');
    expect(b.dataset.mapRoleSource).toBeUndefined();
    b.setAttribute('aria-expanded', 'true'); session.reconcile();
    expect(b.dataset.mapRoleSource).toBe('发起');
    expect(a.dataset.mapRoleSource).toBeUndefined();
    b.setAttribute('aria-expanded', 'false'); session.reconcile();
    expect(a.dataset.mapRoleSource).toBe('发起');
    expect(pin.getAttribute('aria-pressed')).toBe('true');
  });

  test('falls back to effective keyboard Focus after pointer leaves', () => {
    const { root, a, b } = setup();
    a.focus(); over(b);
    expect(b.dataset.mapRoleSource).toBe('发起');
    b.dispatchEvent(new MouseEvent('pointerout', { bubbles: true, relatedTarget: root }));
    expect(a.dataset.mapRoleSource).toBe('发起');
    expect(b.dataset.mapRoleSource).toBeUndefined();
  });

  test('reapplies roles after reconciliation, clears missing sources and removes listeners on disposal', async () => {
    const { a, b, pin, session, set } = setup();
    pin.click(); await Promise.resolve();
    delete a.dataset.mapRoleSource;
    session.reconcile();
    expect(a.dataset.mapRoleSource).toBe('发起');
    set([relation('b', 'robot-b')]);
    expect(pin.getAttribute('aria-pressed')).toBe('false');
    expect(a.dataset.mapRoleSource).toBeUndefined();
    over(b);
    session.dispose();
    expect(b.dataset.mapRoleSource).toBeUndefined();
    over(b);
    expect(b.dataset.mapRoleSource).toBeUndefined();
  });

  test('previews replacement candidates while keeping the original source, and restores on leave', () => {
    const preview = vi.fn(() => [{ ...relation('replacement', 'robot-b'), phase: 'replacementPreview' as const }]);
    const { root, a, target, session } = setup(preview);
    const picker = document.createElement('div');
    picker.dataset.mapHandPicker = '';
    picker.dataset.characterId = 'a';
    picker.innerHTML = '<button data-map-action-swap data-action-id="replacement">Replacement</button>';
    a.parentElement!.append(picker);
    a.setAttribute('aria-expanded', 'true'); session.reconcile();
    over(picker.firstElementChild as HTMLElement);
    expect(preview).toHaveBeenCalledWith(expect.objectContaining({ key: 'a' }), 'replacement');
    expect(a.dataset.mapRoleSource).toBe('发起');
    expect(target.dataset.mapRoleRecipient).toBeUndefined();
    expect(root.querySelector('[data-map-relation-status]')?.textContent).toContain('替换预览');
    over(a);
    expect(target.dataset.mapRoleRecipient).toBe('接收');
    (picker.firstElementChild as HTMLButtonElement).disabled = true;
    preview.mockClear();
    over(picker.firstElementChild as HTMLElement);
    expect(preview).not.toHaveBeenCalled();
    expect(target.dataset.mapRoleRecipient).toBe('接收');
  });

  test('session reset clears pinned state even when a loaded Run reuses the same identifiers', async () => {
    const { session, pin } = setup();
    pin.click(); await Promise.resolve();
    expect(pin.getAttribute('aria-pressed')).toBe('true');
    session.reset(); session.reconcile();
    expect(pin.getAttribute('aria-pressed')).toBe('false');
  });

  function editButton(root: HTMLElement) {
    const edit = document.createElement('button');
    edit.dataset.mapTargetEdit = 'a';
    root.querySelector('main')!.append(edit);
    return edit;
  }

  test('card hit testing confirms the Owner candidate even when its raw ID matches a unit', () => {
    const confirm = vi.fn();
    const { root, target, set } = setup(undefined, confirm);
    const card = { kind: 'card' as const, scope, id: 'robot' };
    const other = { kind: 'card' as const, scope, id: 'robot-b' };
    const row = { ...relation('a', 'robot'), selectedTarget: card, candidates: [card, other] };
    set([row]);
    editButton(root).click();
    target.click(); // Same raw ID, but this is still a unit rather than a legal card.
    expect(confirm).not.toHaveBeenCalled();
    target.dataset.mapObjectKey = mapObjectKey(card);
    const inside = document.createElement('span'); target.append(inside);
    inside.click();
    expect(confirm).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledWith(row, card);
    expect(root.querySelector('main')?.dataset.mapRelationMode).not.toBe('editing');
  });

  test('target editing blocks replacement opening and candidate commands until cancelled', () => {
    const { root, a, b } = setup(undefined, vi.fn());
    const picker = document.createElement('div');
    picker.dataset.mapHandPicker = '';
    picker.innerHTML = '<button data-map-action-swap>Swap</button><button data-map-player-command>Command</button>';
    root.querySelector('main')!.append(picker);
    const delegated = vi.fn();
    root.addEventListener('click', delegated);
    editButton(root).click();
    delegated.mockClear();
    b.click();
    picker.querySelectorAll('button').forEach(button => button.click());
    expect(delegated).not.toHaveBeenCalled();
    expect(a.dataset.mapRoleSource).toBe('发起');
    expect(root.querySelector('main')?.dataset.mapRelationMode).toBe('editing');
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    b.click();
    expect(delegated).toHaveBeenCalledTimes(1);
  });

  test('entering target editing closes an existing replacement through its normal delegate', () => {
    const { root, b } = setup(undefined, vi.fn());
    b.setAttribute('aria-expanded', 'true');
    const close = vi.fn(() => b.setAttribute('aria-expanded', 'false'));
    b.addEventListener('click', close);
    editButton(root).click();
    expect(close).toHaveBeenCalledTimes(1);
    expect(b.getAttribute('aria-expanded')).toBe('false');
    expect(root.querySelector('main')?.dataset.mapRelationMode).toBe('editing');
  });

  test('closing a Popover opener that is itself a card candidate does not confirm it', () => {
    const confirm = vi.fn();
    const { root, b, set } = setup(undefined, confirm);
    const card = { kind: 'card' as const, scope, id: 'open-card' };
    const other = { kind: 'card' as const, scope, id: 'other-card' };
    set([{ ...relation('a', 'robot'), selectedTarget: null, candidates: [card, other] }]);
    b.dataset.mapObjectKey = mapObjectKey(card);
    b.setAttribute('aria-expanded', 'true');
    b.addEventListener('click', () => b.setAttribute('aria-expanded', 'false'));
    editButton(root).click();
    expect(b.getAttribute('aria-expanded')).toBe('false');
    expect(root.querySelector('main')?.dataset.mapRelationMode).toBe('editing');
    expect(confirm).not.toHaveBeenCalled();
  });

  test('target editing locks source above Hover and confirms only legal clicked units once', () => {
    const confirm = vi.fn();
    const { root, a, b, target } = setup(undefined, confirm);
    editButton(root).click();
    over(b);
    expect(root.querySelector('main')?.dataset.mapRelationMode).toBe('editing');
    expect(a.dataset.mapRoleSource).toBe('发起');
    target.click();
    expect(confirm).toHaveBeenCalledOnce();
    expect(confirm.mock.calls[0][1]).toMatchObject({ kind: 'enemy', id: 'robot' });
  });

  test('Escape and changed versions cancel editing without confirming; keyboard confirms legal candidates', () => {
    const confirm = vi.fn();
    const { root, target, set } = setup(undefined, confirm);
    const edit = editButton(root);
    edit.click();
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(confirm).not.toHaveBeenCalled();
    edit.click();
    set([{ ...relation('a', 'robot'), draft: { nodeId: 'node', round: 1, draftVersion: 1 } }]);
    target.click();
    expect(confirm).not.toHaveBeenCalled();
    edit.click();
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(confirm).toHaveBeenCalledOnce();
  });

  test('drag threshold, legal hit and trailing click use one target confirmation and no card click', () => {
    const confirm = vi.fn();
    const { root, a, target } = setup(undefined, confirm);
    a.classList.add('map-workspace__unit-action-card');
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(target);
    const ordinaryClick = vi.fn(); a.addEventListener('click', ordinaryClick);
    a.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, button: 0, clientX: 10, clientY: 10 }));
    root.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: 12, clientY: 10 }));
    expect(root.querySelector('.map-workspace__target-drag-preview')).toBeNull();
    root.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: 50, clientY: 10 }));
    expect(root.querySelector('.map-workspace__target-drag-preview')).not.toBeNull();
    expect(target.dataset.mapRoleRecipient).toBe('接收');
    expect(target.dataset.mapRoleDrop).toBe('接收');
    root.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: 50, clientY: 10 }));
    a.click();
    expect(confirm).toHaveBeenCalledOnce();
    expect(ordinaryClick).not.toHaveBeenCalled();
    expect(root.querySelector('.map-workspace__target-drag-preview')).toBeNull();
  });

  test('invalid release and pointer cancellation remove previews without selecting an obscured object', () => {
    const confirm = vi.fn();
    const { root, a } = setup(undefined, confirm);
    a.classList.add('map-workspace__unit-action-card');
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(document.body);
    for (const cancel of ['pointerup', 'pointercancel']) {
      a.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, button: 0 }));
      root.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: 20 }));
      root.dispatchEvent(new PointerEvent(cancel, { bubbles: true, pointerId: 1, clientX: 20 }));
      expect(root.querySelector('.map-workspace__target-drag-preview')).toBeNull();
    }
    expect(confirm).not.toHaveBeenCalled();
  });
});
