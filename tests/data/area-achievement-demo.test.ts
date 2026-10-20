import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import JSZip from 'jszip';
import type { Datapack } from '../../src/data-services/contracts/datapack';
import { mergeFragments, parseFragment } from '../../src/data-services/datapack/fragment-parser';
import { parsePackFromZipBuffer } from '../../src/data-services/datapack/pack-parser';
import { AronaClickerRuntime } from '../../src/arona-clicker/runtime';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';

const ROOT = process.cwd();
const PACK_DIR = 'datapack-dev/area-achievement-demo';
const ZIP_PATH = `${PACK_DIR}.zip`;
const MOD = 'area-achievement-demo';
const INIT = `${MOD}:init:archive-route`;
const ORIGIN = `${MOD}:area:supply-station`;
const ARCHIVE = `${MOD}:area:archive-room`;
const CREDIT = 'base:resource:credit';
const FRAGMENT = `${MOD}:item:archive-fragment`;
const CREDIT_MILESTONE = `${MOD}:milestone:steady-credit`;
const ITEM_MILESTONE = `${MOD}:milestone:archive-fragments`;
const CREDIT_ACHIEVEMENT = `${MOD}:achievement:steady-credit`;
const ITEM_ACHIEVEMENT = `${MOD}:achievement:archive-fragments`;

function readPackFile(name: string): string {
  return readFileSync(resolve(ROOT, PACK_DIR, name), 'utf8');
}

function loadDemoPack(): Datapack {
  const manifest = JSON.parse(readPackFile('datapack.json')) as { modName: string };
  const fragments = ['00-world.json', '01-achievements.json'].map(name =>
    parseFragment(`${PACK_DIR}/${name}`, readPackFile(name)));
  return { ...mergeFragments(fragments), modName: manifest.modName };
}

function achievementIds(game: GameInstance): string[] {
  return game.getAchievementView().map(item => item.id);
}

function milestoneRegistrations(game: GameInstance) {
  return game.triggerSystem.getDefinitions().filter(def => def.id?.startsWith('milestone-runtime:'));
}

describe('area achievement demo datapack', () => {
  let game: GameInstance | undefined;

  afterEach(() => { game?.stop(); game = undefined; });

  test('reaches both independent goals through production and repeated Area visits', () => {
    const manifest = JSON.parse(readPackFile('datapack.json')) as {
      dependencies: string[];
      modName: string;
      name: string;
      version: string;
    };
    const demoPack = loadDemoPack();
    game = new GameInstance();
    game.init([baseDatapack, demoPack], { enterDefaultInit: false });

    expect(manifest.modName).toBe(MOD);
    expect(manifest.dependencies).toContain('base');
    expect(demoPack.name).toBe(manifest.name);
    expect(demoPack.version).toBe(manifest.version);
    expect(game.registry.areas.get(ORIGIN)?.adjacentAreaIds).toContain(ARCHIVE);
    expect(game.registry.areas.get(ARCHIVE)?.adjacentAreaIds).toContain(ORIGIN);
    expect(game.inits.startNewGame(INIT)).toBe(true);
    expect(achievementIds(game)).toContain(CREDIT_ACHIEVEMENT);
    expect(achievementIds(game)).not.toContain(ITEM_ACHIEVEMENT);
    expect(milestoneRegistrations(game).some(def => def.id?.includes(ITEM_MILESTONE))).toBe(false);

    const startingCredit = game.state.resources[CREDIT] ?? 0;
    for (let tick = 0; tick < 6; tick += 1) game.tick();

    expect(game.state.milestoneProgress?.completed).toContain(CREDIT_MILESTONE);
    expect(game.state.milestoneProgress?.completed).not.toContain(ITEM_MILESTONE);
    expect(game.state.resources[CREDIT] - startingCredit).toBe(8);
    expect(achievementIds(game)).toContain(CREDIT_ACHIEVEMENT);
    expect(achievementIds(game)).not.toContain(ITEM_ACHIEVEMENT);

    const creditBeforeItemReward = game.state.resources[CREDIT] ?? 0;
    expect(game.travelToArea(ARCHIVE).success).toBe(true);
    expect(achievementIds(game)).toContain(ITEM_ACHIEVEMENT);
    expect(game.state.inventory[FRAGMENT]).toBe(1);
    expect(game.state.milestoneProgress?.completed).not.toContain(ITEM_MILESTONE);
    expect(milestoneRegistrations(game).some(def => def.id?.includes(ITEM_MILESTONE))).toBe(true);

    expect(game.travelToArea(ORIGIN).success).toBe(true);
    expect(game.travelToArea(ARCHIVE).success).toBe(true);
    expect(game.travelToArea(ORIGIN).success).toBe(true);
    expect(game.travelToArea(ARCHIVE).success).toBe(true);
    expect(game.state.inventory[FRAGMENT]).toBe(3);
    expect(game.state.milestoneProgress?.completed).toContain(ITEM_MILESTONE);
    expect(game.state.resources[CREDIT] - creditBeforeItemReward).toBe(5);

    const creditAfterRewards = game.state.resources[CREDIT];
    expect(game.travelToArea(ORIGIN).success).toBe(true);
    expect(game.travelToArea(ARCHIVE).success).toBe(true);
    expect(game.state.inventory[FRAGMENT]).toBe(4);
    expect(game.state.resources[CREDIT]).toBe(creditAfterRewards);

    game.load(game.save());
    expect(game.inits.resumeInit(INIT)).toBe(true);
    expect(game.state.milestoneProgress?.completed).toContain(CREDIT_MILESTONE);
    expect(game.state.milestoneProgress?.completed).toContain(ITEM_MILESTONE);
    expect(game.state.resources[CREDIT]).toBe(creditAfterRewards);
    expect(achievementIds(game)).toContain(CREDIT_ACHIEVEMENT);
    expect(achievementIds(game)).toContain(ITEM_ACHIEVEMENT);
  });

  test('the collected-item goal can finish before any production ticks', () => {
    game = new GameInstance();
    game.init([baseDatapack, loadDemoPack()], { enterDefaultInit: false });
    expect(game.inits.startNewGame(INIT)).toBe(true);

    expect(game.state.milestoneProgress?.completed).not.toContain(CREDIT_MILESTONE);
    expect(game.travelToArea(ARCHIVE).success).toBe(true);
    expect(game.state.milestoneProgress?.completed).not.toContain(ITEM_MILESTONE);
    expect(game.travelToArea(ORIGIN).success).toBe(true);
    expect(game.travelToArea(ARCHIVE).success).toBe(true);
    expect(game.travelToArea(ORIGIN).success).toBe(true);
    expect(game.travelToArea(ARCHIVE).success).toBe(true);

    expect(game.state.milestoneProgress?.completed).toContain(ITEM_MILESTONE);
    expect(game.state.milestoneProgress?.completed).not.toContain(CREDIT_MILESTONE);
    expect(game.state.inventory[FRAGMENT]).toBe(3);
  });

  test('imports the root ZIP with source-identical fragments into the Runtime pack library', async () => {
    const zipBytes = readFileSync(resolve(ROOT, ZIP_PATH));
    const zip = await JSZip.loadAsync(zipBytes);
    const sourceFiles = ['datapack.json', '00-world.json', '01-achievements.json'];
    const zipEntries = Object.values(zip.files).filter(entry => !entry.dir);

    expect(zipEntries.map(entry => entry.name).sort()).toEqual([...sourceFiles].sort());
    for (const name of sourceFiles) {
      const entry = zip.file(name);
      expect(entry).not.toBeNull();
      const zippedBytes = await entry!.async('uint8array');
      const sourceBytes = readFileSync(resolve(ROOT, PACK_DIR, name));
      expect(Buffer.from(zippedBytes).equals(sourceBytes)).toBe(true);
    }

    const parsed = await parsePackFromZipBuffer(zipBytes);
    expect(parsed.manifest).toMatchObject({ modName: MOD, name: '双区域档案演示', version: '1.0.0', dependencies: ['base'] });
    expect(parsed.jsonFileCount).toBe(2);
    expect(parsed.datapack.inits.map(init => init.id)).toContain(INIT);
    expect(parsed.datapack.areas.map(area => area.id)).toEqual(expect.arrayContaining([ORIGIN, ARCHIVE]));
    expect(parsed.datapack.achievements?.map(achievement => achievement.id)).toEqual(expect.arrayContaining([
      CREDIT_ACHIEVEMENT,
      ITEM_ACHIEVEMENT,
    ]));

    const runtime = new AronaClickerRuntime();
    runtime.registerParsedPack(parsed);
    const packId = `${MOD}@${parsed.manifest.version}`;
    expect(runtime.getPackCatalog().entries.find(entry => entry.id === packId)?.enabled).toBe(false);
    const current = runtime.getPackConfiguration();
    const result = runtime.applyPackConfiguration({
      ...current,
      enabledIds: current.enabledIds.includes(packId) ? [...current.enabledIds] : [...current.enabledIds, packId],
      order: current.order.includes(packId) ? [...current.order] : [...current.order, packId],
    });

    expect(result.ok).toBe(true);
    expect(runtime.packManager.snapshot().enabledIds).toContain(packId);
    expect(runtime.registry.loadedModNames.has(MOD)).toBe(true);
    expect(runtime.registry.inits.has(INIT)).toBe(true);
    expect(runtime.registry.areas.has(ORIGIN)).toBe(true);
    expect(runtime.registry.areas.has(ARCHIVE)).toBe(true);
    expect(runtime.registry.achievements.has(CREDIT_ACHIEVEMENT)).toBe(true);
    expect(runtime.registry.achievements.has(ITEM_ACHIEVEMENT)).toBe(true);
    runtime.stop();
  });
});
