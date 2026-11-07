import { storyEntryType } from '../../../data-services/contracts/story-entry';
import { isDeferredStoryPresentationEffect } from './story-node-action-host';
import type { StoryNodeDocument } from '../../../data-services/contracts/story-node';
import type { StoryCursorCollection, StoryCursorSnapshot } from '../../../engine/contracts/story-cursor';
import type { StoryOutputContent, StoryPlaybackStep } from '../../../engine/contracts/story-playback-state';
import type { Registry } from '../../../data-services/registry/registry';
import { isStoryFlagValue, isStoryRunFlags } from '../../../data-services/validation/story-run-flags';
import { isStoryNodePerformance } from '../../../data-services/validation/story-performance';

export const STORY_PLAYBACK_MAX_OUTPUTS = 200;
export const STORY_PLAYBACK_MAX_STEPS = 4096;
export const STORY_PLAYBACK_MAX_DELAY_MS = 24 * 60 * 60 * 1000;
export const STORY_PLAYBACK_MAX_PAYLOAD_BYTES = 4 * 1024 * 1024;
export const STORY_PLAYBACK_MAX_DEFERRED_STARTS = 64;
export const STORY_PLAYBACK_MAX_HANDOFFS = 64;
const MAX_DOCUMENTS = 4096;
const visualOps = new Set(['showChatText', 'clearIdChatFlow', 'clearAllChatText', 'clearAllChatFlow', 'setTheme', 'setEntityPresentation', 'clearEntityPresentation', 'showOpeningTitle']);
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const integer = (value: unknown, minimum = 0): value is number => Number.isSafeInteger(value) && Number(value) >= minimum;
const fail = (reason: string): never => { throw new Error(`StoryPlaybackSnapshotInvalid:${reason}`); };

/** Object key order is irrelevant; arrays retain author order. Optional undefined object fields are omitted. */
function canonical(value: unknown, visiting = new Set<object>(), depth = 0): string {
  if (depth > 128) return fail('PayloadDepth');
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') return Number.isFinite(value) ? JSON.stringify(value) : fail('PayloadNumber');
  if (typeof value !== 'object' || visiting.has(value)) return fail('PayloadJSON');
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return fail('PayloadJSON');
  if (Reflect.ownKeys(value).some(key => typeof key !== 'string' || !Array.isArray(value) && !Object.prototype.propertyIsEnumerable.call(value, key))) return fail('PayloadJSON');
  visiting.add(value);
  const result = Array.isArray(value)
    ? `[${Array.from(value, item => canonical(item, visiting, depth + 1)).join(',')}]`
    : `{${Object.keys(value).filter(key => (value as Record<string, unknown>)[key] !== undefined).sort()
      .map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key], visiting, depth + 1)}`).join(',')}}`;
  visiting.delete(value);
  return result;
}

function fingerprint(value: unknown): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(canonical(value))) hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n);
  return `story-doc-v1:${hash.toString(16).padStart(16, '0')}`;
}

/** Fingerprints the session's fixed source documents, including every declared goto/insert branch. */
export function documentFingerprints(documents: ReadonlyMap<string, StoryNodeDocument>, rootId: string): Record<string, string> {
  if (!nonEmpty(rootId)) return fail('DocumentRoot');
  const found = new Map<string, string>();
  const pending = [rootId];
  while (pending.length) {
    const id = pending.pop()!;
    if (found.has(id)) continue;
    if (found.size >= MAX_DOCUMENTS) return fail('DocumentLimit');
    const document = documents.get(id);
    if (!document || document.id !== id || !Array.isArray(document.nodes)) return fail(`DocumentMissing:${id}`);
    found.set(id, fingerprint(document));
    for (const node of document.nodes) {
      if (node.type === 'transfer') pending.push(node.transfer.storyId);
    }
  }
  return Object.fromEntries([...found].sort(([left], [right]) => left.localeCompare(right)));
}

function checkContent(value: unknown): asserts value is StoryOutputContent {
  if (!record(value) || !['talk', 'narration', 'reward', 'travel'].includes(String(value.kind)) || typeof value.text !== 'string') return fail('OutputContent');
  const allowed = new Set(['kind', 'text', 'speaker', 'characterId', 'displayName', 'avatar', 'image', 'side', 'align', 'noAvatar', 'showAvatar', 'storyType', 'storyPageKey', 'choice','node','performance']);
  if (value.performance!==undefined && !isStoryNodePerformance(value.performance)) return fail('NodePerformance');
  if (value.performance!==undefined && value.node===undefined) return fail('NodeDisplayIdentity');
  if (value.node!==undefined && (!record(value.node)||Object.keys(value.node).some(key=>!['storyId','nodeId'].includes(key))||!nonEmpty(value.node.storyId)||!nonEmpty(value.node.nodeId))) return fail('NodeDisplayIdentity');
  if (Object.keys(value).some(key => !allowed.has(key))) return fail('OutputContentKeys');
  for (const key of ['speaker', 'characterId', 'displayName', 'avatar', 'image', 'storyPageKey']) if (value[key] !== undefined && typeof value[key] !== 'string') return fail('OutputContent');
  for (const key of ['noAvatar', 'showAvatar']) if (value[key] !== undefined && typeof value[key] !== 'boolean') return fail('OutputContent');
  if (value.side !== undefined && !['left', 'right'].includes(String(value.side))
    || value.align !== undefined && !['left', 'center', 'right'].includes(String(value.align))
    || value.storyType !== undefined && !['active', 'passive'].includes(String(value.storyType))) return fail('OutputContent');
  if (value.choice !== undefined) {
    const choice = value.choice;
    if (!record(choice) || Object.keys(choice).some(key => !['options', 'selectedOptionId'].includes(key))
      || !Array.isArray(choice.options) || choice.options.length === 0 || !nonEmpty(choice.selectedOptionId)) return fail('OutputChoice');
    const ids = new Set<string>();
    for (const option of choice.options) {
      if (!record(option) || Object.keys(option).some(key => !['id', 'text'].includes(key))
        || !nonEmpty(option.id) || typeof option.text !== 'string' || ids.has(option.id)) return fail('OutputChoice');
      ids.add(option.id);
    }
    if (!ids.has(choice.selectedOptionId)) return fail('OutputChoice');
  }
}

/** Shared admission check for restored queues and newly compiled finite step batches. */
export function validateStoryPlaybackSteps(steps: readonly StoryPlaybackStep[]): void {
  if (!Array.isArray(steps) || steps.length > STORY_PLAYBACK_MAX_STEPS) return fail('StepLimit');
  if (new TextEncoder().encode(canonical(steps)).byteLength > STORY_PLAYBACK_MAX_PAYLOAD_BYTES) return fail('PayloadLimit');
  for (const step of steps) {
    if (!record(step)) return fail('Step');
    if (step.kind === 'delay') {
      if (!['typing', 'thinking', 'operation', 'banner'].includes(String(step.phase))
        || typeof step.durationMs !== 'number' || !Number.isFinite(step.durationMs) || step.durationMs < 0 || step.durationMs > STORY_PLAYBACK_MAX_DELAY_MS
        || step.title !== undefined && typeof step.title !== 'string') return fail('DelayStep');
      if (step.typing !== undefined) checkContent(step.typing);
      if (Object.keys(step).some(key => !['kind', 'phase', 'durationMs', 'typing', 'title'].includes(key))) return fail('StepKeys');
    } else if (step.kind === 'output') {
      checkContent(step.content);
      if (Object.keys(step).some(key => !['kind', 'content'].includes(key))) return fail('StepKeys');
    } else if (step.kind === 'effect') {
      const effect = step.effect;
      if (!record(effect) || !visualOps.has(String(effect.op)) || !isDeferredStoryPresentationEffect(effect as unknown as import('../../../engine/types/expression').Effect) || typeof effect.target !== 'string' || !('value' in effect)) return fail('VisualEffect');
      if (effect.op === 'setTheme' && (!record(effect.value) || effect.value.scope !== undefined && effect.value.scope !== 'ephemeral')) return fail('PersistentThemeStep');
      if (Object.keys(step).some(key => !['kind', 'effect'].includes(key))) return fail('StepKeys');
    } else return fail('StepKind');
  }
}

/** Read-only preflight. Removed history is valid; committed progress must never point backwards. */
export function validateStoryPresentationSnapshot(snapshot: StoryCursorSnapshot, documents: ReadonlyMap<string, StoryNodeDocument>, rootId?: string): void {
  const output = snapshot.output;
  if (!record(output) || !integer(output.epoch) || !integer(output.sequence) || !Array.isArray(output.entries)
    || output.entries.length > STORY_PLAYBACK_MAX_OUTPUTS) return fail('Output');
  const ids = new Set<string>();
  let lastSequence = 0;
  for (const entry of output.entries) {
    if (!record(entry) || !nonEmpty(entry.id) || !nonEmpty(entry.historyId) || !integer(entry.sequence, 1)
      || entry.sequence <= lastSequence || entry.sequence > output.sequence || typeof entry.timestamp !== 'number' || !Number.isFinite(entry.timestamp) || entry.timestamp < 0
      || ids.has(entry.id)) return fail('OutputEntry');
    ids.add(entry.id);
    lastSequence = entry.sequence;
    const { id: _id, sequence: _sequence, timestamp: _timestamp, historyId: _historyId, ...content } = entry;
    checkContent(content);
  }
  if (new TextEncoder().encode(canonical({ output, queue: snapshot.queue ?? null })).byteLength > STORY_PLAYBACK_MAX_PAYLOAD_BYTES) return fail('PayloadLimit');

  const run = snapshot.playback.run;
  if (run && snapshot.finishing) return fail('FinishingWithActiveRun');
  const source = run?.source ?? snapshot.finishing?.source;
  if (!source) {
    if (snapshot.queue !== undefined || snapshot.documents !== undefined || rootId !== undefined) return fail('IdleExecutionState');
    return;
  }
  const expectedRoot = rootId ?? source.rootStoryId;
  if (expectedRoot !== source.rootStoryId || !nonEmpty(source.historyId)) return fail('Source');
  const expectedDocuments = documentFingerprints(documents, expectedRoot);
  if (!record(snapshot.documents) || canonical(snapshot.documents) !== canonical(expectedDocuments)) return fail('DocumentMismatch');
  if (snapshot.finishing && (!nonEmpty(snapshot.finishing.terminalStoryId) || !Object.prototype.hasOwnProperty.call(expectedDocuments, snapshot.finishing.terminalStoryId)
    || typeof snapshot.finishing.settled !== 'boolean' || !snapshot.finishing.settled && !snapshot.finishing.error
    || snapshot.finishing.error !== undefined && typeof snapshot.finishing.error !== 'string')) return fail('Finishing');

  const queue = snapshot.queue;
  if (!queue) {
    if (run?.pending.kind !== 'input' && !snapshot.finishing?.error) return fail('MissingQueue');
    return;
  }
  if (run?.pending.kind === 'input') return fail('InputWithQueue');
  if ((snapshot.finishing || run?.pending.kind === 'operation' || run?.pending.kind === 'result') && queue.automatic !== true) return fail('AutomaticBarrier');
  validateStoryPlaybackSteps(queue.steps);
  const expectedKey = `${source.historyId}:${run ? run.waitSequence : 'finishing'}`;
  if (queue.key !== expectedKey || !integer(queue.index) || queue.index > queue.steps.length
    || typeof queue.ready !== 'boolean' || typeof queue.automatic !== 'boolean' || typeof queue.suppressed !== 'boolean' || typeof queue.delivered !== 'boolean'
    || typeof queue.remainingMs !== 'number' || !Number.isFinite(queue.remainingMs) || queue.remainingMs < 0
    || queue.ready && queue.index !== queue.steps.length || queue.suppressed && queue.delivered) return fail('QueueProgress');
  const current = queue.steps[queue.index];
  if (current?.kind === 'delay' ? queue.remainingMs > current.durationMs : queue.remainingMs !== 0) return fail('QueueRemaining');
  const bodyDelivered = queue.steps.slice(0, queue.index).some(step => step.kind === 'output' && (step.content.kind === 'talk' || step.content.kind === 'narration'));
  if (queue.delivered !== (bodyDelivered && !queue.suppressed)) return fail('QueueDelivered');
  const prefix = `${queue.key}:`;
  for (const entry of output.entries) {
    if (!entry.id.startsWith(prefix)) continue;
    const index = Number(entry.id.slice(prefix.length));
    const step = queue.steps[index];
    if (!integer(index) || `${prefix}${index}` !== entry.id || index >= queue.index || step?.kind !== 'output' || queue.suppressed || entry.historyId !== source.historyId) return fail('OutputProgress');
    const { id: _id, sequence: _sequence, timestamp: _timestamp, historyId: _historyId, ...content } = entry;
    if (canonical(content) !== canonical(step.content)) return fail('OutputMismatch');
  }
}

/** Deferred requests may survive a command boundary only while their target owner is finishing. */
export function validateStoryDeferredStarts(collection: StoryCursorCollection, registry: Pick<Registry, 'storyEntries' | 'stories'>): void {
  const requests = collection.pendingStarts;
  if (!Array.isArray(requests) || requests.length > STORY_PLAYBACK_MAX_DEFERRED_STARTS) return fail('DeferredStartLimit');
  const requestIds = new Set<string>();
  for (const request of requests) {
    if (!record(request) || Object.keys(request).some(key => !['requestId', 'entryId', 'expectedType', 'owner', 'options', 'causalChainId', 'handoffCount'].includes(key))
      || !nonEmpty(request.requestId) || requestIds.has(request.requestId) || !nonEmpty(request.entryId)
      || !['active', 'passive'].includes(String(request.expectedType))
      || request.owner !== null && !nonEmpty(request.owner)
      || !nonEmpty(request.causalChainId) || !integer(request.handoffCount) || request.handoffCount > STORY_PLAYBACK_MAX_HANDOFFS) return fail('DeferredStart');
    requestIds.add(request.requestId);
    if (request.options !== undefined) {
      if (!record(request.options) || Object.keys(request.options).some(key => !['force', 'skipConditions', 'replaceAny', 'initialFlags'].includes(key))) return fail('DeferredStartOptions');
      for (const name of ['force', 'skipConditions', 'replaceAny']) {
        if (request.options[name] !== undefined && typeof request.options[name] !== 'boolean') return fail('DeferredStartOptions');
      }
      if (request.options.initialFlags !== undefined && !isStoryRunFlags(request.options.initialFlags)) return fail('DeferredStartFlags');
      // Optional fields are absent after a JSON round trip; never accept non-JSON nested values.
      const options = Object.fromEntries(Object.entries(request.options).filter(([, value]) => value !== undefined));
      if (!isStoryFlagValue(options)) return fail('DeferredStartOptionsJSON');
    }
    const entry = registry.storyEntries.get(request.entryId);
    if (!entry || storyEntryType(entry) !== request.expectedType || !registry.stories.has(entry.storyId)) return fail('DeferredStartEntry');
    documentFingerprints(registry.stories, entry.storyId);
    const target = request.owner === null ? collection.global : collection.chats[`variant:${request.owner}`];
    const finishing = target?.finishing;
    if (!record(finishing) || !record(finishing.source) || finishing.error || !finishing.settled || finishing.source.owner !== request.owner) return fail('DeferredStartTarget');
    const source = finishing.source;
    const sourceEntry = registry.storyEntries.get(source.entryId);
    if (!sourceEntry || sourceEntry.storyId !== source.rootStoryId || !registry.stories.has(source.rootStoryId)
      || !nonEmpty(source.causalChainId) || !integer(source.handoffCount) || source.handoffCount > STORY_PLAYBACK_MAX_HANDOFFS) return fail('DeferredStartTargetSource');
  }
  if (new TextEncoder().encode(canonical(requests)).byteLength > STORY_PLAYBACK_MAX_PAYLOAD_BYTES) return fail('DeferredStartPayloadLimit');
}
