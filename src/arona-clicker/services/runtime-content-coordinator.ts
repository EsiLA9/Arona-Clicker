import {
  applyAuthoringMutation,
  authoringEntityId,
  buildAuthoringDef,
  cloneAuthoringDef,
  requireContentPolicy,
  validateAuthoringFieldValue,
  validateAuthoringInput,
  type AuthoringMutationReceipt,
  type AuthoringMutationRequest,
  type AuthoringProblem,
  type ContentAuthoringPolicy,
} from '../../data-services/authoring/content-policy';
import type { DefinitionChange, DefinitionResolutionStatus } from '../../data-services/definition/definition-types';
import type { SpotDef } from '../../data-services/contracts/world';
import { Registry } from '../../data-services/registry/registry';
import type {
  RuntimeContentCoordinatorOptions,
  RuntimeContentCoordinatorSettings,
  RuntimeContentDiagnostic,
  RuntimeContentDiagnosticCode,
  RuntimeModStateSnapshot,
  RuntimeSpotCommit,
  RuntimeSpotMutation,
  RuntimeSpotMutationResult,
  RuntimeSpotRollbackContext,
} from '../contracts/runtime-content';

export type {
  RuntimeContentCoordinatorOptions,
  RuntimeContentCoordinatorSettings,
  RuntimeContentDiagnostic,
  RuntimeContentDiagnosticCode,
  RuntimeModStateSnapshot,
  RuntimeSpotCommit,
  RuntimeSpotInput,
  RuntimeSpotMutation,
  RuntimeSpotMutationResult,
  RuntimeSpotRollbackContext,
} from '../contracts/runtime-content';

const RUNTIME_MOD_PATTERN = /^[a-z0-9-]+$/;
const SPOT_CONTENT_KEY = 'spots' as const;
const SPOT_POLICY = requireContentPolicy(SPOT_CONTENT_KEY);

function spotEntityId(modName: string, idName: string): string {
  return authoringEntityId(SPOT_POLICY, modName, idName);
}

interface PreparedMutation {
  readonly mutation: RuntimeSpotMutation;
  readonly request: AuthoringMutationRequest;
  readonly modName: string;
  readonly spotId: string;
  readonly previousSpot: SpotDef | undefined;
  readonly currentSpot: SpotDef | undefined;
  readonly transition: DefinitionChange;
}

interface PreparedFailure {
  readonly diagnostic: RuntimeContentDiagnostic;
  readonly spotId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function definitionChange(spotId: string, before: DefinitionResolutionStatus, after: DefinitionResolutionStatus): DefinitionChange {
  return { key: { table: 'spots', id: spotId }, before, after };
}

function diagnostic(
  code: RuntimeContentDiagnosticCode,
  message: string,
  path?: string,
): RuntimeContentDiagnostic {
  return path === undefined ? { code, message } : { code, path, message };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function failure(
  code: RuntimeContentDiagnosticCode,
  message: string,
  path?: string,
  spotId = '',
): PreparedFailure {
  return { diagnostic: diagnostic(code, message, path), spotId };
}

/** 由策略表产生的问题直接派生失败结果：路径与文案都归策略表所有。 */
function policyFailure(policy: ContentAuthoringPolicy, problem: AuthoringProblem, modName: string, idName = ''): PreparedFailure {
  return { diagnostic: diagnostic(problem.code, problem.message, problem.path), spotId: authoringEntityId(policy, modName, idName) };
}

export class RuntimeContentCoordinator {
  private readonly registry: Registry;
  private readonly sourceId: string;
  private readonly onCommitted: ((commit: RuntimeSpotCommit) => void) | undefined;
  private readonly onRollback: ((context: RuntimeSpotRollbackContext) => void) | undefined;
  private readonly spots = new Map<string, SpotDef>();
  private readonly suspendedSpotIds = new Set<string>();
  private modName: string | null;
  private revision = 0;

  constructor(options: RuntimeContentCoordinatorOptions);
  constructor(registry: Registry, settings?: RuntimeContentCoordinatorSettings);
  constructor(
    registryOrOptions: Registry | RuntimeContentCoordinatorOptions,
    settings: RuntimeContentCoordinatorSettings = {},
  ) {
    const options = registryOrOptions instanceof Registry
      ? { registry: registryOrOptions, ...settings }
      : registryOrOptions;
    const configuredModName = options.modName ?? options.temporaryModName;
    if (options.modName !== undefined && options.temporaryModName !== undefined && options.modName !== options.temporaryModName) {
      throw new Error('RuntimeContentCoordinator 的 modName 与 temporaryModName 不得冲突');
    }
    if (configuredModName !== undefined && !RUNTIME_MOD_PATTERN.test(configuredModName)) {
      throw new Error(`临时 Mod 名称格式无效：${configuredModName}`);
    }
    if (!options.sourceId?.trim() && options.sourceId !== undefined) {
      throw new Error('RuntimeContentCoordinator 的 sourceId 不能为空');
    }

    this.registry = options.registry;
    this.sourceId = options.sourceId?.trim() || 'runtime-editor';
    this.onCommitted = options.onCommitted;
    this.onRollback = options.onRollback;
    this.modName = configuredModName ?? null;
  }

  getRevision(): number {
    return this.revision;
  }

  getRuntimeModState(): RuntimeModStateSnapshot {
    return {
      modName: this.modName,
      sourceId: this.sourceId,
      spots: new Map([...this.spots].map(([id, spot]) => [id, cloneAuthoringDef(spot)])),
      suspendedSpotIds: new Set(this.suspendedSpotIds),
      revision: this.revision,
    };
  }

  getState(): RuntimeModStateSnapshot {
    return this.getRuntimeModState();
  }

  /** 完整 Runtime 重载或临时 Mod 关闭后清除热内容会话状态。 */
  reset(): void {
    this.spots.clear();
    this.suspendedSpotIds.clear();
    this.modName = null;
    this.revision = 0;
  }

  /** 迁移旧的整包临时 Mod 路径后，将当前 Registry 内容接管为热 CRUD 会话。 */
  adoptRuntimeMod(modName: string, spotIds: readonly string[], suspendedSpotIds: readonly string[] = []): void {
    if (!RUNTIME_MOD_PATTERN.test(modName)) throw new Error(`临时 Mod 名称格式无效：${modName}`);
    this.reset();
    this.modName = modName;
    for (const rawId of spotIds) {
      const spotId = rawId.includes(':') ? rawId : spotEntityId(modName, rawId);
      const spot = this.registry.spotIncludingSuspended(spotId);
      if (spot && this.registry.spotOwnerOf(spotId) === modName) this.spots.set(spotId, cloneAuthoringDef(spot));
    }
    for (const rawId of suspendedSpotIds) {
      const spotId = rawId.includes(':') ? rawId : spotEntityId(modName, rawId);
      if (this.spots.has(spotId)) this.suspendedSpotIds.add(spotId);
    }
  }

  submit(mutation: RuntimeSpotMutation): RuntimeSpotMutationResult {
    return this.applySpotMutation(mutation);
  }

  applySpotMutation(mutation: RuntimeSpotMutation): RuntimeSpotMutationResult {
    const rawMutation: Record<string, unknown> = isRecord(mutation) ? mutation : {};
    const rawSpot = isRecord(rawMutation.spot) ? rawMutation.spot : undefined;
    const operation = typeof rawMutation.operation === 'string'
      ? rawMutation.operation as RuntimeSpotMutation['operation']
      : 'create';
    const spotId = typeof rawMutation.modName === 'string'
      ? spotEntityId(rawMutation.modName, typeof rawMutation.idName === 'string' ? rawMutation.idName : typeof rawSpot?.idName === 'string' ? rawSpot.idName : '')
      : '';

    const prepared = this.prepare(mutation);
    if ('diagnostic' in prepared) {
      return {
        ok: false,
        revision: this.revision,
        spotId: prepared.spotId,
        operation,
        diagnostics: [prepared.diagnostic],
        message: prepared.diagnostic.message,
      };
    }

    let receipt: AuthoringMutationReceipt;
    try {
      receipt = applyAuthoringMutation(this.registry, prepared.request);
    } catch (error) {
      const message = `Spot 热内容提交被 Registry 拒绝：${errorMessage(error)}`;
      return {
        ok: false,
        revision: this.revision,
        spotId: prepared.spotId,
        operation: prepared.mutation.operation,
        diagnostics: [diagnostic('registry-rejected', message)],
        message,
      };
    }

    const commit: RuntimeSpotCommit = {
      mutation: prepared.mutation,
      operation: prepared.mutation.operation,
      modName: prepared.modName,
      spotId: prepared.spotId,
      previousSpot: prepared.previousSpot ? cloneAuthoringDef(prepared.previousSpot) : undefined,
      currentSpot: prepared.currentSpot ? cloneAuthoringDef(prepared.currentSpot) : undefined,
      playerData: prepared.mutation.operation === 'delete' ? prepared.mutation.playerData : undefined,
      revisionBefore: this.revision,
      revisionAfter: this.revision + 1,
      transition: prepared.transition,
    };

    try {
      this.onCommitted?.(commit);
    } catch (error) {
      let registryRollbackError: unknown;
      try {
        receipt.rollback();
      } catch (rollbackError) {
        registryRollbackError = rollbackError;
      }
      try {
        this.onRollback?.({ commit, error, registryRollbackError });
      } catch {
        // Rollback observers must not hide the original commit failure.
      }
      const message = registryRollbackError === undefined
        ? `Spot 热内容提交失败，已回滚：${errorMessage(error)}`
        : `Spot 热内容提交失败，Registry 回滚也失败：${errorMessage(error)}；${errorMessage(registryRollbackError)}`;
      const diagnostics = [diagnostic('commit-failed', message)];
      if (registryRollbackError !== undefined) diagnostics.push(diagnostic('rollback-failed', `Registry 回滚失败：${errorMessage(registryRollbackError)}`));
      return {
        ok: false,
        revision: this.revision,
        spotId: prepared.spotId,
        operation: prepared.mutation.operation,
        diagnostics,
        message,
      };
    }

    this.commitState(prepared);
    return {
      ok: true,
      revision: this.revision,
      spotId: prepared.spotId,
      operation: prepared.mutation.operation,
      transition: prepared.transition,
      diagnostics: [],
      message: `Spot 热内容已提交：${prepared.mutation.operation} ${prepared.spotId}`,
    };
  }

  private prepare(mutation: RuntimeSpotMutation): PreparedMutation | PreparedFailure {
    const policy = SPOT_POLICY;
    if (!isRecord(mutation) || typeof mutation.operation !== 'string') {
      return failure('invalid-operation', 'Spot 热内容命令必须包含合法 operation');
    }

    const operation = mutation.operation;
    if (!['create', 'replace', 'delete', 'suspend', 'resume'].includes(operation)) {
      return failure('invalid-operation', `不支持的 Spot 热内容操作：${operation}`);
    }
    if (typeof mutation.modName !== 'string' || !RUNTIME_MOD_PATTERN.test(mutation.modName)) {
      return failure('invalid-mod-name', '临时 Mod 名称必须匹配 [a-z0-9-]+', 'modName');
    }
    if (!Number.isInteger(mutation.expectedRevision) || mutation.expectedRevision < 0) {
      return failure('invalid-revision', 'expectedRevision 必须是非负整数', 'expectedRevision', authoringEntityId(policy, mutation.modName, ''));
    }
    if (mutation.expectedRevision !== this.revision) {
      return failure('stale-revision', `Spot 热内容提交已过期：期望 revision ${mutation.expectedRevision}，当前为 ${this.revision}`, 'expectedRevision', authoringEntityId(policy, mutation.modName, ''));
    }

    if (this.modName !== null && mutation.modName !== this.modName) {
      return failure('mod-conflict', `当前已有临时 Mod：${this.modName}，不能提交 ${mutation.modName}`, undefined, authoringEntityId(policy, mutation.modName, ''));
    }
    if (this.modName === null && operation !== 'create') {
      return failure('spot-not-found', '当前没有可操作的临时 Mod Spot', undefined, authoringEntityId(policy, mutation.modName, ''));
    }
    if (this.revision === 0 && this.registry.loadedModNames.has(mutation.modName)) {
      return failure('mod-conflict', `modName 已被当前 Registry 占用：${mutation.modName}`, undefined, authoringEntityId(policy, mutation.modName, ''));
    }

    if (operation === 'create' || operation === 'replace') {
      if (!isRecord(mutation.spot)) {
        return failure('invalid-field', 'Spot 输入必须是对象', policy.inputPrefix);
      }
      const input = mutation.spot;
      const problem = validateAuthoringInput(policy, input);
      if (problem) {
        const idName = typeof input.idName === 'string' ? input.idName : '';
        return policyFailure(policy, problem, mutation.modName, idName);
      }
      const idName = String(input.idName);
      if (operation === 'replace' && mutation.idName !== idName) {
        return failure('invalid-spot-id', 'replace 的 idName 必须与 spot.idName 一致', 'idName', authoringEntityId(policy, mutation.modName, idName));
      }
      const spotId = authoringEntityId(policy, mutation.modName, idName);
      const currentSpot = this.spots.get(spotId);
      if (operation === 'create' && currentSpot) {
        return failure('spot-not-owned', `临时 Mod 中已存在 Spot：${spotId}`, undefined, spotId);
      }
      if (operation === 'replace' && !currentSpot) {
        return failure('spot-not-found', `当前临时 Mod 不拥有 Spot：${spotId}`, undefined, spotId);
      }
      const nextSpot = buildAuthoringDef(policy, mutation.modName, input) as SpotDef;
      return {
        mutation,
        request: { table: SPOT_CONTENT_KEY, operation, ownerModName: mutation.modName, defId: spotId, def: nextSpot },
        modName: mutation.modName,
        spotId,
        previousSpot: currentSpot,
        currentSpot: nextSpot,
        transition: definitionChange(spotId, operation === 'create' ? 'missing' : 'resolved', 'resolved'),
      };
    }

    const idName = mutation.idName;
    const idProblem = validateAuthoringFieldValue(policy, 'idName', idName);
    if (idProblem) {
      return policyFailure(policy, idProblem, mutation.modName, typeof idName === 'string' ? idName : '');
    }
    const spotId = authoringEntityId(policy, mutation.modName, idName);
    if (operation === 'suspend' || operation === 'resume') {
      const previousSpot = this.spots.get(spotId);
      if (!previousSpot) {
        return failure('spot-not-found', `当前临时 Mod 不拥有 Spot：${spotId}`, undefined, spotId);
      }
      if (operation === 'suspend' && this.suspendedSpotIds.has(spotId)) {
        return failure('spot-not-owned', `Spot 已经挂起：${spotId}`, undefined, spotId);
      }
      if (operation === 'resume' && !this.suspendedSpotIds.has(spotId)) {
        return failure('spot-not-found', `Spot 当前未挂起：${spotId}`, undefined, spotId);
      }
      return {
        mutation,
        request: { table: SPOT_CONTENT_KEY, operation, ownerModName: mutation.modName, defId: spotId },
        modName: mutation.modName,
        spotId,
        previousSpot,
        currentSpot: previousSpot,
        transition: definitionChange(spotId, operation === 'suspend' ? 'resolved' : 'suspended', operation === 'suspend' ? 'suspended' : 'resolved'),
      };
    }
    if (mutation.playerData !== 'retain' && mutation.playerData !== 'purge') {
      return failure('invalid-field', 'delete 的 playerData 必须是 retain 或 purge', 'playerData', spotId);
    }
    if (!this.spots.has(spotId)) {
      return failure('spot-not-found', `当前临时 Mod 不拥有 Spot：${spotId}`, undefined, spotId);
    }
    const previousSpot = this.spots.get(spotId);
    return {
      mutation,
      request: { table: SPOT_CONTENT_KEY, operation: 'delete', ownerModName: mutation.modName, defId: spotId },
      modName: mutation.modName,
      spotId,
      previousSpot,
      currentSpot: undefined,
      transition: definitionChange(spotId, this.suspendedSpotIds.has(spotId) ? 'suspended' : 'resolved', 'missing'),
    };
  }

  private commitState(prepared: PreparedMutation): void {
    this.modName = prepared.modName;
    if (prepared.mutation.operation === 'delete') {
      this.spots.delete(prepared.spotId);
      this.suspendedSpotIds.delete(prepared.spotId);
    } else if (prepared.mutation.operation === 'suspend') {
      this.suspendedSpotIds.add(prepared.spotId);
    } else if (prepared.mutation.operation === 'resume') {
      this.suspendedSpotIds.delete(prepared.spotId);
    } else {
      this.spots.set(prepared.spotId, cloneAuthoringDef(prepared.currentSpot!));
      this.suspendedSpotIds.delete(prepared.spotId);
    }
    this.revision++;
  }
}
