import { describe, expect, test } from 'vitest';
import type { Datapack } from '../../src/data-services/contracts/datapack';
import type { SpotDef } from '../../src/data-services/contracts/world';
import { Registry } from '../../src/data-services/registry/registry';

const areaOne = 'base:area:area_one';
const areaTwo = 'base:area:area_two';
const baseSpotId = 'base:spot:base_spot';
const draftMod = 'draft-mod';
const draftSpotId = `${draftMod}:spot:draft_spot`;

const spot = (id: string, areaId: string, name: string, tags: string[][] = []): SpotDef => ({
  id,
  areaId,
  name,
  description: `${name} description`,
  purchaseOptions: [{ id: 'free', costs: [] }],
  levelUpgrades: [],
  tags,
});

const datapack: Datapack = {
  name: 'registry mutation fixture',
  version: '1.0.0',
  modName: 'base',
  inits: [{ id: 'base:init:init', name: 'Init', description: '', defaultAreas: [] }],
  areas: [
    { id: areaOne, initId: 'base:init:init', name: 'Area One', description: '', defaultSpots: [] },
    { id: areaTwo, initId: 'base:init:init', name: 'Area Two', description: '', defaultSpots: [] },
  ],
  spots: [spot(baseSpotId, areaOne, 'Base Spot')],
  enhancements: [],
  activeStories: [],
  passiveStories: [],
  stories: [],
  items: [],
  funcletDefs: [],
  characters: [],
};

const makeRegistry = (): Registry => {
  const registry = new Registry();
  registry.load(datapack);
  return registry;
};

describe('Registry Spot 局部 mutation', () => {
  test('create updates the Spot, Area and hierarchical Tag indexes', () => {
    const registry = makeRegistry();
    const draftSpot = spot(draftSpotId, areaOne, 'Draft Spot', [['draft-mod:office', 'layout', 'desk']]);

    const receipt = registry.applySpotMutation({ operation: 'create', ownerModName: draftMod, spot: draftSpot });

    expect(registry.spots.get(draftSpotId)).toBe(draftSpot);
    expect(registry.spotOwnerOf(draftSpotId)).toBe(draftMod);
    expect(registry.spotsOfArea(areaOne)).toEqual([baseSpotId, draftSpotId]);
    expect(registry.spotsWithTag(['draft-mod:office'])).toContain(draftSpotId);
    expect(registry.spotsWithTag(['draft-mod:office', 'layout'])).toContain(draftSpotId);
    expect(registry.spotsWithTag(['draft-mod:office', 'layout', 'desk'])).toContain(draftSpotId);
    expect(receipt.previousSpot).toBeUndefined();
    expect(receipt.currentSpot).toBe(draftSpot);
  });

  test('replace moves Area and Tag indexes without leaving ghosts', () => {
    const registry = makeRegistry();
    const created = spot(draftSpotId, areaOne, 'Draft Spot', [['draft-mod:office', 'layout']]);
    registry.applySpotMutation({ operation: 'create', ownerModName: draftMod, spot: created });
    const replacement = spot(draftSpotId, areaTwo, 'Renamed Spot', [['draft-mod:field', 'combat']]);

    const receipt = registry.applySpotMutation({ operation: 'replace', ownerModName: draftMod, spot: replacement });

    expect(registry.spots.get(draftSpotId)).toBe(replacement);
    expect(registry.spotsOfArea(areaOne)).not.toContain(draftSpotId);
    expect(registry.spotsOfArea(areaTwo)).toEqual([draftSpotId]);
    expect(registry.spotsWithTag(['draft-mod:office'])).not.toContain(draftSpotId);
    expect(registry.spotsWithTag(['draft-mod:field'])).toContain(draftSpotId);
    expect(receipt.previousSpot).toBe(created);
    expect(receipt.currentSpot).toBe(replacement);
  });

  test('delete removes all local indexes and its receipt restores the exact prior state', () => {
    const registry = makeRegistry();
    const draftSpot = spot(draftSpotId, areaOne, 'Draft Spot', [['draft-mod:office', 'layout']]);
    registry.applySpotMutation({ operation: 'create', ownerModName: draftMod, spot: draftSpot });

    const receipt = registry.applySpotMutation({ operation: 'delete', ownerModName: draftMod, spotId: draftSpotId });
    expect(registry.spots.has(draftSpotId)).toBe(false);
    expect(registry.spotOwnerOf(draftSpotId)).toBeUndefined();
    expect(registry.spotsOfArea(areaOne)).not.toContain(draftSpotId);
    expect(registry.spotsWithTag(['draft-mod:office'])).not.toContain(draftSpotId);

    receipt.rollback();
    expect(registry.spots.get(draftSpotId)).toBe(draftSpot);
    expect(registry.spotOwnerOf(draftSpotId)).toBe(draftMod);
    expect(registry.spotsOfArea(areaOne)).toContain(draftSpotId);
    expect(registry.spotsWithTag(['draft-mod:office'])).toContain(draftSpotId);
    receipt.rollback();
  });

  test('create receipt rollback removes the created Spot and all indexes', () => {
    const registry = makeRegistry();
    const draftSpot = spot(draftSpotId, areaTwo, 'Draft Spot', [['draft-mod:office']]);
    const receipt = registry.applySpotMutation({ operation: 'create', ownerModName: draftMod, spot: draftSpot });

    receipt.rollback();

    expect(registry.spots.has(draftSpotId)).toBe(false);
    expect(registry.spotsOfArea(areaTwo)).toEqual([]);
    expect(registry.spotsWithTag(['draft-mod:office'])).not.toContain(draftSpotId);
  });

  test('suspend removes the Spot from active indexes while retaining its source and owner, and resume restores it', () => {
    const registry = makeRegistry();
    const draftSpot = spot(draftSpotId, areaTwo, 'Draft Spot', [['draft-mod:office', 'layout']]);
    registry.applySpotMutation({ operation: 'create', ownerModName: draftMod, spot: draftSpot });

    const suspendReceipt = registry.applySpotMutation({ operation: 'suspend', ownerModName: draftMod, spotId: draftSpotId });

    expect(registry.spots.has(draftSpotId)).toBe(false);
    expect(registry.isSpotSuspended(draftSpotId)).toBe(true);
    expect(registry.spotIncludingSuspended(draftSpotId)).toBe(draftSpot);
    expect(registry.spotOwnerOf(draftSpotId)).toBe(draftMod);
    expect(registry.spotsOfArea(areaTwo)).not.toContain(draftSpotId);
    expect(registry.spotsWithTag(['draft-mod:office'])).not.toContain(draftSpotId);
    expect(suspendReceipt.previousSpot).toBe(draftSpot);
    expect(suspendReceipt.currentSpot).toBeUndefined();

    const resumeReceipt = registry.applySpotMutation({ operation: 'resume', ownerModName: draftMod, spotId: draftSpotId });

    expect(registry.spots.get(draftSpotId)).toBe(draftSpot);
    expect(registry.isSpotSuspended(draftSpotId)).toBe(false);
    expect(registry.spotIncludingSuspended(draftSpotId)).toBe(draftSpot);
    expect(registry.spotOwnerOf(draftSpotId)).toBe(draftMod);
    expect(registry.spotsOfArea(areaTwo)).toContain(draftSpotId);
    expect(registry.spotsWithTag(['draft-mod:office'])).toContain(draftSpotId);
    expect(resumeReceipt.previousSpot).toBe(draftSpot);
    expect(resumeReceipt.currentSpot).toBe(draftSpot);
  });

  test('suspend receipt rolls back to the exact prior resolution state', () => {
    const registry = makeRegistry();
    const draftSpot = spot(draftSpotId, areaOne, 'Draft Spot', [['draft-mod:office']]);
    registry.applySpotMutation({ operation: 'create', ownerModName: draftMod, spot: draftSpot });

    const suspendReceipt = registry.applySpotMutation({ operation: 'suspend', ownerModName: draftMod, spotId: draftSpotId });
    suspendReceipt.rollback();
    expect(registry.spots.get(draftSpotId)).toBe(draftSpot);
    expect(registry.isSpotSuspended(draftSpotId)).toBe(false);
    expect(registry.spotsOfArea(areaOne)).toContain(draftSpotId);

  });

  test('resume receipt rolls back to the exact prior suspended state', () => {
    const registry = makeRegistry();
    const draftSpot = spot(draftSpotId, areaOne, 'Draft Spot', [['draft-mod:office']]);
    registry.applySpotMutation({ operation: 'create', ownerModName: draftMod, spot: draftSpot });
    registry.applySpotMutation({ operation: 'suspend', ownerModName: draftMod, spotId: draftSpotId });

    const resumeReceipt = registry.applySpotMutation({ operation: 'resume', ownerModName: draftMod, spotId: draftSpotId });
    resumeReceipt.rollback();

    expect(registry.spots.has(draftSpotId)).toBe(false);
    expect(registry.isSpotSuspended(draftSpotId)).toBe(true);
    expect(registry.spotIncludingSuspended(draftSpotId)).toBe(draftSpot);
    expect(registry.spotOwnerOf(draftSpotId)).toBe(draftMod);
    expect(registry.spotsOfArea(areaOne)).not.toContain(draftSpotId);
    expect(registry.spotsWithTag(['draft-mod:office'])).not.toContain(draftSpotId);
  });

  test('rejects suspend, resume, and delete from a non-owner, including while suspended', () => {
    const registry = makeRegistry();
    const draftSpot = spot(draftSpotId, areaOne, 'Draft Spot');
    registry.applySpotMutation({ operation: 'create', ownerModName: draftMod, spot: draftSpot });

    expect(() => registry.applySpotMutation({ operation: 'suspend', ownerModName: 'other-mod', spotId: draftSpotId })).toThrow(/不属于 Mod|不能由 Mod/);
    registry.applySpotMutation({ operation: 'suspend', ownerModName: draftMod, spotId: draftSpotId });
    expect(() => registry.applySpotMutation({ operation: 'resume', ownerModName: 'other-mod', spotId: draftSpotId })).toThrow(/不属于 Mod|不能由 Mod/);
    expect(() => registry.applySpotMutation({ operation: 'delete', ownerModName: 'other-mod', spotId: draftSpotId })).toThrow(/不属于 Mod|不能由 Mod/);
    expect(registry.isSpotSuspended(draftSpotId)).toBe(true);
    expect(registry.spotIncludingSuspended(draftSpotId)).toBe(draftSpot);
  });

  test('delete of a suspended Spot removes its retained source and receipt restores the suspension', () => {
    const registry = makeRegistry();
    const draftSpot = spot(draftSpotId, areaOne, 'Draft Spot', [['draft-mod:office']]);
    registry.applySpotMutation({ operation: 'create', ownerModName: draftMod, spot: draftSpot });
    registry.applySpotMutation({ operation: 'suspend', ownerModName: draftMod, spotId: draftSpotId });

    const receipt = registry.applySpotMutation({ operation: 'delete', ownerModName: draftMod, spotId: draftSpotId });

    expect(registry.spots.has(draftSpotId)).toBe(false);
    expect(registry.isSpotSuspended(draftSpotId)).toBe(false);
    expect(registry.spotIncludingSuspended(draftSpotId)).toBeUndefined();
    expect(registry.spotOwnerOf(draftSpotId)).toBeUndefined();
    receipt.rollback();
    expect(registry.spots.has(draftSpotId)).toBe(false);
    expect(registry.isSpotSuspended(draftSpotId)).toBe(true);
    expect(registry.spotIncludingSuspended(draftSpotId)).toBe(draftSpot);
    expect(registry.spotOwnerOf(draftSpotId)).toBe(draftMod);
  });

  test('rejects invalid Area, duplicate create, and owner-mismatched mutation before writing', () => {
    const registry = makeRegistry();
    const draftSpot = spot(draftSpotId, areaOne, 'Draft Spot');
    registry.applySpotMutation({ operation: 'create', ownerModName: draftMod, spot: draftSpot });
    const beforeIds = registry.spotsOfArea(areaOne);

    expect(() => registry.applySpotMutation({
      operation: 'create',
      ownerModName: draftMod,
      spot: spot('draft-mod:spot:invalid_area', 'base:area:missing', 'Invalid'),
    })).toThrow(/unknown area/);
    expect(() => registry.applySpotMutation({ operation: 'create', ownerModName: draftMod, spot: draftSpot })).toThrow(/已存在/);
    expect(() => registry.applySpotMutation({
      operation: 'replace',
      ownerModName: draftMod,
      spot: spot(baseSpotId, areaOne, 'Must Not Replace Base'),
    })).toThrow(/不属于 Mod/);
    expect(() => registry.applySpotMutation({ operation: 'delete', ownerModName: draftMod, spotId: baseSpotId })).toThrow(/不属于 Mod/);

    expect(registry.spots.get(draftSpotId)).toBe(draftSpot);
    expect(registry.spotsOfArea(areaOne)).toEqual(beforeIds);
  });

  test('rejects rollback after a later mutation to preserve atomicity', () => {
    const registry = makeRegistry();
    const first = registry.applySpotMutation({
      operation: 'create',
      ownerModName: draftMod,
      spot: spot(draftSpotId, areaOne, 'Draft Spot'),
    });
    registry.applySpotMutation({
      operation: 'replace',
      ownerModName: draftMod,
      spot: spot(draftSpotId, areaOne, 'Changed Spot'),
    });

    expect(() => first.rollback()).toThrow(/再次变更/);
    expect(registry.spots.get(draftSpotId)?.name).toBe('Changed Spot');
  });

  test('datapack override removes the previous Spot from stale Area and Tag indexes', () => {
    const registry = makeRegistry();
    registry.load({
      ...datapack,
      name: 'extension fixture',
      modName: 'extension',
      spots: [spot(baseSpotId, areaTwo, 'Overridden Spot', [['extension:field', 'combat']])],
    });

    expect(registry.spots.get(baseSpotId)?.name).toBe('Overridden Spot');
    expect(registry.spotOwnerOf(baseSpotId)).toBe('extension');
    expect(registry.spotsOfArea(areaOne)).not.toContain(baseSpotId);
    expect(registry.spotsOfArea(areaTwo)).toEqual([baseSpotId]);
    expect(registry.spotsWithTag(['base:office'])).not.toContain(baseSpotId);
    expect(registry.spotsWithTag(['extension:field'])).toContain(baseSpotId);
  });
});
