import { validateStoryContinuations } from '../../../data-services/validation/story-continuations';
import type { PlayerState } from '../../types/state';
import type { StoryEntryDef, BranchGuard } from '../../../data-services/contracts/story-entry';
import type { StoryDef } from '../../../data-services/contracts/story';
import type { StoryEntryRequest, StoryTransfer } from '../../../data-services/contracts/story-node-actions';
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
import type { StoryNodePresentationData } from '../../../engine/contracts/story-node-snapshot';
import type { StoryPlaybackStep, StoryDeferredStart } from '../../../engine/contracts/story-playback-state';
import type { StoryPresentationView } from '../../contracts/runtime/story-presentation';
import type { StoryRunFlags } from '../../../engine/contracts/story-run-flags';
import { isStoryRunFlags } from '../../../data-services/validation/story-run-flags';
import type { CompletedStory } from '../../types/story-state';
import type { TravelResult } from '../../contracts/runtime/results';
import type { StoryNodePresentationPort } from './story-node-presentation-host';
import { PassivePoolSystem } from '../economy/passive-pool-system';
import { validateStoryNodeStructure } from '../../../data-services/validation/story-node-structure';
import { createStoryNodeActionHost, executeStoryPresentationEffect, formatStoryEffectReceipt } from './story-node-action-host';
import type { StoryNodeActionHostOptions } from './story-node-action-host';
import { StoryPlaybackCoordinator, type StoryPlaybackClock } from './story-playback-coordinator';
import { documentFingerprints, validateStoryPresentationSnapshot, validateStoryDeferredStarts } from './story-playback-snapshot';
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
function sameDocumentFingerprints(left: Readonly<Record<string, string>>, right: Readonly<Record<string, string>>): boolean {
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => left[key] === right[key]);
}

export interface StoryServiceOptions {
  registry: Registry;
  conditionSystem: ConditionSystem;
  effectEngine: EffectEngine;
  mutations: StoryMutationPort;
  eventBus: EventBus;
  passivePools: PassivePoolSystem;
  getState: () => PlayerState;
  travelToArea: (areaId: string, allowDuringStory?: boolean, checkAdjacency?: boolean, onCommitted?: (result: Extract<TravelResult, { success: true }>) => void) => TravelResult;
  /** Owns run-scoped overlay and entity presentation lifetime. UI selects its active owner explicitly. */
  presentation?: StoryNodePresentationPort;
  random?: () => number;
  clock?: StoryPlaybackClock;
}

type StartOptions = { force?: boolean; skipConditions?: boolean; replaceAny?: boolean; initialFlags?: StoryRunFlags };
type CompletedAdvance = Extract<StoryAdvanceResult, { success: true; finished: true }>;

/** One StoryNodePlayer session per global/chat owner; no legacy Talklet interpreter remains. */
export class StoryService {
  private readonly sessions = new Map<string, StoryNodeSession>();
  private readonly replaySessions = new Map<string, StoryNodeSession>();
  private readonly completedReplays = new Map<string, string | null>();
  private readonly actionHost: Pick<StoryNodePlaybackHost, 'preflight' | 'execute' | 'move'>;
  private readonly selection: StoryEntrySelectionContext;
  private readonly coordinator: StoryPlaybackCoordinator;
  private readonly actionOptions: StoryNodeActionHostOptions;
  private transactionDepth = 0;
  private readonly pendingStarts: StoryDeferredStart[] = [];
  private readonly reserved = new Map<string, { session: StoryNodeSession; initialFlags: StoryRunFlags }>();
  private activeSource?: StoryNodeSource;
  private readonly requestResults = new Map<string, StoryStartResult>();
  private readonly completions = new Map<string, CompletedAdvance>();

  constructor(private readonly opts: StoryServiceOptions) {
    this.actionOptions = {
      registry: opts.registry,
      effectEngine: opts.effectEngine,
      conditionSystem: opts.conditionSystem,
      getState: opts.getState,
      storyService: this,
      travelToArea: opts.travelToArea,
      eventBus: opts.eventBus,
      presentation: opts.presentation,
      deferPresentation: true,
      getTitle: source => this.sessionForSource(source)?.entry.openingTitle
        ?? this.sessionForSource(source)?.documents.get(source.rootStoryId)?.name
        ?? opts.registry.storyEntries.get(source.entryId)?.openingTitle
        ?? opts.registry.stories.get(source.rootStoryId)?.name,
      requestEntry: (request, source) => this.requestEntry(request, source),
    };
    const core = createStoryNodeActionHost(this.actionOptions);
    this.coordinator = new StoryPlaybackCoordinator({
      clock: opts.clock,
      transaction: work => this.transact(work),
      changed: (owner, replayId) => this.withSource(this.sessionForChannel(owner, replayId)?.source, () => opts.eventBus.emit({ type: 'storyPlaybackChanged', owner, ...(replayId ? { replayId } : {}) })),
      delivered: source => {
        const session = this.sessionForSource(source);
        if (!session || session.source.runId !== source.runId) return;
        const delivered = markTalkletDelivered(session, session.player.getView());
        if (delivered && !session.replay) this.withSource(source, () => opts.mutations.recordStoryRead(delivered.storyId, delivered.ordinal));
      },
      release: (source, token) => {
        const session = this.sessionForSource(source);
        if (!session || session.source.runId !== source.runId) return;
        this.withSource(source, () => {
          if (session.finishing) this.finishPresentation(session);
          else this.advanceNode(undefined, source.owner, token, false, undefined, source.replayId);
        });
      },
      effect: (effect, source) => {
        const result = this.withSource(source, () => executeStoryPresentationEffect(this.actionOptions, effect, source));
        if (result.status === 'rejected') throw new Error(result.error);
      },
      failed: (source, error) => this.withSource(source, () => {
        const session = this.sessionForSource(source);
        if (!session || session.source.runId !== source.runId) return;
        if (session.finishing?.settled && source.replayId && !session.replay) {
          session.finishing.error = error instanceof Error ? error.message : String(error);
          this.opts.eventBus.emit({ type: 'storyPlaybackChanged', owner: source.owner, replayId: source.replayId });
          return;
        }
        const view = session.player.getView();
        session.finishing = { terminalStoryId: 'storyId' in view ? view.storyId : source.rootStoryId, settled: false,
          error: error instanceof Error ? error.message : String(error), receipts: 'data' in view ? view.data.receipts : [] };
        session.player.cancel();
        this.opts.presentation?.close(source, 'failed');
        this.opts.eventBus.emit({ type: 'storyPlaybackChanged', owner: source.owner, ...(source.replayId ? { replayId: source.replayId } : {}) });
      }),
    });
    this.actionHost = {
      preflight: core.preflight,
      move: (node, source) => this.moveStorySpace(node, source),
      execute: (action, source) => {
        const previous = this.activeSource;
        this.activeSource = source;
        let outcome;
        try { outcome = core.execute(action, source); }
        finally { this.activeSource = previous; }
        const session = this.sessionForSource(source);
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
    opts.eventBus.on('chatFlowCleared', event => {
      if (!event.runId) this.coordinator.clear(event.owner ?? null, event.replayId);
    });
  }

  private get state(): PlayerState { return this.opts.getState(); }
  private get documents(): ReadonlyMap<string, StoryDef> { return this.opts.registry.stories; }

  getActiveStoryChannel(): { replayId: string; entryId: string; owner: string | null; runId?: string; context: import('../../../data-services/contracts/story-node').StoryStartContext } | null {
    const candidates = this.allSessions().filter(x => !x.replay && x.source.replayId && !x.continuation);
    const session = candidates.find(x => x.source.parentHistoryId) ?? candidates[0];
    if (!session) return null;
    return { replayId: session.source.replayId!, entryId: session.source.entryId, owner: session.source.owner, runId: session.source.runId,
      context: structuredClone(session.scene ?? session.documents.get(session.source.rootStoryId)!.startContext) };
  }
  private allSessions(): StoryNodeSession[] { return [...new Set([...this.sessions.values(), ...this.replaySessions.values()])]; }
  private isContinuationWait(session: StoryNodeSession): boolean {
    const view = session.player.getView();
    return view.status === 'input' && (view.node.interaction.kind === 'kizunaCard' || view.node.interaction.kind === 'areaContinue');
  }
  private continuationKey(session: StoryNodeSession): string {
    const view = session.player.getView();
    return `continuation:${session.source.historyId}:${'sequence' in view ? view.sequence : 0}`;
  }
  private resumeContinuation(session: StoryNodeSession): StoryAdvanceResult {
    const view = session.player.getView();
    if (view.status !== 'input') return { success: false, error: 'NoActiveStory' };
    session.continuation = undefined;
    const command = session.player.resumeInput(view.token);
    this.syncPresentation(session, command.view);
    return this.advanceResultFromCommand(session, session.source.owner, command);
  }
  private isolate(session: StoryNodeSession): void {
    if (session.source.replayId) return;
    const channel = newRunId();
    Object.assign(session.source, { replayId: channel, isReplay: false });
    session.player.setChannel(channel, false);
    this.replaySessions.set(channel, session);
    const presentation = this.opts.presentation?.save(session.source);
    if (presentation) this.opts.presentation?.restore(session.source, presentation);
  }
  private announceChannel(session: StoryNodeSession): void {
    this.opts.eventBus.emit({ type: 'storyTriggered', storyId: session.source.entryId, owner: session.source.owner,
      runId: session.source.runId, replayId: session.source.replayId, isolated: true, context: session.scene });
  }
  private acceptContinuation(session: StoryNodeSession, atArea = false): StoryAdvanceResult {
    const view = session.player.getView();
    if (view.status !== 'input') return { success: false, error: 'NoActiveStory' };
    const interaction = view.node.interaction;
    if (session.continuation?.state === 'returned') return this.resumeContinuation(session);
    if (session.continuation) return { success: false, error: 'AlreadyActive' };
    if (interaction.kind === 'areaContinue') {
      if (!session.replay && this.state.currentAreaId !== interaction.areaId) return { success: false, error: 'ConditionNotMet' };
      if (session.source.parentHistoryId) return { success: false, error: 'AlreadyActive' };
      session.continued = true;
      this.isolate(session);
      session.scene = { type: 'area', areaId: interaction.areaId };
      this.announceChannel(session);
      this.opts.eventBus.emit({ type: 'storyContextMoved', context: { type: 'area', areaId: interaction.areaId }, owner: null,
        runId: session.source.runId, replayId: session.source.replayId });
      return this.resumeContinuation(session);
    }
    if (interaction.kind !== 'kizunaCard' || !session.entry.kizuna || session.source.parentHistoryId || session.called) return { success: false, error: 'AlreadyActive' };
    const binding = session.entry.kizuna;
    if (binding.areaId && !session.replay && (!atArea || this.state.currentAreaId !== binding.areaId)) return { success: false, error: 'ConditionNotMet' };
    if (this.allSessions().some(x => x.source.parentHistoryId && !x.replay && !session.replay)) return { success: false, error: 'AlreadyActive' };
    const channel = newRunId();
    const prepared = this.prepareEntry(binding.entryId, 'active', session.source.owner, undefined, true, channel);
    if ('error' in prepared) return prepared.error;
    const child = prepared.session;
    Object.assign(child, { replay: session.replay });
    Object.assign(child.source, { parentHistoryId: session.source.historyId, isReplay: session.replay });
    const error = this.travelToStartArea(child);
    if (error) return { success: false, error: 'PlaybackFailed', detail: error };
    session.continuation = { state: 'running', childHistoryId: child.source.historyId! };
    this.replaySessions.set(channel, child);
    this.initializeSession(child, prepared.initialFlags);
    if (child.finishing?.error) return { success: false, error: 'PlaybackFailed', detail: child.finishing.error };
    return { success: true, finished: false, story: this.projectView(session, view)! };
  }


  private moveStorySpace(node: import('../../../data-services/contracts/story-node').StoryMoveToAreaNode | import('../../../data-services/contracts/story-node').StoryMoveToCharaspaceNode,
    source: StoryNodeSource): import('../../contracts/runtime/story-node-playback').StoryNodeActionOutcome {
    const session = this.sessionForSource(source);
    if (!session || session.source.runId !== source.runId) return { status: 'rejected', error: 'NoActiveStory' };
    if (node.type === 'moveToArea' ? !this.opts.registry.areas.has(node.areaId) : !this.opts.registry.characterVariants.has(node.characterId)) {
      return { status: 'rejected', error: node.type === 'moveToArea' ? 'AreaNotFound' : 'CharacterNotFound' };
    }
    const context = node.type === 'moveToArea' ? { type: 'area' as const, areaId: node.areaId }
      : { type: 'chara' as const, characterId: node.characterId };
    session.scene = context;
    const owner = context.type === 'chara' ? context.characterId : null;
    if (!source.replayId && owner !== session.source.owner) {
      const existing = this.sessionFor(owner);
      if (existing && existing !== session) return { status: 'rejected', error: 'StorySpaceOccupied' };
    }
    if (context.type === 'area' && !session.replay) {
      const result = this.opts.travelToArea(context.areaId, true, false);
      if (!result.success) return { status: 'rejected', error: `AreaTravelFailed:${result.error}` };
      if (!this.isCurrent(session)) return { status: 'replaced' };
    }
    if (!source.replayId && owner !== session.source.owner) {
      this.coordinator.end(session.source.owner);
      this.sessions.delete(ownerKey(session.source.owner));
      this.sessions.set(ownerKey(owner), session);
    }
    if (!source.replayId || session.replay || source.parentHistoryId) { session.source.owner = owner; session.player.setOwner(owner); }
    this.withSource(session.source, () => this.opts.eventBus.emit({ type: 'storyContextMoved', context, owner,
      ...(source.runId ? { runId: source.runId } : {}), ...(source.replayId ? { replayId: source.replayId } : {}) }));
    return { status: 'applied' };
  }

  private travelToStartArea(session: StoryNodeSession): string | undefined {
    const context = session.documents.get(session.source.rootStoryId)?.startContext;
    if (!session.entry.travelToStartContext || context?.type !== 'area' || this.state.currentAreaId === context.areaId) return undefined;
    const result = this.opts.travelToArea(context.areaId, true, false);
    return result.success ? undefined : `AreaTravelFailed:${result.error}`;
  }

  private withSource<T>(source: StoryNodeSource | undefined, work: () => T): T {
    const previous = this.activeSource;
    this.activeSource = source ?? previous;
    try { return work(); }
    finally { this.activeSource = previous; }
  }

  private transact<T>(work: () => T): T {
    this.transactionDepth += 1;
    try { return work(); }
    finally {
      this.transactionDepth -= 1;
      if (this.transactionDepth === 0) {
        this.transactionDepth = 1;
        try {
          let remaining = 128;
          while (remaining-- > 0) {
            for (const [key, pending] of [...this.reserved]) {
              this.reserved.delete(key);
              if (this.isCurrent(pending.session)) this.initializeSession(pending.session, pending.initialFlags);
            }
            const canStart = (item: StoryDeferredStart) => {
              const finishing = this.sessionForChannel(item.owner, item.replayId)?.finishing;
              return !finishing || !!finishing.error;
            };
            const index = this.pendingStarts.findIndex(canStart);
            if (index >= 0) {
              const pending = this.pendingStarts.splice(index, 1)[0]!;
              const previous = this.activeSource;
              this.activeSource = { entryId: pending.entryId, rootStoryId: '', owner: pending.owner, ...(pending.replayId ? { replayId: pending.replayId } : {}),
                causalChainId: pending.causalChainId, handoffCount: pending.handoffCount };
              try { this.requestResults.set(pending.requestId, this.startEntry(pending.entryId, pending.expectedType, pending.owner, pending.options, !!pending.replayId, pending.replayId)); }
              finally { this.activeSource = previous; }
              while (this.requestResults.size > 64) this.requestResults.delete(this.requestResults.keys().next().value!);
            }
            this.coordinator.pumpAll();
            if (!this.reserved.size && !this.pendingStarts.some(canStart)) break;
          }
          this.coordinator.pumpAll();
        } finally { this.transactionDepth = 0; }
      }
    }
  }

  getStartRequestResult(requestId: string): StoryStartResult | null { return structuredClone(this.requestResults.get(requestId) ?? null); }

  private startCommand(storyId: string, expectedType: 'active' | 'passive', owner: string | null, options: StartOptions | undefined, replay: boolean): StoryStartResult {
    const entry = this.opts.registry.storyEntries.get(storyId);
    const storyDef = entry && this.documents.get(entry.storyId);
    const contextOwner = storyDef?.startContext.type === 'chara' ? storyDef.startContext.characterId : null;
    const target = replay || entry?.travelToStartContext ? contextOwner : normalizeOwner(owner);
    const before = this.completions.get(ownerKey(target));
    const result = this.transact(() => this.startEntry(storyId, expectedType, owner, options, replay));
    const failed = this.sessionFor(target);
    if (failed?.finishing?.error) return { success: false, storyId: failed.source.entryId, error: 'PlaybackFailed', detail: failed.finishing.error };
    if (!result.success && result.detail !== 'RunReplaced') return result;
    if (result.success) return result;
    const current = this.getCurrentStoryView(target);
    if (current) return { success: true, finished: false, story: current };
    const completion = this.completions.get(ownerKey(target));
    return completion && completion !== before ? completion : result;
  }
  suspendPlayback(): void { this.coordinator.suspend(); }
  resumePlayback(): void { this.transact(() => this.coordinator.resume()); }
  dispose(): void { this.clearAllCurrentStories(); this.completedReplays.clear(); this.coordinator.reset(); this.pendingStarts.length = 0; }
  clearOutput(owner: string | null): void { this.transact(() => this.coordinator.clear(owner)); }
  resetPlayback(): void { this.clearAllCurrentStories(); this.completedReplays.clear(); this.coordinator.reset(); }

  getPlaybackView(owner?: string | null): StoryPresentationView {
    const target = normalizeOwner(owner);
    const session = this.sessionFor(target);
    if (!session) return this.coordinator.view(target, 'idle');
    const view = session.player.getView();
    if (session.finishing) return this.coordinator.view(target, session.finishing.error ? 'failed' : 'finishing', undefined, session.source.runId, session.finishing.error);
    return this.coordinator.view(target, view.status === 'input' ? 'input' : view.status === 'failed' ? 'failed' : 'continue',
      'token' in view ? view.token : undefined, session.source.runId, view.status === 'failed' ? view.error : undefined);
  }

  getReplayPlaybackView(replayId: string): StoryPresentationView | null {
    const session = this.replaySessions.get(replayId);
    if (!session && !this.completedReplays.has(replayId)) return null;
    const owner = session ? session.source.owner : this.completedReplays.get(replayId)!;
    if (!session) return this.coordinator.view(owner, 'idle', undefined, undefined, undefined, replayId);
    const view = session.player.getView();
    if (session.finishing?.error && session.finishing.settled && !session.replay) return this.coordinator.view(owner, 'continue', `${session.source.historyId}:recover`, session.source.runId, session.finishing.error, replayId);
    if (session.finishing) return this.coordinator.view(owner, session.finishing.error ? 'failed' : 'finishing', undefined, session.source.runId, session.finishing.error, replayId);
    return this.coordinator.view(owner, view.status === 'input' ? 'input' : view.status === 'failed' ? 'failed' : 'continue',
      'token' in view ? view.token : undefined, session.source.runId, view.status === 'failed' ? view.error : undefined, replayId);
  }

  continueStory(owner: string | null, token: string): StoryAdvanceResult {
    if (this.transactionDepth) return { success: false, error: 'Busy' };
    const current = this.getPlaybackView(owner);
    if (current.token !== token) return { success: false, error: 'StaleToken' };
    if (current.phase !== 'continue') return { success: false, error: 'PresentationPending' };
    return this.transact(() => this.advanceNode(undefined, owner, undefined, false, newRunId()));
  }

  continueReplayStory(replayId: string, token: string): StoryAdvanceResult {
    if (this.transactionDepth) return { success: false, error: 'Busy' };
    const session = this.replaySessions.get(replayId);
    const current = this.getReplayPlaybackView(replayId);
    if (!session || !current) return { success: false, error: 'NoActiveStory' };
    if (current.token !== token) return { success: false, error: 'StaleToken' };
    if (current.phase !== 'continue') return { success: false, error: 'PresentationPending' };
    if (session.finishing?.error && session.finishing.settled && !session.replay) return this.transact(() => {
      // World settlement already committed; recover the return without executing it again.
      session.finishing!.error = undefined;
      this.finishPresentation(session);
      return { success: true, finished: true, storyId: session.source.rootStoryId, completed: this.completedRecord(session, session.source.rootStoryId) };
    });
    return this.transact(() => this.advanceNode(undefined, session.source.owner, undefined, false, newRunId(), replayId));
  }

  submitStoryInput(owner: string | null, token: string, optionId?: string): StoryAdvanceResult {
    if (this.transactionDepth) return { success: false, error: 'Busy' };
    const current = this.getPlaybackView(owner);
    if (current.token !== token) return { success: false, error: 'StaleToken' };
    if (current.phase !== 'input') return { success: false, error: 'PresentationPending' };
    return this.transact(() => this.advanceNode(optionId, owner, undefined, true, newRunId()));
  }

  submitReplayStoryInput(replayId: string, token: string, optionId?: string): StoryAdvanceResult {
    if (this.transactionDepth) return { success: false, error: 'Busy' };
    const session = this.replaySessions.get(replayId);
    const current = this.getReplayPlaybackView(replayId);
    if (!session || !current) return { success: false, error: 'NoActiveStory' };
    if (current.token !== token) return { success: false, error: 'StaleToken' };
    if (current.phase !== 'input') return { success: false, error: 'PresentationPending' };
    return this.transact(() => this.advanceNode(optionId, session.source.owner, undefined, true, newRunId(), replayId));
  }

  accelerateReplayStoryPresentation(replayId: string, token: string): boolean {
    if (this.transactionDepth) return false;
    const session = this.replaySessions.get(replayId);
    const view = session?.player.getView();
    if (!session || !view || !('token' in view)) return false;
    return this.coordinator.accelerate(session.source.owner, token, view.token, replayId);
  }

  cancelReplayStory(replayId: string): void {
    const session = this.replaySessions.get(replayId);
    if (session?.finishing?.completionRecorded && !session.replay) this.finishPresentation(session);
    else if (session) this.endSession(session, 'cancelled');
    this.replaySessions.delete(replayId);
    this.completedReplays.delete(replayId);
    this.coordinator.discardReplay(replayId);
  }

  getReplayStoryView(replayId: string): StoryView | null {
    const session = this.replaySessions.get(replayId);
    if (!session) return null;
    return this.projectView(session, session.player.getView());
  }

  accelerateStoryPresentation(owner: string | null, token: string): boolean {
    if (this.transactionDepth) return false;
    const session = this.sessionFor(owner);
    const view = session?.player.getView();
    if (!view || !('token' in view)) return false;
    return this.transact(() => this.coordinator.accelerate(owner, token, view.token));
  }

  /** UI calls this when the player selects a global or owner-specific conversation surface. */
  activateOwner(owner?: string | null, replayId?: string): void {
    const target = normalizeOwner(owner);
    this.opts.presentation?.activate(replayId ?? target);
    if (replayId) return;
    const session = this.sessionFor(target);
    if (session?.continuation?.state === 'returned' && !this.allSessions().some(x => x.source.parentHistoryId && !x.replay)) {
      this.transact(() => this.resumeContinuation(session));
    }
  }

  getCurrentStoryId(owner?: string | null): string | null {
    const session = this.sessionFor(normalizeOwner(owner));
    return session?.finishing ? null : session?.source.entryId ?? null;
  }

  /** Actual Story.id at the current delivery/input wait point, or null while idle. */
  getCurrentStoryDefId(owner?: string | null): string | null {
    const session = this.sessionFor(normalizeOwner(owner));
    if (!session) return null;
    const view = session.player.getView();
    return view.status === 'delivery' || view.status === 'operation' || view.status === 'result' || view.status === 'input' ? view.storyId : null;
  }

  /** The compatibility condition target is scoped to the global owner's active chain. */
  isVisitedInChain(storyId: string): boolean {
    return this.sessionFor(null)?.visitedStoryIds.has(storyId) ?? false;
  }

  saveCursor(): StoryCursor {
    const session = this.sessionFor(null);
    if (this.transactionDepth) throw new Error('Busy');
    return session ? this.snapshot(session) : this.emptySnapshot();
  }

  saveChatCursors(): Record<string, StoryCursor> {
    if (this.transactionDepth) throw new Error('Busy');
    const result: Record<string, StoryCursor> = {};
    for (const session of this.sessions.values()) {
      if (session.source.owner !== null) result[ownerKey(session.source.owner)] = this.snapshot(session);
    }
    for (const owner of this.coordinator.outputOwners()) {
      if (owner !== null && !result[ownerKey(owner)]) result[ownerKey(owner)] = this.emptySnapshot(owner);
    }
    return result;
  }

  /** Purely validates every owner checkpoint before callers replace PlayerState or live cursors. */
  validateCursors(collection: StoryCursorCollection | undefined): void {
    if (collection === undefined) return;
    if (!collection || collection.format !== 'story-playback-v2' || !Array.isArray(collection.pendingStarts) || collection.pendingStarts.length > 64 || typeof collection !== 'object'
      || !collection.global || !collection.chats || typeof collection.chats !== 'object'
      || Array.isArray(collection.chats)) throw new Error('InvalidStoryCursorCollection');
    this.validateCursorSnapshotOrRestart(collection.global, null);
    for (const [key, snapshot] of Object.entries(collection.chats)) {
      const owner = this.ownerFromCursorKey(key);
      this.validateCursorSnapshotOrRestart(snapshot, owner);
    }
    if (collection.child) {
      const source = collection.child.finishing?.source ?? collection.child.playback.run?.source;
      if (!source?.parentHistoryId || !source.replayId || source.isReplay !== false || collection.child.isReplay || collection.child.continuation || collection.child.called || collection.child.continued) throw new Error('InvalidStoryChild');
      this.validateCursorSnapshot(collection.child, source.owner);
      const parent = [collection.global, ...Object.values(collection.chats)].find(x => x.playback.run?.source.historyId === source.parentHistoryId);
      if (!parent?.continuation || parent.continuation.state !== 'running' || parent.continuation.childHistoryId !== source.historyId || this.opts.registry.storyEntries.get(parent.playback.run!.source.entryId)?.kizuna?.entryId !== source.entryId) throw new Error('OrphanStoryChild');
    }
    for (const cursor of [collection.global, ...Object.values(collection.chats)]) {
      const source = cursor.finishing?.source ?? cursor.playback.run?.source;
      if (source?.parentHistoryId || cursor.isReplay || cursor.called !== undefined && typeof cursor.called !== 'boolean') throw new Error('InvalidStoryRoot');
      if (cursor.continuation?.state === 'running') {
        const childSource = collection.child?.finishing?.source ?? collection.child?.playback.run?.source;
        if (!childSource || childSource.parentHistoryId !== source?.historyId || childSource.historyId !== cursor.continuation.childHistoryId) throw new Error('MissingStoryChild');
      }
      if (cursor.continuation) {
        const run = cursor.playback.run;
        const node = run && this.documents.get(run.storyId)?.nodes.find(x => x.id === run.nodeId);
        if (node?.type !== 'click' || node.interaction.kind !== 'kizunaCard' || cursor.continuation.state === 'returned' && cursor.called !== true) throw new Error('InvalidStoryContinuation');
      }
      if (cursor.continuation && (!['running', 'returned'].includes(cursor.continuation.state) || typeof cursor.continuation.childHistoryId !== 'string' || !cursor.continuation.childHistoryId.trim() || cursor.playback.run?.pending.kind !== 'input')) throw new Error('InvalidStoryContinuation');
      if (cursor.continuation || cursor.called || source?.replayId) this.validateCursorSnapshot(cursor, source!.owner);
    }
    const sources = [collection.global, ...Object.values(collection.chats), ...(collection.child ? [collection.child] : [])].map(x => x.finishing?.source ?? x.playback.run?.source).filter(x => x);
    if (new Set(sources.map(x => x!.historyId)).size !== sources.length) throw new Error('DuplicateStoryHistory');
    const channels = sources.filter(x => x?.replayId);
    if (new Set(channels.map(x => x!.replayId)).size !== channels.length || channels.some(x => x!.isReplay !== false)) throw new Error('InvalidStoryChannels');
    validateStoryDeferredStarts(collection, this.opts.registry);
  }

  restoreCursor(snapshot: StoryCursor): void {
    this.validateCursorSnapshotOrRestart(snapshot, null);
    this.clearOwner(null);
    const session = this.restoreOrRestartSession(snapshot, null);
    if (session) this.sessions.set(ownerKey(null), session);
  }

  restoreChatCursors(snapshots: Record<string, StoryCursor> | undefined): void {
    if (snapshots !== undefined) {
      if (!snapshots || typeof snapshots !== 'object' || Array.isArray(snapshots)) throw new Error('InvalidStoryCursorChats');
      for (const [key, snapshot] of Object.entries(snapshots)) {
        this.validateCursorSnapshotOrRestart(snapshot, this.ownerFromCursorKey(key));
      }
    }
    for (const session of [...this.sessions.values()]) if (session.source.owner !== null) this.endSession(session, 'cancelled');
    if (!snapshots) return;
    for (const [key, snapshot] of Object.entries(snapshots)) {
      const owner = this.ownerFromCursorKey(key);
      const session = this.restoreOrRestartSession(snapshot, owner);
      if (session) this.sessions.set(key, session);
    }
  }

  saveCursors(): StoryCursorCollection {
    if (this.transactionDepth) throw new Error('Busy');
    return { format: 'story-playback-v2', global: this.saveCursor(), chats: this.saveChatCursors(),
      pendingStarts: structuredClone(this.pendingStarts.filter(item => !item.replayId)),
      ...(() => { const child = this.allSessions().find(x => x.source.parentHistoryId && !x.replay); return child ? { child: this.snapshot(child) } : {}; })() };
  }

  restoreCursors(collection: StoryCursorCollection | undefined): void {
    this.validateCursors(collection);
    this.clearAllCurrentStories();
    this.coordinator.reset();
    this.completedReplays.clear();
    this.pendingStarts.length = 0;
    if (!collection) return;
    this.pendingStarts.push(...structuredClone(collection.pendingStarts));
    if (collection.child) {
      const source = collection.child.finishing?.source ?? collection.child.playback.run!.source;
      this.restoreSession(collection.child, source.owner);
    }
    const global = this.restoreOrRestartSession(collection.global, null);
    if (global) this.sessions.set(ownerKey(null), global);
    for (const [key, snapshot] of Object.entries(collection.chats)) {
      const owner = this.ownerFromCursorKey(key);
      const session = this.restoreOrRestartSession(snapshot, owner);
      if (session) this.sessions.set(key, session);
    }
  }

  clearAllCurrentStories(): void {
    for (const session of [...this.sessions.values(), ...this.replaySessions.values()]) this.endSession(session, 'cancelled');
    this.sessions.clear();
    this.replaySessions.clear();
    this.completedReplays.clear();
    this.reserved.clear();
    this.pendingStarts.length = 0;
  }

  clearCurrentStory(owner?: string | null): void {
    const session = this.sessionFor(normalizeOwner(owner));
    if (session) this.endSession(session, 'cancelled');
  }

  isBlockingMovement(owner?: string | null): boolean {
    return this.sessionsForInteractionGate(owner).filter(session => !this.isContinuationWait(session)).some(session => {
      const entry = session.entry;
      return entry.type !== 'passive' || entry.blocksInteraction === true || entry.leaveArea === false;
    });
  }

  isBlockingInteraction(owner?: string | null): boolean {
    return this.sessionsForInteractionGate(owner).filter(session => !this.isContinuationWait(session)).some(session =>
      session.entry.type !== 'passive' || session.entry.blocksInteraction === true);
  }

  clearPassiveIfPlaying(owner?: string | null): void {
    const sessions = owner === undefined ? [...this.sessions.values()] : [this.sessionFor(normalizeOwner(owner))];
    for (const session of sessions) {
      const entry = session?.entry;
      if (session && !session.source.replayId && !this.isContinuationWait(session) && entry?.type === 'passive' && entry.interruptible !== false && entry.blocksInteraction !== true) {
        this.endSession(session, 'cancelled');
      }
    }
  }

  hasCompletedStory(storyId: string): boolean { return this.state.storyLog.some(story => story.storyId === storyId); }

  getAreaStoryDeliveries(areaId: string): readonly AreaStoryDeliveryView[] {
    const state = this.state;
    if (state.currentAreaId !== areaId) return [];
    const area = this.opts.registry.areas.get(areaId);
    if (!area || area.initId !== state.activeInit) return [];
    const continuations: AreaStoryDeliveryView[] = this.allSessions().filter(x => !x.replay && !x.source.parentHistoryId && !x.continuation).flatMap(session => {
      const view = session.player.getView();
      if (view.status !== 'input') return [];
      const interaction = view.node.interaction;
      const targetArea = interaction.kind === 'areaContinue' ? interaction.areaId : interaction.kind === 'kizunaCard' ? session.entry.kizuna?.areaId : undefined;
      if (targetArea !== areaId) return [];
      const entryId = interaction.kind === 'areaContinue' ? session.source.entryId : session.entry.kizuna!.entryId;
      const entry = this.opts.registry.storyEntries.get(entryId)!;
      return [{ id: this.continuationKey(session), entryId, areaId, title: entry.openingTitle ?? this.documents.get(entry.storyId)!.name, owner: null }];
    });
    return [...continuations, ...(state.areaStoryDeliveries ?? []).flatMap(delivery => {
      if (delivery.areaId !== areaId || delivery.status !== 'pending') return [];
      const entry = this.opts.registry.activeStories.get(delivery.entryId);
      const story = entry ? this.opts.registry.stories.get(entry.storyId) : undefined;
      if (!entry || !story || story.nodes.length === 0
        || (entry.availableInits.length > 0 && !entry.availableInits.includes(state.activeInit))) return [];
      return [{ entryId: entry.id, areaId, title: entry.openingTitle ?? story.name, owner: entry.owner ?? null }];
    })];
  }

  acceptAreaStoryDelivery(storyEntryId: string, areaId: string): StoryStartResult {
    const unavailable = (): StoryStartResult => ({ success: false, storyId: storyEntryId, error: 'AreaDeliveryUnavailable' });
    const continuation = this.allSessions().find(x => this.continuationKey(x) === storyEntryId);
    if (continuation) {
      if (this.state.currentAreaId !== areaId || !this.getAreaStoryDeliveries(areaId).some(x => x.id === storyEntryId)) return unavailable();
      return this.transact(() => this.acceptContinuation(continuation, true));
    }
    const state = this.state;
    const area = this.opts.registry.areas.get(areaId);
    const entry = this.opts.registry.activeStories.get(storyEntryId);
    const delivery = (state.areaStoryDeliveries ?? []).find(candidate =>
      candidate.entryId === storyEntryId && candidate.areaId === areaId && candidate.status === 'pending');
    if (state.currentAreaId !== areaId || !area || area.initId !== state.activeInit || !delivery || !entry) return unavailable();
    if (entry.availableInits.length > 0 && !entry.availableInits.includes(state.activeInit)) return unavailable();
    if (this.hasCompletedStory(entry.storyId)) return { success: false, storyId: storyEntryId, error: 'AlreadyCompleted' };
    const owner = entry.owner ?? null;
    return this.startStory(storyEntryId, 'active', owner);
  }

  startActiveStory(storyId: string, owner?: string | null, initialFlags?: StoryRunFlags): StoryStartResult {
    return this.startStory(storyId, 'active', owner, { initialFlags });
  }

  startCardStory(storyId: string, owner?: string | null, initialFlags?: StoryRunFlags): StoryStartResult {
    return this.startStory(storyId, 'active', owner, { skipConditions: true, force: true, replaceAny: true, initialFlags });
  }

  startStory(storyId: string, expectedType: 'active' | 'passive', owner?: string | null, options?: StartOptions): StoryStartResult {
    if (this.activeSource?.parentHistoryId || this.activeSource?.replayId && this.activeSource.isReplay === false) return { success: false, error: 'AlreadyActive' };
    if (this.transactionDepth) {
      const checked = this.resolveStartDocument(storyId, expectedType, options?.initialFlags);
      if ('error' in checked) return checked.error;
      const requestId = `${newRunId()}:request`;
      const cause = this.activeSource;
      if (this.pendingStarts.length >= 64) return { success: false, error: 'PlaybackFailed', detail: 'StoryRequestLimitExceeded' };
      this.pendingStarts.push({ requestId, entryId: storyId, expectedType, owner: normalizeOwner(owner), ...(cause?.replayId ? { replayId: cause.replayId } : {}), options: options && structuredClone(options),
        causalChainId: cause?.causalChainId ?? newRunId(), handoffCount: cause?.handoffCount ?? 0 });
      return { success: false, error: 'StartDeferred', detail: requestId };
    }
    return this.startCommand(storyId, expectedType, normalizeOwner(owner), options, false);
  }

  triggerPassiveStory(initId = this.state.activeInit, owner?: string | null): StoryStartResult {
    return triggerPassiveStory(this.selection, initId, normalizeOwner(owner));
  }

  triggerAffectionPush(owner: string): StoryStartResult { return triggerAffectionPush(this.selection, owner); }

  triggerTailPush(owner: string, storyId: string): StoryStartResult { return triggerTailPush(this.selection, owner, storyId); }

  readyStepCount(owner: string): number { return readyStepIds(this.selection, owner).length; }

  replayStory(storyId: string, owner?: string | null): StoryStartResult {
    if (this.transactionDepth) return { success: false, error: 'Busy' };
    const entry = this.opts.registry.storyEntries.get(storyId);
    if (!entry) return { success: false, storyId, error: 'NotFound' };
    if (!entry.replayable) return { success: false, storyId, error: 'NotReplayable' };
    const replayId = newRunId();
    const target = normalizeOwner(owner);
    const prepared = this.prepareEntry(storyId, entry.type, target, { skipConditions: true }, true, replayId);
    if ('error' in prepared) return prepared.error;
    const areaError = this.travelToStartArea(prepared.session);
    if (areaError) return { success: false, storyId, error: 'PlaybackFailed', detail: areaError };
    this.replaySessions.set(replayId, prepared.session);
    this.completedReplays.delete(replayId);
    this.initializeSession(prepared.session, prepared.initialFlags);
    if (prepared.session.finishing?.error) {
      this.replaySessions.delete(replayId);
      this.coordinator.discardReplay(replayId);
      return { success: false, storyId, error: 'PlaybackFailed', detail: prepared.session.finishing.error };
    }
    const current = this.getReplayStoryView(replayId);
    if (current) return { success: true, finished: false, story: current, replayId };
    return { success: true, finished: true, storyId, completed: this.completedRecord(prepared.session, prepared.session.source.rootStoryId), replayId };
  }

  startReplayEntry(replayId: string, storyEntryId: string): StoryStartResult {
    if (this.transactionDepth) return { success: false, error: 'Busy' };
    const previous = this.replaySessions.get(replayId);
    if (!previous) return { success: false, storyId: storyEntryId, error: 'NoActiveStory' };
    if (previous.source.parentHistoryId) return { success: false, error: 'AlreadyActive' };
    const entry = this.opts.registry.storyEntries.get(storyEntryId);
    if (!entry) return { success: false, storyId: storyEntryId, error: 'NotFound' };
    const prepared = this.prepareEntry(storyEntryId, entry.type, previous.source.owner,
      { force: true, replaceAny: true, skipConditions: true }, true, replayId);
    if ('error' in prepared) return prepared.error;
    const areaError = this.travelToStartArea(prepared.session);
    if (areaError) return { success: false, storyId: storyEntryId, error: 'PlaybackFailed', detail: areaError };
    const cleanupError = this.installSession(prepared.session);
    if (cleanupError) return { success: false, storyId: storyEntryId, error: 'PlaybackFailed', detail: cleanupError };
    this.initializeSession(prepared.session, prepared.initialFlags);
    if (prepared.session.finishing?.error) return { success: false, storyId: storyEntryId, error: 'PlaybackFailed', detail: prepared.session.finishing.error };
    const story = this.getReplayStoryView(replayId);
    return story
      ? { success: true, finished: false, story, replayId }
      : { success: true, finished: true, storyId: entry.storyId, completed: this.completedRecord(prepared.session, entry.storyId), replayId };
  }

  advanceStory(choiceIndex?: number | string, owner?: string | null, token?: string): StoryAdvanceResult {
    const target = normalizeOwner(owner);
    const current = this.getPlaybackView(target);
    const session = this.sessionFor(target);
    if (!session) return { success: false, error: 'NoActiveStory' };
    const input = session.player.getView();
    if (choiceIndex === undefined) return current.phase === 'input'
      ? { success: false, error: input.status === 'input' && input.node.interaction.kind === 'choice' ? 'ChoiceRequired' : 'ClickRequired' }
      : this.continueStory(target, token ?? current.token ?? '');
    if (input.status !== 'input' || input.node.interaction.kind !== 'choice') return { success: false, error: 'InvalidChoice' };
    const optionId = typeof choiceIndex === 'number' ? input.node.interaction.options[choiceIndex]?.id : choiceIndex;
    if (!optionId) return { success: false, error: 'InvalidChoice' };
    return this.submitStoryInput(target, token ?? current.token ?? '', optionId);
  }

  private advanceNode(
    choiceIndex: number | string | undefined,
    owner: string | null | undefined,
    token: string | undefined,
    allowClickInput: boolean,
    causalChainId?: string,
    replayId?: string,
  ): StoryAdvanceResult {
    const normalizedOwner = normalizeOwner(owner);
    const session = this.sessionForChannel(normalizedOwner, replayId);
    if (!session) return { success: false, error: 'NoActiveStory' };
    if (session.source.replayId && !replayId) return { success: false, error: 'PresentationPending' };
    const current = session.player.getView();
    if (current.status === 'input' && (current.node.interaction.kind === 'kizunaCard' || current.node.interaction.kind === 'areaContinue')) return this.acceptContinuation(session);
    const commandToken = token ?? ('token' in current ? current.token : undefined);
    if (!commandToken || current.status !== 'delivery' && current.status !== 'operation' && current.status !== 'result' && current.status !== 'input') return { success: false, error: 'NoActiveStory' };
    if (current.status === 'input' && current.node.interaction.kind !== 'choice' && !allowClickInput) {
      return { success: false, storyId: session.source.entryId, error: 'ClickRequired' };
    }

    session.denialMessage = undefined;
    let command;
    let selectedOptionIndex: number | undefined;
    if (current.status === 'delivery' || current.status === 'operation' || current.status === 'result') {
      if (choiceIndex !== undefined) return { success: false, storyId: session.source.entryId, error: 'InvalidChoice' };
      command = session.player.ackDelivery(commandToken, causalChainId);
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
      command = session.player.submit(commandToken, optionId, causalChainId);
      if (command.ok && selectedOptionIndex !== undefined) {
        if (current.node.interaction.kind === 'choice') {
          this.coordinator.append(normalizedOwner, `${session.source.historyId}:${current.sequence}:choice`, session.source.historyId!, {
            kind: 'narration', text: '', align: 'right',
            choice: {
              options: current.node.interaction.options.map(option => ({ id: option.id, text: option.text })),
              selectedOptionId: current.node.interaction.options[selectedOptionIndex]!.id,
            },
          }, replayId);
        }
        session.lastChoiceIndex = selectedOptionIndex;
        session.lastChoiceStoryId = current.storyId;
        const talkletOrdinal = this.precedingTalkletOrdinal(session, current.storyId, current.node.id);
        if (talkletOrdinal !== null && !session.replay) {
          this.opts.mutations.recordStoryRead(current.storyId, talkletOrdinal, selectedOptionIndex);
        }
      }
    }

    if (command.ok && causalChainId) Object.assign(session.source, { causalChainId, handoffCount: 0 });
    this.syncPresentation(session, command.view);
    return this.advanceResultFromCommand(session, session.source.owner, command);
  }

  getSendState(owner?: string | null): SendState {
    const normalizedOwner = normalizeOwner(owner);
    const session = this.sessionFor(normalizedOwner);
    return session ? this.sendStateFor(session) : { mode: 'idle', reason: 'noStory' };
  }

  getReplaySendState(replayId: string): SendState {
    const session = this.replaySessions.get(replayId);
    if (session?.finishing?.settled && session.finishing.error && !session.replay) return {
      mode: 'advance', storyId: session.source.entryId, pageIndex: 0, text: '继续故事', token: this.getReplayPlaybackView(replayId)!.token!,
    };
    return session ? this.sendStateFor(session) : { mode: 'idle', reason: 'noStory' };
  }

  private sendStateFor(session: StoryNodeSession): SendState {
    const view = session.player.getView();
    const storyView = this.projectView(session, view);
    if (!storyView) return { mode: 'idle', reason: 'noStory' };
    if (view.status === 'operation' || view.status === 'result') {
      return {
        mode: 'advance', storyId: session.source.entryId, pageIndex: storyView.pageIndex,
        text: '正在逐项呈现效果', token: storyView.token, checkpoint: 'operation',
      };
    }
    if (view.status === 'delivery') {
      return {
        mode: 'advance', storyId: session.source.entryId, pageIndex: storyView.pageIndex,
        text: '', token: storyView.token,
      };
    }
    if (view.status !== 'input') return { mode: 'idle', reason: 'noStory' };
    const interaction = view.node.interaction;
    if (interaction.kind === 'choice') return { mode: 'choice', confirmed: true, token: storyView.token };
    if (interaction.kind === 'entryCard') {
      const card = interaction.card;
      return {
        mode: 'kizuna', storyId: session.source.entryId, pageIndex: storyView.pageIndex,
        targetStoryId: card.request.entryId, title: card.title, buttonText: card.buttonText,
        align: card.align ?? 'left', token: storyView.token,
      };
    }
    const destination = interaction.kind === 'areaContinue' ? interaction.areaId : session.entry.kizuna?.areaId;
    return {
      mode: 'advance', storyId: session.source.entryId, pageIndex: storyView.pageIndex, text: interaction.kind === 'button' ? interaction.text : session.continuation?.state === 'running' ? '等待关联故事结束' : session.continuation?.state === 'returned' ? '继续故事' : destination ? `前往${this.opts.registry.areas.get(destination)?.name ?? destination}接续故事` : '进入关联故事', token: storyView.token,
      ...(view.press ? { clickWork: { total: view.press.total, done: view.press.done } } : {}),
    };
  }

  clickSend(owner?: string | null, token?: string): SendResult {
    const target = normalizeOwner(owner);
    const session = this.sessionFor(target);
    if (!session) {
      let started = target !== null ? this.triggerAffectionPush(target) : this.triggerPassiveStory(this.state.activeInit, target);
      if (target !== null && !started.success && started.error === 'NoAvailableStory') {
        started = this.triggerPassiveStory(this.state.activeInit, target);
      }
      return { type: 'idle', started: started.success, ...(!started.success ? { error: started.error } : {}) };
    }
    const playback = this.getPlaybackView(target);
    const current = session.player.getView();
    if (current.status === 'input' && current.node.interaction.kind === 'choice') return { type: 'choice' };
    const previousDone = current.status === 'input' ? current.press?.done : undefined;
    const result = playback.phase === 'input'
      ? this.submitStoryInput(target, token ?? playback.token ?? '')
      : this.continueStory(target, token ?? playback.token ?? '');
    const next = session.player.getView();
    if (result.success && previousDone !== undefined && next.status === 'input' && next.press && next.press.done > previousDone) {
      return { type: 'working', storyId: session.source.entryId, pageIndex: this.getCurrentStoryView(target)?.pageIndex ?? 0,
        clicksDone: next.press.done, clicksTotal: next.press.total };
    }
    return { type: 'completed', storyId: session.source.entryId, finished: result.success && result.finished, advance: result, absorbed: [] };
  }

  getCurrentStoryView(owner?: string | null): StoryView | null {
    const session = this.sessionFor(normalizeOwner(owner));
    return session && !session.source.replayId ? this.projectView(session, session.player.getView()) : null;
  }

  private projectView(session: StoryNodeSession, view: StoryNodePlaybackView): StoryView | null {
    const projected = projectStoryNodeView(session, view);
    if (!projected) return null;
    return { ...projected, token: this.coordinator.intentToken(session.source.owner, projected.token, session.source.runId, session.source.replayId),
      ...(view.status === 'operation' || view.status === 'result' ? { operationCheckpoint: true as const } : {}) };
  }

  private resultSteps(data: StoryNodePresentationData): StoryPlaybackStep[] {
    const steps: StoryPlaybackStep[] = [];
    let noticeCount = 0;
    for (const item of data.order) {
      if (item.kind === 'presentation') {
        const effect = data.presentation[item.index]!;
        steps.push({ kind: 'effect', effect });
        if (effect.op === 'showOpeningTitle') steps.push({ kind: 'delay', phase: 'banner', durationMs: 3000, title: String(effect.value ?? '') });
      } else {
        const receipt = data.receipts[item.index]!;
        const text = formatStoryEffectReceipt(receipt, this.opts.registry);
        if (!text) continue;
        if (noticeCount++ > 0) steps.push({ kind: 'delay', phase: 'operation', durationMs: 360 });
        steps.push({ kind: 'output', content: { kind: receipt.op === 'travel' ? 'travel' : 'reward', text } });
      }
    }
    return steps;
  }

  private syncPresentation(session: StoryNodeSession, view: StoryNodePlaybackView): void {
    if (!this.isCurrent(session) || session.finishing) return;
    const owner = session.source.owner;
    if (view.status === 'input') {
      this.coordinator.end(owner, session.source.replayId);
      this.opts.eventBus.emit({ type: 'storyPlaybackChanged', owner, ...(session.source.replayId ? { replayId: session.source.replayId } : {}) });
      return;
    }
    if (view.status !== 'delivery' && view.status !== 'operation' && view.status !== 'result') return;
    const key = `${session.source.historyId}:${view.sequence}`;
    let steps: StoryPlaybackStep[];
    let automatic = view.status !== 'delivery';
    if (view.status === 'delivery') {
      const page = projectStoryNodeView(session, view)!;
      automatic = page.nextIsInput === true;
      const { content, presentation, pacing } = view.node;
      const { typing: _typing, thinking: _thinking, choices: _choices, kizuna: _card, ...display } = page.page;
      const body = { ...display, kind: content.kind, storyType: session.entry.type, storyPageKey: key };
      const rhythm = (value: number | undefined, fallback: number) => Math.min(10, Math.max(0, value ?? fallback)) * 1000;
      const paced = content.kind === 'talk' && presentation?.side !== 'right';
      const typing = paced ? rhythm(pacing?.typing, 0.9) : 0;
      const thinking = paced && (automatic || pacing?.thinking !== undefined) ? rhythm(pacing?.thinking, automatic ? 0.9 : 0) : 0;
      steps = [
        ...(typing ? [{ kind: 'delay' as const, phase: 'typing' as const, durationMs: typing, typing: body }] : []),
        { kind: 'output', content: body },
        ...(thinking ? [{ kind: 'delay' as const, phase: 'thinking' as const, durationMs: thinking }] : []),
      ];
    } else steps = this.resultSteps(view.data);
    this.coordinator.accept(session.source, view.token, key, steps, automatic);
    this.coordinator.pump(owner, session.source.replayId);
  }

  private resolveStartDocument(storyId: string, expectedType: 'active' | 'passive', initialFlags?: StoryRunFlags):
    { entry: StoryEntryDef; root: StoryDef } | { error: StoryStartResult } {
    const fail = (error: import('../../contracts/runtime/results').StoryError, detail?: string) =>
      ({ error: { success: false as const, storyId, error, ...(detail ? { detail } : {}) } });
    const suppliedFlags = initialFlags === undefined ? {} : initialFlags;
    if (!isStoryRunFlags(suppliedFlags)) return fail('PlaybackFailed', 'InvalidLocalFlags');
    const entry = this.opts.registry.storyEntries.get(storyId);
    if (!entry) return fail('NotFound');
    if (entry.type !== expectedType) return fail('WrongStoryType');
    const root = this.documents.get(entry.storyId);
    if (!root) return fail('NotFound');
    const validation = validateStoryNodeStructure(root);
    if (!validation.ok) return fail('PlaybackFailed', `InvalidDocument:${validation.issues[0]?.path}`);
    try {
      documentFingerprints(this.documents, root.id);
      validateStoryContinuations([...this.opts.registry.storyEntries.values()], [...this.documents.values()], new Set(this.opts.registry.areas.keys()));
    }
    catch (error) { return fail('PlaybackFailed', error instanceof Error ? error.message : String(error)); }
    return { entry, root };
  }

  private prepareEntry(storyId: string, expectedType: 'active' | 'passive', owner: string | null,
    options: StartOptions | undefined, replay: boolean, replayId?: string): { session: StoryNodeSession; initialFlags: StoryRunFlags } | { error: StoryStartResult } {
    const checked = this.resolveStartDocument(storyId, expectedType, options?.initialFlags);
    if ('error' in checked) return checked;
    const { entry, root } = checked;
    const contextOwner = replay || entry.travelToStartContext
      ? root.startContext.type === 'chara' ? root.startContext.characterId : null
      : normalizeOwner(owner);
    const fail = (error: import('../../contracts/runtime/results').StoryError, detail?: string) =>
      ({ error: { success: false as const, storyId, error, ...(detail ? { detail } : {}) } });
    if (!options?.skipConditions && (entry.availableInits.length > 0 && !entry.availableInits.includes(this.state.activeInit)
      || !this.opts.conditionSystem.evaluateGroup(entry.triggerCondition, this.state))) return fail('ConditionNotMet');
    if (!replay && !options?.force && !(entry.type === 'passive' && entry.repeatable) && this.hasCompletedStory(root.id)) return fail('AlreadyCompleted');
    if (!replay && (this.activeSource?.parentHistoryId || this.allSessions().some(x => x.source.replayId && !x.replay))) return fail('AlreadyActive');
    if (!replay && [...this.opts.registry.storyEntries.values()].some(x => x.kizuna?.entryId === storyId)) return fail('AlreadyActive');
    const existing = replay ? undefined : this.sessionFor(contextOwner);
    if (existing && this.isContinuationWait(existing)) return fail('AlreadyActive');
    if (existing && !existing.finishing?.error && (existing.finishing || existing.entry.type === 'passive' && existing.entry.blocksInteraction)) return fail('AlreadyActive');
    if (existing && !existing.finishing?.error && !options?.replaceAny && !(existing.entry.type === 'passive' && (expectedType === 'active' || options?.force))) return fail('AlreadyActive');
    const cause = this.activeSource;
    const handoffCount = cause ? (cause.handoffCount ?? 0) + 1 : 0;
    if (handoffCount > 64) return fail('PlaybackFailed', 'StoryHandoffLimitExceeded');
    const runId = newRunId();
    const source: StoryNodeSource = { entryId: entry.id, rootStoryId: root.id, owner: contextOwner, runId, historyId: runId, ...(replayId ? { replayId } : {}),
      causalChainId: cause?.causalChainId ?? runId, handoffCount, ...(replay ? { isReplay: true } : {}) };
    let session!: StoryNodeSession;
    session = createStoryNodeSession({
      source, entry: structuredClone(entry), replay, documents: this.documents,
      conditionSystem: this.opts.conditionSystem, getState: this.opts.getState,
      actionHost: this.actionHost, random: this.opts.random,
      preflightTransfer: transfer => this.preflightTransfer(session, transfer),
    });
    return { session, initialFlags: structuredClone(options?.initialFlags ?? {}) };
  }

  /** Installed but unstarted sessions must fail explicitly rather than remain idle without a ticket. */
  private failInstalledSession(session: StoryNodeSession, diagnostic: string): string {
    const owner = session.source.owner;
    if (this.isCurrent(session)) this.coordinator.end(owner, session.source.replayId);
    session.player.cancel();
    session.finishing = { terminalStoryId: session.source.rootStoryId, settled: false, error: diagnostic, receipts: [] };
    try { this.withSource(session.source, () => this.opts.eventBus.emit({ type: 'storyPlaybackChanged', owner, ...(session.source.replayId ? { replayId: session.source.replayId } : {}) })); }
    catch (notificationError) { session.finishing.error += `;StoryFailureNotificationFailed:${notificationError instanceof Error ? notificationError.message : String(notificationError)}`; }
    return session.finishing.error!;
  }

  private installSession(session: StoryNodeSession): string | undefined {
    if (session.source.replayId) {
      const existing = this.replaySessions.get(session.source.replayId);
      this.replaySessions.set(session.source.replayId, session);
      this.coordinator.end(session.source.owner, session.source.replayId);
      if (existing) {
        markSessionClosed(existing);
        existing.player.cancel();
        this.opts.presentation?.close(existing.source, 'replaced');
      }
      return undefined;
    }
    const owner = session.source.owner;
    const existing = this.sessionFor(owner);
    // Retire the old barrier before publishing a new slot, even if cleanup observers fail.
    this.coordinator.end(owner, session.source.replayId);
    this.sessions.set(ownerKey(owner), session);
    try {
      if (existing) this.endSession(existing, 'replaced');
    } catch (error) {
      const diagnostic = `StoryReplacementCleanupFailed:${error instanceof Error ? error.message : String(error)}`;
      return this.failInstalledSession(session, diagnostic);
    }
  }

  private requestEntry(request: StoryEntryRequest, source: StoryNodeSource): import('../../contracts/runtime/story-node-playback').StoryNodeActionOutcome {
    if (source.parentHistoryId || source.replayId && source.isReplay === false) return { status: 'rejected', error: 'NestedStoryCall' };
    const prepared = this.prepareEntry(request.entryId, request.entryType, request.owner,
      request.intent === 'card' ? { force: true, replaceAny: true, skipConditions: true }
        : request.intent === 'system' ? { force: true } : undefined, !!source.replayId, source.replayId);
    if ('error' in prepared) return { status: 'rejected', error: prepared.error.success ? 'EntryStartFailed' : `EntryStartFailed:${prepared.error.error}` };
    const areaError = this.travelToStartArea(prepared.session);
    if (areaError) return { status: 'rejected', error: areaError };
    const cleanupError = this.installSession(prepared.session);
    if (cleanupError) return { status: 'rejected', error: `EntryStartFailed:${cleanupError}` };
    this.reserved.set(source.replayId ? `replay:${source.replayId}` : ownerKey(request.owner), prepared);
    return { status: request.owner === source.owner ? 'replaced' : 'applied' };
  }

  private initializeSession(session: StoryNodeSession, initialFlags: StoryRunFlags): void {
    const previous = this.activeSource;
    this.activeSource = session.source;
    try {
      try {
        this.opts.eventBus.emit({ type: 'storyTriggered', storyId: session.source.entryId, owner: session.source.owner, runId: session.source.runId, ...(session.source.replayId ? { replayId: session.source.replayId, isolated: true, context: session.scene } : {}) });
      } catch (error) {
        this.failInstalledSession(session, `StoryInitializationFailed:${error instanceof Error ? error.message : String(error)}`);
        return;
      }
      if (!this.isCurrent(session)) return;
      const command = session.player.start(session.source.rootStoryId, session.source, initialFlags);
      this.captureVisited(session, command);
      this.handleTerminal(session, command.view);
      this.syncPresentation(session, command.view);
      this.coordinator.pump(session.source.owner, session.source.replayId);
    } finally { this.activeSource = previous; }
  }

  private startEntry(storyId: string, expectedType: 'active' | 'passive', owner: string | null,
    options: StartOptions | undefined, replay: boolean, replayId?: string): StoryStartResult {
    const prepared = this.prepareEntry(storyId, expectedType, owner, options, replay, replayId);
    if ('error' in prepared) return prepared.error;
    const areaError = this.travelToStartArea(prepared.session);
    if (areaError) return { success: false, storyId, error: 'PlaybackFailed', detail: areaError };
    const cleanupError = this.installSession(prepared.session);
    if (cleanupError) return { success: false, storyId, error: 'PlaybackFailed', detail: cleanupError };
    this.initializeSession(prepared.session, prepared.initialFlags);
    if (prepared.session.finishing?.error) return { success: false, error: 'PlaybackFailed', detail: prepared.session.finishing.error };
    if (replay && replayId) {
      const replayView = this.getReplayStoryView(replayId);
      if (replayView) return { success: true, finished: false, story: replayView, replayId };
      const terminal = prepared.session.player.getView();
      if (terminal.status === 'completed') return { success: true, finished: true, storyId: terminal.completion.terminalStoryId,
        completed: this.completedRecord(prepared.session, terminal.completion.terminalStoryId), replayId };
      return { success: false, storyId, error: 'PlaybackFailed', detail: terminal.status === 'failed' ? terminal.error : 'RunReplaced' };
    }
    const view = this.getCurrentStoryView(prepared.session.source.owner);
    if (view) return { success: true, finished: false, story: view };
    const terminal = prepared.session.player.getView();
    if (terminal.status === 'completed') return { success: true, finished: true, storyId: terminal.completion.terminalStoryId,
      completed: this.completedRecord(prepared.session, terminal.completion.terminalStoryId) };
    return { success: false, storyId, error: 'PlaybackFailed', detail: terminal.status === 'failed' ? terminal.error : 'RunReplaced' };
  }

  private advanceResultFromCommand(
    session: StoryNodeSession,
    owner: string | null,
    command: StoryNodeCommandResult,
  ): StoryAdvanceResult {
    const currentOwner = this.sessionForChannel(owner, session.source.replayId);
    if (currentOwner?.finishing?.error) return { success: false, storyId: currentOwner.source.entryId, error: 'PlaybackFailed', detail: currentOwner.finishing.error };
    this.captureVisited(session, command);
    if (session.finishing?.error) return { success: false, storyId: session.source.entryId, error: 'PlaybackFailed', detail: session.finishing.error };
    const completion = this.handleTerminal(session, command.view);
    if (completion) return completion;
    if (command.view.status === 'failed') return { success: false, storyId: session.source.entryId, error: 'PlaybackFailed', detail: command.view.error };
    if (session.finishing?.settled && !session.finishing.error) return { success: true, finished: true,
      storyId: session.finishing.terminalStoryId, completed: this.completedRecord(session, session.finishing.terminalStoryId) };
    if (!this.isCurrent(session)) {
      const replacementSession = this.sessionForChannel(owner, session.source.replayId);
      const replacement = replacementSession ? this.projectView(replacementSession, replacementSession.player.getView()) : null;
      return replacement
        ? { success: true, finished: false, story: replacement }
        : { success: false, storyId: session.source.entryId, error: 'NoActiveStory' };
    }
    if (!command.ok) {
      const mapped = this.mapError(command.error);
      return { success: false, storyId: session.source.entryId, error: mapped.error,
        ...(session.denialMessage ? { denialMessage: session.denialMessage } : {}), ...(mapped.detail ? { detail: mapped.detail } : {}) };
    }
    const current = this.sessionForChannel(owner, session.source.replayId);
    const view = current ? this.projectView(current, current.player.getView()) : null;
    return view
      ? { success: true, finished: false, story: view }
      : { success: false, storyId: session.source.entryId, error: 'NoActiveStory' };
  }

  private handleTerminal(session: StoryNodeSession, view: StoryNodePlaybackView): StoryAdvanceResult | null {
    if (view.status === 'completed') return this.completeSession(session, view.completion);
    if (view.status === 'failed' && this.isCurrent(session)) {
      session.finishing = { terminalStoryId: session.source.rootStoryId, settled: false, error: view.error, receipts: [...view.data.receipts] };
      this.coordinator.end(session.source.owner, session.source.replayId);
      this.opts.presentation?.close(session.source, 'failed');
      this.opts.eventBus.emit({ type: 'storyPlaybackChanged', owner: session.source.owner, ...(session.source.replayId ? { replayId: session.source.replayId } : {}) });
    }
    else if (view.status === 'replaced' && this.isCurrent(session)) this.endSession(session, 'replaced');
    return null;
  }

  private captureVisited(session: StoryNodeSession, command: StoryNodeCommandResult): void {
    for (const event of command.events) {
      if (event.type === 'view' && (event.view.status === 'delivery' || event.view.status === 'operation' || event.view.status === 'input')) {
        session.visitedStoryIds.add(event.view.storyId);
      }
    }
    if (command.view.status === 'delivery' || command.view.status === 'operation' || command.view.status === 'input') session.visitedStoryIds.add(command.view.storyId);
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

  /** Completion metadata remains attached through settlement and trailing presentation. */
  private completedRecord(session: StoryNodeSession, terminalStoryId: string): CompletedStory {
    return session.entry.type === 'active'
      ? { type: 'active', storyId: terminalStoryId, choiceIndex: session.lastChoiceStoryId === terminalStoryId ? session.lastChoiceIndex : -1 }
      : { type: 'passive', storyId: terminalStoryId };
  }

  private completeSession(session: StoryNodeSession, completion: { terminalStoryId: string; localFlags?: StoryRunFlags }): StoryAdvanceResult {
    if (session.finishing?.error) return { success: false, error: 'PlaybackFailed', detail: session.finishing.error };
    if (session.finishing) return { success: true, finished: true, storyId: completion.terminalStoryId,
      completed: this.completedRecord(session, completion.terminalStoryId) };
    const terminalStoryId = (session.entry.kizuna || session.continued || session.source.parentHistoryId) ? session.source.rootStoryId : completion.terminalStoryId;
    const completed = this.completedRecord(session, terminalStoryId);
    session.finishing = { terminalStoryId, settled: false, localFlags: completion.localFlags ?? {} };
    let receipts: import('../../../engine/contracts/effect-receipt').EffectReceipt[] = [];
    const previous = this.activeSource;
    this.activeSource = session.source;
    try {
      if (!session.replay) {
        const rewardContext = {
          registry: this.opts.registry, conditionSystem: this.rewardConditionSystem(session),
          effectEngine: this.opts.effectEngine, mutations: this.opts.mutations,
          getState: this.opts.getState, hasCompletedStory: (storyId: string) => this.hasCompletedStory(storyId),
        };
        const reward = applyCompletionReward(rewardContext, session.entry, terminalStoryId);
        receipts = reward?.receipts ?? [];
        session.finishing.receipts = receipts;
        this.opts.mutations.completeStory(completed, session.entry.id, () => { session.finishing!.completionRecorded = true; });
        session.finishing.completionRecorded = true;
        if (session.entry.type === 'passive') {
          recordPassiveCooldown(rewardContext, session.entry);
          maybeBlockConversation(rewardContext, session.entry);
        }
        session.finishing.settled = true;
        if (reward) this.opts.eventBus.emit({ type: 'storyRewarded', storyId: terminalStoryId, source: reward.source,
          effects: reward.effects, flags: [...session.flags], owner: session.source.owner, runId: session.source.runId });
        if (!session.source.parentHistoryId && session.source.owner !== null) triggerTailPush(this.selection, session.source.owner, terminalStoryId);
      } else session.finishing.settled = true;
      const data: StoryNodePresentationData = { receipts, presentation: [], order: receipts.map((_, index) => ({ kind: 'receipt', index })) };
      const key = `${session.source.historyId}:finishing`;
      this.coordinator.accept(session.source, key, key, this.resultSteps(data), true);
      this.coordinator.pump(session.source.owner, session.source.replayId);
    } catch (error) {
      const failed = error as { receipts?: typeof receipts; rewardSettlement?: { receipts: typeof receipts } };
      session.finishing.receipts = failed.rewardSettlement?.receipts ?? failed.receipts ?? receipts;
      session.finishing.error = error instanceof Error ? error.message : String(error);
      this.pendingStarts.splice(0, this.pendingStarts.length, ...this.pendingStarts.filter(item => item.causalChainId !== session.source.causalChainId));
      this.coordinator.end(session.source.owner, session.source.replayId);
      if (!session.source.replayId || !session.finishing.settled || session.replay) this.opts.presentation?.close(session.source, 'failed');
      this.opts.eventBus.emit({ type: 'storyPlaybackChanged', owner: session.source.owner, ...(session.source.replayId ? { replayId: session.source.replayId } : {}) });
    } finally { this.activeSource = previous; }
    if (session.finishing.error) return { success: false, error: 'PlaybackFailed', detail: session.finishing.error };
    const result = { success: true as const, finished: true as const, storyId: terminalStoryId, completed };
    if (!session.finishing.error && !session.replay) this.completions.set(ownerKey(session.source.owner), result);
    return result;
  }

  private finishPresentation(session: StoryNodeSession): void {
    if (!this.isCurrent(session) || !markSessionClosed(session)) return;
    this.coordinator.end(session.source.owner, session.source.replayId);
    if (session.source.parentHistoryId) {
      const parent = this.allSessions().find(x => x.source.historyId === session.source.parentHistoryId);
      if (parent?.continuation?.state === 'running' && parent.continuation.childHistoryId === session.source.historyId) {
        const view = parent.player.save();
        if (view.run) {
          const flags = { ...view.run.localFlags };
          for (const key of parent.entry.kizuna?.returnFlags ?? []) {
            delete flags[key];
            if (Object.prototype.hasOwnProperty.call(session.finishing?.localFlags ?? {}, key)) Object.defineProperty(flags, key, { value: session.finishing!.localFlags![key], enumerable: true, configurable: true, writable: true });
          }
          parent.player.restore({ ...view, run: { ...view.run, localFlags: flags } });
          parent.continuation.state = 'returned'; parent.called = true;
        }
      }
    }
    if (session.source.replayId) {
      this.replaySessions.delete(session.source.replayId);
      this.completedReplays.set(session.source.replayId, session.source.owner);
    } else this.sessions.delete(ownerKey(session.source.owner));
    if (!session.source.parentHistoryId && !session.replay) this.sessions.delete(ownerKey(session.source.owner));
    const parent = session.source.parentHistoryId && this.allSessions().find(x => x.source.historyId === session.source.parentHistoryId);
    if (parent && parent.replay && parent.continuation?.state === 'returned') { this.announceChannel(parent); this.resumeContinuation(parent); }
    const previous = this.activeSource;
    this.activeSource = session.source;
    try {
      this.opts.presentation?.close(session.source, 'completed');
      this.opts.eventBus.emit({ type: 'storyPlaybackChanged', owner: session.source.owner, ...(session.source.replayId ? { replayId: session.source.replayId } : {}) });
    } finally { this.activeSource = previous; }
  }

  private endSession(session: StoryNodeSession, reason: StoryNodeRunEndReason): void {
    if (!markSessionClosed(session)) return;
    if (session.source.parentHistoryId) {
      const parent = this.allSessions().find(x => x.source.historyId === session.source.parentHistoryId);
      if (parent && parent.continuation?.childHistoryId === session.source.historyId) parent.continuation = undefined;
    } else {
      for (const child of this.allSessions().filter(x => x.source.parentHistoryId === session.source.historyId)) this.endSession(child, 'cancelled');
    }
    if (this.isCurrent(session)) this.coordinator.end(session.source.owner, session.source.replayId);
    if (this.isCurrent(session)) {
      if (session.source.replayId) this.replaySessions.delete(session.source.replayId);
      else this.sessions.delete(ownerKey(session.source.owner));
      if (!session.replay && !session.source.parentHistoryId) this.sessions.delete(ownerKey(session.source.owner));
    }
    session.player.cancel();
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
    return session.source.replayId
      ? this.replaySessions.get(session.source.replayId) === session
      : this.sessions.get(ownerKey(session.source.owner)) === session;
  }

  private sessionForSource(source: StoryNodeSource): StoryNodeSession | undefined {
    return source.replayId ? this.replaySessions.get(source.replayId) : this.sessionFor(source.owner);
  }

  private sessionForChannel(owner: string | null, replayId?: string): StoryNodeSession | undefined {
    return replayId ? this.replaySessions.get(replayId) : this.sessionFor(owner);
  }

  private sessionFor(owner?: string | null): StoryNodeSession | undefined {
    return this.sessions.get(ownerKey(normalizeOwner(owner)));
  }

  private sessionsForInteractionGate(owner?: string | null): StoryNodeSession[] {
    if (owner == null) return this.allSessions().filter(session => !session.replay && !session.finishing?.error);
    const result = new Set<StoryNodeSession>(this.allSessions().filter(x => !x.replay && x.source.replayId && !x.finishing?.error));
    const global = this.sessionFor(null);
    const owned = this.sessionFor(owner);
    if (global && !global.finishing?.error) result.add(global);
    if (owned && !owned.finishing?.error) result.add(owned);
    return [...result];
  }

  private snapshot(session: StoryNodeSession): StoryCursorSnapshot {
    const presentation = this.opts.presentation?.save(session.source);
    const queue = this.coordinator.saveQueue(session.source.owner, session.source.replayId);
    return {
      playback: session.player.save(), isReplay: session.replay, continuation: session.continuation, called: session.called, continued: session.continued, scene: session.scene,
      lastChoiceIndex: session.lastChoiceIndex, lastChoiceStoryId: session.lastChoiceStoryId, flags: [...session.flags],
      output: this.coordinator.saveOutputs(session.source.owner),
      ...(session.source.replayId ? { channelOutput: this.coordinator.saveOutputs(session.source.owner, session.source.replayId) } : {}),
      documents: documentFingerprints(session.documents, session.source.rootStoryId),
      ...(queue ? { queue } : {}),
      ...(session.finishing ? { finishing: { ...session.finishing, source: session.source } } : {}),
      ...(presentation === undefined ? {} : { presentation }),
    };
  }

  private emptySnapshot(owner: string | null = null): StoryCursorSnapshot {
    return { playback: { format: 'story-nodes-v2', run: null }, isReplay: false,
      lastChoiceIndex: -1, lastChoiceStoryId: null, flags: [], output: this.coordinator.saveOutputs(owner) };
  }

  private restoreSession(snapshot: StoryCursorSnapshot, expectedOwner: string | null): StoryNodeSession | null {
    this.coordinator.restoreOutputs(expectedOwner, snapshot.output);
    const run = snapshot.playback.run;
    const source = snapshot.finishing?.source ?? run?.source;
    if (!source) return null;
    const entry = this.opts.registry.storyEntries.get(source.entryId)!;
    const restoredSource: StoryNodeSource = { ...source, runId: newRunId(), historyId: source.historyId ?? source.runId };
    let session!: StoryNodeSession;
    session = createStoryNodeSession({ source: restoredSource, entry: structuredClone(entry), replay: snapshot.isReplay,
      documents: this.documents, conditionSystem: this.opts.conditionSystem, getState: this.opts.getState,
      actionHost: this.actionHost, random: this.opts.random, preflightTransfer: transfer => this.preflightTransfer(session, transfer) });
    if (run) session.player.restore({ ...snapshot.playback, run: { ...run, source: restoredSource } });
    session.continuation = snapshot.continuation && structuredClone(snapshot.continuation);
    session.called = snapshot.called;
    session.continued = snapshot.continued;
    session.scene = snapshot.scene && structuredClone(snapshot.scene);
    if (restoredSource.replayId) {
      this.replaySessions.set(restoredSource.replayId, session);
      this.coordinator.restoreOutputs(expectedOwner, snapshot.channelOutput ?? snapshot.output, restoredSource.replayId);
    }
    session.lastChoiceIndex = snapshot.lastChoiceIndex;
    session.lastChoiceStoryId = snapshot.lastChoiceStoryId;
    for (const flag of snapshot.flags) session.flags.add(flag);
    for (const visited of run?.visited ?? []) session.visitedStoryIds.add(visited);
    if (snapshot.finishing) session.finishing = { ...snapshot.finishing };
    if (snapshot.presentation !== undefined) this.opts.presentation?.restore?.(restoredSource, snapshot.presentation);
    if (snapshot.queue) {
      const view = session.player.getView();
      const automatic = snapshot.queue.automatic;
      this.coordinator.restoreQueue(restoredSource, 'token' in view ? view.token : `${restoredSource.historyId}:finishing`, snapshot.queue, automatic);
    }
    return session;
  }

  private cursorRecoveryKind(snapshot: StoryCursorSnapshot, expectedOwner: string | null): 'restart' | 'discard' | undefined {
    const source = snapshot.finishing?.source ?? snapshot.playback?.run?.source;
    if (!source || source.owner !== expectedOwner) return undefined;
    const entry = this.opts.registry.storyEntries.get(source.entryId);
    if (!entry) return 'discard';
    if (!this.documents.has(entry.storyId)) return 'discard';
    if (entry.storyId !== source.rootStoryId) return 'restart';
    let currentDocuments: Readonly<Record<string, string>>;
    try { currentDocuments = documentFingerprints(this.documents, entry.storyId); }
    catch { return 'restart'; }
    const savedDocuments = snapshot.documents;
    if (!savedDocuments || !sameDocumentFingerprints(savedDocuments, currentDocuments)) return 'restart';
    // Matching fingerprints with a broken checkpoint indicate corruption, not an edited document.
    return undefined;
  }

  private validateCursorSnapshotOrRestart(snapshot: StoryCursorSnapshot, expectedOwner: string | null): void {
    try { this.validateCursorSnapshot(snapshot, expectedOwner); }
    catch (error) {
      if (!this.cursorRecoveryKind(snapshot, expectedOwner)) throw error;
      validateStoryPresentationSnapshot({ ...snapshot, documents: undefined, queue: undefined, finishing: undefined,
        presentation: undefined, playback: { format: 'story-nodes-v2', run: null } }, this.documents);
    }
  }

  private restoreOrRestartSession(snapshot: StoryCursorSnapshot, expectedOwner: string | null): StoryNodeSession | null {
    const recovery = this.cursorRecoveryKind(snapshot, expectedOwner);
    if (!recovery) return this.restoreSession(snapshot, expectedOwner);
    this.coordinator.restoreOutputs(expectedOwner, snapshot.output);
    if (recovery === 'discard') return null;
    const source = snapshot.finishing?.source ?? snapshot.playback.run?.source;
    const entry = source && this.opts.registry.storyEntries.get(source.entryId);
    if (!entry || !this.documents.has(entry.storyId)) return null;
    const prepared = this.prepareEntry(entry.id, entry.type, expectedOwner,
      { force: true, replaceAny: true, skipConditions: true }, false);
    if ('error' in prepared) return null;
    if (this.travelToStartArea(prepared.session)) return null;
    if (this.installSession(prepared.session)) return null;
    this.initializeSession(prepared.session, prepared.initialFlags);
    return prepared.session;
  }

  private validateCursorSnapshot(snapshot: StoryCursorSnapshot, expectedOwner: string | null): void {
    if (!isStoryCursorSnapshot(snapshot)) throw new Error('InvalidStoryCursorSnapshot');
    if (!Number.isSafeInteger(snapshot.lastChoiceIndex) || snapshot.lastChoiceIndex < -1 || new Set(snapshot.flags).size !== snapshot.flags.length) throw new Error('InvalidStoryCursorMetadata');
    const run = snapshot.playback.run;
    const source = snapshot.finishing?.source ?? run?.source;
    validateStoryPresentationSnapshot(snapshot, this.documents, source?.rootStoryId);
    if (snapshot.continued !== undefined && typeof snapshot.continued !== 'boolean') throw new Error('InvalidStoryContinuation');
    if (snapshot.finishing?.localFlags !== undefined && !isStoryRunFlags(snapshot.finishing.localFlags)) throw new Error('InvalidStoryResultFlags');
    if (snapshot.scene && (snapshot.scene.type === 'area' ? !this.opts.registry.areas.has(snapshot.scene.areaId) : snapshot.scene.type !== 'chara' || !this.opts.registry.characterVariants.has(snapshot.scene.characterId))) throw new Error('InvalidStoryScene');
    if (snapshot.channelOutput) validateStoryPresentationSnapshot({ ...snapshot, output: snapshot.channelOutput }, this.documents, source?.rootStoryId);
    if (!source) {
      if (snapshot.isReplay || snapshot.lastChoiceIndex !== -1 || snapshot.lastChoiceStoryId !== null || snapshot.flags.length || snapshot.presentation) throw new Error('InvalidEmptyStoryCursor');
      return;
    }
    if (source.owner !== expectedOwner || typeof source.runId !== 'string' || !source.runId.trim() || !source.historyId
      || typeof source.causalChainId !== 'string' || !source.causalChainId.trim()
      || !Number.isSafeInteger(source.handoffCount) || source.handoffCount! < 0 || source.handoffCount! > 64) throw new Error('InvalidStoryCursorSource');
    const entry = this.opts.registry.storyEntries.get(source.entryId);
    if (!entry || entry.storyId !== source.rootStoryId) throw new Error('StoryCursorSourceNotFound');
    const session = createStoryNodeSession({ source, entry, replay: snapshot.isReplay, documents: this.documents,
      conditionSystem: this.opts.conditionSystem, getState: this.opts.getState, actionHost: this.actionHost, random: this.opts.random });
    if (run) {
      session.player.restore(snapshot.playback);
      this.validateLastChoiceMetadata(snapshot, run.visited);
    }
    if (snapshot.presentation !== undefined) this.opts.presentation?.validateSnapshot?.(source, snapshot.presentation);
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
