import { describe, expect, test } from 'vitest';
import {
  createWorldDomainPolicySummary,
  WORLD_DOMAIN_CONTRACT_VERSION,
  WORLD_DOMAIN_KEY,
  WORLD_DOMAIN_POLICY_SUMMARY,
} from '../../src/data-services/authoring/policies/world';

describe('World domain Policy module', () => {
  test('projects the four existing World Policies in stable order without registering a second policy table', () => {
    expect(WORLD_DOMAIN_POLICY_SUMMARY).toMatchObject({
      domainKey: WORLD_DOMAIN_KEY,
      contractVersion: WORLD_DOMAIN_CONTRACT_VERSION,
    });
    expect(WORLD_DOMAIN_POLICY_SUMMARY.capabilities.map(summary => summary.table)).toEqual([
      'inits',
      'areas',
      'spots',
      'enhancements',
    ]);
    expect(WORLD_DOMAIN_POLICY_SUMMARY.capabilities.map(summary => summary.label)).toEqual([
      'Init',
      'Area',
      'Spot',
      'Enhancement',
    ]);
  });

  test('reports Apply strategy and capability boundaries from the current Policy implementation', () => {
    const byTable = new Map(WORLD_DOMAIN_POLICY_SUMMARY.capabilities.map(summary => [summary.table, summary]));

    for (const table of ['inits', 'areas', 'spots'] as const) {
      expect(byTable.get(table)).toMatchObject({
        applyStrategy: 'local-mutation',
        opaqueSafe: false,
        runtimeReady: true,
        capabilities: { browse: true, inspect: true, draft: true, apply: true, level: 'A1' },
      });
    }

    expect(byTable.get('enhancements')).toMatchObject({
      applyStrategy: 'reload',
      opaqueSafe: false,
      runtimeReady: false,
      capabilities: { browse: true, inspect: true, draft: true, apply: false, level: 'D1' },
    });
    expect(byTable.get('enhancements')?.capabilities.reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'reload-strategy', level: 'runtimeReady' }),
      expect.objectContaining({ code: 'opaque-structure', level: 'opaqueSafe' }),
    ]));
  });

  test('preserves every writable surface and its materialization status without reading runtime state', () => {
    const summary = createWorldDomainPolicySummary();
    const spots = summary.capabilities.find(item => item.table === 'spots')!;
    const enhancements = summary.capabilities.find(item => item.table === 'enhancements')!;

    expect(spots.materialization.map(entry => entry.field)).toEqual([
      'idName',
      'areaId',
      'name',
      'description',
      'maxLevel',
      'conditionText',
      'global',
      'functionalities',
      'levelUpgrades',
      'purchaseOptions',
      'revealTriggers',
      'tags',
      'gachaPools',
    ]);
    expect(spots.materialization.every(entry => entry.status === 'ready')).toBe(true);
    expect(spots.materialization.find(entry => entry.field === 'functionalities')).toMatchObject({
      consumers: ['registry-record', 'affector', 'game-num', 'ui-dynamic'],
      invalidate: 'remount',
      trigger: expect.stringContaining('spotDefinitionChanged'),
    });
    expect(enhancements.materialization.find(entry => entry.field === 'attachment')).toMatchObject({
      consumers: ['registry-record', 'init-scope', 'visibility'],
      invalidate: 'remount',
      trigger: expect.stringContaining('reloadPreservingState'),
    });
    expect(summary.materialization.filter(entry => entry.table === 'spots')).toHaveLength(spots.materialization.length);
  });

  test('returns fresh summary containers and never mutates the source Policy through a projection', () => {
    const first = createWorldDomainPolicySummary();
    const second = createWorldDomainPolicySummary();

    expect(first).not.toBe(second);
    expect(first.capabilities).not.toBe(second.capabilities);
    expect(first.capabilities[2].materialization).not.toBe(second.capabilities[2].materialization);
    expect(first.capabilities[2].materialization[0].consumers).not.toBe(second.capabilities[2].materialization[0].consumers);
    expect(first.capabilities[2].materialization[0].consumers).toEqual(['registry-record']);
  });
});
