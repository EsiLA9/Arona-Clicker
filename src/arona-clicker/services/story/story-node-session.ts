import type { StoryEntryDef } from '../../../data-services/contracts/story-entry';
import type { StoryStartResult } from '../../contracts/runtime/results';
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
  replacementResult?: StoryStartResult;
  denialMessage?: string;
  closed: boolean;
}

export interface CreateStoryNodeSessionOptions {
  readonly source: StoryNodeSource;
  readonly entry: StoryEntryDef;
  readonly replay: boolean;
  readonly documents: ReadonlyMap<string, StoryNodeDocument>;
  readonly conditionSystem: ConditionSystem;
  readonly getState: () => PlayerState;
  readonly actionHost: Pick<StoryNodePlaybackHost, 'preflight' | 'execute'>;
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
  if (view.status !== 'delivery' && view.status !== 'input') return null;
  const document = session.documents.get(view.storyId);
  const runId = session.source.runId;
  if (!runId) throw new Error('StoryRunIdRequired');
  const historyId = session.source.historyId;
  if (!historyId) throw new Error('StoryHistoryIdRequired');
  if (!document) return null;
  const displayNodes = document.nodes.filter(candidate => candidate.type === 'talklet' || candidate.type === 'click');
  const pageIndex = displayNodes.findIndex(candidate => candidate.id === view.node.id);
  if (pageIndex < 0) return null;
  const page = view.status === 'delivery' ? talkletPage(view.node) : clickPage(view.node);
  const nodeIndex = document.nodes.findIndex(candidate => candidate.id === view.node.id);
  const nextIsInput = view.status === 'delivery'
    && nodeIndex >= 0
    && document.nodes[nodeIndex + 1]?.type === 'click';
  return {
    storyId: session.source.entryId,
    type: session.entry.type,
    storyDefId: view.storyId,
    pageIndex,
    totalPages: displayNodes.length,
    page,
    availableChoiceIndexes: view.status === 'input' && view.node.interaction.kind === 'choice'
      ? view.node.interaction.options.flatMap((option, index) => view.availableOptionIds.includes(option.id) ? [index] : [])
      : [],
    nodeId: view.node.id,
    token: view.token,
    phase: view.status,
    runId,
    historyId,
    waitSequence: view.sequence,
    ...(nextIsInput ? { nextIsInput: true } : {}),
  };
}

function talkletPage(node: StoryTalkletNode): Talklet {
  const { content, presentation, pacing } = node;
  return {
    kind: content.kind,
    text: content.text,
    ...(content.kind === 'talk' && content.speaker !== undefined ? { speaker: content.speaker } : {}),
    ...(content.kind === 'talk' && content.image !== undefined ? { image: content.image } : {}),
    ...(presentation?.side === undefined ? {} : { side: presentation.side }),
    ...(presentation?.align === undefined ? {} : { align: presentation.align }),
    ...(presentation?.avatar === undefined ? {} : { avatar: presentation.avatar }),
    ...(presentation?.avatarMode === 'hide' ? { noAvatar: true } : {}),
    ...(presentation?.avatarMode === 'show' ? { showAvatar: true } : {}),
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
  if (view.status !== 'delivery') return null;
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
