import { afterEach, describe, expect, test } from 'vitest';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
import { gameplayBCarouselDatapack } from '../../src/arona-clicker/content/operation-samples/gameplay-b-datapack';
import { CAROUSEL_SCENE_ACTION_IDS as IDS } from '../../src/arona-clicker/content/operation-samples/carousel-scene-action-slice';
import { AronaClickerRuntime } from '../../src/arona-clicker/runtime';
import { Character } from '../../src/arona-clicker/types/ids';
import type { Datapack } from '../../src/data-services/contracts/datapack';
import type { ParsedPack } from '../../src/data-services/datapack/pack-parser';

const PACK_RECORD_ID = 'demo@1.0.0';
const STUDENTS = [Character.Hoshino, Character.Serika, Character.Shiroko] as const;
const VARIANTS: Record<typeof STUDENTS[number], string> = {
  [Character.Hoshino]: 'Hoshino',
  [Character.Serika]: 'Serika',
  [Character.Shiroko]: 'Shiroko',
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function parsedCarouselPack(datapack: Datapack): ParsedPack {
  return {
    manifest: {
      modName: datapack.modName!,
      name: datapack.name,
      version: datapack.version,
      dependencies: ['base'],
    },
    datapack,
    images: [],
    jsonFileCount: 1,
    ignoredCount: 0,
  };
}

function configurationWithCarousel(runtime: AronaClickerRuntime) {
  const configuration = runtime.getPackConfiguration();
  return {
    ...configuration,
    enabledIds: configuration.enabledIds.includes(PACK_RECORD_ID)
      ? [...configuration.enabledIds]
      : [...configuration.enabledIds, PACK_RECORD_ID],
  };
}

function savePackContent(runtime: AronaClickerRuntime, datapack: Datapack): void {
  const stored = runtime.packManager.getPack(PACK_RECORD_ID);
  if (!stored) throw new Error('Formal carousel Datapack is missing from the PackManager');
  runtime.packManager.savePack({ ...stored, datapack, contentDigest: undefined });
}

describe('Gameplay B Datapack authoring workflow', () => {
  const runtimes: AronaClickerRuntime[] = [];
  const createRuntime = (): AronaClickerRuntime => {
    const runtime = new AronaClickerRuntime();
    runtime.init([defaultDatapack], { enterDefaultInit: true });
    runtime.registerParsedPack(parsedCarouselPack(clone(gameplayBCarouselDatapack)), PACK_RECORD_ID);
    runtimes.push(runtime);
    return runtime;
  };

  afterEach(() => {
    for (const runtime of runtimes.splice(0)) if (runtime.running) runtime.stop();
  });

  test('validates, applies, edits, reloads and starts the same formal event without replacing Runtime on invalid content', () => {
    const runtime = createRuntime();
    const configuration = configurationWithCarousel(runtime);

    expect(runtime.validatePackConfiguration(configuration)).toEqual({ ok: true, errors: [], warnings: [] });
    const initialApply = runtime.applyPackConfiguration(configuration);
    expect(initialApply.ok, initialApply.message).toBe(true);
    expect(runtime.registry.operationEvents.get(IDS.event)?.resumeVersion).toBe(1);

    for (const student of STUDENTS) runtime.mutations.acquireCharacter(VARIANTS[student], 'story');
    const initialRun = runtime.operationEntry.start(IDS.event, STUDENTS);
    expect(initialRun.currentLocationId).toBe(IDS.locations.platform);
    const initialSave = runtime.save();
    const registryDefinitionBeforeInvalidEdit = runtime.registry.operationEvents.get(IDS.event);

    const brokenPack = clone(gameplayBCarouselDatapack);
    brokenPack.operationLocations![0] = {
      ...brokenPack.operationLocations![0],
      routeEdges: [...brokenPack.operationLocations![0].routeEdges, {
        id: 'broken-route',
        targetLocationId: 'demo:operation-location:missing',
        label: 'Invalid target',
        description: 'This reference is intentionally invalid for the author workflow test.',
      }],
    };
    savePackContent(runtime, brokenPack);

    const invalidValidation = runtime.validatePackConfiguration(configuration);
    expect(invalidValidation.ok).toBe(false);
    const diagnostic = invalidValidation.errors.join('\n');
    expect(diagnostic).toContain(IDS.event);
    expect(diagnostic).toContain(IDS.locations.platform);
    expect(diagnostic).toContain('.routeEdges[broken-route].targetLocationId');
    expect(diagnostic).toContain('demo:operation-location:missing');

    const rejectedApply = runtime.applyPackConfiguration(configuration);
    expect(rejectedApply.ok).toBe(false);
    expect(rejectedApply.validation.ok).toBe(false);
    expect(runtime.registry.operationEvents.get(IDS.event)).toEqual(registryDefinitionBeforeInvalidEdit);
    expect(runtime.operationEntry.getSnapshot()).toEqual(initialRun);

    const revisedPack = clone(gameplayBCarouselDatapack);
    revisedPack.operationEvents![0] = {
      ...revisedPack.operationEvents![0],
      resumeVersion: 2,
      initialLocationId: IDS.locations.concourse,
    };
    savePackContent(runtime, revisedPack);
    expect(runtime.validatePackConfiguration(configuration)).toEqual({ ok: true, errors: [], warnings: [] });

    const revisedApply = runtime.applyPackConfiguration(configuration);
    expect(revisedApply.ok, revisedApply.message).toBe(true);
    expect(runtime.operationEntry.getSnapshot()).toBeNull();
    expect(runtime.registry.operationEvents.get(IDS.event)).toMatchObject({
      resumeVersion: 2,
      initialLocationId: IDS.locations.concourse,
    });

    runtime.load(initialSave);
    expect(runtime.operationEntry.getLastRestoreResult()).toMatchObject({
      status: 'rejected',
      eventId: IDS.event,
      reason: 'content-version-mismatch',
    });
    expect(runtime.operationEntry.getSnapshot()).toBeNull();

    const resumedRoster = runtime.operationEntry.start(IDS.event, STUDENTS);
    expect(resumedRoster.currentLocationId).toBe(IDS.locations.concourse);
    expect(runtime.operationEntry.createSaveSnapshot()?.resumeVersion).toBe(2);
    expect(resumedRoster.random.seed).toBe(revisedPack.operationEvents![0].randomSeed ?? 0);
  });
});
