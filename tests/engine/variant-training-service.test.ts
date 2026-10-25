import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../../src/arona-clicker/state/state-factory';
import type { PlayerState } from '../../src/arona-clicker/types/state';
import { VariantTrainingService } from '../../src/arona-clicker/services/character/variant-training-service';
import { canonical } from '../../src/arona-clicker/services/character/variant-translation-rules';

const VARIANT_ID = 'Hoshino';
const INIT_ID = 'training-init';

function makeState(owned = false): PlayerState {
  const state = createDefaultState();
  state.activeInit = INIT_ID;
  if (owned) {
    state.roster = {
      [VARIANT_ID]: {
        variantId: VARIANT_ID,
        acquiredVia: 'story',
        acquiredCount: 1,
        level: 1,
        exp: 0,
        stars: 1,
        affectionLevel: 1,
        affectionExp: 0,
        colorEquipment: null,
      },
    };
  }
  return state;
}

function makeService(state: PlayerState): VariantTrainingService {
  return new VariantTrainingService({
    getState: () => state,
    getVariant: id => id === VARIANT_ID ? { id, proto: 'hoshino', displayName: 'Hoshino' } : undefined,
  });
}

function readyToken(service: VariantTrainingService, source: 'owned' | 'normal' | 'enhanced'): string {
  const preview = service.preview(source);
  expect(preview.status).toBe('ready');
  if (preview.status !== 'ready') throw new Error('Expected a ready training preview');
  return preview.token;
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('VariantTrainingService', () => {
  it('allows only currently owned owned-source previews while slices never grant roster ownership', () => {
    const state = makeState(false);
    const service = makeService(state);

    expect(service.getView().owned).toBe(false);
    expect(service.preview('owned')).toMatchObject({ status: 'blocked' });
    expect(service.preview('normal')).toMatchObject({ status: 'ready' });
    expect(service.preview('enhanced')).toMatchObject({ status: 'ready' });
    expect(state.roster).toBeUndefined();
  });

  it.each([
    { source: 'normal' as const, partyHp: 10, first: 'enemy' as const, finalPartyHp: 4 },
    { source: 'enhanced' as const, partyHp: 16, first: 'party' as const, finalPartyHp: 12 },
  ])('$source slice uses its authored HP and AG-1 initiative through a three-round battle', ({ source, partyHp, first, finalPartyHp }) => {
    const state = makeState(false);
    const service = makeService(state);
    const before = jsonClone(state);

    const started = service.start(readyToken(service, source));
    expect(started).toMatchObject({ phase: 'battle', partyHp, partyMaxHp: partyHp, enemyHp: 6, enemyMaxHp: 6 });
    expect(started.translation?.members[0]).toMatchObject({ variantId: VARIANT_ID, statisticsCharacterId: 'hoshino' });

    let view = started;
    for (let round = 1; round <= 3; round += 1) {
      view = service.commitRound(view.commitVersion);
      expect(view.round).toBe(Math.min(round + 1, 3));
      expect(view.lastRound?.order[0]?.side).toBe(first);
      expect(view.lastRound?.round).toBe(round);
    }

    expect(view).toMatchObject({ phase: 'result', outcome: 'success', partyHp: finalPartyHp, enemyHp: 0 });
    expect(state).toEqual(before);
  });

  it('reads current cultivation into the owned preview, freezes it at entry, and never writes player state', () => {
    const state = makeState(true);
    const service = makeService(state);
    const baseline = jsonClone(state);

    const first = service.start(readyToken(service, 'owned'));
    expect(first.translation?.members[0].progression).toEqual({ level: 1, stars: 1, affectionLevel: 1 });
    const frozenHp = first.partyHp;

    state.roster![VARIANT_ID].level = 12;
    state.roster![VARIANT_ID].stars = 4;
    state.roster![VARIANT_ID].affectionLevel = 5;
    const stillInBattle = service.getView();
    expect(stillInBattle.partyHp).toBe(frozenHp);
    expect(stillInBattle.translation?.members[0].progression).toEqual({ level: 1, stars: 1, affectionLevel: 1 });

    const nextService = makeService(state);
    const current = nextService.start(readyToken(nextService, 'owned'));
    expect(current.translation?.members[0].progression).toEqual({ level: 12, stars: 4, affectionLevel: 5 });
    expect(current.partyHp).not.toBe(frozenHp);
    expect(state).toEqual({ ...baseline, roster: { ...baseline.roster, [VARIANT_ID]: state.roster![VARIANT_ID] } });
    expect(state.roster![VARIANT_ID].level).toBe(12);
    expect(baseline.roster![VARIANT_ID].level).toBe(1);
  });

  it('rejects stale and missing battle commands without advancing the encounter', () => {
    const service = makeService(makeState(false));
    expect(() => service.commitRound(0)).toThrow();
    expect(() => service.save()).toThrow();

    const started = service.start(readyToken(service, 'normal'));
    expect(() => service.commitRound(started.commitVersion - 1)).toThrow();
    expect(service.getView()).toMatchObject({ phase: 'battle', round: 1, partyHp: 10, enemyHp: 6 });
    expect(service.commitRound(started.commitVersion)).toMatchObject({ phase: 'battle', round: 2 });
  });

  it('rejects a preview token after its owned source changes', () => {
    const state = makeState(true);
    const service = makeService(state);
    const preview = service.preview('owned');
    expect(preview.status).toBe('ready');
    if (preview.status !== 'ready') return;

    state.roster![VARIANT_ID].level += 1;
    expect(() => service.start(preview.token)).toThrow();
    expect(service.getView().phase).toBe('preparation');
  });

  it('round-trips a JSON battle checkpoint with frozen build, round and HP after live progress changes', () => {
    const state = makeState(true);
    const original = makeService(state);
    const started = original.start(readyToken(original, 'owned'));
    const afterRound = original.commitRound(started.commitVersion);
    const checkpoint = JSON.parse(JSON.stringify(original.save()));

    state.roster![VARIANT_ID].level = 99;
    state.roster![VARIANT_ID].stars = 9;
    const restored = makeService(state);
    const view = restored.load(checkpoint);
    expect(view).toMatchObject({
      phase: 'battle', round: afterRound.round, commitVersion: afterRound.commitVersion,
      partyHp: afterRound.partyHp, enemyHp: afterRound.enemyHp,
      translation: afterRound.translation,
    });
    expect(view.translation?.members[0].progression).toEqual({ level: 1, stars: 1, affectionLevel: 1 });
    expect(restored.commitRound(view.commitVersion).round).toBe(view.round + 1);
  });

  it('loads checkpoints atomically and rejects tampering, wrong template versions, and mixed source builds', () => {
    const service = makeService(makeState(false));
    const current = service.start(readyToken(service, 'normal'));
    const saved = jsonClone(service.save());
    const enhancedService = makeService(makeState(false));
    enhancedService.start(readyToken(enhancedService, 'enhanced'));
    const enhanced = jsonClone(enhancedService.save());

    const corruptions: unknown[] = [];
    const wrongTemplate = jsonClone(saved) as any;
    wrongTemplate.templateVersion = 999;
    corruptions.push(wrongTemplate);
    const wrongTranslation = jsonClone(saved) as any;
    wrongTranslation.translation.contentEvidence = 'forged';
    corruptions.push(wrongTranslation);
    const wrongParty = jsonClone(saved) as any;
    wrongParty.mapRun.run.party[0].variantId = 'Other';
    corruptions.push(wrongParty);
    const wrongHp = jsonClone(saved) as any;
    wrongHp.mapRun.run.partyHp[0].currentHp = 999;
    corruptions.push(wrongHp);
    const wrongAgility = jsonClone(saved) as any;
    wrongAgility.mapRun.run.partyAgility[0].agility = 999;
    corruptions.push(wrongAgility);
    const mixed = jsonClone(saved) as any;
    mixed.translation = enhanced.translation;
    corruptions.push(mixed);
    const crossSpliced = jsonClone(saved) as any;
    crossSpliced.mapRun = enhanced.mapRun;
    corruptions.push(crossSpliced);
    const mapRunForgeryWithConsistentBinding = jsonClone(saved) as any;
    mapRunForgeryWithConsistentBinding.mapRun.run.partyHp[0].currentHp = 999;
    const forgedBody = {
      templateVersion: mapRunForgeryWithConsistentBinding.templateVersion,
      translation: mapRunForgeryWithConsistentBinding.translation,
      mapRun: mapRunForgeryWithConsistentBinding.mapRun,
    };
    mapRunForgeryWithConsistentBinding.binding = canonical(forgedBody);
    corruptions.push(mapRunForgeryWithConsistentBinding);

    for (const checkpoint of corruptions) {
      expect(() => service.load(checkpoint)).toThrow();
      expect(service.getView()).toEqual(current);
    }
  });

  it('drops pending tokens when Init changes and clears the training owner on reset', () => {
    const state = makeState(false);
    const service = makeService(state);
    const token = readyToken(service, 'normal');
    state.activeInit = 'another-init';
    expect(() => service.start(token)).toThrow();

    const current = service.start(readyToken(service, 'normal'));
    expect(current.phase).toBe('battle');
    const pending = service.preview('enhanced');
    expect(pending.status).toBe('ready');
    if (pending.status !== 'ready') return;
    service.reset();
    expect(service.getView()).toMatchObject({ phase: 'preparation', round: 0, partyHp: null, enemyHp: null, translation: null });
    expect(() => service.start(pending.token)).toThrow();
  });
});
