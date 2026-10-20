// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest';
import {
  MAP_CARD_ENTRY_ATTRIBUTE,
  MAP_CARD_INSTANCE_ATTRIBUTE,
  MAP_CARD_OPTION_ATTRIBUTE,
  MAP_CARD_USAGE_ATTRIBUTE,
  isReservedCardMark,
  mapCardBindingAttributes,
  mapCardHasEntry,
  mapCardInstanceAt,
  mapCardInstanceKey,
  mapLocationObjectKey,
} from '../../src/ui/cards/card-host';

const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

describe('Card host binding', () => {
  test('same object in different hosts or slots keeps one object key and distinct instance keys', () => {
    const objectKey = '["run","map","node",null,1,"card","serika:rifle-shot"]';
    const mapCopy = mapCardInstanceKey('map:run', 'serika:current', objectKey);
    const flowCopy = mapCardInstanceKey('flow:map:run', 'flow-entry-1:card', objectKey);
    expect(mapCopy).not.toBe(flowCopy);
    expect(mapCopy).toContain(objectKey);
    expect(flowCopy).toContain(objectKey);
  });

  test('attributes separate visual identity, usage, object, relation and entries', () => {
    const html = `<button${mapCardBindingAttributes(escape, {
      instanceKey: 'map:run::current::object',
      usage: 'live',
      objectKey: 'object',
      relationKey: 'relation',
      entries: ['inspect', 'target', 'inspect'],
      optionId: 'swap:rifle-shot',
    })}></button>`;
    const root = document.createElement('div');
    root.innerHTML = html;
    const node = root.querySelector('button')!;
    expect(node.dataset.mapInstanceKey).toBe('map:run::current::object');
    expect(node.dataset.mapCardUsage).toBe('live');
    expect(node.getAttribute(MAP_CARD_USAGE_ATTRIBUTE)).toBe('live');
    expect(node.dataset.mapObjectKey).toBe('object');
    expect(node.dataset.mapRelationKey).toBe('relation');
    expect(node.getAttribute(MAP_CARD_ENTRY_ATTRIBUTE)).toBe('inspect target');
    expect(node.getAttribute(MAP_CARD_OPTION_ATTRIBUTE)).toBe('swap:rifle-shot');
    expect(mapCardHasEntry(node, 'target')).toBe(true);
    expect(mapCardHasEntry(node, 'replace')).toBe(false);
    expect(mapCardInstanceAt(node)).toBe(node);
    expect(node.hasAttribute(MAP_CARD_INSTANCE_ATTRIBUTE)).toBe(true);
  });

  test('replacement offer without a real card keeps an instance and option but no object key', () => {
    const root = document.createElement('div');
    root.innerHTML = `<button${mapCardBindingAttributes(escape, {
      instanceKey: 'map:run::picker::playerCommand::command',
      usage: 'replacement',
      entries: ['inspect'],
      optionId: 'playerCommand:command',
    })}></button>`;
    const node = root.querySelector('button')!;
    expect(node.hasAttribute('data-map-object-key')).toBe(false);
    expect(mapCardHasEntry(node, 'inspect')).toBe(true);
    expect(mapCardHasEntry(node, 'target')).toBe(false);
  });

  test('Map node copies share a typed object identity and expose a location selection entry', () => {
    const ref = { kind: 'mapNode' as const, runId: 'run', mapId: 'map', nodeId: 'node-b' };
    const objectKey = mapLocationObjectKey(ref);
    const first = mapCardInstanceKey('flow:run', 'entry-1:location:node-b', objectKey);
    const second = mapCardInstanceKey('map:run', 'map-list:node-b', objectKey);
    expect(first).not.toBe(second);
    expect(first).toContain(objectKey);
    expect(mapLocationObjectKey({ ...ref, runId: 'other-run' })).not.toBe(objectKey);
    expect(mapLocationObjectKey({ ...ref, mapId: 'other-map' })).not.toBe(objectKey);
    expect(mapLocationObjectKey({ ...ref, nodeId: 'node-c' })).not.toBe(objectKey);

    const root = document.createElement('div');
    root.innerHTML = `<article${mapCardBindingAttributes(escape, {
      instanceKey: first,
      usage: 'live',
      objectKey,
      entries: ['selectLocation'],
    })}></article>`;
    expect(mapCardHasEntry(root.firstElementChild as HTMLElement, 'selectLocation')).toBe(true);
  });

  test('generic Flow marks cannot mint typed card binding attributes', () => {
    for (const name of [
      'data-map-object-key',
      'data-map-relation-key',
      'data-map-instance-key',
      'data-map-card-usage',
      'data-map-card-entry',
      'data-map-card-option',
      'data-map-card-target',
      'data-map-target-edit',
    ]) expect(isReservedCardMark(name)).toBe(true);
    expect(isReservedCardMark('data-map-move-to')).toBe(false);
    expect(isReservedCardMark('role')).toBe(false);
  });
});
