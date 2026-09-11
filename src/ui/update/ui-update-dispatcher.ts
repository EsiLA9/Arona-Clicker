import type {
  UIUpdate,
  UIUpdateApplyResult,
  UIUpdateRequest,
} from './ui-update-types';
import { sameSurfaceToken, type UISurfaceToken } from './ui-surface';

export interface UIUpdateSink {
  getCurrentSurfaceToken(): UISurfaceToken;
  isSurfaceCurrent(token: UISurfaceToken): boolean;
  apply(update: UIUpdate): UIUpdateApplyResult;
  applyBatch?(updates: readonly UIUpdate[]): readonly UIUpdateApplyResult[];
  onDrop?(update: UIUpdate, reason: 'stale-surface'): void;
}

function updateIdentity(update: UIUpdate): string {
  const prefix = `${update.token.key}@${update.token.generation}:${update.type}`;
  if (update.type === 'behavior') return `${prefix}:${update.behavior}:${update.key}:${update.hostId ?? ''}`;
  if (update.type === 'region') return `${prefix}:${update.hostId}`;
  return `${prefix}:${update.scope}`;
}

function priority(update: UIUpdate): number {
  if (update.type === 'structure') return 0;
  if (update.type === 'region') return 1;
  return 2;
}

export class UIUpdateDispatcher {
  private readonly pending = new Map<string, UIUpdate>();
  private flushScheduled = false;

  constructor(private readonly sink: UIUpdateSink) {}

  request(request: UIUpdateRequest): void {
    const update = this.normalize(request);
    this.pending.set(updateIdentity(update), update);
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    queueMicrotask(() => this.flushNow());
  }

  applyNow(request: UIUpdateRequest): UIUpdateApplyResult {
    return this.dispatch(this.normalize(request));
  }

  flushNow(): void {
    this.flushScheduled = false;
    if (this.pending.size === 0) return;
    const queued = [...this.pending.values()];
    this.pending.clear();

    const eligible = queued.filter(update => {
      if (this.sink.isSurfaceCurrent(update.token)) return true;
      this.sink.onDrop?.(update, 'stale-surface');
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
      if (update.type !== 'behavior' || !update.hostId) return true;
      const hostId = update.hostId;
      return !regions.some(region =>
        sameSurfaceToken(region.token, update.token)
        && (hostId === region.hostId || hostId.startsWith(`${region.hostId}.`)),
      );
    });
  }
}
