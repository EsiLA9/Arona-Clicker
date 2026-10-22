import type {
  GameplayMapEncounterLocalsDef,
} from '../../data-services/contracts/gameplay-map-effects';
import { validateGameplayEncounterEffectSyntax } from '../../data-services/validation/gameplay-map-effect-syntax';
import type { MapEffectLocalsState, MapEffectTraceEntry } from '../contracts/map-effects';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isLocalId(value: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value);
}

function invalidLocals(message: string): never {
  throw new Error(`Invalid Encounter locals: ${message}`);
}

/** Materializes one detached, immutable locals Owner from an Encounter declaration. */
export function initializeMapEncounterLocals(
  declaration: GameplayMapEncounterLocalsDef | undefined,
): MapEffectLocalsState {
  const validation = validateGameplayEncounterEffectSyntax({ locals: declaration }, 'Encounter');
  if (!validation.ok) return invalidLocals(validation.issues.map(issue => `${issue.path}: ${issue.message}`).join('; '));
  const counters = Object.fromEntries((declaration?.counters ?? []).map(counter => [counter.id, {
    value: counter.initial,
    min: counter.min,
    max: counter.max,
  }]));
  const flags = Object.fromEntries((declaration?.flags ?? []).map(flag => [flag.id, flag.initial]));
  return copyMapEncounterLocalsState({ counters, flags }, declaration);
}

/** Validates declaration identity and returns a deeply detached immutable state. */
export function copyMapEncounterLocalsState(
  value: unknown,
  declaration?: GameplayMapEncounterLocalsDef,
): MapEffectLocalsState {
  if (declaration !== undefined) {
    const validation = validateGameplayEncounterEffectSyntax({ locals: declaration }, 'Encounter');
    if (!validation.ok) return invalidLocals(validation.issues.map(issue => `${issue.path}: ${issue.message}`).join('; '));
  }
  if (!isRecord(value) || Object.keys(value).some(key => key !== 'counters' && key !== 'flags')
    || !isRecord(value.counters) || !isRecord(value.flags)) {
    return invalidLocals('expected counter and flag records');
  }
  const counterEntries: [string, { value: number; min: number; max: number }][] = [];
  const flagEntries: [string, boolean][] = [];
  const ids = new Set<string>();
  for (const [id, rawCounter] of Object.entries(value.counters)) {
    if (!isLocalId(id) || ids.has(id) || !isRecord(rawCounter)
      || Object.keys(rawCounter).length !== 3
      || !Number.isSafeInteger(rawCounter.value) || !Number.isSafeInteger(rawCounter.min)
      || !Number.isSafeInteger(rawCounter.max) || (rawCounter.min as number) > (rawCounter.max as number)
      || (rawCounter.value as number) < (rawCounter.min as number)
      || (rawCounter.value as number) > (rawCounter.max as number)) {
      return invalidLocals(`invalid Counter state "${id}"`);
    }
    ids.add(id);
    counterEntries.push([id, Object.freeze({
      value: rawCounter.value as number,
      min: rawCounter.min as number,
      max: rawCounter.max as number,
    })]);
  }
  for (const [id, rawFlag] of Object.entries(value.flags)) {
    if (!isLocalId(id) || ids.has(id) || typeof rawFlag !== 'boolean') {
      return invalidLocals(`invalid Flag state "${id}"`);
    }
    ids.add(id);
    flagEntries.push([id, rawFlag]);
  }
  if (ids.size > 64) return invalidLocals('the declaration exceeds 64 locals');

  if (declaration !== undefined) {
    const declaredCounters = declaration.counters ?? [];
    const declaredFlags = declaration.flags ?? [];
    if (declaredCounters.length !== counterEntries.length || declaredFlags.length !== flagEntries.length) {
      return invalidLocals('state does not match its declaration');
    }
    for (const declared of declaredCounters) {
      const current = Object.fromEntries(counterEntries)[declared.id];
      if (!current || current.min !== declared.min || current.max !== declared.max) {
        return invalidLocals(`Counter "${declared.id}" does not match its declaration`);
      }
    }
    for (const declared of declaredFlags) {
      if (!Object.prototype.hasOwnProperty.call(value.flags, declared.id)) {
        return invalidLocals(`Flag "${declared.id}" does not match its declaration`);
      }
    }
  }

  return Object.freeze({
    counters: Object.freeze(Object.fromEntries(counterEntries)),
    flags: Object.freeze(Object.fromEntries(flagEntries)),
  });
}

/** Deeply detaches the U06 trace shape for immutable Preview and Commit snapshots. */
export function copyMapEffectTrace(entries: readonly MapEffectTraceEntry[]): readonly MapEffectTraceEntry[] {
  return Object.freeze(entries.map(entry => Object.freeze({
    ...entry,
    ...('identity' in entry && entry.identity ? { identity: Object.freeze({ ...entry.identity }) } : {}),
    ...('reads' in entry ? { reads: Object.freeze(entry.reads.map(read => Object.freeze({
      ...read,
      ...('identity' in read ? { identity: Object.freeze({ ...read.identity }) } : {}),
    }))) } : {}),
  }))) as readonly MapEffectTraceEntry[];
}
