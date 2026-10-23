import type { PlayerState } from '../../types/state';
import type { StoryEntryDef, BranchGuard } from '../../../data-services/contracts/story-entry';
import type { StoryDef } from '../../../data-services/contracts/story';
import type { StoryAction, StoryTransfer } from '../../../data-services/contracts/story-node-actions';
import type { StoryContent } from '../../../data-services/contracts/story-node';
import type {
  AreaStoryDeliveryView, SendResult, SendState, StoryAdvanceResult, StoryStartResult, StoryView,
} from '../../contracts/runtime/results';
import type { EventBus } from '../../../engine/core/event-bus';
import type { StoryCursorCollection, StoryCursorSnapshot } from '../../../engine/contracts/story-cursor';
import type { Registry } from '../../../data-services/registry/registry';
import { ConditionSystem } from '../../../engine/expression/condition-system';
import type { EffectEngine } from '../../../engine/effect/effect-engine';
import type { StoryMutationPort } from '../../contracts/runtime/mutation';
import type { StoryNodeCommandResult, StoryNodePlaybackHost, StoryNodePlaybackView, StoryNodeSource } from '../../contracts/runtime/story-node-playback';
import type { StoryNodeSnapshot } from '../../../engine/contracts/story-node-snapshot';
import type { CompletedStory } from '../../types/story-state';
import type { TravelResult } from '../../contracts/runtime/results';
import type { StoryNodePresentationPort } from './story-node-presentation-host';
import { PassivePoolSystem } from '../economy/passive-pool-system';
import { validateStoryNodeStructure } from '../../../data-services/validation/story-node-structure';
import { createStoryNodeActionHost } from './story-node-action-host';
import {
  createStoryNodeSession, markSessionClosed, markTalkletDelivered, projectStoryNodeView,
  trackStoryFlags, type StoryNodeRunEndReason, type StoryNodeSession,
} from './story-node-session';
import {
  guardPrereqsMet, isStoryCursorSnapshot, readyStepIds, triggerAffectionPush,
  triggerPassiveStory, triggerTailPush, type StoryEntrySelectionContext,
} from './story-entry-selection';
import { applyCompletionReward, maybeBlockConversation, recordPassiveCooldown } from './story-rewards';

export type StoryCursor = StoryCursorSnapshot;

let nextRunSequence = 0;
function newRunId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `story:${uuid}` : `story:${Date.now().toString(36)}:${++nextRunSequence}`;
}

function ownerKey(owner: string | null): string { return owner === null ? '\u0000global' : `variant:${owner}`; }
function normalizeOwner(owner?: string | null): string | null { return owner ?? null; }

export interface StoryServiceOptions {
  registry: Registry;
  conditionSystem: ConditionSystem;
  effectEngine: EffectEngine;
  mutations: StoryMutationPort;
  eventBus: EventBus;
  passivePools: PassivePoolSystem;
  getState: () => PlayerState;
  travelToArea: (areaId: string, allowDuringStory?: boolean, checkAdjacency?: boolean) => TravelResult;
  /** Owns run-scoped overlay and entity presentation lifetime. UI selects its active owner explicitly. */
  presentation?: StoryNodePresentationPort;
  random?: () => number;
}

type StartOptions = { force?: boolean; skipConditions?: boolean; replaceAny?: boolean };
type CompletedAdvance = Extract<StoryAdvanceResult, { success: true; finished: true }>;

/** One StoryNodePlayer session per global/chat owner; no legacy Talklet interpreter remains. */
export class StoryService {
  private readonly sessions = new Map<string, StoryNodeSession>();
  private readonly actionHost: Pick<StoryNodePlaybackHost, 'preflight' | 'execute'>;
  private readonly selection: StoryEntrySelectionContext;

  constructor(private readonly opts: StoryServiceOptions) {
    const core = createStoryNodeActionHost({
      registry: opts.registry,
      effectEngine: opts.effectEngine,
      conditionSystem: opts.conditionSystem,
      getState: opts.getState,
      storyService: this,
      travelToArea: opts.travelToArea,
      eventBus: opts.eventBus,
      presentation: opts.presentation,
    });
    this.actionHost = {
      preflight: core.preflight,
      execute: (action, source) => {
        const outcome = core.execute(action, source);
        const session = this.sessionFor(source.owner);
        if (session && session.source.runId === source.runId) trackStoryFlags(session, action, outcome);
        return outcome;
      },
    };
    this.selection = {
      registry: opts.registry,
      conditionSystem: opts.conditionSystem,
      passivePools: opts.passivePools,
      getState: opts.getState,
      hasCompletedStory: storyId => this.hasCompletedStory(storyId),
      getCurrentStoryId: owner => this.getCurrentStoryId(owner),
      startStory: (storyId, expectedType, owner, startOpts) => this.startStory(storyId, expectedType, owner, startOpts),
    };
  }

  private get state(): PlayerState { return this.opts.getState(); }
  private get documents(): ReadonlyMap<string, StoryDef> { return this.opts.registry.stories; }

  /** UI calls this when the player selects a global or owner-specific conversation surface. */
  activateOwner(owner?: string | null): void { this.opts.presentation?.activate(normalizeOwner(owner)); }

  getCurrentStoryId(owner?: string | null): string | null {
    return this.sessionFor(normalizeOwner(owner))?.source.entryId ?? null;
  }

  /** Actual Story.id at the current delivery/input wait point, or null while idle. */
  getCurrentStoryDefId(owner?: string | null): string | null {
    const session = this.sessionFor(normalizeOwner(owner));
    if (!session) return null;
    const view = session.player.getView();
    return view.status === 'delivery' || view.status === 'input' ? view.storyId : null;
  }

  /** The compatibility condition target is scoped to the global owner's active chain. */
  isVisitedInChain(storyId: string): boolean {
    return this.sessionFor(null)?.visitedStoryIds.has(storyId) ?? false;
  }

  saveCursor(): StoryCursor {
    const session = this.sessionFor(null);
    return session ? this.snapshot(session) : this.emptySnapshot();
  }

  saveChatCursors(): Record<string, StoryCursor> {
    const result: Record<string, StoryCursor> = {};
    for (const session of this.sessions.values()) {
      if (session.source.owner !== null) result[ownerKey(session.source.owner)] = this.snapshot(session);
    }
    return result;
  }

  /** Purely validates every owner checkpoint before callers replace PlayerState or live cursors. */
  validateCursors(collection: StoryCursorCollection | undefined): void {
    if (collection === undefined) return;
    if (!collection || typeof collection !== 'object'
      || !collection.global || !collection.chats || typeof collection.chats !== 'object'
      || Array.isArray(collection.chats)) throw new Error('InvalidStoryCursorCollection');
    this.validateCursorSnapshot(collection.global, null);
    for (const [key, snapshot] of Object.entries(collection.chats)) {
      const owner = this.ownerFromCursorKey(key);
      this.validateCursorSnapshot(snapshot, owner);
    }
  }

  restoreCursor(snapshot: StoryCursor): void {
    this.validateCursorSnapshot(snapshot, null);
    this.clearOwner(null);
    const session = this.restoreSession(snapshot, null);
    if (session) this.sessions.set(ownerKey(null), session);
  }

  restoreChatCursors(snapshots: Record<string, StoryCursor> | undefined): void {
    if (snapshots !== undefined) {
      if (!snapshots || typeof snapshots !== 'object' || Array.isArray(snapshots)) throw new Error('InvalidStoryCursorChats');
      for (const [key, snapshot] of Object.entries(snapshots)) {
        this.validateCursorSnapshot(snapshot, this.ownerFromCursorKey(key));
      }
    }
    for (const session of [...this.sessions.values()]) if (session.source.owner !== null) this.endSession(session, 'cancelled');
    if (!snapshots) return;
    for (const [key, snapshot] of Object.entries(snapshots)) {
      const owner = this.ownerFromCursorKey(key);
      const session = this.restoreSession(snapshot, owner);
      if (session) this.sessions.set(key, session);
    }
  }

  saveCursors(): StoryCursorCollection {
    return { global: this.saveCursor(), chats: this.saveChatCursors() };
  }

  restoreCursors(collection: StoryCursorCollection | undefined): void {
    this.validateCursors(collection);
    this.clearAllCurrentStories();
    if (!collection) return;
    const global = this.restoreSession(collection.global, null);
    if (global) this.sessions.set(ownerKey(null), global);
    for (const [key, snapshot] of Object.entries(collection.chats)) {
      const owner = this.ownerFromCursorKey(key);
      const session = this.restoreSession(snapshot, owner);
      if (session) this.sessions.set(key, session);
    }
  }

  clearAllCurrentStories(): void {
    for (const session of [...this.sessions.values()]) this.endSession(session, 'cancelled');
    this.sessions.clear();
  }

  clearCurrentStory(owner?: string | null): void {
    const session = this.sessionFor(normalizeOwner(owner));
    if (session) this.endSession(session, 'cancelled');
  }

  isBlockingMovement(owner?: string | null): boolean {
    return this.sessionsForInteractionGate(owner).some(session => {
      const entry = session.entry;
      return entry.type !== 'passive' || entry.blocksInteraction === true || entry.leaveArea === false;
    });
  }

  isBlockingInteraction(owner?: string | null): boolean {
    return this.sessionsForInteractionGate(owner).some(session =>
      session.entry.type !== 'passive' || session.entry.blocksInteraction === true);
  }

  clearPassiveIfPlaying(owner?: string | null): void {
    const session = this.sessionFor(normalizeOwner(owner));
    const entry = session?.entry;
    if (session && entry?.type === 'passive' && entry.interruptible !== false && entry.blocksInteraction !== true) {
      this.endSession(session, 'cancelled');
    }
  }

  hasCompletedStory(storyId: string): boolean { return this.state.storyLog.some(story => story.storyId === storyId); }

  getAreaStoryDeliveries(areaId: string): readonly AreaStoryDeliveryView[] {
    const state = this.state;
    if (state.currentAreaId !== areaId) return [];
    const area = this.opts.registry.areas.get(areaId);
    if (!area || area.initId !== state.activeInit) return [];
    return (state.areaStoryDeliveries ?? []).flatMap(delivery => {
      if (delivery.areaId !== areaId || delivery.status !== 'pending') return [];
      const entry = this.opts.registry.activeStories.get(delivery.entryId);
      const story = entry ? this.opts.registry.stories.get(entry.storyId) : undefined;
      if (!entry || !story || story.nodes.length === 0
        || (entry.availableInits.length > 0 && !entry.availableInits.includes(state.activeInit))) return [];
      return [{ entryId: entry.id, areaId, title: entry.openingTitle ?? story.name, owner: entry.owner ?? null }];
    });
  }

  acceptAreaStoryDelivery(storyEntryId: string, areaId: string): StoryStartResult {
    const unavailable = (): StoryStartResult => ({ success: false, storyId: storyEntryId, error: 'AreaDeliveryUnavailable' });
    const state = this.state;
    const area = this.opts.registry.areas.get(areaId);
    const entry = this.opts.registry.activeStories.get(storyEntryId);
    const delivery = (state.areaStoryDeliveries ?? []).find(candidate =>
      candidate.entryId === storyEntryId && candidate.areaId === areaId && candidate.status === 'pending');
    if (state.currentAreaId !== areaId || !area || area.initId !== state.activeInit || !delivery || !entry) return unavailable();
    if (entry.availableInits.length > 0 && !entry.availableInits.includes(state.activeInit)) return unavailable();
    if (this.hasCompletedStory(entry.storyId)) return { success: false, storyId: storyEntryId, error: 'AlreadyCompleted' };
    const owner = entry.owner ?? null;
    if (this.getCurrentStoryId(owner) !== null) return { success: false, storyId: storyEntryId, error: 'AlreadyActive' };
    return this.startStory(storyEntryId, 'active', owner);
  }

  startActiveStory(storyId: string, owner?: string | null): StoryStartResult {
    return this.startStory(storyId, 'active', owner);
  }

  startCardStory(storyId: string, owner?: string | null): StoryStartResult {
    const existing = this.sessionFor(normalizeOwner(owner));
    if (existing?.entry.type === 'passive' && existing.entry.blocksInteraction === true) {
      return { success: false, storyId, error: 'AlreadyActive' };
    }
    return this.startEntry(storyId, 'active', normalizeOwner(owner), { skipConditions: true, force: true, replaceAny: true }, false);
  }

  startStory(storyId: string, expectedType: 'active' | 'passive', owner?: string | null, options?: StartOptions): StoryStartResult {
    return this.startEntry(storyId, expectedType, normalizeOwner(owner), options, false);
  }

  triggerPassiveStory(initId = this.state.activeInit, owner?: string | null): StoryStartResult {
    return triggerPassiveStory(this.selection, initId, normalizeOwner(owner));
  }

  triggerAffectionPush(owner: string): StoryStartResult { return triggerAffectionPush(this.selection, owner); }

  triggerTailPush(owner: string, storyId: string): StoryStartResult { return triggerTailPush(this.selection, owner, storyId); }

  readyStepCount(owner: string): number { return readyStepIds(this.selection, owner).length; }

  replayStory(storyId: string, owner?: string | null): StoryStartResult {
    const entry = this.opts.registry.storyEntries.get(storyId);
    if (!entry) return { success: false, storyId, error: 'NotFound' };
    if (!entry.replayable) return { success: false, storyId, error: 'NotReplayable' };
    if (this.sessionFor(normalizeOwner(owner))) return { success: false, storyId, error: 'AlreadyActive' };
    return this.startEntry(storyId, entry.type, normalizeOwner(owner), { skipConditions: true }, true);
  }

  advanceStory(choiceIndex?: number | string, owner?: string | null, token?: string): StoryAdvanceResult {
    return this.advanceNode(choiceIndex, owner, token, false);
  }

  private advanceNode(
    choiceIndex: number | string | undefined,
    owner: string | null | undefined,
    token: string | undefined,
    allowClickInput: boolean,
  ): StoryAdvanceResult {
    const normalizedOwner = normalizeOwner(owner);
    const session = this.sessionFor(normalizedOwner);
    if (!session) return { success: false, error: 'NoActiveStory' };
    const current = session.player.getView();
    const commandToken = token ?? (current.status === 'delivery' || current.status === 'input' ? current.token : undefined);
    if (!commandToken || current.status !== 'delivery' && current.status !== 'input') return { success: false, error: 'NoActiveStory' };
    if (current.status === 'input' && current.node.interaction.kind !== 'choice' && !allowClickInput) {
      return { success: false, storyId: session.source.entryId, error: 'ClickRequired' };
    }

    session.denialMessage = undefined;
    let command;
    let selectedOptionIndex: number | undefined;
    if (current.status === 'delivery') {
      if (choiceIndex !== undefined) return { success: false, storyId: session.source.entryId, error: 'InvalidChoice' };
      let acknowledgementIsCurrent = current.token === commandToken;
      if (acknowledgementIsCurrent) {
        try { session.player.save(); }
        catch { acknowledgementIsCurrent = false; }
      }
      if (acknowledgementIsCurrent) {
        const delivered = markTalkletDelivered(session, current);
        if (delivered) this.opts.mutations.recordStoryRead(delivered.storyId, delivered.ordinal);
      }
      command = session.player.ackDelivery(commandToken);
    } else {
      let optionId: string | undefined;
      if (current.node.interaction.kind === 'choice') {
        if (choiceIndex === undefined) return { success: false, storyId: session.source.entryId, error: 'ChoiceRequired' };
        const options = current.node.interaction.options;
        selectedOptionIndex = typeof choiceIndex === 'number'
          ? choiceIndex
          : options.findIndex(option => option.id === choiceIndex);
        if (!Number.isSafeInteger(selectedOptionIndex) || selectedOptionIndex! < 0 || selectedOptionIndex! >= options.length) {
          return { success: false, storyId: session.source.entryId, error: 'InvalidChoice' };
        }
        optionId = options[selectedOptionIndex!]!.id;
        if (!current.availableOptionIds.includes(optionId)) {
          return { success: false, storyId: session.source.entryId, error: 'ChoiceConditionNotMet' };
        }
      } else if (choiceIndex !== undefined) {
        return { success: false, storyId: session.source.entryId, error: 'InvalidChoice' };
      }
      command = session.player.submit(commandToken, optionId);
      if (command.ok && selectedOptionIndex !== undefined) {
        session.lastChoiceIndex = selectedOptionIndex;
        session.lastChoiceStoryId = current.storyId;
        const talkletOrdinal = this.precedingTalkletOrdinal(session, current.storyId, current.node.id);
        if (talkletOrdinal !== null) {
          this.opts.mutations.recordStoryRead(current.storyId, talkletOrdinal, selectedOptionIndex);
        }
      }
    }

    const reply = command.events.find(event => event.type === 'reply')?.content;
    return this.advanceResultFromCommand(session, normalizedOwner, command, reply);
  }

  getSendState(owner?: string | null): SendState {
    const normalizedOwner = normalizeOwner(owner);
    const session = this.sessionFor(normalizedOwner);
    if (!session) return { mode: 'idle', reason: 'noStory' };
    const view = session.player.getView();
    const storyView = projectStoryNodeView(session, view);
    if (!storyView) return { mode: 'idle', reason: 'noStory' };
    if (view.status === 'delivery') {
      return { mode: 'advance', storyId: session.source.entryId, pageIndex: storyView.pageIndex, text: '', token: view.token };
    }
    if (view.status !== 'input') return { mode: 'idle', reason: 'noStory' };
    const interaction = view.node.interaction;
    if (interaction.kind === 'choice') return { mode: 'choice', confirmed: true, token: view.token };
    if (interaction.kind === 'entryCard') {
      const card = interaction.card;
      return {
        mode: 'kizuna', storyId: session.source.entryId, pageIndex: storyView.pageIndex,
        targetStoryId: card.request.entryId, title: card.title, buttonText: card.buttonText,
        align: card.align ?? 'left', token: view.token,
      };
    }
    return {
      mode: 'advance', storyId: session.source.entryId, pageIndex: storyView.pageIndex, text: interaction.text, token: view.token,
      ...(view.press ? { clickWork: { total: view.press.total, done: view.press.done } } : {}),
    };
  }

  clickSend(owner?: string | null, token?: string): SendResult {
    const normalizedOwner = normalizeOwner(owner);
    const state = this.getSendState(normalizedOwner);
    const session = this.sessionFor(normalizedOwner);
    if (!session || state.mode === 'idle') {
      if (normalizedOwner !== null) {
        const pushed = this.triggerAffectionPush(normalizedOwner);
        if (pushed.success) return { type: 'idle', started: true };
      }
      const started = this.triggerPassiveStory(this.state.activeInit, normalizedOwner);
      return started.success
        ? { type: 'idle', started: true }
        : { type: 'idle', started: false, error: started.error };
    }
    const current = session.player.getView();
    const currentToken = token ?? (current.status === 'delivery' || current.status === 'input' ? current.token : undefined);
    if (state.mode === 'choice') return { type: 'choice' };

    if (current.status === 'delivery') {
      const advance = this.advanceStory(undefined, normalizedOwner, currentToken);
      return {
        type: 'completed', storyId: session.source.entryId, finished: advance.success && advance.finished,
        sentText: '', echoReply: false, advance, absorbed: [],
      };
    }
    if (current.status !== 'input' || !currentToken) return { type: 'idle', started: false, error: 'NoActiveStory' };

    if (current.node.interaction.kind === 'button' && current.press) {
      const done = current.press.done + 1;
      if (done < current.press.total) {
        const advance = this.advanceNode(undefined, normalizedOwner, currentToken, true);
        const next = session.player.getView();
        if (advance.success && !advance.finished && next.status === 'input' && next.press) {
          return {
            type: 'working', storyId: session.source.entryId, pageIndex: state.mode === 'advance' ? state.pageIndex : 0,
            clicksDone: next.press.done, clicksTotal: next.press.total,
          };
        }
        return { type: 'completed', storyId: session.source.entryId, finished: false, sentText: '', echoReply: false, advance, absorbed: [] };
      }
    }

    const interaction = current.node.interaction;
    const sentText = interaction.kind === 'button'
      ? interaction.reply?.text ?? interaction.text
      : interaction.kind === 'entryCard' ? interaction.card.buttonText ?? '' : '';
    const advance = this.advanceNode(undefined, normalizedOwner, currentToken, true);
    const echoReply = interaction.kind === 'button' && interaction.reply !== undefined && advance.success;
    return {
      type: 'completed', storyId: session.source.entryId,
      finished: advance.success && advance.finished,
      sentText, echoReply, advance, absorbed: [],
    };
  }

  getCurrentStoryView(owner?: string | null): StoryView | null {
    const session = this.sessionFor(normalizeOwner(owner));
    return session ? projectStoryNodeView(session, session.player.getView()) : null;
  }

  private startEntry(
    storyId: string,
    expectedType: 'active' | 'passive',
    owner: string | null,
    options: StartOptions | undefined,
    replay: boolean,
  ): StoryStartResult {
    const entry = this.opts.registry.storyEntries.get(storyId);
    if (!entry) return { success: false, storyId, error: 'NotFound' };
    if (entry.type !== expectedType) return { success: false, storyId, error: 'WrongStoryType' };
    const root = this.opts.registry.stories.get(entry.storyId);
    if (!root) return { success: false, storyId, error: 'NotFound' };
    const validation = validateStoryNodeStructure(root);
    if (!validation.ok) return { success: false, storyId, error: 'PlaybackFailed', detail: `InvalidDocument:${validation.issues[0]?.path ?? 'unknown'}` };
    if (!options?.skipConditions) {
      const state = this.state;
      if (entry.availableInits.length > 0 && !entry.availableInits.includes(state.activeInit)) {
        return { success: false, storyId, error: 'ConditionNotMet' };
      }
      if (entry.triggerCondition && !this.opts.conditionSystem.evaluateGroup(entry.triggerCondition, state)) {
        return { success: false, storyId, error: 'ConditionNotMet' };
      }
    }
    const repeatable = entry.type === 'passive' && entry.repeatable;
    if (!replay && !options?.force && !repeatable && this.hasCompletedStory(root.id)) {
      return { success: false, storyId, error: 'AlreadyCompleted' };
    }

    const existing = this.sessionFor(owner);
    if (replay && existing) return { success: false, storyId, error: 'AlreadyActive' };
    if (existing) {
      if (existing.entry.type === 'passive' && existing.entry.blocksInteraction === true) {
        return { success: false, storyId, error: 'AlreadyActive' };
      }
      const mayReplacePassive = existing.entry.type === 'passive'
        && (expectedType === 'active' || options?.force === true);
      if (!mayReplacePassive && !options?.replaceAny) return { success: false, storyId, error: 'AlreadyActive' };
    }

    const runId = newRunId();
    const source: StoryNodeSource = { entryId: entry.id, rootStoryId: root.id, owner, runId, historyId: runId };
    let session!: StoryNodeSession;
    const preflightTransfer = (transfer: StoryTransfer, _source: StoryNodeSource): string | undefined => {
      session.denialMessage = undefined;
      if (!session.replay) return undefined;
      const guard = session.entry.branchGuards?.find(candidate => candidate.storyId === transfer.storyId);
      if (!guard || guardPrereqsMet(this.opts.registry, this.state, guard)) return undefined;
      session.denialMessage = guard.denialMessage;
      return 'BranchGuardDenied';
    };
    session = createStoryNodeSession({
      source, entry, replay, documents: this.documents,
      conditionSystem: this.opts.conditionSystem,
      getState: this.opts.getState,
      actionHost: this.actionHost,
      random: this.opts.random,
      preflightTransfer,
    });

    const rememberReplacement = (result: StoryStartResult): StoryStartResult => {
      if (existing) existing.replacementResult = result;
      return result;
    };
    this.sessions.set(ownerKey(owner), session);
    // Publish the replacement before the old run's close event can synchronously start another run.
    if (existing) this.endSession(existing, 'replaced');
    if (!this.isCurrent(session)) return rememberReplacement(this.startResultForCurrent(owner, storyId));
    this.opts.eventBus.emit({ type: 'storyTriggered', storyId: entry.id, owner, runId: source.runId });
    // Synchronous listeners may replace this session before its Player is initialized.
    if (!this.isCurrent(session)) return rememberReplacement(this.startResultForCurrent(owner, storyId));

    const command = session.player.start(root.id, source);
    this.captureVisited(session, command);
    const completion = this.handleTerminal(session, command.view);
    if (completion) return rememberReplacement({ success: true, finished: true, storyId: completion.storyId, completed: completion.completed });
    if (session.replacementResult !== undefined) return rememberReplacement(session.replacementResult);
    if (command.view.status === 'failed') return rememberReplacement({ success: false, storyId, error: 'PlaybackFailed', detail: command.view.error });
    if (!this.isCurrent(session)) return rememberReplacement(this.startResultForCurrent(owner, storyId));
    const view = this.getCurrentStoryView(owner);
    return rememberReplacement(view
      ? { success: true, finished: false, story: view }
      : { success: false, storyId, error: command.ok ? 'NoActiveStory' : this.mapError(command.error).error });
  }

  private startResultForCurrent(owner: string | null, requestedStoryId: string): StoryStartResult {
    const view = this.getCurrentStoryView(owner);
    return view ? { success: true, finished: false, story: view } : { success: false, storyId: requestedStoryId, error: 'NoActiveStory' };
  }

  private advanceResultFromCommand(
    session: StoryNodeSession,
    owner: string | null,
    command: StoryNodeCommandResult,
    reply?: StoryContent,
  ): StoryAdvanceResult {
    this.captureVisited(session, command);
    if (session.replacementResult !== undefined) {
      return this.advanceResultFromStart(session.replacementResult, session.source.entryId, reply);
    }
    const completion = this.handleTerminal(session, command.view);
    if (completion) return { ...completion, ...(reply ? { reply } : {}) };
    if (command.view.status === 'failed') return { success: false, storyId: session.source.entryId, error: 'PlaybackFailed', detail: command.view.error };
    if (!this.isCurrent(session)) {
      const replacement = this.getCurrentStoryView(owner);
      return replacement
        ? { success: true, finished: false, story: replacement, ...(reply ? { reply } : {}) }
        : { success: false, storyId: session.source.entryId, error: 'NoActiveStory' };
    }
    if (!command.ok) {
      const mapped = this.mapError(command.error);
      return { success: false, storyId: session.source.entryId, error: mapped.error,
        ...(session.denialMessage ? { denialMessage: session.denialMessage } : {}), ...(mapped.detail ? { detail: mapped.detail } : {}) };
    }
    const view = this.getCurrentStoryView(owner);
    return view
      ? { success: true, finished: false, story: view, ...(reply ? { reply } : {}) }
      : { success: false, storyId: session.source.entryId, error: 'NoActiveStory' };
  }

  private advanceResultFromStart(result: StoryStartResult, fallbackStoryId: string, reply?: StoryContent): StoryAdvanceResult {
    if (!result.success) {
      return {
        success: false,
        ...(result.storyId === undefined ? { storyId: fallbackStoryId } : { storyId: result.storyId }),
        error: result.error,
        ...(result.detail === undefined ? {} : { detail: result.detail }),
      };
    }
    return result.finished
      ? { success: true, finished: true, storyId: result.storyId, completed: result.completed, ...(reply ? { reply } : {}) }
      : { success: true, finished: false, story: result.story, ...(reply ? { reply } : {}) };
  }

  private handleTerminal(session: StoryNodeSession, view: StoryNodePlaybackView): CompletedAdvance | null {
    if (view.status === 'completed') return this.completeSession(session, view.completion);
    if (view.status === 'failed' && this.isCurrent(session)) this.endSession(session, 'failed');
    else if (view.status === 'replaced' && this.isCurrent(session)) this.endSession(session, 'replaced');
    return null;
  }

  private captureVisited(session: StoryNodeSession, command: StoryNodeCommandResult): void {
    for (const event of command.events) {
      if (event.type === 'view' && (event.view.status === 'delivery' || event.view.status === 'input')) {
        session.visitedStoryIds.add(event.view.storyId);
      }
    }
    if (command.view.status === 'delivery' || command.view.status === 'input') session.visitedStoryIds.add(command.view.storyId);
  }

  /** Associates a Click choice with the latest Talklet in the same Story document. */
  private precedingTalkletOrdinal(session: StoryNodeSession, storyId: string, nodeId: string): number | null {
    const document = session.documents.get(storyId);
    if (!document) return null;
    const choiceIndex = document.nodes.findIndex(node => node.id === nodeId);
    if (choiceIndex < 0) return null;
    let ordinal = -1;
    let preceding = -1;
    for (let index = 0; index < choiceIndex; index += 1) {
      if (document.nodes[index]!.type === 'talklet') {
        ordinal += 1;
        preceding = ordinal;
      }
    }
    return preceding >= 0 ? preceding : null;
  }

  /** Remove source before close, reward, mutation events, or listeners can synchronously start a new run. */
  private completeSession(session: StoryNodeSession, completion: { terminalStoryId: string }): CompletedAdvance | null {
    if (!markSessionClosed(session)) return null;
    this.sessions.delete(ownerKey(session.source.owner));
    this.opts.presentation?.close(session.source, 'completed');
    const completed: CompletedStory = session.entry.type === 'active'
      ? { type: 'active', storyId: completion.terminalStoryId,
          choiceIndex: session.lastChoiceStoryId === completion.terminalStoryId ? session.lastChoiceIndex : -1 }
      : { type: 'passive', storyId: completion.terminalStoryId };
    if (!session.replay) {
      const rewardContext = {
        registry: this.opts.registry, conditionSystem: this.rewardConditionSystem(session),
        effectEngine: this.opts.effectEngine, mutations: this.opts.mutations,
        getState: this.opts.getState, hasCompletedStory: (storyId: string) => this.hasCompletedStory(storyId),
      };
      const reward = applyCompletionReward(rewardContext, session.entry, completion.terminalStoryId);
      this.opts.mutations.completeStory(completed, session.entry.id);
      if (session.entry.type === 'passive') {
        recordPassiveCooldown(rewardContext, session.entry);
        maybeBlockConversation(rewardContext, session.entry);
      }
      if (reward) this.opts.eventBus.emit({
        type: 'storyRewarded', storyId: completion.terminalStoryId, source: reward.source,
        effects: reward.effects, flags: [...session.flags], owner: session.source.owner, runId: session.source.runId,
      });
    }
    return { success: true, finished: true, storyId: completion.terminalStoryId, completed };
  }

  private endSession(session: StoryNodeSession, reason: StoryNodeRunEndReason): void {
    if (!markSessionClosed(session)) return;
    if (this.isCurrent(session)) this.sessions.delete(ownerKey(session.source.owner));
    if (reason === 'cancelled') session.player.cancel();
    this.opts.presentation?.close(session.source, reason);
  }

  /** Reward predicates still see this completed run's chain after its live cursor is removed. */
  private rewardConditionSystem(session: StoryNodeSession): ConditionSystem {
    const base = this.opts.conditionSystem;
    const scoped = new ConditionSystem();
    scoped.setTagIndex(tag => base.tagIndex(tag));
    scoped.setStatReader(dsl => base.statReader(dsl));
    scoped.setStoryRunChecker(id => base.storyRunChecker(id));
    scoped.setStoryChainChecker(id => session.visitedStoryIds.has(id));
    scoped.setExtraReader(path => base.extraReader(path));
    scoped.setTagCountReader(key => base.tagCountReader(key));
    scoped.setAffectionLevelReader((id, state) => base.affectionLevelReader(id, state));
    return scoped;
  }

  private isCurrent(session: StoryNodeSession): boolean {
    return this.sessions.get(ownerKey(session.source.owner)) === session;
  }

  private sessionFor(owner?: string | null): StoryNodeSession | undefined {
    return this.sessions.get(ownerKey(normalizeOwner(owner)));
  }

  private sessionsForInteractionGate(owner?: string | null): StoryNodeSession[] {
    if (owner == null) return [...this.sessions.values()];
    const result = new Set<StoryNodeSession>();
    const global = this.sessionFor(null);
    const owned = this.sessionFor(owner);
    if (global) result.add(global);
    if (owned) result.add(owned);
    return [...result];
  }

  private snapshot(session: StoryNodeSession): StoryCursorSnapshot {
    const presentation = this.opts.presentation?.save(session.source);
    return {
      playback: session.player.save(), isReplay: session.replay,
      lastChoiceIndex: session.lastChoiceIndex, lastChoiceStoryId: session.lastChoiceStoryId, flags: [...session.flags],
      ...(presentation === undefined ? {} : { presentation }),
    };
  }

  private emptySnapshot(): StoryCursorSnapshot {
    return {
      playback: { format: 'story-nodes', run: null }, isReplay: false,
      lastChoiceIndex: -1, lastChoiceStoryId: null, flags: [],
    };
  }

  private restoreSession(snapshot: StoryCursorSnapshot, expectedOwner: string | null): StoryNodeSession | null {
    if (!isStoryCursorSnapshot(snapshot)) throw new Error('InvalidStoryCursorSnapshot');
    const run = snapshot.playback.run;
    if (!run) {
      if (snapshot.isReplay || snapshot.lastChoiceIndex !== -1 || snapshot.lastChoiceStoryId !== null
        || snapshot.flags.length > 0 || snapshot.presentation !== undefined) {
        throw new Error('InvalidEmptyStoryCursor');
      }
      return null;
    }
    const source = run.source;
    if (source.owner !== expectedOwner || typeof source.runId !== 'string' || source.runId.length === 0) throw new Error('InvalidStoryCursorSource');
    const entry = this.opts.registry.storyEntries.get(source.entryId);
    const root = this.opts.registry.stories.get(source.rootStoryId);
    if (!entry || entry.storyId !== source.rootStoryId || !root) throw new Error('StoryCursorSourceNotFound');
    const restoredSource: StoryNodeSource = { ...source, runId: newRunId(), historyId: source.historyId ?? source.runId };
    const playback: StoryNodeSnapshot = { ...snapshot.playback, run: { ...run, source: restoredSource } };
    const session = createStoryNodeSession({
      source: restoredSource, entry, replay: snapshot.isReplay, documents: this.documents,
      conditionSystem: this.opts.conditionSystem, getState: this.opts.getState,
      actionHost: this.actionHost, random: this.opts.random,
      preflightTransfer: transfer => this.preflightTransfer(session, transfer),
    });
    try {
      session.player.restore(playback);
      if (snapshot.presentation !== undefined) {
        if (!this.opts.presentation?.restore) throw new Error('StoryPresentationRestoreUnavailable');
        this.opts.presentation.restore(restoredSource, snapshot.presentation);
      }
    } catch (error) {
      this.opts.presentation?.close(restoredSource, 'failed');
      throw error;
    }
    session.lastChoiceIndex = snapshot.lastChoiceIndex;
    session.lastChoiceStoryId = snapshot.lastChoiceStoryId;
    session.flags.clear();
    for (const flag of snapshot.flags) session.flags.add(flag);
    for (const visited of run.visited) session.visitedStoryIds.add(visited);
    return session;
  }

  private validateCursorSnapshot(snapshot: StoryCursorSnapshot, expectedOwner: string | null): void {
    if (!isStoryCursorSnapshot(snapshot)) throw new Error('InvalidStoryCursorSnapshot');
    if (!Number.isSafeInteger(snapshot.lastChoiceIndex) || snapshot.lastChoiceIndex < -1) {
      throw new Error('InvalidStoryCursorMetadata');
    }
    if (new Set(snapshot.flags).size !== snapshot.flags.length) throw new Error('InvalidStoryCursorMetadata');
    const run = snapshot.playback.run;
    if (!run) {
      if (snapshot.isReplay || snapshot.lastChoiceIndex !== -1 || snapshot.lastChoiceStoryId !== null
        || snapshot.flags.length > 0 || snapshot.presentation !== undefined) {
        throw new Error('InvalidEmptyStoryCursor');
      }
      return;
    }

    const source = run.source;
    if (!source || source.owner !== expectedOwner
      || typeof source.entryId !== 'string' || source.entryId.trim().length === 0
      || typeof source.rootStoryId !== 'string' || source.rootStoryId.trim().length === 0
      || typeof source.runId !== 'string' || source.runId.trim().length === 0
      || source.historyId !== undefined && (typeof source.historyId !== 'string' || source.historyId.trim().length === 0)) {
      throw new Error('InvalidStoryCursorSource');
    }
    const entry = this.opts.registry.storyEntries.get(source.entryId);
    const root = this.opts.registry.stories.get(source.rootStoryId);
    if (!entry || entry.storyId !== source.rootStoryId || !root) throw new Error('StoryCursorSourceNotFound');
    const validationSource: StoryNodeSource = { ...source, historyId: source.historyId ?? source.runId };
    const session = createStoryNodeSession({
      source: validationSource, entry, replay: snapshot.isReplay, documents: this.documents,
      conditionSystem: this.opts.conditionSystem, getState: this.opts.getState,
      actionHost: this.actionHost, random: this.opts.random,
      preflightTransfer: transfer => this.preflightTransfer(session, transfer),
    });
    const playback: StoryNodeSnapshot = { ...snapshot.playback, run: { ...run, source: validationSource } };
    session.player.restore(playback);
    this.validateLastChoiceMetadata(snapshot, run.visited);
    if (snapshot.presentation !== undefined) {
      if (!this.opts.presentation?.validateSnapshot) throw new Error('StoryPresentationValidationUnavailable');
      this.opts.presentation.validateSnapshot(validationSource, snapshot.presentation);
    }
  }

  private validateLastChoiceMetadata(snapshot: StoryCursorSnapshot, visited: readonly string[]): void {
    const storyId = snapshot.lastChoiceStoryId;
    const hasChoice = snapshot.lastChoiceIndex >= 0;
    if (hasChoice !== (storyId !== null)) throw new Error('InvalidStoryCursorMetadata');
    if (!hasChoice) return;
    if (!storyId || !visited.includes(storyId)) throw new Error('InvalidStoryCursorMetadata');
    const document = this.opts.registry.stories.get(storyId);
    if (!document || !document.nodes.some(node => node.type === 'click'
      && node.interaction.kind === 'choice'
      && snapshot.lastChoiceIndex < node.interaction.options.length)) {
      throw new Error('InvalidStoryCursorMetadata');
    }
  }

  private ownerFromCursorKey(key: string): string {
    if (!key.startsWith('variant:') || key.length <= 'variant:'.length) throw new Error('InvalidStoryCursorOwnerKey');
    return key.slice('variant:'.length);
  }

  private clearOwner(owner: string | null): void {
    const session = this.sessionFor(owner);
    if (session) this.endSession(session, 'cancelled');
  }

  private preflightTransfer(session: StoryNodeSession, transfer: StoryTransfer): string | undefined {
    session.denialMessage = undefined;
    if (!session.replay) return undefined;
    const guard: BranchGuard | undefined = session.entry.branchGuards?.find(candidate => candidate.storyId === transfer.storyId);
    if (!guard || guardPrereqsMet(this.opts.registry, this.state, guard)) return undefined;
    session.denialMessage = guard.denialMessage;
    return 'BranchGuardDenied';
  }

  private mapError(error?: string): { error: import('../../contracts/runtime/results').StoryError; detail?: string } {
    switch (error) {
      case 'StaleToken': case 'DeliveryNotPending': case 'InputNotReady': return { error: 'StaleToken' };
      case 'InvalidOption': return { error: 'InvalidChoice' };
      case 'OptionUnavailable': return { error: 'ChoiceConditionNotMet' };
      case 'BranchGuardDenied': return { error: 'BranchGuardDenied' };
      case 'TransferLimitExceeded': return { error: 'JumpLimitExceeded' };
      case 'DocumentNotFound': case 'DocumentIdentityMismatch': return { error: 'NotFound' };
      case 'Busy': return { error: 'AlreadyActive' };
      default: return { error: 'PlaybackFailed', ...(error ? { detail: error } : {}) };
    }
  }
}
