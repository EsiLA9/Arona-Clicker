import { afterEach, describe, expect, test } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';

describe('Published content reference semantics', () => {
  let game: GameInstance | undefined;
  afterEach(() => game?.stop());

  test('当前发布内容的剧情入口和规则源关系均可解析', () => {
    game = new GameInstance();
    game.init([defaultDatapack], { enterDefaultInit: false });
    const browser = game.runtimeContentBrowser;
    const view = browser.getView();
    for (const kind of ['affectorPacks', 'triggerDefs']) {
      expect(view.entries.some(entry => entry.ref.definitionKind === kind), kind).toBe(true);
    }
    const office = browser.getDefinition({ definitionKind: 'inits', fullId: 'base:init:schale_office' })!;
    expect(office.outgoingReferences.find(edge => edge.path === '$.startStoryId')).toMatchObject({
      status: 'resolved', target: { definitionKind: 'activeStories', fullId: 'base:activestory:schale_welcome' },
    });
    expect(browser.getResourceRelations('base:resource:credit').incoming.some(edge => edge.confidence === 'declared')).toBe(true);
    const issues = view.entries.flatMap(entry => browser.getReferences(entry.ref).outgoing
      .filter(edge => edge.scope !== 'candidate' && edge.confidence === 'declared' && edge.status !== 'resolved')
      .map(edge => ({ source: entry.ref, path: edge.path, value: edge.value, status: edge.status })));
    expect(issues).toEqual([]);
  });
});
