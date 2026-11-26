import type {
  UIUpdate,
  UIUpdateApplyResult,
  UIUpdateRequest,
} from './ui-update-types';
import { sameSurfaceToken, type UISurfaceToken } from './ui-surface';
import type { ColumnToken } from '../workspace/workspace-columns';

export interface UIUpdateSink {
  getCurrentSurfaceToken(): UISurfaceToken;
  isSurfaceCurrent(token: UISurfaceToken): boolean;
  /** Optional so legacy sinks can keep host-scoped updates without owning column lifecycle. */
  isColumnCurrent?(token: ColumnToken): boolean;
  apply(update: UIUpdate): UIUpdateApplyResult;
  applyBatch?(updates: readonly UIUpdate[]): readonly UIUpdateApplyResult[];
  onDrop?(update: UIUpdate, reason: 'stale-surface' | 'stale-column'): void;
}

type ColumnScopedUpdate = Extract<UIUpdate, { type: 'region' | 'element' }>;

function columnInstanceId(update: ColumnScopedUpdate): string | undefined {
  return update.instanceId ?? update.columnToken?.instanceId;
}

function hasValidColumnIdentity(update: ColumnScopedUpdate): boolean {
  const instanceId = columnInstanceId(update);
  return !update.columnToken || update.columnToken.instanceId === instanceId;
}

function sameColumnMount(left: ColumnScopedUpdate, right: ColumnScopedUpdate): boolean {
  const leftInstanceId = columnInstanceId(left);
  const rightInstanceId = columnInstanceId(right);
  if (!leftInstanceId && !rightInstanceId) return true;
  if (!leftInstanceId || leftInstanceId !== rightInstanceId) return false;
  if (!left.columnToken && !right.columnToken) return true;
  return Boolean(left.columnToken && right.columnToken
    && left.columnToken.instanceId === right.columnToken.instanceId
    && left.columnToken.generation === right.columnToken.generation);
}

function updateIdentity(update: UIUpdate): string {
  const prefix = `${update.token.key}@${update.token.generation}:${update.type}`;
  if (update.type === 'behavior') return `${prefix}:${update.behavior}:${update.key}:${update.hostId ?? ''}`;
  if (update.type === 'element') {
    const instanceId = columnInstanceId(update) ?? '';
    const columnGeneration = update.columnToken?.generation ?? '';
    return `${prefix}:${update.target}:${update.key}:${instanceId}:${columnGeneration}:${update.hostId ?? ''}`;
  }
  if (update.type === 'region') {
    const instanceId = columnInstanceId(update) ?? '';
    const columnGeneration = update.columnToken?.generation ?? '';
    return `${prefix}:${update.hostId}:${instanceId}:${columnGeneration}`;
  }
  return `${prefix}:${update.scope}`;
}

function priority(update: UIUpdate): number {
  if (update.type === 'structure') return 0;
  if (update.type === 'region') return 1;
  if (update.type === 'element') return 2;
  return 3;
}

export class UIUpdateDispatcher {
  private readonly pending = new Map<string, UIUpdate>();
  private flushScheduled = false;
  private disposed = false;

  constructor(private readonly sink: UIUpdateSink) {}

  dispose(): void {
    this.disposed = true;
    this.pending.clear();
    this.flushScheduled = false;
  }

  request(request: UIUpdateRequest): void {
    if (this.disposed) return;
    const update = this.normalize(request);
    this.pending.set(updateIdentity(update), update);
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    queueMicrotask(() => this.flushNow());
  }

  applyNow(request: UIUpdateRequest): UIUpdateApplyResult {
    if (this.disposed) return 'not-found';
    return this.dispatch(this.normalize(request));
  }

  flushNow(): void {
    if (this.disposed) return;
    this.flushScheduled = false;
    if (this.pending.size === 0) return;
    const queued = [...this.pending.values()];
    this.pending.clear();

    const surfaceEligible = queued.filter(update => {
      if (this.sink.isSurfaceCurrent(update.token)) return true;
      this.sink.onDrop?.(update, 'stale-surface');
      return false;
    });
    const eligible = surfaceEligible.filter(update => {
      if (update.type !== 'region' && update.type !== 'element') return true;
      if (!hasValidColumnIdentity(update)) {
        this.sink.onDrop?.(update, 'stale-column');
        return false;
      }
      if (!update.columnToken || !this.sink.isColumnCurrent || this.sink.isColumnCurrent(update.columnToken)) return true;
      this.sink.onDrop?.(update, 'stale-column');
      return false;
    });
    if (eligible.length === 0) return;

    const effective = this.reduceByRegion(this.reduceByStructure(eligible)).sort((left, right) => priority(left) - priority(right));
    if (this.sink.applyBatch) {
      this.sink.applyBatch(effective);
      return;
    }
    for (const update of effective) this.sink.apply(update);
  }

  private normalize(request: UIUpdateRequest): UIUpdate {
    const token = request.token ?? this.sink.getCurrentSurfaceToken();
    const reason = request.reason ?? request.type;
    return { ...request, token: { ...token }, reason } as UIUpdate;
  }

  private dispatch(update: UIUpdate): UIUpdateApplyResult {
    if (!this.sink.isSurfaceCurrent(update.token)) {
      this.sink.onDrop?.(update, 'stale-surface');
      return 'not-found';
    }
    if ((update.type === 'region' || update.type === 'element')
      && (!hasValidColumnIdentity(update)
        || (update.columnToken && this.sink.isColumnCurrent && !this.sink.isColumnCurrent(update.columnToken)))) {
      this.sink.onDrop?.(update, 'stale-column');
      return 'not-found';
    }
    return this.sink.apply(update);
  }

  private reduceByStructure(updates: UIUpdate[]): UIUpdate[] {
    const structure = updates.find(update => update.type === 'structure' && update.scope === 'app');
    if (structure) return [structure];
    const workspaceStructure = updates.find(update => update.type === 'structure' && update.scope === 'workspace');
    if (!workspaceStructure) return updates;
    return [workspaceStructure];
  }

  private reduceByRegion(updates: UIUpdate[]): UIUpdate[] {
    const regions = updates.filter((update): update is Extract<UIUpdate, { type: 'region' }> => update.type === 'region');
    if (regions.length === 0) return updates;
    return updates.filter(update => {
      if ((update.type !== 'behavior' && update.type !== 'element') || !update.hostId) return true;
      const hostId = update.hostId;
      return !regions.some(region => {
        if (!sameSurfaceToken(region.token, update.token)) return false;
        if (update.type === 'element' && (columnInstanceId(region) || columnInstanceId(update))) {
          // A column refresh covers its own element work, regardless of the theme host
          // name; never let an ambiguous or different display instance cover it.
          return sameColumnMount(region, update);
        }
        return hostId === region.hostId || hostId.startsWith(`${region.hostId}.`);
      });
    });
  }
}
