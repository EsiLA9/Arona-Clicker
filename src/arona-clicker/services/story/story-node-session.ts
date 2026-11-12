import { storyEntryType } from '../../../data-services/contracts/story-entry';
import { projectStoryContent, storyNodeDisplay } from '../../../data-services/authoring/story-content-display';
import type { StoryEntryDef } from '../../../data-services/contracts/story-entry';
import type { StoryNodeDocument, StoryTalkletNode } from '../../../data-services/contracts/story-node';
import type { StoryAction } from '../../../data-services/contracts/story-node-actions';
import { ConditionSystem } from '../../../engine/expression/condition-system';
import type { PlayerState } from '../../types/state';
import type { StoryNodeSnapshot } from '../../../engine/contracts/story-node-snapshot';
import type { StoryView } from '../../contracts/runtime/results';
import type {
  StoryNodeActionOutcome, StoryNodePlaybackHost, StoryNodePlaybackView, StoryNodeSource,
} from '../../contracts/runtime/story-node-playback';
import type { Talklet } from '../../../data-services/contracts/story';
import { StoryNodePlayer } from './story-node-player';

export type StoryNodeRunEndReason = 'completed' | 'replaced' | 'cancelled' | 'failed';

/** One owner's active run and metadata that must never leak into another session. */
export interface StoryNodeSession {
  readonly player: StoryNodePlayer;
  readonly source: StoryNodeSource;
  readonly entry: StoryEntryDef;
  readonly replay: boolean;
  readonly documents: ReadonlyMap<string, StoryNodeDocument>;
  readonly flags: Set<string>;
  readonly deliveredTalklets: Set<string>;
  readonly visitedStoryIds: Set<string>;
  lastChoiceIndex: number;
  lastChoiceStoryId: string | null;
  denialMessage?: string;
  closed: boolean;
  continuation?: { state: 'running' | 'returned'; childHistoryId: string };
  called?: boolean;
  continued?: boolean;
  scene?: import('../../../data-services/contracts/story-node').StoryStartContext;
  finishing?: { localFlags?: import('../../../engine/contracts/story-run-flags').StoryRunFlags; terminalStoryId: string; settled: boolean; error?: string; receipts?: readonly import('../../../engine/contracts/effect-receipt').EffectReceipt[]; completionRecorded?: boolean };
}

export interface CreateStoryNodeSessionOptions {
  readonly source: StoryNodeSource;
  readonly entry: StoryEntryDef;
  readonly replay: boolean;
  readonly documents: ReadonlyMap<string, StoryNodeDocument>;
  readonly conditionSystem: ConditionSystem;
  readonly getState: () => PlayerState;
  readonly actionHost: Pick<StoryNodePlaybackHost, 'preflight' | 'execute' | 'move'>;
  readonly random?: () => number;
  readonly preflightTransfer?: StoryNodePlaybackHost['preflightTransfer'];
}

/** Creates a player with conditions evaluated against current state and this run's visited set. */
export function createStoryNodeSession(options: CreateStoryNodeSessionOptions): StoryNodeSession {
  const documents = new Map([...options.documents].map(([id, document]) => [id, structuredClone(document)]));
  const flags = new Set<string>();
  const visitedStoryIds = new Set<string>([options.source.rootStoryId]);
  const base = options.conditionSystem;
  const scoped = new ConditionSystem();
  scoped.setTagIndex(tag => base.tagIndex(tag));
  scoped.setStatReader(dsl => base.statReader(dsl));
  scoped.setStoryRunChecker(id => base.storyRunChecker(id));
  scoped.setStoryChainChecker(() => false);
  scoped.setExtraReader(path => base.extraReader(path));
  scoped.setTagCountReader(key => base.tagCountReader(key));
  scoped.setAffectionLevelReader((id, state) => base.affectionLevelReader(id, state));

  const player = new StoryNodePlayer(documents, {
    ...options.actionHost,
    random: options.random ?? Math.random,
    evaluate: (condition, visited) => {
      scoped.setStoryChainChecker(id => visited.includes(id));
      return scoped.evaluateGroup(condition, options.getState());
    },
    ...(options.preflightTransfer ? { preflightTransfer: options.preflightTransfer } : {}),
  });

  return {
    player,
    source: { ...options.source },
    entry: options.entry,
    replay: options.replay,
    documents,
    flags,
    deliveredTalklets: new Set(),
    visitedStoryIds,
    lastChoiceIndex: -1,
    lastChoiceStoryId: null,
    closed: false,
  };
}

/** Projects a wait point to a display-only legacy-shaped DTO. */
export function projectStoryNodeView(session: StoryNodeSession, view: StoryNodePlaybackView): StoryView | null {
  if (view.status !== 'delivery' && view.status !== 'operation' && view.status !== 'result' && view.status !== 'input') return null;
  const document = session.documents.get(view.storyId);
  const runId = session.source.runId;
  if (!runId) throw new Error('StoryRunIdRequired');
  const historyId = session.source.historyId;
  if (!historyId) throw new Error('StoryHistoryIdRequired');
  if (!document) return null;
  const displayNodes = document.nodes.filter(candidate => candidate.type === 'talklet' || candidate.type === 'click');
  const nodeIndex = document.nodes.findIndex(candidate => candidate.id === view.node.id);
  if (nodeIndex < 0) return null;
  const displayIndex = displayNodes.findIndex(candidate => candidate.id === view.node.id);
  const pageIndex = displayIndex >= 0 ? displayIndex
    : displayNodes.filter(candidate => document.nodes.findIndex(item => item.id === candidate.id) < nodeIndex).length;
  const page = view.status === 'delivery' ? talkletPage(view.node)
    : view.status === 'operation' || view.status === 'result' ? operationCheckpointPage() : clickPage(view.node);
  const next = document.nodes[nodeIndex + 1];
  const nextIsInput = view.status === 'delivery'
    && nodeIndex >= 0
    && next?.type === 'click'
    && (next.requiresFlag === undefined || session.player.hasLocalFlag(next.requiresFlag));
  const performance = view.node.type === 'talklet' || view.node.type === 'click' ? storyNodeDisplay(view.node) : undefined;
  return {
    storyId: session.source.entryId,
    type: storyEntryType(session.entry),
    storyDefId: view.storyId,
    pageIndex,
    totalPages: displayNodes.length,
    page,
    availableChoiceIndexes: view.status === 'input' && view.node.interaction.kind === 'choice'
      ? view.node.interaction.options.flatMap((option, index) => view.availableOptionIds.includes(option.id) ? [index] : [])
      : [],
    nodeId: view.node.id,
    token: view.token,
    phase: view.status === 'operation' || view.status === 'result' ? 'delivery' : view.status,
    runId,
    historyId,
    waitSequence: view.sequence,
    ...(view.status==='input'&&view.press ? {press:{...view.press}}:{}),
    ...(performance ? { performance: structuredClone(performance) } : {}),
    ...(nextIsInput ? { nextIsInput: true } : {}),
  };
}

function operationCheckpointPage(): Talklet {
  return { kind: 'click', text: '操作已执行，点击继续' };
}

function talkletPage(node: StoryTalkletNode): Talklet {
  const { content } = node;
  const presentation = node.appearance?.presentation ?? node.presentation;
  const pacing = node.performance?.pacing ?? node.pacing;
  return {
    ...projectStoryContent(content,presentation),
    ...(pacing?.typing === undefined ? {} : { typing: pacing.typing }),
    ...(pacing?.thinking === undefined ? {} : { thinking: pacing.thinking }),
  };
}

function clickPage(node: Extract<StoryNodePlaybackView, { status: 'input' }>['node']): Talklet {
  const interaction = node.interaction;
  if (interaction.kind === 'button') return { kind: 'click', text: interaction.text };
  if (interaction.kind === 'choice') {
    return {
      kind: 'click', text: '',
      choices: interaction.options.map(option => ({ id: option.id, text: option.text })),
    };
  }
  if (interaction.kind === 'areaContinue') return { kind: 'click', text: interaction.buttonText?.trim() || '到指定地点继续故事' };
  if (interaction.kind === 'kizunaCard') return { kind: 'click', text: interaction.buttonText?.trim() || '进入关联故事' };
  const card = interaction.card;
  return {
    kind: 'click', text: card.buttonText ?? '',
    kizuna: {
      storyId: card.request.entryId,
      ...(card.title === undefined ? {} : { title: card.title }),
      ...(card.buttonText === undefined ? {} : { buttonText: card.buttonText }),
      ...(card.align === undefined ? {} : { align: card.align }),
    },
  };
}

/** Records a Talklet ordinal once after a delivery acknowledgement is accepted. */
export function markTalkletDelivered(session: StoryNodeSession, view: StoryNodePlaybackView): { storyId: string; ordinal: number } | null {
  if (view.status !== 'delivery' || view.node.type !== 'talklet') return null;
  const key = `${view.storyId}\u0000${view.node.id}\u0000${view.sequence}`;
  if (session.deliveredTalklets.has(key)) return null;
  const document = session.documents.get(view.storyId);
  if (!document) return null;
  let ordinal = -1;
  for (const node of document.nodes) {
    if (node.type !== 'talklet') continue;
    ordinal += 1;
    if (node.id === view.node.id) break;
  }
  if (ordinal < 0) return null;
  session.deliveredTalklets.add(key);
  return { storyId: view.storyId, ordinal };
}

/** Captures flags only after the existing domain action host reports the state batch applied. */
export function trackStoryFlags(session: StoryNodeSession, action: StoryAction, outcome: StoryNodeActionOutcome): void {
  if (outcome.status !== 'applied' || action.kind !== 'state') return;
  for (const effect of action.effects) if (effect.op === 'setFlag') session.flags.add(effect.flagId);
}

/** Prevents reentrant shutdown paths from closing the presentation host more than once. */
export function markSessionClosed(session: StoryNodeSession): boolean {
  if (session.closed) return false;
  session.closed = true;
  return true;
}

export function snapshotOf(session: StoryNodeSession): StoryNodeSnapshot { return session.player.save(); }
