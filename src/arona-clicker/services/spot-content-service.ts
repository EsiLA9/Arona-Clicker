import type { RuntimeModDraft, RuntimeModApplyResult } from '../contracts/runtime';
import type {
  RuntimeModStateSnapshot,
  RuntimeSpotInput,
  RuntimeSpotMutation,
  RuntimeSpotMutationResult,
} from '../contracts/runtime-content';

export interface SpotContentPort {
  getState(): RuntimeModStateSnapshot;
  setModMetadata(metadata: Pick<RuntimeModDraft, 'modName' | 'displayName' | 'version' | 'author' | 'description'>): RuntimeModApplyResult;
  applyMutation(mutation: RuntimeSpotMutation): RuntimeSpotMutationResult;
}

/** SpotService 的内容编辑窄门面：每次只提交一个 Spot，不接收整包 Draft。 */
export class SpotContentService {
  constructor(private readonly port: SpotContentPort) {}

  getState(): RuntimeModStateSnapshot {
    return this.port.getState();
  }

  setModMetadata(metadata: Pick<RuntimeModDraft, 'modName' | 'displayName' | 'version' | 'author' | 'description'>): RuntimeModApplyResult {
    return this.port.setModMetadata(metadata);
  }

  applyMutation(mutation: RuntimeSpotMutation): RuntimeSpotMutationResult {
    return this.port.applyMutation(mutation);
  }

  create(modName: string, spot: RuntimeSpotInput, expectedRevision: number): RuntimeSpotMutationResult {
    return this.applyMutation({ operation: 'create', modName, spot, expectedRevision });
  }

  replace(modName: string, idName: string, spot: RuntimeSpotInput, expectedRevision: number): RuntimeSpotMutationResult {
    return this.applyMutation({ operation: 'replace', modName, idName, spot, expectedRevision });
  }

  delete(modName: string, idName: string, playerData: 'retain' | 'purge', expectedRevision: number): RuntimeSpotMutationResult {
    return this.applyMutation({ operation: 'delete', modName, idName, playerData, expectedRevision });
  }

  suspend(modName: string, idName: string, expectedRevision: number): RuntimeSpotMutationResult {
    return this.applyMutation({ operation: 'suspend', modName, idName, expectedRevision });
  }

  resume(modName: string, idName: string, expectedRevision: number): RuntimeSpotMutationResult {
    return this.applyMutation({ operation: 'resume', modName, idName, expectedRevision });
  }
}
