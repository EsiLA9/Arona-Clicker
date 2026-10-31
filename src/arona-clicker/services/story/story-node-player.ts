import type { StoryAction, StoryTransfer } from '../../../data-services/contracts/story-node-actions';
import type { StoryClickNode, StoryNodeDocument, StoryNodeResult, StoryOperationNode, StoryTalkletNode } from '../../../data-services/contracts/story-node';
import { validateStoryNodeStructure } from '../../../data-services/validation/story-node-structure';
import { isStoryFlagValue, isStoryLocalFlagAction, isStoryRunFlags } from '../../../data-services/validation/story-run-flags';
import type { StoryFlagValue, StoryRunFlags } from '../../../engine/contracts/story-run-flags';
import type { StoryNodePresentationData, StoryNodeSnapshot } from '../../../engine/contracts/story-node-snapshot';
import type {
  StoryNodeCommandResult, StoryNodeDocuments, StoryNodePlaybackEvent, StoryNodePlaybackHost,
  StoryNodePlaybackView, StoryNodeSource,
} from '../../contracts/runtime/story-node-playback';

type Pending = { token: string } & (
  | { kind: 'delivery'; node: StoryTalkletNode }
  | { kind: 'operation'; node: StoryOperationNode; data: StoryNodePresentationData }
  | { kind: 'result'; node: StoryClickNode; data: StoryNodePresentationData; continuation: { transfer?: StoryTransfer } }
  | { kind: 'input'; node: StoryClickNode; press?: { total: number; done: number } }
);
interface Run {
  readonly source: StoryNodeSource;
  readonly localFlags: Map<string, StoryFlagValue>;
  storyId: string;
  index: number;
  terminalStoryId: string;
  transfers: number;
  waitSequence: number;
  readonly visited: Set<string>;
  readonly stack: { storyId: string; index: number }[];
  pending?: Pending;
}
let nextPlayerId = 0;
const emptyData = (): StoryNodePresentationData => ({ receipts: [], presentation: [], order: [] });
const hasData = (data: StoryNodePresentationData): boolean => data.receipts.length > 0 || data.presentation.length > 0;
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

function isPresentationData(value: unknown): value is StoryNodePresentationData {
  if (!record(value) || !Array.isArray(value.receipts) || !Array.isArray(value.presentation) || !Array.isArray(value.order) || !isStoryFlagValue(value)) return false;
  if (Object.keys(value).some(key => !['receipts', 'presentation', 'order'].includes(key))) return false;
  const receipts = value.receipts;
  const presentation = value.presentation;
  const seen = new Set<string>();
  if (value.order.length !== receipts.length + presentation.length || !value.order.every(item => {
    if (!record(item) || !['receipt', 'presentation'].includes(String(item.kind)) || !Number.isSafeInteger(item.index) || Number(item.index) < 0) return false;
    const length = item.kind === 'receipt' ? receipts.length : presentation.length;
    const key = `${item.kind}:${item.index}`;
    if (Number(item.index) >= length || seen.has(key)) return false;
    seen.add(key);
    return true;
  })) return false;
  return value.receipts.every(receipt => record(receipt) && Number.isSafeInteger(receipt.effectIndex) && Number(receipt.effectIndex) >= 0
    && typeof receipt.op === 'string' && typeof receipt.target === 'string' && ['changed', 'noop'].includes(String(receipt.status))
    && (receipt.delta === undefined || typeof receipt.delta === 'number'))
    && value.presentation.every(effect => record(effect) && typeof effect.op === 'string' && typeof effect.target === 'string' && 'value' in effect);
}

function errorData(error: unknown): StoryNodePresentationData {
  if (!record(error)) return emptyData();
  const candidate = record(error.data) ? error.data : error;
  const receipts = Array.isArray(candidate.receipts) ? structuredClone(candidate.receipts) : [];
  const presentation = Array.isArray(candidate.presentation) ? structuredClone(candidate.presentation) : [];
  return { receipts, presentation, order: Array.isArray(candidate.order) ? structuredClone(candidate.order)
    : [...receipts.map((_, index) => ({ kind: 'receipt' as const, index })), ...presentation.map((_, index) => ({ kind: 'presentation' as const, index }))] };
}

/** 新节点同步内存播放器；不解释旧Talklet，不持久化，也不结算旧Entry。 */
export class StoryNodePlayer {
  private readonly documents: Map<string, StoryNodeDocument>;
  private readonly validated = new Set<string>();
  private readonly playerId = ++nextPlayerId;
  private ticket = 0;
  private busy = false;
  private run?: Run;
  private terminal: StoryNodePlaybackView = { status: 'idle' };

  constructor(documents: StoryNodeDocuments, private readonly host: StoryNodePlaybackHost) {
    this.documents = new Map([...documents].map(([id, document]) => [id, structuredClone(document)]));
  }

  start(storyId: string, source: Omit<StoryNodeSource, 'rootStoryId'>, initialFlags: StoryRunFlags = {}): StoryNodeCommandResult {
    return this.command(events => {
      if (this.run) return 'AlreadyActive';
      if (!isStoryRunFlags(initialFlags)) return 'InvalidLocalFlags';
      this.document(storyId);
      this.run = {
        source: { ...source, rootStoryId: storyId }, storyId, terminalStoryId: storyId, index: 0,
        transfers: 0, waitSequence: 0, visited: new Set([storyId]), stack: [],
        localFlags: new Map(Object.entries(structuredClone(initialFlags))),
      };
      this.terminal = { status: 'running' };
      this.drain(this.run, events);
      if (this.terminal.status === 'idle') return 'Cancelled';
    });
  }

  /** 查询不初始化随机工作量，也不执行操作；返回隔离副本。 */
  getView(): StoryNodePlaybackView {
    return structuredClone(this.view());
  }

  /** Read-only presence check for display hints; values stay inside the run. */
  hasLocalFlag(name: string): boolean { return this.run?.localFlags.has(name) ?? false; }

  setOwner(owner: string | null): void { if (this.run) this.run.source.owner = owner; }

  /** 仅在等待边界保存，避免同步Effect回调保存半个动作后读档重放。 */
  save(): StoryNodeSnapshot {
    if (this.busy) throw new Error('Busy');
    const run = this.run;
    if (!run) return { format: 'story-nodes-v2', run: null };
    if (!run.pending) throw new Error('NotAtCheckpoint');
    const { token: _token, node: _node, ...pending } = run.pending;
    return structuredClone({ format: 'story-nodes-v2', run: {
      source: run.source, storyId: run.storyId, nodeId: run.pending.node.id,
      localFlags: Object.fromEntries(run.localFlags),
      terminalStoryId: run.terminalStoryId, transfers: run.transfers, waitSequence: run.waitSequence, visited: [...run.visited],
      stack: run.stack.map(frame => ({ storyId: frame.storyId,
        nextNodeId: this.document(frame.storyId).nodes[frame.index]?.id ?? null })),
      pending,
    } });
  }

  /** 验证后原子替换等待点；不推进、不执行动作、不抽随机，票据重新生成。 */
  restore(snapshot: StoryNodeSnapshot): void {
    if (this.busy) throw new Error('Busy');
    const bad = (): never => { throw new Error('InvalidSnapshot'); };
    if (snapshot?.format !== 'story-nodes-v2') bad();
    if (snapshot.run !== null && (!snapshot.run || !isStoryRunFlags(snapshot.run.localFlags))) bad();
    const saved = structuredClone(snapshot.run);
    if (saved === null) { this.cancel(); return; }
    if (!saved || !saved.source || typeof saved.source.entryId !== 'string' || !saved.source.entryId.trim()
      || !(saved.source.owner === null || typeof saved.source.owner === 'string' && saved.source.owner.trim())
      || (saved.source.causalChainId !== undefined && (typeof saved.source.causalChainId !== 'string' || !saved.source.causalChainId.trim()))
      || (saved.source.handoffCount !== undefined && (!Number.isSafeInteger(saved.source.handoffCount) || saved.source.handoffCount < 0))
      || !Number.isSafeInteger(saved.transfers) || saved.transfers < 0 || saved.transfers > 32
      || !Number.isSafeInteger(saved.waitSequence) || saved.waitSequence < 1
      || !Array.isArray(saved.visited) || saved.visited.length > 33 || !Array.isArray(saved.stack)
      || saved.stack.length > saved.transfers || !saved.pending || !isStoryRunFlags(saved.localFlags)) bad();
    const visited = new Set(saved.visited);
    if (visited.size !== saved.visited.length || !visited.has(saved.source.rootStoryId)
      || !visited.has(saved.storyId) || !visited.has(saved.terminalStoryId)) bad();
    for (const id of visited) this.document(id);
    const document = this.document(saved.storyId);
    const index = document.nodes.findIndex(node => node.id === saved.nodeId);
    const node = document.nodes[index];
    if (!node || node.type !== 'talklet' && node.type !== 'click' && node.type !== 'operation') return bad();
    const savedPending = saved.pending;
    const pendingKeys = savedPending.kind === 'input' ? ['kind', 'press'] : savedPending.kind === 'result'
      ? ['kind', 'data', 'continuation'] : savedPending.kind === 'operation' ? ['kind', 'data'] : ['kind'];
    if (Object.keys(savedPending).some(key => !pendingKeys.includes(key))) bad();
    if (node.type === 'talklet' ? savedPending.kind !== 'delivery'
      : node.type === 'operation' ? savedPending.kind !== 'operation'
        : savedPending.kind !== 'input' && savedPending.kind !== 'result') bad();
    if (savedPending.kind === 'operation' || savedPending.kind === 'result') {
      if (!isPresentationData(savedPending.data)) bad();
    }
    if (savedPending.kind === 'result') {
      if (!hasData(savedPending.data) || !record(savedPending.continuation)) bad();
      if (Object.keys(savedPending.continuation).some(key => key !== 'transfer')) bad();
      const transfer = savedPending.continuation.transfer;
      if (transfer !== undefined) {
        if (!record(transfer) || !['goto', 'insert'].includes(transfer.mode) || typeof transfer.storyId !== 'string' || saved.transfers >= 32) bad();
        this.document(transfer.storyId);
      }
      const click = node.type === 'click' ? node : bad();
      const interaction = click.interaction;
      const transfers = interaction.kind === 'button' ? [interaction.result?.transfer]
        : interaction.kind === 'choice' ? interaction.options.map(option => option.result?.transfer) : [undefined];
      if (!transfers.some(candidate => candidate === undefined ? transfer === undefined
        : candidate.storyId === transfer?.storyId && candidate.mode === transfer.mode)) bad();
    }
    const definition = savedPending.kind === 'input' && node.type === 'click' && node.interaction.kind === 'button' ? node.interaction.press : undefined;
    const press = savedPending.kind === 'input' ? savedPending.press : undefined;
    if (Boolean(definition) !== Boolean(press)) bad();
    if (press && definition && (!Number.isSafeInteger(press.total) || !Number.isSafeInteger(press.done)
      || press.total < definition.base || press.total > definition.base + Math.max(0, (definition.rand ?? 0) - 1)
      || press.done < 0 || press.done >= press.total)) bad();
    const stack = saved.stack.map(frame => {
      if (!frame || !visited.has(frame.storyId)) return bad();
      const parent = this.document(frame.storyId);
      const next = frame.nextNodeId === null ? parent.nodes.length : parent.nodes.findIndex(item => item.id === frame.nextNodeId);
      if (next < 0) return bad();
      return { storyId: frame.storyId, index: next };
    });
    const pending = { ...savedPending, token: this.token(), node } as Pending;
    this.run = { source: saved.source, storyId: saved.storyId, index, terminalStoryId: saved.terminalStoryId,
      transfers: saved.transfers, waitSequence: saved.waitSequence, visited, stack, pending,
      localFlags: new Map(Object.entries(saved.localFlags)) };
    this.terminal = { status: 'running' };
  }

  /** 允许同步事件取消本链；正在执行的旧命令会在端口返回后停止。 */
  cancel(): void {
    this.run = undefined;
    this.terminal = { status: 'idle' };
    this.ticket += 1;
  }

  ackDelivery(token: string, causalChainId?: string): StoryNodeCommandResult {
    return this.command(events => {
      const run = this.run;
      if (!run || run.pending?.token !== token) return 'StaleToken';
      const pending = run.pending;
      if (pending.kind === 'input') return 'DeliveryNotPending';
      if (causalChainId) Object.assign(run.source, { causalChainId, handoffCount: 0 });
      run.pending = undefined;
      if (pending.kind === 'result' && pending.continuation.transfer) this.transfer(run, pending.continuation.transfer, true);
      else run.index += 1;
      this.drain(run, events);
      if (this.terminal.status === 'idle') return 'Cancelled';
    });
  }

  submit(token: string, optionId?: string, causalChainId?: string): StoryNodeCommandResult {
    return this.command(events => {
      const run = this.run;
      if (!run || run.pending?.token !== token) return 'StaleToken';
      const pending = run.pending;
      if (pending.kind !== 'input') return 'InputNotReady';
      const interaction = pending.node.interaction;
      let actions: readonly StoryAction[] = [];
      let result: StoryNodeResult | undefined;
      if (interaction.kind === 'choice') {
        const option = interaction.options.find(candidate => candidate.id === optionId);
        if (!option) return 'InvalidOption';
        if (option.condition && !this.host.evaluate(option.condition, [...run.visited])) return 'OptionUnavailable';
        result = option.result;
        actions = [...(interaction.sharedActions ?? []), ...(result?.actions ?? [])];
      } else {
        if (optionId !== undefined) return 'InvalidOption';
        if (interaction.kind === 'button') {
          result = interaction.result;
          actions = result?.actions ?? [];
          if (pending.press && pending.press.done + 1 < pending.press.total) {
            pending.press.done += 1;
            pending.token = this.token();
            return;
          }
        } else {
          actions = [{ kind: 'entryRequest', request: interaction.card.request }];
        }
      }
      // 整个被选分支先检查可解析性；拒绝不消费输入票据或执行任何动作。
      if (result?.transfer) {
        try { this.prepareTransfer(run, result.transfer); }
        catch (error) { return this.errorText(error); }
      }
      for (const action of actions) {
        const error = this.preflight(action, run.source);
        if (error) return error;
        if (this.run !== run) return 'Cancelled';
      }
      if (causalChainId) Object.assign(run.source, { causalChainId, handoffCount: 0 });
      run.pending = undefined; // 在调用同步领域服务之前消费旧输入。
      const applied = this.apply(run, actions);
      if (applied.status === 'cancelled') return 'Cancelled';
      if (applied.status === 'replaced') {
        events.push({ type: 'replaced', source: run.source });
        return;
      }
      if (hasData(applied.data)) {
        run.waitSequence += 1;
        run.pending = { kind: 'result', token: this.token(), node: pending.node, data: applied.data,
          continuation: result?.transfer ? { transfer: structuredClone(result.transfer) } : {} };
        events.push({ type: 'view', view: this.view() });
        return;
      }
      if (result?.transfer) this.transfer(run, result.transfer, true);
      else run.index += 1;
      this.drain(run, events);
      if (this.terminal.status === 'idle') return 'Cancelled';
    });
  }

  private token(): string { return `player-${this.playerId}:${++this.ticket}`; }
  private preflight(action: StoryAction, source: StoryNodeSource): string | undefined {
    return action.kind === 'localFlag' ? isStoryLocalFlagAction(action) ? undefined : 'InvalidLocalFlagAction'
      : this.host.preflight(action, source);
  }
  private errorText(error: unknown): string { return error instanceof Error ? error.message : String(error); }

  private command(work: (events: StoryNodePlaybackEvent[]) => string | void): StoryNodeCommandResult {
    if (this.busy) return { ok: false, error: 'Busy', view: this.getView(), events: [] };
    this.busy = true;
    const events: StoryNodePlaybackEvent[] = [];
    try {
      const error = work(events);
      return structuredClone({ ok: !error, ...(error ? { error } : {}), view: this.view(), events });
    } catch (error) {
      const text = this.errorText(error);
      // 取消已经作废来源时，不允许旧回调把idle再覆盖成失败的新链。
      if (this.run) { this.run = undefined; this.terminal = { status: 'failed', error: text, data: errorData(error) }; }
      return structuredClone({ ok: false, error: text, view: this.view(), events });
    } finally { this.busy = false; }
  }

  private view(): StoryNodePlaybackView {
    const run = this.run;
    const pending = run?.pending;
    if (!run || !pending) return this.terminal;
    if (pending.kind === 'delivery') return { status: 'delivery', token: pending.token, storyId: run.storyId, sequence: run.waitSequence, node: pending.node };
    if (pending.kind === 'operation') return { status: 'operation', token: pending.token, storyId: run.storyId, sequence: run.waitSequence, node: pending.node, data: pending.data };
    if (pending.kind === 'result') return { status: 'result', token: pending.token, storyId: run.storyId, sequence: run.waitSequence, node: pending.node, data: pending.data };
    const interaction = pending.node.interaction;
    return {
      status: 'input', token: pending.token, storyId: run.storyId, sequence: run.waitSequence, node: pending.node,
      availableOptionIds: interaction.kind === 'choice'
        ? interaction.options.filter(option => !option.condition || this.host.evaluate(option.condition, [...run.visited])).map(option => option.id)
        : [],
      ...(pending.press ? { press: pending.press } : {}),
    };
  }

  private document(id: string): StoryNodeDocument {
    const document = this.documents.get(id);
    if (!document) throw new Error('DocumentNotFound');
    if (document.id !== id) throw new Error('DocumentIdentityMismatch');
    if (!this.validated.has(id)) {
      const validation = validateStoryNodeStructure(document);
      if (!validation.ok) throw new Error(`InvalidDocument:${validation.issues[0].path}`);
      this.validated.add(id);
    }
    return document;
  }

  private prepareTransfer(run: Run, transfer: StoryTransfer): void {
    if (run.transfers >= 32) throw new Error('TransferLimitExceeded');
    this.document(transfer.storyId);
    const error = this.host.preflightTransfer?.(transfer, run.source);
    if (error) throw new Error(error);
  }

  private transfer(run: Run, transfer: StoryTransfer, accepted = false): void {
    if (!accepted) this.prepareTransfer(run, transfer);
    if (transfer.mode === 'insert') run.stack.push({ storyId: run.storyId, index: run.index + 1 });
    run.storyId = transfer.storyId;
    run.index = 0;
    run.transfers += 1;
    run.visited.add(transfer.storyId);
    run.terminalStoryId = transfer.storyId;
  }

  private apply(run: Run, actions: readonly StoryAction[]): { status: 'applied' | 'replaced' | 'cancelled'; data: StoryNodePresentationData } {
    const receipts: StoryNodePresentationData['receipts'][number][] = [];
    const presentation: StoryNodePresentationData['presentation'][number][] = [];
    const order: StoryNodePresentationData['order'][number][] = [];
    const data = { receipts, presentation, order };
    const append = (next: StoryNodePresentationData) => {
      for (const item of next.order) order.push({ ...item, index: item.index + (item.kind === 'receipt' ? receipts.length : presentation.length) });
      receipts.push(...structuredClone(next.receipts));
      presentation.push(...structuredClone(next.presentation));
    };
    try {
      for (const action of actions) {
        if (this.run !== run) return { status: 'cancelled', data };
        if (action.kind === 'localFlag') {
          if (!isStoryLocalFlagAction(action)) throw new Error('InvalidLocalFlagAction');
          if (action.op === 'set') run.localFlags.set(action.name, structuredClone(action.value));
          else run.localFlags.delete(action.name);
          continue;
        }
        const result = this.host.execute(action, run.source);
        if (this.run !== run) return { status: 'cancelled', data };
        append(errorData(result));
        if (result.status === 'rejected') throw new Error(result.error);
        if (result.status === 'replaced') {
          this.run = undefined;
          this.terminal = { status: 'replaced' };
          return { status: 'replaced', data };
        }
      }
      return { status: this.run === run ? 'applied' : 'cancelled', data };
    } catch (error) {
      append(errorData(error));
      throw Object.assign(new Error(this.errorText(error)), { data });
    }
  }

  private drain(run: Run, events: StoryNodePlaybackEvent[]): void {
    let remaining = 256;
    while (this.run === run) {
      const document = this.document(run.storyId);
      if (run.index >= document.nodes.length) {
        const frame = run.stack.pop();
        if (frame) { run.storyId = frame.storyId; run.index = frame.index; continue; }
        const completion = { ...run.source, terminalStoryId: run.terminalStoryId };
        this.run = undefined;
        this.terminal = { status: 'completed', completion };
        events.push({ type: 'completed', completion });
        return;
      }
      if (remaining-- <= 0) throw new Error('AutoStepLimitExceeded');
      const node = document.nodes[run.index];
      run.terminalStoryId = run.storyId;
      if (node.requiresFlag !== undefined && !run.localFlags.has(node.requiresFlag)) { run.index += 1; continue; }
      if (node.type === 'talklet' || node.type === 'click') {
        run.waitSequence += 1;
        if (node.type === 'talklet') run.pending = { kind: 'delivery', token: this.token(), node };
        else {
          const press = node.interaction.kind === 'button' ? node.interaction.press : undefined;
          let total = press?.base ?? 1;
          if (press?.rand) {
            const random = this.host.random();
            if (!Number.isFinite(random) || random < 0 || random >= 1) throw new Error('InvalidRandom');
            total += Math.floor(random * press.rand);
          }
          run.pending = { kind: 'input', token: this.token(), node, ...(press ? { press: { total, done: 0 } } : {}) };
        }
        events.push({ type: 'view', view: this.view() });
        return;
      }
      if (node.type === 'transfer') this.transfer(run, node.transfer);
      else if (node.type === 'moveToArea' || node.type === 'moveToCharaspace') {
        const result = this.host.move?.(node, run.source) ?? { status: 'rejected' as const, error: 'StorySpaceMovementUnavailable' };
        if (result.status === 'rejected') throw new Error(result.error);
        if (result.status === 'replaced') {
          this.run = undefined;
          this.terminal = { status: 'replaced' };
          events.push({ type: 'replaced', source: run.source });
          return;
        }
        run.source.owner = node.type === 'moveToCharaspace' ? node.characterId : null;
        run.index += 1;
      } else {
        // Replays reproduce dialogue and movement, never arbitrary Story Operation side effects.
        if (run.source.replayId) { run.index += 1; continue; }
        const error = this.preflight(node.action, run.source);
        if (error) throw new Error(error);
        if (this.run !== run) return;
        const applied = this.apply(run, [node.action]);
        if (applied.status === 'replaced') events.push({ type: 'replaced', source: run.source });
        if (applied.status !== 'applied') return;
        if (node.action.kind !== 'localFlag') {
          run.waitSequence += 1;
          run.pending = { kind: 'operation', token: this.token(), node, data: applied.data };
          events.push({ type: 'view', view: this.view() });
          return;
        }
        run.index += 1;
      }
    }
  }
}
