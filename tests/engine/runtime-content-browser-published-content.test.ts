import { afterEach, describe, expect, test } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
import { gameplayBCarouselDatapack } from '../../src/arona-clicker/content/operation-samples/gameplay-b-datapack';
import { gameplayBStrategyParkDatapack } from '../../src/arona-clicker/content/operation-samples/gameplay-b-strategy-park';

describe('Published content reference semantics', () => {
  let game: GameInstance | undefined;
  afterEach(() => game?.stop());

  test('真实包的剧情入口、设施关卡和规则源关系均可解析', () => {
    game = new GameInstance();
    game.init([defaultDatapack, gameplayBCarouselDatapack, gameplayBStrategyParkDatapack], { enterDefaultInit: false });
    const browser = game.runtimeContentBrowser;
    const view = browser.getView();
    for (const kind of ['operationEvents', 'operationLocations', 'operationActions',
      'studentOperationProfiles', 'operationStrategyProfiles', 'operationCardPools', 'affectorPacks', 'triggerDefs']) {
      expect(view.entries.some(entry => entry.ref.definitionKind === kind), kind).toBe(true);
    }
    const office = browser.getDefinition({ definitionKind: 'inits', fullId: 'base:init:schale_office' })!;
    expect(office.outgoingReferences.find(edge => edge.path === '$.startStoryId')).toMatchObject({
      status: 'resolved', target: { definitionKind: 'activeStories', fullId: 'base:activestory:schale_welcome' },
    });
    const spotEdges = view.entries.filter(entry => entry.ref.definitionKind === 'spots')
      .flatMap(entry => browser.getReferences(entry.ref).outgoing);
    expect(spotEdges.some(edge => edge.targetKind === 'operationEvents' && edge.status === 'resolved')).toBe(true);
    expect(browser.getResourceRelations('base:resource:credit').incoming.some(edge => edge.confidence === 'declared')).toBe(true);
    const issues = view.entries.flatMap(entry => browser.getReferences(entry.ref).outgoing
      .filter(edge => edge.scope !== 'candidate' && edge.confidence === 'declared' && edge.status !== 'resolved')
      .map(edge => ({ source: entry.ref, path: edge.path, value: edge.value, status: edge.status })));
    expect(issues).toEqual([]);
    const event = browser.getDefinition({ definitionKind: 'operationEvents', fullId: 'gameplay-b:operation-event:atomic-scene-demo' })!;
    expect(event.outgoingReferences.some(edge => edge.path === '$.actors[0].teamId' && edge.scope === 'local' && edge.status === 'resolved')).toBe(true);
    const action = browser.getDefinition({ definitionKind: 'operationActions', fullId: 'gameplay-b:operation-action:atomic-scene-suppress-front-row' })!;
    expect(action.outgoingReferences.find(edge => edge.path === '$.target.allowedActorTypes[0]')).toMatchObject({
      scope: 'candidate', confidence: 'inferred', value: 'opponent',
    });
    expect(action.outgoingReferences.find(edge => edge.path === '$.target.allowedActorTypes[0]')?.targetLocations?.length).toBeGreaterThan(1);
  });
});
