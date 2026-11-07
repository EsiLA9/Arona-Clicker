import type { Effect } from '../../../engine/types/expression';
import type { StoryNodeSource } from '../../contracts/runtime/story-node-playback';
import type { StoryPresentationView } from '../../contracts/runtime/story-presentation';
import type {
  StoryOutputContent, StoryOutputSnapshot, StoryPlaybackQueueSnapshot, StoryPlaybackStep,
} from '../../../engine/contracts/story-playback-state';
import { validateStoryPlaybackSteps } from './story-playback-snapshot';

export interface StoryPlaybackClock {
  now(): number;
  schedule(callback: () => void, delayMs: number): unknown;
  cancel(handle: unknown): void;
}
export const storyPlaybackClock: StoryPlaybackClock = {
  now: () => Date.now(),
  schedule: (callback, delay) => { const handle = setTimeout(callback, delay); (handle as unknown as { unref?: () => void }).unref?.(); return handle; },
  cancel: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

interface Barrier {
  readonly source: StoryNodeSource;
  readonly token: string;
  readonly key: string;
  readonly steps: readonly StoryPlaybackStep[];
  readonly automatic: boolean;
  index: number;
  ready: boolean;
  suppressed: boolean;
  delivered: boolean;
  deadline?: number;
  timer?: unknown;
  generation: number;
}

interface CoordinatorOptions {
  readonly outputOwner?: (source: StoryNodeSource) => string | null;
  readonly clock?: StoryPlaybackClock;
  readonly transaction: (work: () => void) => void;
  readonly changed: (owner: string | null, replayId?: string) => void;
  readonly delivered: (source: StoryNodeSource) => void;
  readonly release: (source: StoryNodeSource, token: string) => void;
  readonly effect: (effect: Effect, source: StoryNodeSource) => void;
  readonly failed: (source: StoryNodeSource, error: unknown) => void;
}

const ownerKey = (owner: string | null) => owner === null ? '\u0000global' : `variant:${owner}`;
const channelKey = (owner: string | null, replayId?: string) => replayId ? `replay:${replayId}` : ownerKey(owner);
const MAX_OUTPUTS = 200;
const PUMP_BUDGET = 256;

/** Current-barrier presentation only. The Player remains the sole story cursor. */
export class StoryPlaybackCoordinator {
  private readonly clock: StoryPlaybackClock;
  private readonly barriers = new Map<string, Barrier>();
  private readonly outputs = new Map<string, StoryOutputSnapshot>();
  private readonly revisions = new Map<string, number>();
  private paused = false;
  private pumping = false;
  private readonly requestedChannels = new Map<string, { owner: string | null; replayId?: string }>();

  constructor(private readonly options: CoordinatorOptions) { this.clock = options.clock ?? storyPlaybackClock; }

  accept(source: StoryNodeSource, token: string, barrierKey: string, steps: readonly StoryPlaybackStep[], automatic: boolean): void {
    const key = channelKey(source.owner, source.replayId);
    const previous = this.barriers.get(key);
    if (previous?.key === barrierKey && previous.source.runId === source.runId) return;
    validateStoryPlaybackSteps(steps);
    this.end(source.owner, source.replayId);
    this.barriers.set(key, {
      source, token, key: barrierKey, steps: structuredClone(steps), automatic,
      index: 0, ready: false, suppressed: false, delivered: false, generation: 0,
    });
  }

  pump(owner: string | null, replayId?: string): void {
    const key = channelKey(owner, replayId);
    this.requestedChannels.set(key, { owner, ...(replayId ? { replayId } : {}) });
    if (this.pumping) return;
    this.pumping = true;
    try {
      let remaining = PUMP_BUDGET;
      while (this.requestedChannels.size && remaining-- > 0) {
        const [key, target] = this.requestedChannels.entries().next().value!;
        this.requestedChannels.delete(key);
        const barrier = this.barriers.get(key);
        try { this.pumpCurrent(key); }
        catch (error) {
          if (!barrier) throw error;
          this.end(target.owner, target.replayId);
          this.options.failed(barrier.source, error);
        }
      }
      for (const [key] of this.requestedChannels) {
        const barrier = this.barriers.get(key);
        if (barrier) this.schedule(barrier, 0);
      }
      this.requestedChannels.clear();
    } finally { this.pumping = false; }
  }

  private pumpCurrent(key: string): void {
    if (this.paused) return;
    const barrier = this.barriers.get(key);
    if (!barrier || barrier.ready) return;
    let budget = PUMP_BUDGET;
    while (this.barriers.get(key) === barrier && budget-- > 0) {
      const step = barrier.steps[barrier.index];
      if (!step) {
        barrier.ready = true;
        this.notify(barrier.source.owner, barrier.source.replayId);
        if (barrier.automatic) this.options.release(barrier.source, barrier.token);
        return;
      }
      if (step.kind === 'delay') {
        if (barrier.deadline === undefined) barrier.deadline = this.clock.now() + step.durationMs;
        const remaining = barrier.deadline - this.clock.now();
        if (remaining > 0) { this.schedule(barrier, remaining); this.notify(barrier.source.owner, barrier.source.replayId); return; }
        barrier.deadline = undefined;
        barrier.index += 1;
        continue;
      }
      // Install the completed position before synchronous read/visual notifications can reenter.
      barrier.index += 1;
      if (step.kind === 'output') {
        if (!barrier.suppressed) {
          this.append(this.options.outputOwner ? this.options.outputOwner(barrier.source) : barrier.source.owner, `${barrier.key}:${barrier.index - 1}`, barrier.source.historyId ?? barrier.source.runId ?? barrier.key, step.content, barrier.source.isReplay === false ? undefined : barrier.source.replayId);
          if (!barrier.delivered && (step.content.kind === 'talk' || step.content.kind === 'narration')) {
            barrier.delivered = true;
            this.options.delivered(barrier.source);
          }
        }
      } else {
        if (step.effect.op === 'clearAllChatFlow') this.clear(this.options.outputOwner ? this.options.outputOwner(barrier.source) : barrier.source.owner, barrier.source.isReplay === false ? undefined : barrier.source.replayId);
        this.options.effect(step.effect, barrier.source);
      }
    }
    if (this.barriers.get(key) === barrier) this.schedule(barrier, 0);
  }

  pumpAll(): void { for (const barrier of [...this.barriers.values()]) this.pump(barrier.source.owner, barrier.source.replayId); }

  private schedule(barrier: Barrier, delay: number): void {
    if (barrier.timer !== undefined) this.clock.cancel(barrier.timer);
    const generation = ++barrier.generation;
    barrier.timer = this.clock.schedule(() => this.options.transaction(() => {
      if (this.barriers.get(channelKey(barrier.source.owner, barrier.source.replayId)) !== barrier || barrier.generation !== generation) return;
      barrier.timer = undefined;
      this.pump(barrier.source.owner, barrier.source.replayId);
    }), delay);
  }

  private notify(owner: string | null, replayId?: string): void {
    const key = channelKey(owner, replayId);
    this.revisions.set(key, (this.revisions.get(key) ?? 0) + 1);
    this.options.changed(owner, replayId);
  }

  private store(owner: string | null, replayId?: string): StoryOutputSnapshot {
    return this.outputs.get(channelKey(owner, replayId)) ?? { epoch: 0, sequence: 0, entries: [] };
  }

  append(owner: string | null, id: string, historyId: string, content: StoryOutputContent, replayId?: string): void {
    const key = channelKey(owner, replayId);
    const store = this.store(owner, replayId);
    if (store.entries.some(entry => entry.id === id)) return;
    const sequence = store.sequence + 1;
    this.outputs.set(key, {
      ...store, sequence,
      entries: [...store.entries.filter(entry=>!(content.performance?.layout?.mode==='positioned' && content.node && entry.historyId===historyId && entry.node?.storyId===content.node.storyId && entry.node.nodeId===content.node.nodeId)), { ...structuredClone(content), id, sequence, historyId, timestamp: this.clock.now() }].slice(-MAX_OUTPUTS),
    });
  }

  clear(owner: string | null, replayId?: string): void {
    const key = channelKey(owner, replayId);
    const store = this.store(owner, replayId);
    this.outputs.set(key, { epoch: store.epoch + 1, sequence: store.sequence, entries: [] });
    const barrier = this.barriers.get(key);
    if (barrier?.steps[barrier.index]?.kind === 'delay' && !barrier.delivered) barrier.suppressed = true;
    this.notify(owner, replayId);
  }

  clearNode(historyId: string, target: {storyId:string;nodeId:string}): void {
    for (const [key,store] of this.outputs) this.outputs.set(key,{...store,entries:store.entries.filter(entry=>entry.historyId!==historyId||entry.node?.storyId!==target.storyId||entry.node.nodeId!==target.nodeId)});
  }

  clearPositioned(historyId: string): void {
    for (const [key,store] of this.outputs) this.outputs.set(key,{...store,entries:store.entries.filter(entry=>entry.historyId!==historyId||entry.performance?.layout?.mode!=='positioned')});
  }

  end(owner: string | null, replayId?: string): void {
    const key = channelKey(owner, replayId);
    const barrier = this.barriers.get(key);
    if (barrier?.timer !== undefined) this.clock.cancel(barrier.timer);
    if (barrier) barrier.generation += 1;
    this.barriers.delete(key);
  }

  reset(): void {
    for (const barrier of this.barriers.values()) if (barrier.timer !== undefined) this.clock.cancel(barrier.timer);
    this.barriers.clear(); this.outputs.clear(); this.revisions.clear(); this.requestedChannels.clear();
  }

  suspend(): void {
    if (this.paused) return;
    this.paused = true;
    for (const barrier of this.barriers.values()) {
      if (barrier.timer !== undefined) this.clock.cancel(barrier.timer);
      barrier.timer = undefined;
      if (barrier.deadline !== undefined) barrier.deadline = Math.max(0, barrier.deadline - this.clock.now());
      barrier.generation += 1;
    }
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    for (const barrier of this.barriers.values()) if (barrier.deadline !== undefined) barrier.deadline += this.clock.now();
    this.pumpAll();
  }

  intentToken(owner: string | null, playerToken: string, runId?: string, replayId?: string): string {
    const key = channelKey(owner, replayId);
    const barrier = this.barriers.get(key);
    return `${runId ?? barrier?.source.runId ?? ''}:${playerToken}:${barrier ? `${barrier.index}:${barrier.ready ? 'ready' : 'presenting'}` : 'input'}`;
  }

  accelerate(owner: string | null, token: string, playerToken: string, replayId?: string): boolean {
    const key = channelKey(owner, replayId);
    const barrier = this.barriers.get(key);
    const step = barrier?.steps[barrier.index];
    if (!barrier || token !== this.intentToken(owner, playerToken, barrier.source.runId, replayId) || step?.kind !== 'delay'
      || (step.phase !== 'typing' && step.phase !== 'thinking')) return false;
    barrier.deadline = Math.max(this.clock.now(), (barrier.deadline ?? this.clock.now()) - 1000);
    this.pump(owner, replayId);
    return true;
  }

  view(owner: string | null, fallback: 'idle' | 'continue' | 'input' | 'finishing' | 'failed', playerToken?: string, runId?: string, error?: string, replayId?: string): StoryPresentationView {
    const key = channelKey(owner, replayId);
    const output = this.store(owner, replayId);
    const barrier = this.barriers.get(key);
    const step = barrier?.steps[barrier.index];
    const remainingMs = barrier?.deadline === undefined ? 0 : Math.max(0, this.paused ? barrier.deadline : barrier.deadline - this.clock.now());
    return structuredClone({
      owner, ...output,
      ...(replayId ? { replayId } : {}),
      revision: this.revisions.get(key) ?? 0,
      phase: step?.kind === 'delay' ? step.phase : fallback,
      ...(playerToken ? { token: this.intentToken(owner, playerToken, runId, replayId) } : {}),
      ...(runId ? { runId } : {}), ...(error ? { error } : {}),
      ...(step?.kind === 'delay' && step.typing && !barrier?.suppressed ? { typing: step.typing } : {}),
      ...(step?.kind === 'delay' && step.phase === 'banner' ? { banner: { title: step.title ?? '', remainingMs } } : {}),
    });
  }

  saveQueue(owner: string | null, replayId?: string): StoryPlaybackQueueSnapshot | undefined {
    const barrier = this.barriers.get(channelKey(owner, replayId));
    if (!barrier) return undefined;
    return structuredClone({ key: barrier.key, steps: barrier.steps, index: barrier.index, ready: barrier.ready,
      remainingMs: barrier.deadline === undefined ? 0 : Math.max(0, this.paused ? barrier.deadline : barrier.deadline - this.clock.now()),
      suppressed: barrier.suppressed, delivered: barrier.delivered, automatic: barrier.automatic });
  }

  saveOutputs(owner: string | null, replayId?: string): StoryOutputSnapshot { return structuredClone(this.store(owner, replayId)); }

  outputOwners(): (string | null)[] { return [...this.outputs.keys()].filter(key => key === '\u0000global' || key.startsWith('variant:')).map(key => key === '\u0000global' ? null : key.slice(8)); }

  restoreQueue(source: StoryNodeSource, token: string, saved: StoryPlaybackQueueSnapshot, automatic: boolean): void {
    this.accept(source, token, saved.key, saved.steps, automatic);
    const barrier = this.barriers.get(channelKey(source.owner, source.replayId))!;
    barrier.index = saved.index; barrier.ready = saved.ready && !automatic; barrier.suppressed = saved.suppressed; barrier.delivered = saved.delivered;
    if (barrier.steps[barrier.index]?.kind === 'delay') barrier.deadline = this.paused ? saved.remainingMs : this.clock.now() + saved.remainingMs;
    if (!this.paused && !barrier.ready) this.schedule(barrier, saved.remainingMs);
  }

  restoreOutputs(owner: string | null, saved: StoryOutputSnapshot, replayId?: string): void { this.outputs.set(channelKey(owner, replayId), structuredClone(saved)); }

  discardReplay(replayId: string): void {
    const key = channelKey(null, replayId);
    const barrier = this.barriers.get(key);
    if (barrier?.timer !== undefined) this.clock.cancel(barrier.timer);
    if (barrier) barrier.generation += 1;
    this.barriers.delete(key);
    this.outputs.delete(key);
    this.revisions.delete(key);
    this.requestedChannels.delete(key);
  }
}
