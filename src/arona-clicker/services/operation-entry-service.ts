import type { Character } from '../types/ids';
import type { PlayerState } from '../types/state';
import type { OperationRunSaveSnapshot, OperationRunRestoreFailureReason, OperationRunRestoreResult } from '../contracts/operation-save';
import type { EventRun, OperationInterventionCommand, OperationRouteCommand, OperationRunVersionCommand } from '../contracts/operation';
import type { OperationInterventionPreview } from '../contracts/operation-beat';
import type { OperationResolution } from '../contracts/operation-resolution';
import type { OperationSceneActionBatchCommand, OperationSceneActionBatchPreview } from '../contracts/operation-scene-action';
import type { OperationView } from '../contracts/operation-view';
import type { OperationAdmission } from '../contracts/operation-participant';
import type { OperationContentResolver } from '../contracts/operation-content-resolver';
import type { OperationRuntimeService } from './operation-runtime-service';
import type { CharacterSystem } from './character-system';
import type { RosterSystem } from './roster-system';
import { OperationParticipantAdmission } from './operation-participant-admission';
import { resolveOperationRunResume, resolveOperationRunStart, StudentOperationProfileResolutionError } from './student-operation-profile-resolver';
import { OperationRuntimeError } from './operation-runtime-service';

export interface OperationEntryContext {
  readonly characterSystem?: CharacterSystem;
  readonly rosterSystem?: RosterSystem;
  readonly getState?: () => PlayerState;
}

export interface OperationEntryFacade {
  start(eventId: string, characterIds: readonly Character[]): EventRun;
  getSnapshot(): EventRun | null;
  getResult(): import('../contracts/operation').EventResult | null;
  getView(expectedRunId?: string): OperationView | null;
  createSaveSnapshot(): OperationRunSaveSnapshot | null;
  restoreSaveSnapshot(snapshot: unknown): OperationRunRestoreResult;
  getLastRestoreResult(): OperationRunRestoreResult | null;
  previewIntervention(input: OperationInterventionCommand): OperationInterventionPreview;
  reviseIntervention(input: OperationInterventionCommand): EventRun;
  clearIntervention(input: OperationRunVersionCommand): EventRun;
  commitBeat(input: OperationRunVersionCommand): OperationResolution;
  previewSceneActionBatch(input: OperationSceneActionBatchCommand): OperationSceneActionBatchPreview;
  stageSceneActionBatch(input: OperationSceneActionBatchCommand): EventRun;
  clearSceneActionBatchDraft(input: OperationRunVersionCommand): EventRun;
  commitStagedSceneActionBatch(input: OperationRunVersionCommand): OperationResolution;
  commitSceneActionBatch(input: OperationSceneActionBatchCommand): OperationResolution;
  transitionRoute(input: OperationRouteCommand): EventRun;
}

export interface CreateOperationEntryOptions extends OperationEntryContext {
  readonly resolver: OperationContentResolver;
  readonly owner: OperationRuntimeService;
}

/** Returns the narrow public facade while keeping the raw owner in the service's private closure. */
export function createOperationEntry(options: CreateOperationEntryOptions): {
  readonly facade: OperationEntryFacade;
} {
  const service = new OperationEntryService(options);
  const facade: OperationEntryFacade = Object.freeze({
    start: service.start.bind(service),
    getSnapshot: service.getSnapshot.bind(service),
    getResult: service.getResult.bind(service),
    getView: service.getView.bind(service),
    createSaveSnapshot: service.createSaveSnapshot.bind(service),
    restoreSaveSnapshot: service.restoreSaveSnapshot.bind(service),
    getLastRestoreResult: service.getLastRestoreResult.bind(service),
    previewIntervention: service.previewIntervention.bind(service),
    reviseIntervention: service.reviseIntervention.bind(service),
    clearIntervention: service.clearIntervention.bind(service),
    commitBeat: service.commitBeat.bind(service),
    previewSceneActionBatch: service.previewSceneActionBatch.bind(service),
    stageSceneActionBatch: service.stageSceneActionBatch.bind(service),
    clearSceneActionBatchDraft: service.clearSceneActionBatchDraft.bind(service),
    commitStagedSceneActionBatch: service.commitStagedSceneActionBatch.bind(service),
    commitSceneActionBatch: service.commitSceneActionBatch.bind(service),
    transitionRoute: service.transitionRoute.bind(service),
  });
  return { facade };
}

class OperationEntryService {
  readonly #admission: OperationParticipantAdmission;
  readonly #owner: OperationRuntimeService;
  readonly #resolver: OperationContentResolver;
  readonly #characterSystem?: CharacterSystem;
  readonly #getState?: () => PlayerState;
  #lastRestoreResult: OperationRunRestoreResult | null = null;

  constructor(options: CreateOperationEntryOptions) {
    this.#resolver = options.resolver;
    this.#characterSystem = options.characterSystem;
    this.#getState = options.getState;
    this.#admission = new OperationParticipantAdmission({
      resolver: options.resolver,
      characterSystem: options.characterSystem,
      rosterSystem: options.rosterSystem,
      getState: options.getState,
    });
    this.#owner = options.owner;
  }

  start(eventId: string, characterIds: readonly Character[]): EventRun {
    const admission = this.#admission.admit(eventId, characterIds);
    return this.startAdmitted(admission);
  }

  private startAdmitted(admission: OperationAdmission): EventRun {
    // Admission-to-Actor materialization finishes before the owner publishes runStarted.
    return this.#owner.start(resolveOperationRunStart(admission));
  }

  getSnapshot(): EventRun | null { return this.#owner.getSnapshot(); }

  getResult(): import('../contracts/operation').EventResult | null { return this.#owner.getResult(); }

  getView(expectedRunId?: string): OperationView | null { return this.#owner.getView(expectedRunId); }

  createSaveSnapshot(): OperationRunSaveSnapshot | null { return this.#owner.createSaveSnapshot(); }

  getLastRestoreResult(): OperationRunRestoreResult | null { return this.#lastRestoreResult; }

  restoreSaveSnapshot(value: unknown): OperationRunRestoreResult {
    if (value === null || value === undefined) {
      return this.#lastRestoreResult = { status: 'none' };
    }
    if (!isRecord(value) || typeof value.eventId !== 'string' || value.eventId.trim() === ''
      || !Number.isSafeInteger(value.resumeVersion) || (value.resumeVersion as number) < 1
      || !isRecord(value.run) || value.run.eventId !== value.eventId
      || !Array.isArray(value.run.actorStates)) {
      return this.rejectRestore('invalid-snapshot', 'Operation Run save snapshot has an invalid header or run state');
    }

    const eventId = value.eventId;
    let resolved: ReturnType<OperationContentResolver['resolve']>;
    try {
      resolved = this.#resolver.resolve(eventId);
    } catch (error) {
      return this.rejectRestore('invalid-content', 'Operation content could not be resolved: ' + errorMessage(error), eventId);
    }
    if (!resolved) return this.rejectRestore('unknown-event', 'Operation Event is not available in the current Registry: ' + eventId, eventId);
      if (resolved.eventDefinition.id !== eventId) {
      return this.rejectRestore('invalid-content', 'Operation content resolver returned a different eventId', eventId);
    }
    if (resolved.eventDefinition.resumeVersion !== value.resumeVersion) {
      return this.rejectRestore('content-version-mismatch', 'Operation Event resumeVersion changed from '
        + value.resumeVersion + ' to ' + String(resolved.eventDefinition.resumeVersion), eventId);
    }
    const state = this.#getState?.();
    const requiredInitId = resolved.eventDefinition.initId;
    if (requiredInitId !== undefined && state?.activeInit !== requiredInitId) {
      return this.rejectRestore('init-mismatch', 'Operation Event requires Init ' + requiredInitId
        + ', current Init is ' + String(state?.activeInit), eventId);
    }

    let runStart: ReturnType<typeof resolveOperationRunResume>;
    try {
      runStart = resolveOperationRunResume(
        resolved,
        value.run as unknown as EventRun,
        characterId => this.#characterSystem?.exists(characterId as Character) ?? false,
      );
    } catch (error) {
      const message = errorMessage(error);
      const reason: OperationRunRestoreFailureReason = error instanceof StudentOperationProfileResolutionError
        && error.diagnostics.some(diagnostic => diagnostic.includes('unknown Character'))
        ? 'character-missing'
        : 'invalid-content';
      return this.rejectRestore(reason, message, eventId);
    }

    try {
      const run = this.#owner.restoreSaveSnapshot(value, runStart);
      return this.#lastRestoreResult = { status: 'restored', eventId, runId: run.runId };
    } catch (error) {
      const reason: OperationRunRestoreFailureReason = error instanceof OperationRuntimeError
        ? 'invalid-run'
        : 'invalid-snapshot';
      return this.rejectRestore(reason, errorMessage(error), eventId);
    }
  }

  previewIntervention(input: OperationInterventionCommand): OperationInterventionPreview {
    return this.#owner.previewIntervention(input);
  }

  reviseIntervention(input: OperationInterventionCommand): EventRun {
    return this.#owner.reviseIntervention(input);
  }

  clearIntervention(input: OperationRunVersionCommand): EventRun {
    return this.#owner.clearIntervention(input);
  }

  commitBeat(input: OperationRunVersionCommand): OperationResolution {
    return this.#owner.commitBeat(input);
  }

  previewSceneActionBatch(input: OperationSceneActionBatchCommand): OperationSceneActionBatchPreview {
    return this.#owner.previewSceneActionBatch(input);
  }

  stageSceneActionBatch(input: OperationSceneActionBatchCommand): EventRun {
    return this.#owner.stageSceneActionBatch(input);
  }

  clearSceneActionBatchDraft(input: OperationRunVersionCommand): EventRun {
    return this.#owner.clearSceneActionBatchDraft(input);
  }

  commitStagedSceneActionBatch(input: OperationRunVersionCommand): OperationResolution {
    return this.#owner.commitStagedSceneActionBatch(input);
  }

  commitSceneActionBatch(input: OperationSceneActionBatchCommand): OperationResolution {
    return this.#owner.commitSceneActionBatch(input);
  }

  transitionRoute(input: OperationRouteCommand): EventRun {
    return this.#owner.transitionRoute(input);
  }

  private rejectRestore(reason: OperationRunRestoreFailureReason, message: string, eventId = ''): OperationRunRestoreResult {
    return this.#lastRestoreResult = { status: 'rejected', eventId, reason, diagnostics: [message] };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'unknown Operation restore error';
}
