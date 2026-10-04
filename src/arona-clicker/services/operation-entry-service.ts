import type { Character } from '../types/ids';
import type { PlayerState } from '../types/state';
import type { EventRun } from '../contracts/operation';
import type { OperationAdmission } from '../contracts/operation-participant';
import type { OperationContentResolver } from '../contracts/operation-content-resolver';
import type { OperationRuntimeService } from './operation-runtime-service';
import type { CharacterSystem } from './character-system';
import type { RosterSystem } from './roster-system';
import { OperationParticipantAdmission } from './operation-participant-admission';

export interface OperationEntryContext {
  readonly characterSystem?: CharacterSystem;
  readonly rosterSystem?: RosterSystem;
  readonly getState?: () => PlayerState;
}

export interface OperationEntryFacade {
  start(eventId: string, characterIds: readonly Character[]): EventRun;
  getSnapshot(): EventRun | null;
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
  });
  return { facade };
}

class OperationEntryService {
  readonly #admission: OperationParticipantAdmission;
  readonly #owner: OperationRuntimeService;

  constructor(options: CreateOperationEntryOptions) {
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
    // U1 validates the DTO here. U2 extends this private seam to materialize its Actor/Profile
    // snapshot before the owner publishes runStarted; U1 currently starts the base EventRun.
    return this.#owner.start(admission.eventDefinition);
  }

  getSnapshot(): EventRun | null { return this.#owner.getSnapshot(); }
}
