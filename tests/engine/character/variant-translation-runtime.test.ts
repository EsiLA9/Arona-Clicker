import { afterEach, describe, expect, test } from 'vitest';
import {
  VariantTranslationMode,
  type VariantTranslationContentResolver,
  type VariantTranslationRequest,
} from '../../../src/arona-clicker/contracts/character/variant-translation';
import { GameInstance } from '../../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../../src/data/base/datapack';

const ENTRY_ID = 'test:translation-entry';
const RULES = { id: 'test:translation-rules', revision: 1 } as const;
const PROFILE = { id: 'test:translation-profile', revision: 1 } as const;
const REQUEST: VariantTranslationRequest = {
  entryId: ENTRY_ID,
  mode: VariantTranslationMode.GameplayB,
  members: [{ slotId: 'front', source: { kind: 'owned', variantId: 'Hoshino' } }],
};

function resolver(): VariantTranslationContentResolver {
  const rules = {
    ...RULES,
    mode: VariantTranslationMode.GameplayB,
    dimensions: [{
      id: 'might', min: 0, max: 10,
      grades: [{ id: 'E', minInclusive: 0 }, { id: 'D', minInclusive: 5 }],
    }],
    parameters: {
      maxHp: { attributeId: 'might', values: [{ gradeId: 'E', value: 5 }, { gradeId: 'D', value: 7 }] },
      baseAgility: { attributeId: 'might', values: [{ gradeId: 'E', value: 1 }, { gradeId: 'D', value: 2 }] },
      maxAgility: { attributeId: 'might', values: [{ gradeId: 'E', value: 3 }, { gradeId: 'D', value: 4 }] },
    },
  } as const;
  const profile = {
    ...PROFILE,
    variantId: 'Hoshino',
    attributes: [{ id: 'might', base: 5, perLevel: 0, perStar: 0, perAffectionLevel: 0 }],
    capabilityIds: [], tags: [], candidateSourceIds: [],
  } as const;
  const entry = {
    id: ENTRY_ID,
    revision: 1,
    mode: VariantTranslationMode.GameplayB,
    rules: RULES,
    minPartySize: 1,
    maxPartySize: 1,
    allowDuplicateVariants: false,
    owned: [{ variantId: 'Hoshino', profile: PROFILE }],
    slices: [],
  } as const;
  return {
    resolveEntry: id => id === ENTRY_ID ? entry : undefined,
    resolveRules: ref => ref.id === RULES.id && ref.revision === RULES.revision ? rules : undefined,
    resolveProfile: ref => ref.id === PROFILE.id && ref.revision === PROFILE.revision ? profile : undefined,
    resolveSlice: () => undefined,
  };
}

describe('Variant translation Runtime integration', () => {
  const games: GameInstance[] = [];

  function createGame(contentResolver?: VariantTranslationContentResolver): GameInstance {
    const game = new GameInstance({ variantTranslationContentResolver: contentResolver });
    games.push(game);
    game.init([baseDatapack]);
    return game;
  }

  function ownHoshino(game: GameInstance): void {
    game.mutations.acquireCharacter('Hoshino', 'story');
  }

  function previewToken(game: GameInstance): string {
    const preview = game.variantTranslation.preview(REQUEST);
    if (preview.status !== 'ready') throw new Error(`expected ready preview; got ${preview.issues[0]?.code}`);
    return preview.token;
  }

  afterEach(() => {
    for (const game of games.splice(0)) {
      if (game.running) game.stop();
    }
  });

  test('exposes a narrow port and clearly rejects requests when trusted content is absent', () => {
    const game = createGame();

    expect(Object.keys(game.variantTranslation).sort()).toEqual(['confirm', 'preview', 'restore']);
    expect(game.variantTranslation.preview(REQUEST)).toMatchObject({
      status: 'blocked', issues: [{ code: 'entry-unavailable' }],
    });
  });

  test('reads current ownership through Runtime state instead of a construction-time snapshot', () => {
    const game = createGame(resolver());

    expect(game.variantTranslation.preview(REQUEST)).toMatchObject({
      status: 'blocked', issues: [{ code: 'variant-not-owned' }],
    });
    ownHoshino(game);
    expect(game.variantTranslation.preview(REQUEST)).toMatchObject({ status: 'ready' });
  });

  test.each(['reset', 'init', 'load', 'dispose'] as const)(
    'invalidates pending tokens at Runtime %s', operation => {
      const game = createGame(resolver());
      ownHoshino(game);
      const token = previewToken(game);
      const save = game.save();

      if (operation === 'reset') game.reset();
      if (operation === 'init') game.init([baseDatapack], { enterDefaultInit: false });
      if (operation === 'load') game.load(save);
      if (operation === 'dispose') game.dispose();

      expect(game.variantTranslation.confirm(token)).toMatchObject({
        status: 'blocked', issues: [{ code: 'stale-preview' }],
      });
    },
  );

  test('invalidates tokens when an Init changes away and back before confirmation', () => {
    const game = createGame(resolver());
    ownHoshino(game);
    const token = previewToken(game);

    game.inits.enterInit('base:init:millennium');
    game.inits.enterInit('base:init:schale_office');

    expect(game.variantTranslation.confirm(token)).toMatchObject({
      status: 'blocked', issues: [{ code: 'stale-preview' }],
    });
  });
});
