// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest';
import type { MapActionRelation, MapRelationScope } from '../../src/arona-clicker/contracts/map-relations';
import { mapObjectKey, mapUnitKey, presentMapRelations } from '../../src/ui/workspace/map-relation-presentation';

const scope: MapRelationScope = { runId: 'run', mapId: 'map', nodeId: 'node', activityId: null, round: 1 };
const unit = (id: string) => ({ kind: 'partyCharacter' as const, id, scope });
const relation: MapActionRelation = {
  key: 'relation', scope, draft: { nodeId: 'node', round: 1, draftVersion: 2 },
  phase: 'preparation', visibility: 'public', source: { kind: 'preparedAction', id: 'a', actionId: 'shoot', performer: unit('a') },
  selectedTarget: unit('b'), targetState: 'determined', selectionMode: 'selectable', candidates: [unit('a'), unit('b'), unit('c')],
  canSelectTarget: true, canReplaceAction: true, effectRecipients: [],
};

function mounted() {
  const root = document.createElement('div');
  const card = document.createElement('button');
  card.dataset.mapRelationKey = relation.key;
  root.append(card);
  const units = ['a', 'b', 'c', 'illegal'].map(id => {
    const node = document.createElement('section');
    node.dataset.mapObjectKey = mapUnitKey(scope, 'partyCharacter', id);
    root.append(node);
    return node;
  });
  return { root, card, units };
}

describe('Map relation visual roles', () => {
  test('highlights every copy of a card without confusing its owner or same-ID unit', () => {
    const { root, units } = mounted();
    const target = { kind: 'card' as const, scope, id: 'b' };
    const next = { kind: 'card' as const, scope, id: 'next' };
    const copies = [target, target, next].map(ref => {
      const node = document.createElement('button');
      node.dataset.mapObjectKey = mapObjectKey(ref);
      root.append(node);
      return node;
    });
    const cardRelation: MapActionRelation = { ...relation, selectedTarget: target, candidates: [target, next],
      effectRecipients: [{ kind: 'cardCost', resourceId: 'sCost', amount: -1, recipient: target }] };
    presentMapRelations(root, [cardRelation], true);
    expect(copies.slice(0, 2).every(node => node.dataset.mapRoleRecipient === '目标')).toBe(true);
    expect(copies[2].dataset.mapRoleCandidate).toBe('候选');
    expect(units[1].dataset.mapRoleRecipient).toBeUndefined();
    copies[0].remove();
    presentMapRelations(root, [cardRelation], true);
    expect(copies[1].dataset.mapRoleRecipient).toBe('目标');
    expect(cardRelation.selectedTarget).toBe(target);
  });
  test('marks source, selected target and weaker candidates without replacing elements', () => {
    const { root, card, units } = mounted();
    const before = [...root.children];
    presentMapRelations(root, [relation], true);
    expect(card.dataset.mapRoleSource).toBe('发起');
    expect(units[0].dataset.mapRoleSource).toBe('发起');
    expect(units[1].dataset.mapRoleRecipient).toBe('目标');
    expect(units[2].dataset.mapRoleCandidate).toBe('候选');
    expect(units[3].dataset.mapRoleCandidate).toBeUndefined();
    expect([...root.children]).toEqual(before);
    presentMapRelations(root, []);
    expect(root.querySelector('[data-map-role-source], [data-map-role-recipient], [data-map-role-candidate]')).toBeNull();
    expect([...root.children]).toEqual(before);
  });

  test('supports self dual roles, no target and multiple display copies', () => {
    const { root, card, units } = mounted();
    root.append(card.cloneNode(true));
    presentMapRelations(root, [{ ...relation, selectedTarget: unit('a') }]);
    expect(units[0].dataset.mapRoleSource).toBe('发起');
    expect(units[0].dataset.mapRoleRecipient).toBe('目标');
    expect(root.querySelectorAll('button[data-map-role-source]')).toHaveLength(2);
    presentMapRelations(root, [{ ...relation, selectedTarget: null, targetState: 'none', selectionMode: 'none' }], true);
    expect(root.querySelectorAll('[data-map-role-source]')).toHaveLength(3);
    expect(root.querySelector('[data-map-role-recipient], [data-map-role-candidate]')).toBeNull();
  });

  test('does not present unknown enemy targets or use effects as selected targets', () => {
    const { root } = mounted();
    presentMapRelations(root, [{ ...relation, source: { kind: 'enemy', id: 'enemy', actionId: null, performer: null },
      selectedTarget: null, targetState: 'unknown', candidates: [], selectionMode: 'rule',
      effectRecipients: [{ kind: 'hp', resourceId: null, amount: -2, recipient: unit('b') }],
    }], true);
    expect(root.querySelector('[data-map-role-recipient], [data-map-role-candidate]')).toBeNull();
    expect(mapUnitKey({ ...scope, round: 2 }, 'partyCharacter', 'a')).not.toBe(mapUnitKey(scope, 'partyCharacter', 'a'));
  });
});
