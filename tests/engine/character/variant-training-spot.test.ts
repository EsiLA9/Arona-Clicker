import { describe, expect, test } from 'vitest';
import { GameInstance } from '../../../src/arona-clicker/runtime/runtime-game-instance';
import { defaultDatapack } from '../../../src/arona-clicker/content/default-datapack';
import { baseDatapack } from '../../../src/data/base/datapack';

const SPOT_ID = 'base:spot:variant_training';

describe('Variant training Spot entry', () => {
  test('is visible and usable in Schale by default, while the functionality itself requires Spot ownership', () => {
    const game = new GameInstance();
    game.init([baseDatapack]);
    const spot = game.registry.spots.get(SPOT_ID);
    expect(spot).toMatchObject({
      id: SPOT_ID,
      areaId: 'base:area:schale_main',
      name: '转译演练场',
      maxLevel: 1,
      purchaseOptions: [{ costs: [{ type: 'resource', resourceId: 'base:resource:credit', amount: { type: 'const', value: 0 } }] }],
      functionalities: [{ id: 'base:funclet:variant_training_entry', kind: 'variantTrainingEntry' }],
    });
    expect(game.registry.areas.get('base:area:schale_main')?.defaultSpots).toContain(SPOT_ID);
    expect(game.world.spotsOfArea('base:area:schale_main')).toContain(SPOT_ID);
    expect(game.state.spotLevels[SPOT_ID]).toBe(1);
    expect(game.spotFunctionalitySystem.hasFunctionality(spot!, game.state, 'variantTrainingEntry')).toBe(true);
    expect(game.state.roster).toBeUndefined();

    delete (game as any)._state.spotLevels[SPOT_ID];
    expect(game.spotFunctionalitySystem.hasFunctionality(spot!, game.state, 'variantTrainingEntry')).toBe(false);

    game.mutations.setSpotLevel(SPOT_ID, 1);
    expect(game.spotFunctionalitySystem.hasFunctionality(spot!, game.state, 'variantTrainingEntry')).toBe(true);
    expect(game.state.roster).toBeUndefined();
  });

  test('includes the training Spot in the bundled production Datapack', () => {
    const game = new GameInstance();
    game.init([defaultDatapack]);
    const spot = game.registry.spots.get(SPOT_ID);
    expect(game.world.spotsOfArea('base:area:schale_main')).toContain(SPOT_ID);
    expect(spot?.functionalities).toContainEqual({ id: 'base:funclet:variant_training_entry', kind: 'variantTrainingEntry' });
    expect(game.spotFunctionalitySystem.hasFunctionality(spot!, game.state, 'variantTrainingEntry')).toBe(true);
  });
});
