import { storyEntryType } from '../../../data-services/contracts/story-entry';
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
import type { EffectReceipt } from '../../../engine/contracts/effect-receipt';
import type { WorldInformationTargetRef } from '../../../engine/contracts/world-information';
import { displayName } from '../../../engine/core/display-name';

/** 只读访问适配器可静态核验的领域引用表。 */
export type StoryNodeActionRegistry = Pick<Registry,
  'storyEntries' | 'stories' | 'inits' | 'areas' | 'areaMaps' | 'spots' | 'enhancements' | 'items' | 'characters' | 'characterVariants' | 'colorGroups' | 'spotsOfInit'>;

/** 产品组合根提供的既有端口；不持有或反向依赖 GameInstance。 */
export interface StoryNodeActionHostOptions {
  readonly registry: StoryNodeActionRegistry;
  readonly effectEngine: Pick<EffectEngine, 'applyEffects'> & Partial<Pick<EffectEngine, 'applyEffectsWithReceipts'>>;
  readonly conditionSystem: Pick<ConditionSystem, 'evaluateGroup'>;
  readonly getState: () => PlayerState;
  readonly storyService: Pick<StoryService, 'getCurrentStoryId' | 'hasCompletedStory' | 'startStory' | 'startCardStory'>;
  readonly travelToArea: (areaId: string, allowDuringStory: boolean, checkAdjacency: boolean, onCommitted?: (result: Extract<TravelResult, { success: true }>) => void) => TravelResult;
  readonly eventBus: Pick<EventBus, 'emit'>;
  /** Optional lifecycle-aware route for StoryNode overlay and presentation commands. */
  readonly presentation?: Pick<StoryNodePresentationPort, 'preflight' | 'execute'>;
  /** Formal playback queues detached intents and applies them only at their presentation step. */
  readonly deferPresentation?: boolean;
  readonly getTitle?: (source: StoryNodeSource) => string | undefined;
  readonly requestEntry?: (request: StoryEntryRequest, source: StoryNodeSource) => StoryNodeActionOutcome;
  readonly clearNode?: (target: {storyId:string;nodeId:string}, source: StoryNodeSource) => void;
}

/** Playback factory 合并本端口与自身的链级 evaluate/random。 */
export type StoryNodeActionHost = Pick<StoryNodePlaybackHost, 'preflight' | 'execute'>;

const rejected = (error: string): StoryNodeActionOutcome => ({ status: 'rejected', error });
const nonEmpty = (value: string): boolean => value.trim().length > 0;
const errorText = (error: unknown): string => error instanceof Error ? error.message : String(error);

/** Materialize readable notifications from actual committed results, never requested amounts. */
export function formatStoryEffectReceipt(receipt: EffectReceipt, registry: Registry): string | undefined {
  if (receipt.status !== 'changed') return undefined;
  const number = (value: number) => value.toLocaleString('zh-CN');
  const signed = (value: number) => `${value > 0 ? '+' : ''}${number(value)}`;
  const name = (kind: Parameters<typeof displayName>[1], id = receipt.target) => displayName(registry, kind, id);
  const details = receipt.details && typeof receipt.details === 'object' && !Array.isArray(receipt.details)
    ? receipt.details as Record<string, unknown> : {};
  switch (receipt.op) {
    case 'addResource': case 'setResource':
      return typeof receipt.delta === 'number' && receipt.delta !== 0 ? `${name('resource')} ${signed(receipt.delta)}` : undefined;
    case 'addItem':
      return typeof receipt.delta === 'number' && receipt.delta !== 0 ? `${name('item')} ${signed(receipt.delta)}` : undefined;
    case 'setSpotLevel': case 'addSpotLevel':
      return typeof receipt.before === 'number' && typeof receipt.after === 'number' ? `${name('spot')}等级 ${number(receipt.before)} → ${number(receipt.after)}` : undefined;
    case 'setManager': return `${name('spot')}的经理变更为${typeof receipt.after === 'string' && receipt.after !== 'none' ? name('character', receipt.after) : '未指派'}`;
    case 'addEnhancement': return `获得强化 ${name('enhancement')}`;
    case 'unlockInit': return `解锁世界线 ${name('init')}`;
    case 'acquireAreaMap': return `获得区域地图 ${registry.areaMaps.get(receipt.target)?.name ?? receipt.target}`;
    case 'revealInformation': {
      try {
        const target = JSON.parse(receipt.target) as WorldInformationTargetRef;
        if (!target || !['area', 'areaMap', 'areaMapNode'].includes(target.entityKind)) return '得知世界信息';
        const entity = target.entityKind === 'area' ? '区域' : target.entityKind === 'areaMap' ? '区域地图' : '地图节点';
        const face = { existence: '存在', name: '身份', utility: '用途', condition: '方法' }[target.target];
        return face ? `得知${entity}${face}信息` : '得知世界信息';
      } catch { return '得知世界信息'; }
    }
    case 'grantCharacter': {
      const variant = registry.characterVariants.get(receipt.target)?.displayName ?? receipt.target;
      if (details.duplicate === true) return typeof details.shards === 'number' && details.shards !== 0 ? `${variant}碎片 ${signed(details.shards)}` : `${variant}重复获得`;
      return `获得学生 ${variant}`;
    }
    case 'addAffectionExp': {
      const before = receipt.before as { level?: number; exp?: number } | undefined;
      const after = receipt.after as { level?: number; exp?: number } | undefined;
      if (!before || !after || typeof after.level !== 'number' || typeof after.exp !== 'number') return undefined;
      const variant = registry.characterVariants.get(receipt.target)?.displayName ?? receipt.target;
      return before.level === after.level && typeof before.exp === 'number'
        ? `${variant} 好感经验 ${signed(after.exp - before.exp)}`
        : `${variant} 好感等级 ${before.level ?? 1} → ${after.level}（经验 ${number(after.exp)}）`;
    }
    case 'travel': return details.notice === true ? `已移动到 ${name('area')}` : undefined;
    default: return undefined;
  }
}

function hasVisitedStoryCondition(group: ConditionGroup): boolean {
  const first = group.conditions[0];
  if (group.type === 'OR' && first && 'target' in first && first.target === 'alwaysTrue'
    && first.comparator === '==' && first.value === 1) return false;
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
  if (storyEntryType(entry) !== request.entryType) return { error: 'EntryTypeMismatch' };
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
    case 'acquireAreaMap': return registry.areaMaps.has(action.mapId) ? undefined : 'AreaMapNotFound';
    case 'revealInformation': {
      const target = action.target;
        const rule = target.entityKind === 'area'
          ? registry.areas.get(target.entityId)?.reveal?.[target.target]
          : target.entityKind === 'areaMap'
            ? registry.areaMaps.get(target.entityId)?.reveal?.[target.target]
            : registry.areaMaps.get(target.mapId)?.nodes.find(node => node.id === target.nodeId)?.reveal?.[target.target];
        const found = target.entityKind === 'area'
          ? registry.areas.has(target.entityId)
          : target.entityKind === 'areaMap'
            ? registry.areaMaps.has(target.entityId)
            : registry.areaMaps.get(target.mapId)?.nodes.some(node => node.id === target.nodeId) === true;
        if (!found) return 'InformationTargetNotFound';
        return rule?.mode === 'explicit' ? undefined : 'InformationTargetNotExplicit';
    }
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
    case 'localFlag': return 'LocalFlagRequiresPlayback';
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
    case 'acquireAreaMap': target = action.mapId; value = 0; break;
    case 'revealInformation': target = ''; value = action.target; break;
    case 'setFlag': target = action.flagId; value = action.value; break;
    case 'setExtra': target = action.path; value = action.value; break;
    case 'addExtra': target = action.path; value = action.amount; break;
    case 'removeExtra': target = action.path; value = 0; break;
    case 'grantCharacter': target = action.variantId; value = 0; break;
    case 'addAffectionExp': target = action.variantId; value = action.amount; break;
  }
  return { op: action.op, target, value };
}

type PreparedChatTextValue = ChatTextEffectValue & { cardRequest?: Extract<StoryEntryRequest, { intent: 'card' }> };

function toOverlayEffect(command: StoryOverlayCommand, options?: StoryNodeActionHostOptions): Effect {
  if (command.command === 'clearId') return { op: 'clearIdChatFlow', target: command.id, value: 0 };
  if (command.command === 'clearAllTexts') return { op: 'clearAllChatText', target: '', value: 0 };
  if (command.command === 'clearFlow') return { op: 'clearAllChatFlow', target: '', value: 0 };

  const { content } = command;
  const location = {
    ...(command.x === undefined ? {} : { x: command.x }),
    ...(command.y === undefined ? {} : { y: command.y }),
    ...(command.align === undefined ? {} : { align: command.align }),
  };
  let value: PreparedChatTextValue;
  if (content.kind === 'entryCard') {
    if (!options?.presentation) throw new Error('OverlayCardRoutingUnsupported');
    const resolved = resolveEntry(options.registry, content.card.request);
    if ('error' in resolved) throw new Error(resolved.error);
    value = { kind: 'kizuna', targetStoryId: resolved.storyId, cardRequest: { ...content.card.request },
      talklet: { kind: 'click', text: content.card.buttonText ?? '', kizuna: { storyId: resolved.storyId,
        ...(content.card.title === undefined ? {} : { title: content.card.title }),
        ...(content.card.buttonText === undefined ? {} : { buttonText: content.card.buttonText }),
        ...(content.card.align === undefined ? {} : { align: content.card.align }) } },
      ...(content.card.title === undefined ? {} : { title: content.card.title }),
      ...(content.card.buttonText === undefined ? {} : { buttonText: content.card.buttonText }), ...location };
  } else if (content.kind === 'text') {
    value = { text: content.text, ...location, ...(content.template === undefined ? {} : { kind: content.template }), ...(content.style === undefined ? {} : { style: content.style }) };
  } else {
    const presentation = content.presentation;
    value = {
      talklet: {
        kind: content.content.kind, text: content.content.text,
        ...(content.content.kind === 'talk' ? { speaker: content.content.speaker, characterId: content.content.characterId, displayName: content.content.displayName, image: content.content.image } : {}),
        ...(presentation?.side === undefined ? {} : { side: presentation.side }),
        ...(presentation?.align === undefined ? {} : { align: presentation.align }),
        ...(presentation?.avatar === undefined ? {} : { avatar: presentation.avatar }),
        ...(presentation?.avatarMode === 'hide' ? { noAvatar: true } : {}),
        ...(presentation?.avatarMode === 'show' ? { showAvatar: true } : {}),
      },
      ...(presentation?.align === undefined || options?.presentation ? {} : { align: presentation.align }),
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

/** Only run-owned visual effects may survive as deferred presentation instructions. */
export function isDeferredStoryPresentationEffect(effect: Effect): boolean {
  switch (effect.op) {
    case 'showChatText': case 'clearIdChatFlow': case 'clearAllChatText': case 'clearAllChatFlow': case 'showOpeningTitle': return true;
    case 'setTheme': {
      if (!effect.value || typeof effect.value !== 'object' || Array.isArray(effect.value)) return false;
      const scope = 'scope' in effect.value ? effect.value.scope : undefined;
      return scope === undefined || scope === 'ephemeral';
    }
    case 'setEntityPresentation': return Boolean(effect.value && typeof effect.value === 'object' && 'lifetime' in effect.value && effect.value.lifetime === 'story');
    // clearEntityPresentation can fall back to manual/area/init ownership, so it commits logically.
    default: return false;
  }
}

/** Execute a previously materialized intent through the same run-aware lifecycle host. */
export function executeStoryPresentationEffect(options: Pick<StoryNodeActionHostOptions, 'presentation' | 'effectEngine'>, effect: Effect, source: StoryNodeSource): StoryNodeActionOutcome {
  if (!isDeferredStoryPresentationEffect(effect)) return rejected('PresentationEffectMustExecuteLogically');
  if (!options.presentation) {
    try { options.effectEngine.applyEffects([effect]); return { status: 'applied' }; }
    catch (error) { return rejected(`ActionExecutionFailed:${errorText(error)}`); }
  }
  let action: StoryAction;
  switch (effect.op) {
    case 'clearIdChatFlow': action = { kind: 'overlay', command: { command: 'clearId', id: effect.target } }; break;
    case 'clearAllChatText': action = { kind: 'overlay', command: { command: 'clearAllTexts' } }; break;
    case 'clearAllChatFlow': action = { kind: 'overlay', command: { command: 'clearFlow' } }; break;
    case 'showChatText': {
      const value = effect.value as PreparedChatTextValue;
      const location = { ...(value.x === undefined ? {} : { x: value.x }), ...(value.y === undefined ? {} : { y: value.y }), ...(value.align === undefined ? {} : { align: value.align }) };
      let content: Extract<StoryOverlayCommand, { command: 'show' }>['content'];
      if (value.cardRequest) {
        const card = value.talklet?.kizuna as { align?: 'left' | 'right' } | undefined;
        content = { kind: 'entryCard', card: { request: value.cardRequest,
          ...(value.title === undefined ? {} : { title: value.title }),
          ...(value.buttonText === undefined ? {} : { buttonText: value.buttonText }),
          ...(card?.align === undefined ? {} : { align: card.align }) } };
      } else if (value.talklet) {
        const talklet = value.talklet as typeof value.talklet & { kind?: string; side?: 'left' | 'right'; align?: 'left' | 'center' | 'right'; noAvatar?: boolean; showAvatar?: boolean };
        content = { kind: 'message', content: talklet.kind === 'narration' ? { kind: 'narration', text: talklet.text }
          : { kind: 'talk', text: talklet.text, ...(talklet.speaker === undefined ? {} : { speaker: talklet.speaker }), ...(talklet.characterId === undefined ? {} : { characterId: talklet.characterId }), ...(talklet.displayName === undefined ? {} : { displayName: talklet.displayName }), ...(talklet.image === undefined ? {} : { image: talklet.image }) },
          presentation: { ...(talklet.side === undefined ? {} : { side: talklet.side }), ...(talklet.align === undefined ? {} : { align: talklet.align }),
            ...(talklet.avatar === undefined ? {} : { avatar: talklet.avatar }), ...(talklet.noAvatar ? { avatarMode: 'hide' as const } : talklet.showAvatar ? { avatarMode: 'show' as const } : {}) },
          ...(value.style === undefined ? {} : { style: value.style }) };
      } else content = { kind: 'text', text: value.text ?? '', ...(value.kind === undefined || value.kind === 'kizuna' ? {} : { template: value.kind }), ...(value.style === undefined ? {} : { style: value.style }) };
      action = { kind: 'overlay', command: { command: 'show', id: effect.target, content, ...location } }; break;
    }
    case 'setTheme': action = { kind: 'presentation', command: { command: 'theme', value: effect.value as Extract<StoryPresentationCommand, { command: 'theme' }>['value'] } }; break;
    case 'setEntityPresentation': {
      const value = effect.value as { optionId: string; owner: string; lifetime?: Extract<StoryPresentationCommand, { command: 'setEntityPresentation' }>['lifetime'] };
      action = { kind: 'presentation', command: { command: 'setEntityPresentation', target: effect.target as EntityPresentationKey, optionId: value.optionId, owner: value.owner, ...(value.lifetime === undefined ? {} : { lifetime: value.lifetime }) } }; break;
    }
    case 'clearEntityPresentation': action = { kind: 'presentation', command: { command: 'clearEntityPresentation', target: effect.target as EntityPresentationKey, owner: (effect.value as { owner: string }).owner } }; break;
    case 'showOpeningTitle': action = { kind: 'presentation', command: { command: 'openingTitle', title: String(effect.value) } }; break;
    default: return rejected('PresentationEffectUnsupported');
  }
  return options.presentation.execute(action, source);
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
  if (storyEntryType(current) === 'passive' && current.blocksInteraction) return 'EntryBlockedByPassive';
  if (request.intent === 'card' || request.entryType === 'active' && storyEntryType(current) === 'passive'
    || request.intent === 'system' && storyEntryType(current) === 'passive') return undefined;
  return 'EntryCursorOccupied';
}

function executeEntryRequest(options: StoryNodeActionHostOptions, request: StoryEntryRequest, source: StoryNodeSource): StoryNodeActionOutcome {
  const resolved = resolveEntry(options.registry, request);
  if ('error' in resolved) return rejected(resolved.error);
  if (request.intent !== 'card') {
    const error = conditionGateError(options, resolved.entry);
    if (error) return rejected(error);
  }
  if (request.intent === 'ordinary' && !(storyEntryType(resolved.entry) === 'passive' && (resolved.entry.activation.kind === 'random' && resolved.entry.activation.repeatable))
    && options.storyService.hasCompletedStory(resolved.storyId)) return rejected('EntryAlreadyCompleted');
  const cursorError = cursorGateError(options, request);
  if (cursorError) return rejected(cursorError);
  if (options.requestEntry) return options.requestEntry(request, source);

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
    if (action.kind==='clearNode') return !options.clearNode ? 'NodeDisplayLifecycleUnsupported'
      : options.registry.stories.get(action.storyId)?.nodes.some(node=>node.id===action.nodeId&&(node.type==='talklet'||node.type==='click')) ? undefined : 'NodeDisplayTargetNotFound';
    if (options.presentation && (action.kind === 'overlay' || action.kind === 'presentation')) {
      return options.presentation.preflight(action, source);
    }
    return actionError(options.registry, action, source);
  };
  const execute = (action: StoryAction, source: StoryNodeSource): StoryNodeActionOutcome => {
    if (options.deferPresentation && action.kind === 'presentation' && action.command.command === 'openingTitle') {
      const title = nonEmpty(action.command.title ?? '') ? action.command.title! : options.getTitle?.(source) ?? '';
      if (!nonEmpty(title)) return rejected('OpeningTitleDefaultSourceMissing');
      action = { ...action, command: { ...action.command, title } };
    }
    const error = preflight(action, source);
    if (error) return rejected(error);
    const receipts: EffectReceipt[] = [];
    try {
      switch (action.kind) {
        case 'clearNode': options.clearNode!(action,source); return {status:'applied'};
        case 'localFlag': return rejected('LocalFlagRequiresPlayback');
        case 'state': {
          const gateError = stateBatchGateError(options, action.effects);
          if (gateError) return rejected(gateError);
          if (options.effectEngine.applyEffectsWithReceipts) {
            options.effectEngine.applyEffectsWithReceipts(action.effects.map(toEffect), receipt => receipts.push(receipt));
            return { status: 'applied', receipts };
          }
          options.effectEngine.applyEffects(action.effects.map(toEffect));
          return { status: 'applied' };
        }
        case 'travel': {
          const recordTravel = (result: Extract<TravelResult, { success: true }>) => receipts.push({
            effectIndex: 0, op: 'travel', target: action.areaId, status: result.fromAreaId === result.areaId ? 'noop' : 'changed',
            before: result.fromAreaId, after: result.areaId, details: { notice: action.notice ?? false, ...result },
          });
          const result = options.travelToArea(action.areaId, true, false, recordTravel);
          // Story travel was historically best-effort: domain-level denials such as
          // AlreadyThere or NotInThisInit do not fault the Story action chain.
          if (!receipts.length) {
            if (result.success) recordTravel(result);
            else receipts.push({ effectIndex: 0, op: 'travel', target: action.areaId, status: 'noop', details: { notice: action.notice ?? false, ...result } });
          }
          return { status: 'applied', receipts };
        }
        case 'overlay':
          if (options.deferPresentation) return { status: 'applied', presentation: [JSON.parse(JSON.stringify(toOverlayEffect(action.command, options))) as Effect] };
          if (options.presentation) return options.presentation.execute(action, source);
          options.effectEngine.applyEffects([toOverlayEffect(action.command)]);
          return { status: 'applied' };
        case 'presentation':
          if (options.deferPresentation) {
            const effect = toPresentationEffect(action.command);
            if (isDeferredStoryPresentationEffect(effect)) return { status: 'applied', presentation: [JSON.parse(JSON.stringify(effect)) as Effect] };
          }
          if (options.presentation) return options.presentation.execute(action, source);
          options.effectEngine.applyEffects([toPresentationEffect(action.command)]);
          return { status: 'applied' };
        case 'entryRequest': return executeEntryRequest(options, action.request, source);
      }
    } catch (error) {
      const committed = receipts.length ? receipts : (error as { receipts?: EffectReceipt[] } | null)?.receipts;
      return { ...rejected(`ActionExecutionFailed:${errorText(error)}`), ...(committed?.length ? { receipts: committed } : {}) };
    }
  };
  return { preflight, execute };
}
