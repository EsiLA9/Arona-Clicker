import type { StoryAction, StoryTransfer } from '../../../data-services/contracts/story-node-actions';
import type { StoryClickNode, StoryContent, StoryNodeDocument, StoryNodeResult, StoryTalkletNode } from '../../../data-services/contracts/story-node';
import { validateStoryNodeStructure } from '../../../data-services/validation/story-node-structure';
import type { StoryNodeSnapshot } from '../../../engine/contracts/story-node-snapshot';
import type {
  StoryNodeCommandResult, StoryNodeDocuments, StoryNodePlaybackEvent, StoryNodePlaybackHost,
  StoryNodePlaybackView, StoryNodeSource,
} from '../../contracts/runtime/story-node-playback';

type Pending = { token: string } & (
  | { kind: 'delivery'; node: StoryTalkletNode }
  | { kind: 'input'; node: StoryClickNode; press?: { total: number; done: number } }
);
interface Run {
  readonly source: StoryNodeSource;
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

  start(storyId: string, source: { entryId: string; owner: string | null; runId?: string; historyId?: string }): StoryNodeCommandResult {
    return this.command(events => {
      if (this.run) return 'AlreadyActive';
      this.document(storyId);
      this.run = {
        source: { ...source, rootStoryId: storyId }, storyId, terminalStoryId: storyId, index: 0,
        transfers: 0, waitSequence: 0, visited: new Set([storyId]), stack: [],
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

  /** 仅在等待边界保存，避免同步Effect回调保存半个动作后读档重放。 */
  save(): StoryNodeSnapshot {
    if (this.busy) throw new Error('Busy');
    const run = this.run;
    if (!run) return { format: 'story-nodes', run: null };
    if (!run.pending) throw new Error('NotAtCheckpoint');
    return structuredClone({ format: 'story-nodes', run: {
      source: run.source, storyId: run.storyId, nodeId: run.pending.node.id,
      terminalStoryId: run.terminalStoryId, transfers: run.transfers, waitSequence: run.waitSequence, visited: [...run.visited],
      stack: run.stack.map(frame => ({ storyId: frame.storyId,
        nextNodeId: this.document(frame.storyId).nodes[frame.index]?.id ?? null })),
      pending: { kind: run.pending.kind, ...(run.pending.kind === 'input' && run.pending.press ? { press: run.pending.press } : {}) },
    } });
  }

  /** 验证后原子替换等待点；不推进、不执行动作、不抽随机，票据重新生成。 */
  restore(snapshot: StoryNodeSnapshot): void {
    if (this.busy) throw new Error('Busy');
    const bad = (): never => { throw new Error('InvalidSnapshot'); };
    if (snapshot?.format !== 'story-nodes') bad();
    const saved = structuredClone(snapshot.run);
    if (saved === null) { this.cancel(); return; }
    if (!saved || !saved.source || typeof saved.source.entryId !== 'string' || !saved.source.entryId.trim()
      || !(saved.source.owner === null || typeof saved.source.owner === 'string' && saved.source.owner.trim())
      || !Number.isSafeInteger(saved.transfers) || saved.transfers < 0 || saved.transfers > 32
      || !Number.isSafeInteger(saved.waitSequence) || saved.waitSequence < 1
      || !Array.isArray(saved.visited) || saved.visited.length > 33 || !Array.isArray(saved.stack)
      || saved.stack.length > saved.transfers || !saved.pending) bad();
    const visited = new Set(saved.visited);
    if (visited.size !== saved.visited.length || !visited.has(saved.source.rootStoryId)
      || !visited.has(saved.storyId) || !visited.has(saved.terminalStoryId)) bad();
    for (const id of visited) this.document(id);
    const document = this.document(saved.storyId);
    const index = document.nodes.findIndex(node => node.id === saved.nodeId);
    const node = document.nodes[index];
    if (!node || node.type !== 'talklet' && node.type !== 'click') return bad();
    const expectedKind = node.type === 'talklet' ? 'delivery' : 'input';
    if (saved.pending.kind !== expectedKind) bad();
    const definition = node.type === 'click' && node.interaction.kind === 'button' ? node.interaction.press : undefined;
    const press = saved.pending.press;
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
    const pending: Pending = node.type === 'talklet'
      ? { kind: 'delivery', token: this.token(), node }
      : { kind: 'input', token: this.token(), node, ...(press ? { press } : {}) };
    this.run = { source: saved.source, storyId: saved.storyId, index, terminalStoryId: saved.terminalStoryId,
      transfers: saved.transfers, waitSequence: saved.waitSequence, visited, stack, pending };
    this.terminal = { status: 'running' };
  }

  /** 允许同步事件取消本链；正在执行的旧命令会在端口返回后停止。 */
  cancel(): void {
    this.run = undefined;
    this.terminal = { status: 'idle' };
    this.ticket += 1;
  }

  ackDelivery(token: string): StoryNodeCommandResult {
    return this.command(events => {
      const run = this.run;
      if (!run || run.pending?.token !== token) return 'StaleToken';
      if (run.pending.kind !== 'delivery') return 'DeliveryNotPending';
      run.pending = undefined;
      run.index += 1;
      this.drain(run, events);
      if (this.terminal.status === 'idle') return 'Cancelled';
    });
  }

  submit(token: string, optionId?: string): StoryNodeCommandResult {
    return this.command(events => {
      const run = this.run;
      if (!run || run.pending?.token !== token) return 'StaleToken';
      const pending = run.pending;
      if (pending.kind !== 'input') return 'InputNotReady';
      const interaction = pending.node.interaction;
      let actions: readonly StoryAction[] = [];
      let result: StoryNodeResult | undefined;
      let reply: StoryContent | undefined;
      if (interaction.kind === 'choice') {
        const option = interaction.options.find(candidate => candidate.id === optionId);
        if (!option) return 'InvalidOption';
        if (option.condition && !this.host.evaluate(option.condition, [...run.visited])) return 'OptionUnavailable';
        result = option.result;
        reply = option.reply;
        actions = [...(interaction.sharedActions ?? []), ...(result?.actions ?? [])];
      } else {
        if (optionId !== undefined) return 'InvalidOption';
        if (interaction.kind === 'button') {
          result = interaction.result;
          reply = interaction.reply;
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
        const error = this.host.preflight(action, run.source);
        if (error) return error;
        if (this.run !== run) return 'Cancelled';
      }
      run.pending = undefined; // 在调用同步领域服务之前消费旧输入。
      const disposition = this.apply(run, actions);
      if (disposition === 'cancelled') return 'Cancelled';
      if (reply) events.push({ type: 'reply', source: run.source, storyId: run.storyId, clickId: pending.node.id, content: reply });
      if (disposition === 'replaced') {
        events.push({ type: 'replaced', source: run.source });
        return;
      }
      if (result?.transfer) this.transfer(run, result.transfer);
      else run.index += 1;
      this.drain(run, events);
      if (this.terminal.status === 'idle') return 'Cancelled';
    });
  }

  private token(): string { return `player-${this.playerId}:${++this.ticket}`; }
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
      if (this.run) { this.run = undefined; this.terminal = { status: 'failed', error: text }; }
      return structuredClone({ ok: false, error: text, view: this.view(), events });
    } finally { this.busy = false; }
  }

  private view(): StoryNodePlaybackView {
    const run = this.run;
    const pending = run?.pending;
    if (!run || !pending) return this.terminal;
    if (pending.kind === 'delivery') return { status: 'delivery', token: pending.token, storyId: run.storyId, sequence: run.waitSequence, node: pending.node };
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

  private transfer(run: Run, transfer: StoryTransfer): void {
    this.prepareTransfer(run, transfer);
    if (transfer.mode === 'insert') run.stack.push({ storyId: run.storyId, index: run.index + 1 });
    run.storyId = transfer.storyId;
    run.index = 0;
    run.transfers += 1;
    run.visited.add(transfer.storyId);
    run.terminalStoryId = transfer.storyId;
  }

  private apply(run: Run, actions: readonly StoryAction[]): 'applied' | 'replaced' | 'cancelled' {
    for (const action of actions) {
      if (this.run !== run) return 'cancelled';
      const result = this.host.execute(action, run.source);
      if (this.run !== run) return 'cancelled';
      if (result.status === 'rejected') throw new Error(result.error);
      if (result.status === 'replaced') {
        this.run = undefined;
        this.terminal = { status: 'replaced' };
        return 'replaced';
      }
    }
    return this.run === run ? 'applied' : 'cancelled';
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
      else {
        const error = this.host.preflight(node.action, run.source);
        if (error) throw new Error(error);
        if (this.run !== run) return;
        const disposition = this.apply(run, [node.action]);
        if (disposition === 'replaced') events.push({ type: 'replaced', source: run.source });
        if (disposition !== 'applied') return;
        run.index += 1;
      }
    }
  }
}
