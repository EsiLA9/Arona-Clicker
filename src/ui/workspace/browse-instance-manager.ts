/** Opaque identity for one browsing context, independent from its resource identity. */
export type BrowseInstanceId = string & { readonly __browseInstanceId: unique symbol };

export interface BrowseInstancePresentation {
  readonly title: string;
  readonly kind?: string;
  readonly icon?: string;
  readonly status?: string;
}

/** Business payload stays opaque to the manager and is interpreted by its Provider. */
export interface BrowseInstanceSeed<TState = unknown> {
  readonly providerKey: string;
  readonly resourceKey?: string;
  readonly reuseKey?: string;
  readonly state: TState;
  readonly presentation: BrowseInstancePresentation;
}

export interface BrowseInstance<TState = unknown> extends BrowseInstanceSeed<TState> {
  readonly id: BrowseInstanceId;
}

export interface BrowseInstanceSnapshot<TState = unknown> {
  instances: readonly BrowseInstance<TState>[];
  activeBrowseInstanceId?: BrowseInstanceId;
}

export type BrowseInstancePreparation<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

export type BrowseInstanceResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: 'invalid-instance' | 'not-found' | 'id-collision' | 'provider-failed'; message: string };
export type BrowseInstanceReusePreparation<TState> = (
  current: BrowseInstance<TState>,
  requested: BrowseInstanceSeed<TState>,
) => BrowseInstancePreparation<BrowseInstanceSeed<TState>>;

export type BrowseInstanceIdFactory = () => string;

const defaultIdFactory: BrowseInstanceIdFactory = () => `browse:${crypto.randomUUID()}`;

function freezeRecord<TState>(record: BrowseInstance<TState>): BrowseInstance<TState> {
  return Object.freeze({ ...record, presentation: Object.freeze({ ...record.presentation }) });
}

function isValidSeed(seed: BrowseInstanceSeed): boolean {
  return Boolean(seed && typeof seed.providerKey === 'string' && seed.providerKey.trim()
    && (seed.resourceKey === undefined || typeof seed.resourceKey === 'string')
    && (seed.reuseKey === undefined || typeof seed.reuseKey === 'string')
    && seed.presentation && typeof seed.presentation.title === 'string');
}

/**
 * Owns only the common instance registry and active id. Provider work is prepared before
 * calling a committing operation, so a rejected preparation cannot leave a partial record.
 */
export class BrowseInstanceManager<TState = unknown> {
  private readonly records = new Map<BrowseInstanceId, BrowseInstance<TState>>();
  private readonly order: BrowseInstanceId[] = [];
  private readonly activationRecency: BrowseInstanceId[] = [];
  private activeBrowseInstanceId?: BrowseInstanceId;

  constructor(private readonly makeId: BrowseInstanceIdFactory = defaultIdFactory) {}

  snapshot(): BrowseInstanceSnapshot<TState> {
    return Object.freeze({
      instances: Object.freeze(this.order.flatMap(id => {
        const record = this.records.get(id);
        return record ? [record] : [];
      })),
      activeBrowseInstanceId: this.activeBrowseInstanceId,
    });
  }

  get(id: BrowseInstanceId): BrowseInstance<TState> | undefined {
    return this.records.get(id);
  }

  get active(): BrowseInstance<TState> | undefined {
    return this.activeBrowseInstanceId ? this.records.get(this.activeBrowseInstanceId) : undefined;
  }

  get activeId(): BrowseInstanceId | undefined {
    return this.activeBrowseInstanceId;
  }

  /** Most recently activated live record for a Provider; does not change global activity. */
  lastActive(providerKey: string): BrowseInstance<TState> | undefined {
    return this.activationRecency.map(id => this.records.get(id))
      .find((record): record is BrowseInstance<TState> => Boolean(record && record.providerKey === providerKey));
  }

  findReusable(providerKey: string, reuseKey: string | undefined): BrowseInstance<TState> | undefined {
    if (reuseKey === undefined) return undefined;
    const matches = this.order.map(id => this.records.get(id))
      .filter((record): record is BrowseInstance<TState> => Boolean(record
        && record.providerKey === providerKey && record.reuseKey === reuseKey));
    return matches.find(record => record.id === this.activeBrowseInstanceId) ?? matches[0];
  }

  createPrepared(
    prepare: () => BrowseInstancePreparation<BrowseInstanceSeed<TState>>,
    activate = this.records.size === 0,
    prepareActivation?: (target: BrowseInstance<TState>, current?: BrowseInstance<TState>) => BrowseInstancePreparation<unknown>,
  ): BrowseInstanceResult<BrowseInstance<TState>> {
    let prepared: BrowseInstancePreparation<BrowseInstanceSeed<TState>>;
    try { prepared = prepare(); }
    catch (error) { return { ok: false, code: 'provider-failed', message: errorMessage(error) }; }
    if (!prepared.ok) return { ok: false, code: 'provider-failed', message: prepared.message };
    if (!isValidSeed(prepared.value)) return { ok: false, code: 'invalid-instance', message: 'Provider returned an invalid instance seed.' };

    let rawId: string;
    try { rawId = this.makeId(); }
    catch (error) { return { ok: false, code: 'provider-failed', message: errorMessage(error) }; }
    if (!rawId || this.records.has(rawId as BrowseInstanceId)) {
      return { ok: false, code: 'id-collision', message: 'The generated browse instance id is empty or already in use.' };
    }
    const record = freezeRecord({ ...prepared.value, id: rawId as BrowseInstanceId });
    this.records.set(record.id, record);
    this.order.push(record.id);
    const shouldActivate = activate || !this.activeBrowseInstanceId;
    if (shouldActivate) {
      const failure = runPreparation(prepareActivation ? () => prepareActivation(record, this.active) : undefined);
      if (failure) {
        this.removeUncommitted(record.id);
        return failure;
      }
      this.activeBrowseInstanceId = record.id;
      this.rememberActivation(record.id);
    }
    return { ok: true, value: record };
  }

  activate(id: BrowseInstanceId, prepare?: (target: BrowseInstance<TState>, current?: BrowseInstance<TState>) => BrowseInstancePreparation<unknown>): BrowseInstanceResult<BrowseInstance<TState>> {
    const target = this.records.get(id);
    if (!target) return { ok: false, code: 'not-found', message: 'The browse instance does not exist.' };
    if (id === this.activeBrowseInstanceId) return { ok: true, value: target };
    const current = this.active;
    const failure = runPreparation(prepare ? () => prepare(target, current) : undefined);
    if (failure) return failure;
    this.activeBrowseInstanceId = id;
    this.rememberActivation(id);
    return { ok: true, value: target };
  }

  openOrReuse(
    seed: BrowseInstanceSeed<TState>,
    prepareActivation?: (target: BrowseInstance<TState>, current?: BrowseInstance<TState>) => BrowseInstancePreparation<unknown>,
    prepareReuse?: BrowseInstanceReusePreparation<TState>,
  ): BrowseInstanceResult<BrowseInstance<TState>> {
    if (!isValidSeed(seed)) return { ok: false, code: 'invalid-instance', message: 'Provider returned an invalid instance seed.' };
    const existing = this.findReusable(seed.providerKey, seed.reuseKey);
    if (existing) {
      let prepared: BrowseInstancePreparation<BrowseInstanceSeed<TState>>;
      try {
        const { id: _id, ...existingSeed } = existing;
        prepared = prepareReuse ? prepareReuse(existing, seed) : { ok: true, value: existingSeed };
      }
      catch (error) { return { ok: false, code: 'provider-failed', message: errorMessage(error) }; }
      if (!prepared.ok) return { ok: false, code: 'provider-failed', message: prepared.message };
      if (!isValidSeed(prepared.value) || prepared.value.providerKey !== existing.providerKey || prepared.value.reuseKey !== existing.reuseKey) {
        return { ok: false, code: 'invalid-instance', message: 'Provider returned an invalid reused instance seed.' };
      }
      const replacement = freezeRecord({ ...prepared.value, id: existing.id });
      const failure = runPreparation(prepareActivation ? () => prepareActivation(replacement, this.active) : undefined);
      if (failure) return failure;
      this.records.set(existing.id, replacement);
      this.activeBrowseInstanceId = existing.id;
      this.rememberActivation(existing.id);
      return { ok: true, value: replacement };
    }
    return this.createPrepared(() => ({ ok: true, value: seed }), true, prepareActivation);
  }

  duplicate(
    sourceId: BrowseInstanceId,
    prepareCopy: (source: BrowseInstance<TState>) => BrowseInstancePreparation<BrowseInstanceSeed<TState>>,
    prepareActivation?: (target: BrowseInstance<TState>, current?: BrowseInstance<TState>) => BrowseInstancePreparation<unknown>,
  ): BrowseInstanceResult<BrowseInstance<TState>> {
    const source = this.records.get(sourceId);
    if (!source) return { ok: false, code: 'not-found', message: 'The source browse instance does not exist.' };
    return this.createPrepared(() => {
      const prepared = prepareCopy(source);
      if (prepared.ok && prepared.value.providerKey !== source.providerKey) {
        return { ok: false, message: 'A duplicate must remain within the source Provider.' };
      }
      return prepared;
    }, true, prepareActivation);
  }

  close(
    id: BrowseInstanceId,
    prepare?: (closing: BrowseInstance<TState>, successor?: BrowseInstance<TState>) => BrowseInstancePreparation<unknown>,
    preferredSuccessorId?: BrowseInstanceId,
  ): BrowseInstanceResult<{ closed: BrowseInstance<TState>; active?: BrowseInstance<TState> }> {
    const closing = this.records.get(id);
    if (!closing) return { ok: false, code: 'not-found', message: 'The browse instance does not exist.' };
    const index = this.order.indexOf(id);
    const isActive = id === this.activeBrowseInstanceId;
    const preferred = preferredSuccessorId && preferredSuccessorId !== id ? this.records.get(preferredSuccessorId) : undefined;
    const successorId = isActive ? preferred?.id ?? this.order[index + 1] ?? this.order[index - 1] : this.activeBrowseInstanceId;
    const successor = successorId ? this.records.get(successorId) : undefined;
    const failure = runPreparation(prepare ? () => prepare(closing, isActive ? successor : this.active) : undefined);
    if (failure) return failure;
    this.records.delete(id);
    this.order.splice(index, 1);
    this.removeActivation(id);
    if (isActive) this.activeBrowseInstanceId = successor?.id;
    if (isActive && successor) this.rememberActivation(successor.id);
    return { ok: true, value: { closed: closing, active: this.active } };
  }

  update(id: BrowseInstanceId, changes: Partial<Omit<BrowseInstance<TState>, 'id' | 'providerKey'>>): BrowseInstanceResult<BrowseInstance<TState>> {
    const current = this.records.get(id);
    if (!current) return { ok: false, code: 'not-found', message: 'The browse instance does not exist.' };
    const next = { ...current, ...changes, id: current.id, providerKey: current.providerKey };
    if (!isValidSeed(next)) return { ok: false, code: 'invalid-instance', message: 'The updated browse instance is invalid.' };
    const frozen = freezeRecord(next);
    this.records.set(id, frozen);
    return { ok: true, value: frozen };
  }

  private removeUncommitted(id: BrowseInstanceId): void {
    this.records.delete(id);
    const index = this.order.indexOf(id);
    if (index >= 0) this.order.splice(index, 1);
    this.removeActivation(id);
  }

  private rememberActivation(id: BrowseInstanceId): void {
    const index = this.activationRecency.indexOf(id);
    if (index >= 0) this.activationRecency.splice(index, 1);
    this.activationRecency.unshift(id);
  }

  private removeActivation(id: BrowseInstanceId): void {
    const index = this.activationRecency.indexOf(id);
    if (index >= 0) this.activationRecency.splice(index, 1);
  }
}

function runPreparation<T>(prepare?: () => BrowseInstancePreparation<T>): BrowseInstanceResult<never> | undefined {
  if (!prepare) return undefined;
  try {
    const result = prepare();
    return result.ok ? undefined : { ok: false, code: 'provider-failed', message: result.message };
  } catch (error) {
    return { ok: false, code: 'provider-failed', message: errorMessage(error) };
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
