import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
import { ABYDOS_STUDENT_RECRUITMENT_SPOT_ID } from '../../src/arona-clicker/content/world/spots';

const OFFICE = 'base:init:schale_office';
const MILLENNIUM = 'base:init:millennium';
const AREA = 'base:area:schale_main';
const SPOT_ID = ABYDOS_STUDENT_RECRUITMENT_SPOT_ID;
const TRIGGER_ID = 'base:trigger:abydos_student_recruitment';
const STUDENTS = ['Hoshino', 'Serika', 'Shiroko'] as const;

describe('Base 免费阿比多斯学生领取 Spot', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
    game.init([defaultDatapack]);
    expect(game.inits.startNewGame(OFFICE)).toBe(true);
  });

  afterEach(() => game.stop());

  test('夏莱主厅手动免费领取后立即获得三名学生，Spot 与 Trigger 都只发放一次', () => {
    const spot = game.registry.spots.get(SPOT_ID);
    expect(spot).toMatchObject({
      id: SPOT_ID,
      areaId: AREA,
      global: true,
      maxLevel: 1,
      purchaseOptions: [{ id: 'free', label: '免费', costs: [] }],
    });
    expect(spot?.revealTriggers).toBeUndefined();
    expect(spot?.functionalities).toBeUndefined();
    expect(spot?.gachaPools).toBeUndefined();
    expect(game.registry.spotsOfArea(AREA)).toContain(SPOT_ID);
    expect(game.registry.areas.get(AREA)?.defaultSpots).not.toContain(SPOT_ID);
    expect(game.state.spotLevels[SPOT_ID]).toBeUndefined();
    expect(game.visibility.spots[SPOT_ID]).toBe(true);
    expect(game.spot.getPaymentOptions(SPOT_ID, 'unlock')).toMatchObject([
      { id: 'free', label: '免费', affordable: true, status: 'available', costs: [] },
    ]);
    for (const variantId of STUDENTS) expect(game.state.roster?.[variantId]).toBeUndefined();
    expect(game.state.triggersCompleted).not.toContain(TRIGGER_ID);

    const resourcesBefore = {
      resources: { ...game.state.resources },
      globalResources: { ...game.state.globalResources },
    };
    expect(game.spot.unlockSpot(SPOT_ID)).toMatchObject({ success: true, spotId: SPOT_ID });
    expect(game.state.spotLevels[SPOT_ID]).toBe(1);
    expect(game.state.resources).toEqual(resourcesBefore.resources);
    expect(game.state.globalResources).toEqual(resourcesBefore.globalResources);
    expect(game.state.triggersCompleted).toContain(TRIGGER_ID);

    for (const variantId of STUDENTS) {
      expect(game.state.roster?.[variantId]).toMatchObject({
        variantId,
        acquiredVia: 'story',
        acquiredCount: 1,
      });
    }
    expect(game.spot.unlockSpot(SPOT_ID)).toMatchObject({ success: false, spotId: SPOT_ID, error: 'AlreadyOwned' });

    // Even if another matching spot-level event is emitted, the once Trigger cannot grant duplicates.
    game.mutations.setSpotLevel(SPOT_ID, 0);
    game.mutations.setSpotLevel(SPOT_ID, 1);
    for (const variantId of STUDENTS) {
      expect(game.state.roster?.[variantId]?.acquiredCount).toBe(1);
      expect(game.state.fragments?.[variantId] ?? 0).toBe(0);
    }
  });

  test('已持有的学生沿用默认重复获得补偿，global Spot 跨 Init 与硬重启保留', () => {
    game.mutations.acquireCharacter('Hoshino', 'story');
    expect(game.spot.unlockSpot(SPOT_ID)).toMatchObject({ success: true, spotId: SPOT_ID });

    expect(game.state.roster?.Hoshino?.acquiredCount).toBe(2);
    expect(game.state.fragments?.Hoshino).toBe(1);
    expect(game.state.roster?.Serika?.acquiredCount).toBe(1);
    expect(game.state.roster?.Shiroko?.acquiredCount).toBe(1);

    game.inits.unlockInit(MILLENNIUM);
    expect(game.inits.resumeInit(MILLENNIUM)).toBe(true);
    expect(game.state.spotLevels[SPOT_ID]).toBe(1);
    for (const variantId of STUDENTS) expect(game.state.roster?.[variantId]).toBeDefined();

    game.inits.hardRestartInit();
    expect(game.inits.resumeInit(MILLENNIUM)).toBe(true);
    expect(game.state.spotLevels[SPOT_ID]).toBe(1);
    expect(game.state.roster?.Hoshino?.acquiredCount).toBe(2);
    expect(game.state.fragments?.Hoshino).toBe(1);
    expect(game.state.roster?.Serika?.acquiredCount).toBe(1);
    expect(game.state.roster?.Shiroko?.acquiredCount).toBe(1);
  });
});
