import { ConditionSystem } from '../../engine/expression/condition-system';
import type { StoryNodeDocuments } from '../contracts/runtime/story-node-playback';
import { createStoryNodeActionHost } from '../services/story/story-node-action-host';
import { StoryNodePlayer } from '../services/story/story-node-player';
import type { GameInstance } from './runtime-game-instance';

/**
 * 显式构造新节点内存播放器。调用方管理其生命周期；不注册旧游标、UI或存档。
 * 复用当前GameInstance的领域服务，条件链访问则使用本新Run的visited集合。
 */
export function createStoryNodePlayback(
  game: GameInstance,
  documents: StoryNodeDocuments,
  options: { readonly random?: () => number } = {},
): StoryNodePlayer {
  const actions = createStoryNodeActionHost({
    registry: game.registry,
    effectEngine: game.effectEngine,
    conditionSystem: game.conditionSystem,
    getState: () => game.state,
    storyService: game.storyService,
    travelToArea: (areaId, allowDuringStory, checkAdjacency) => game.travelToArea(areaId, allowDuringStory, checkAdjacency),
    eventBus: game.eventBus,
    presentation: game.storyPresentation,
  });
  return new StoryNodePlayer(documents, {
    ...actions,
    random: options.random ?? Math.random,
    evaluate: (condition, visitedStoryIds) => {
      // 不改全局ConditionSystem的storyChainChecker，避免不同owner互相覆盖。
      const base = game.conditionSystem;
      const scoped = new ConditionSystem();
      scoped.setTagIndex(tag => base.tagIndex(tag));
      scoped.setStatReader(dsl => base.statReader(dsl));
      scoped.setStoryRunChecker(id => base.storyRunChecker(id));
      scoped.setStoryChainChecker(id => visitedStoryIds.includes(id));
      scoped.setExtraReader(path => base.extraReader(path));
      scoped.setTagCountReader(key => base.tagCountReader(key));
      scoped.setAffectionLevelReader((id, state) => base.affectionLevelReader(id, state));
      return scoped.evaluateGroup(condition, game.state);
    },
  });
}
