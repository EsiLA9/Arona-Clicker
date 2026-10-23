import type { StoryEntryDef } from '../../../data-services/contracts/story-entry';
import type { EntityPresentationDef, EntityPresentationKey } from '../../../data-services/contracts/entity-presentation';
import type { Registry } from '../../../data-services/registry/registry';
import type { Effect, ConditionGroup } from '../../../engine/types/expression';
import type { ChatTextEffectValue } from '../../../engine/contracts/chat-presentation';
import type { EventBus } from '../../../engine/core/event-bus';
import type { ConditionSystem } from '../../../engine/expression/condition-system';
import type { EffectEngine } from '../../../engine/effect/effect-engine';
import type { PlayerState } from '../../types/state';
import type { StoryStartResult, TravelResult } from '../../contracts/runtime/results';
import type { StoryService } from './story-service';
import type { StoryAction, StoryEntryRequest, StoryOverlayCommand, StoryPresentationCommand, StoryStateAction } from '../../../data-services/contracts/story-node-actions';
import type { StoryNodeActionOutcome, StoryNodePlaybackHost, StoryNodeSource } from '../../contracts/runtime/story-node-playback';
import type { StoryNodePresentationPort } from './story-node-presentation-host';

/** 只读访问适配器可静态核验的领域引用表。 */
export type StoryNodeActionRegistry = Pick<Registry,
  'storyEntries' | 'stories' | 'inits' | 'areas' | 'spots' | 'enhancements' | 'items' | 'characters' | 'characterVariants' | 'colorGroups' | 'spotsOfInit'>;

/** 产品组合根提供的既有端口；不持有或反向依赖 GameInstance。 */
export interface StoryNodeActionHostOptions {
  readonly registry: StoryNodeActionRegistry;
  readonly effectEngine: Pick<EffectEngine, 'applyEffects'>;
  readonly conditionSystem: Pick<ConditionSystem, 'evaluateGroup'>;
  readonly getState: () => PlayerState;
  readonly storyService: Pick<StoryService, 'getCurrentStoryId' | 'hasCompletedStory' | 'startStory' | 'startCardStory'>;
  readonly travelToArea: (areaId: string, allowDuringStory: boolean, checkAdjacency: boolean) => TravelResult;
  readonly eventBus: Pick<EventBus, 'emit'>;
  /** Optional lifecycle-aware route for StoryNode overlay and presentation commands. */
  readonly presentation?: Pick<StoryNodePresentationPort, 'preflight' | 'execute'>;
}

/** Playback factory 合并本端口与自身的链级 evaluate/random。 */
export type StoryNodeActionHost = Pick<StoryNodePlaybackHost, 'preflight' | 'execute'>;

const rejected = (error: string): StoryNodeActionOutcome => ({ status: 'rejected', error });
const nonEmpty = (value: string): boolean => value.trim().length > 0;
const errorText = (error: unknown): string => error instanceof Error ? error.message : String(error);

function hasVisitedStoryCondition(group: ConditionGroup): boolean {
  return group.conditions.some(condition => 'conditions' in condition
    ? hasVisitedStoryCondition(condition)
    : condition.target === 'visitedStoryInChain');
}

function resolveEntry(registry: StoryNodeActionRegistry, request: StoryEntryRequest):
  | { readonly entry: StoryEntryDef; readonly storyId: string }
  | { readonly error: string } {
  if (!nonEmpty(request.entryId)) return { error: 'EmptyEntryId' };
  if (request.owner !== null && !nonEmpty(request.owner)) return { error: 'EmptyEntryOwner' };
  const entry = registry.storyEntries.get(request.entryId);
  if (!entry) return { error: 'EntryNotFound' };
  if (entry.type !== request.entryType) return { error: 'EntryTypeMismatch' };
  if (request.intent === 'card' && request.entryType !== 'active') return { error: 'CardEntryMustBeActive' };
  const story = registry.stories.get(entry.storyId);
  if (!story?.nodes.length) return { error: 'EntryStoryEmpty' };
  if (hasVisitedStoryCondition(entry.triggerCondition)) return { error: 'EntryChainConditionUnsupported' };
  return { entry, storyId: story.id };
}

function entityDef(registry: StoryNodeActionRegistry, key: EntityPresentationKey) {
  const separator = key.indexOf(':');
  if (separator <= 0 || separator === key.length - 1) return undefined;
  const id = key.slice(separator + 1);
  switch (key.slice(0, separator)) {
    case 'init': return registry.inits.get(id);
    case 'area': return registry.areas.get(id);
    case 'spot': return registry.spots.get(id);
    case 'enhancement': return registry.enhancements.get(id);
    case 'variant': return registry.characterVariants.get(id);
    default: return undefined;
  }
}

function stateError(registry: StoryNodeActionRegistry, action: StoryStateAction): string | undefined {
  switch (action.op) {
    case 'setResource': case 'addResource': return nonEmpty(action.resourceId) ? undefined : 'EmptyResourceId';
    case 'setSpotLevel': case 'addSpotLevel': return registry.spots.has(action.spotId) ? undefined : 'SpotNotFound';
    case 'setManager':
      if (!registry.spots.has(action.spotId)) return 'SpotNotFound';
      return action.managerId === 'none' || registry.characters.has(action.managerId) ? undefined : 'CharacterNotFound';
    case 'addEnhancement': return registry.enhancements.has(action.enhancementId) ? undefined : 'EnhancementNotFound';
    case 'addItem': return registry.items.has(action.itemId) ? undefined : 'ItemNotFound';
    case 'unlockInit': return registry.inits.has(action.initId) ? undefined : 'InitNotFound';
    case 'setFlag': return nonEmpty(action.flagId) ? undefined : 'EmptyFlagId';
    case 'setExtra': case 'addExtra': case 'removeExtra': return nonEmpty(action.path) ? undefined : 'EmptyExtraPath';
    case 'grantCharacter': case 'addAffectionExp': return registry.characterVariants.has(action.variantId) ? undefined : 'CharacterVariantNotFound';
  }
}

function overlayError(command: StoryOverlayCommand, source: StoryNodeSource): string | undefined {
  if (source.owner !== null) return 'OverlaySourceOwnerUnsupported';
  if (command.command === 'clearId') return nonEmpty(command.id) ? undefined : 'EmptyOverlayId';
  if (command.command !== 'show') return undefined;
  if (!nonEmpty(command.id)) return 'EmptyOverlayId';
  return command.content.kind === 'entryCard' ? 'OverlayCardRoutingUnsupported' : undefined;
}

function presentationError(registry: StoryNodeActionRegistry, command: StoryPresentationCommand, source: StoryNodeSource): string | undefined {
  switch (command.command) {
    case 'theme': {
      const { value } = command;
      if (value.scope === undefined || value.scope === 'ephemeral') return 'EphemeralThemeLifecycleUnsupported';
      if (value.colorGroupId && !registry.colorGroups.has(value.colorGroupId)) return 'ThemeColorGroupNotFound';
      if (value.background !== undefined) return 'ThemeBackgroundScopeUnsupported';
      if (value.scope === 'area' && !registry.areas.has(value.entityKey.slice(5))) return 'ThemeAreaNotFound';
      if (value.scope === 'student' && !registry.characterVariants.has(value.entityKey.slice(8))) return 'ThemeVariantNotFound';
      return undefined;
    }
    case 'setEntityPresentation': {
      if (!nonEmpty(command.owner)) return 'EmptyPresentationOwner';
      if (command.lifetime === 'story') return 'StoryPresentationLifetimeUnsupported';
      const presentation = entityDef(registry, command.target)?.presentation as EntityPresentationDef | undefined;
      if (!presentation) return 'PresentationTargetNotFound';
      return presentation.additions?.some(option => option.id === command.optionId) ? undefined : 'PresentationOptionNotFound';
    }
    case 'clearEntityPresentation':
      return !nonEmpty(command.owner) ? 'EmptyPresentationOwner' : entityDef(registry, command.target) ? undefined : 'PresentationTargetNotFound';
    case 'openingTitle':
      if (source.owner !== null) return 'OpeningTitleSourceOwnerUnsupported';
      return nonEmpty(command.title ?? '') ? undefined : 'OpeningTitleDefaultSourceUnsupported';
  }
}

function actionError(registry: StoryNodeActionRegistry, action: StoryAction, source: StoryNodeSource): string | undefined {
  switch (action.kind) {
    case 'state': return action.effects.map(effect => stateError(registry, effect)).find(error => error !== undefined);
    case 'travel': return registry.areas.has(action.areaId) ? undefined : 'TravelAreaNotFound';
    case 'overlay': return overlayError(action.command, source);
    case 'presentation': return presentationError(registry, action.command, source);
    case 'entryRequest': {
      const resolved = resolveEntry(registry, action.request);
      return 'error' in resolved ? resolved.error : undefined;
    }
  }
}

function toEffect(action: StoryStateAction): Effect {
  let target: string; let value: Effect['value'];
  switch (action.op) {
    case 'setResource': case 'addResource': target = action.resourceId; value = action.amount; break;
    case 'setSpotLevel': case 'addSpotLevel': target = action.spotId; value = action.amount; break;
    case 'setManager': target = action.spotId; value = action.managerId; break;
    case 'addEnhancement': target = ''; value = action.enhancementId; break;
    case 'addItem': target = action.itemId; value = action.amount; break;
    case 'unlockInit': target = ''; value = action.initId; break;
    case 'setFlag': target = action.flagId; value = action.value; break;
    case 'setExtra': target = action.path; value = action.value; break;
    case 'addExtra': target = action.path; value = action.amount; break;
    case 'removeExtra': target = action.path; value = 0; break;
    case 'grantCharacter': target = action.variantId; value = 0; break;
    case 'addAffectionExp': target = action.variantId; value = action.amount; break;
  }
  return { op: action.op, target, value };
}

function toOverlayEffect(command: StoryOverlayCommand): Effect {
  if (command.command === 'clearId') return { op: 'clearIdChatFlow', target: command.id, value: 0 };
  if (command.command === 'clearAllTexts') return { op: 'clearAllChatText', target: '', value: 0 };
  if (command.command === 'clearFlow') return { op: 'clearAllChatFlow', target: '', value: 0 };

  const { content } = command;
  if (content.kind === 'entryCard') throw new Error('OverlayCardRoutingUnsupported');
  const location = {
    ...(command.x === undefined ? {} : { x: command.x }),
    ...(command.y === undefined ? {} : { y: command.y }),
    ...(command.align === undefined ? {} : { align: command.align }),
  };
  let value: ChatTextEffectValue;
  if (content.kind === 'text') {
    value = { text: content.text, ...location, ...(content.template === undefined ? {} : { kind: content.template }), ...(content.style === undefined ? {} : { style: content.style }) };
  } else {
    const presentation = content.presentation;
    value = {
      talklet: {
        kind: content.content.kind, text: content.content.text,
        ...(content.content.kind === 'talk' ? { speaker: content.content.speaker, image: content.content.image } : {}),
        ...(presentation?.side === undefined ? {} : { side: presentation.side }),
        ...(presentation?.align === undefined ? {} : { align: presentation.align }),
        ...(presentation?.avatar === undefined ? {} : { avatar: presentation.avatar }),
        ...(presentation?.avatarMode === 'hide' ? { noAvatar: true } : {}),
        ...(presentation?.avatarMode === 'show' ? { showAvatar: true } : {}),
      },
      ...(presentation?.align === undefined ? {} : { align: presentation.align }),
      ...(content.style === undefined ? {} : { style: content.style }),
      ...location,
    };
  }
  return { op: 'showChatText', target: command.id, value };
}

function toPresentationEffect(command: StoryPresentationCommand): Effect {
  switch (command.command) {
    case 'theme': return { op: 'setTheme', target: '', value: command.value };
    case 'setEntityPresentation': return {
      op: command.command, target: command.target,
      value: { optionId: command.optionId, owner: command.owner, ...(command.lifetime === undefined ? {} : { lifetime: command.lifetime }) },
    };
    case 'clearEntityPresentation': return { op: command.command, target: command.target, value: { owner: command.owner } };
    case 'openingTitle': return { op: 'showOpeningTitle', target: '', value: command.title ?? '' };
  }
}

function conditionGateError(options: StoryNodeActionHostOptions, entry: StoryEntryDef): string | undefined {
  const state = options.getState();
  if (entry.availableInits.length && !entry.availableInits.includes(state.activeInit)) return 'EntryUnavailableInInit';
  return options.conditionSystem.evaluateGroup(entry.triggerCondition, state) ? undefined : 'EntryConditionNotMet';
}

/** 実行直前按顺序模拟state批次的拥有状态，保持EffectEngine的一次批量求值/写入。 */
function stateBatchGateError(options: StoryNodeActionHostOptions, effects: readonly StoryStateAction[]): string | undefined {
  const state = options.getState();
  const ownedVariants = new Set(Object.keys(state.roster ?? {}));
  for (const action of effects) {
    if (action.op === 'setSpotLevel' || action.op === 'addSpotLevel' || action.op === 'setManager') {
      const spot = options.registry.spots.get(action.spotId);
      if (spot && !spot.global
        && (!state.activeInit || !options.registry.spotsOfInit(state.activeInit).includes(action.spotId))) {
        return 'SpotOutsideActiveInit';
      }
    } else if (action.op === 'grantCharacter') {
      ownedVariants.add(action.variantId);
    } else if (action.op === 'addAffectionExp') {
      if (!ownedVariants.has(action.variantId)) return 'CharacterNotOwned';
    }
  }
  return undefined;
}

function cursorGateError(options: StoryNodeActionHostOptions, request: StoryEntryRequest): string | undefined {
  const id = options.storyService.getCurrentStoryId(request.owner);
  if (!id) return undefined;
  const current = options.registry.storyEntries.get(id);
  if (!current) return undefined;
  if (current.type === 'passive' && current.blocksInteraction) return 'EntryBlockedByPassive';
  if (request.intent === 'card' || request.entryType === 'active' && current.type === 'passive'
    || request.intent === 'system' && current.type === 'passive') return undefined;
  return 'EntryCursorOccupied';
}

function executeEntryRequest(options: StoryNodeActionHostOptions, request: StoryEntryRequest, source: StoryNodeSource): StoryNodeActionOutcome {
  const resolved = resolveEntry(options.registry, request);
  if ('error' in resolved) return rejected(resolved.error);
  if (request.intent !== 'card') {
    const error = conditionGateError(options, resolved.entry);
    if (error) return rejected(error);
  }
  if (request.intent === 'ordinary' && !(resolved.entry.type === 'passive' && resolved.entry.repeatable)
    && options.storyService.hasCompletedStory(resolved.storyId)) return rejected('EntryAlreadyCompleted');
  const cursorError = cursorGateError(options, request);
  if (cursorError) return rejected(cursorError);

  let result: StoryStartResult;
  if (request.intent === 'card') result = options.storyService.startCardStory(request.entryId, request.owner);
  else result = options.storyService.startStory(request.entryId, request.entryType, request.owner,
    request.intent === 'system' ? { force: true } : undefined);
  if (!result.success) return rejected(`EntryStartFailed:${result.error}`);
  return { status: request.owner === source.owner ? 'replaced' : 'applied' };
}

/** 将有限StoryAction接到既有服务；Entry静态预检与启动前资格复核分开执行。 */
export function createStoryNodeActionHost(options: StoryNodeActionHostOptions): StoryNodeActionHost {
  const preflight = (action: StoryAction, source: StoryNodeSource) => {
    if (options.presentation && (action.kind === 'overlay' || action.kind === 'presentation')) {
      return options.presentation.preflight(action, source);
    }
    return actionError(options.registry, action, source);
  };
  const execute = (action: StoryAction, source: StoryNodeSource): StoryNodeActionOutcome => {
    const error = preflight(action, source);
    if (error) return rejected(error);
    try {
      switch (action.kind) {
        case 'state': {
          const gateError = stateBatchGateError(options, action.effects);
          if (gateError) return rejected(gateError);
          options.effectEngine.applyEffects(action.effects.map(toEffect));
          return { status: 'applied' };
        }
        case 'travel': {
          const result = options.travelToArea(action.areaId, true, false);
          // Story travel was historically best-effort: domain-level denials such as
          // AlreadyThere or NotInThisInit do not fault the Story action chain.
          if (result.success && action.notice) options.eventBus.emit({
            type: 'storyAreaTraveled', areaId: action.areaId, owner: source.owner,
            ...(source.runId === undefined ? {} : { runId: source.runId }),
          });
          return { status: 'applied' };
        }
        case 'overlay':
          if (options.presentation) return options.presentation.execute(action, source);
          options.effectEngine.applyEffects([toOverlayEffect(action.command)]);
          return { status: 'applied' };
        case 'presentation':
          if (options.presentation) return options.presentation.execute(action, source);
          options.effectEngine.applyEffects([toPresentationEffect(action.command)]);
          return { status: 'applied' };
        case 'entryRequest': return executeEntryRequest(options, action.request, source);
      }
    } catch (error) {
      return rejected(`ActionExecutionFailed:${errorText(error)}`);
    }
  };
  return { preflight, execute };
}
