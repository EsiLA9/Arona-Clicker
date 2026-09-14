import type { DefinitionChange, DefinitionResolutionStatus } from '../../data-services/definition/definition-types';
import type { SpotDef } from '../../data-services/contracts/world';
import { Registry } from '../../data-services/registry/registry';
import type { RegistrySpotMutation, RegistrySpotMutationReceipt } from '../../data-services/registry/registry-spot-mutation';
import { parseEntityId } from '../../engine/core/entity-id';
import type {
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
const SPOT_NAME_PATTERN = /^[a-z0-9_-]+$/;
const RUNTIME_SPOT_FIELDS = [
  'idName',
  'areaId',
  'name',
  'description',
  'baseCost',
  'baseCostResource',
  'baseYield',
  'baseYieldResource',
  'baseCapacity',
] as const;

interface PreparedMutation {
  readonly mutation: RuntimeSpotMutation;
  readonly registryMutation: RegistrySpotMutation;
  readonly modName: string;
  readonly spotId: string;
  readonly previousSpot: SpotDef | undefined;
  readonly currentSpot: SpotDef | undefined;
  readonly transition: DefinitionChange;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function cloneSpot(spot: SpotDef): SpotDef {
  return {
    ...spot,
    baseCost: { ...spot.baseCost },
    baseYield: { ...spot.baseYield },
    tags: [...spot.tags],
    levelUpgrades: spot.levelUpgrades?.map(upgrade => ({ ...upgrade, effects: [...upgrade.effects] })),
  };
}

function constantExpression(value: number): SpotDef['baseCost'] {
  return { type: 'const', value };
}

function fullSpotId(modName: string, idName: string): string {
  return `${modName}:spot:${idName}`;
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
      spots: new Map([...this.spots].map(([id, spot]) => [id, cloneSpot(spot)])),
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
      const spotId = rawId.includes(':') ? rawId : fullSpotId(modName, rawId);
      const spot = this.registry.spotIncludingSuspended(spotId);
      if (spot && this.registry.spotOwnerOf(spotId) === modName) this.spots.set(spotId, cloneSpot(spot));
    }
    for (const rawId of suspendedSpotIds) {
      const spotId = rawId.includes(':') ? rawId : fullSpotId(modName, rawId);
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
      ? fullSpotId(rawMutation.modName, typeof rawMutation.idName === 'string' ? rawMutation.idName : typeof rawSpot?.idName === 'string' ? rawSpot.idName : '')
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

    let receipt: RegistrySpotMutationReceipt;
    try {
      receipt = this.registry.applySpotMutation(prepared.registryMutation);
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
      previousSpot: prepared.previousSpot ? cloneSpot(prepared.previousSpot) : undefined,
      currentSpot: prepared.currentSpot ? cloneSpot(prepared.currentSpot) : undefined,
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

  private prepare(mutation: RuntimeSpotMutation): PreparedMutation | { readonly diagnostic: RuntimeContentDiagnostic; readonly spotId: string } {
    if (!isRecord(mutation) || typeof mutation.operation !== 'string') {
      return { diagnostic: diagnostic('invalid-operation', 'Spot 热内容命令必须包含合法 operation'), spotId: '' };
    }

    const operation = mutation.operation;
    if (!['create', 'replace', 'delete', 'suspend', 'resume'].includes(operation)) {
      return { diagnostic: diagnostic('invalid-operation', `不支持的 Spot 热内容操作：${operation}`), spotId: '' };
    }
    if (typeof mutation.modName !== 'string' || !RUNTIME_MOD_PATTERN.test(mutation.modName)) {
      return { diagnostic: diagnostic('invalid-mod-name', '临时 Mod 名称必须匹配 [a-z0-9-]+', 'modName'), spotId: '' };
    }
    if (!Number.isInteger(mutation.expectedRevision) || mutation.expectedRevision < 0) {
      return { diagnostic: diagnostic('invalid-revision', 'expectedRevision 必须是非负整数', 'expectedRevision'), spotId: fullSpotId(mutation.modName, '') };
    }
    if (mutation.expectedRevision !== this.revision) {
      return { diagnostic: diagnostic('stale-revision', `Spot 热内容提交已过期：期望 revision ${mutation.expectedRevision}，当前为 ${this.revision}`, 'expectedRevision'), spotId: fullSpotId(mutation.modName, '') };
    }

    if (this.modName !== null && mutation.modName !== this.modName) {
      return { diagnostic: diagnostic('mod-conflict', `当前已有临时 Mod：${this.modName}，不能提交 ${mutation.modName}`), spotId: fullSpotId(mutation.modName, '') };
    }
    if (this.modName === null && operation !== 'create') {
      return { diagnostic: diagnostic('spot-not-found', '当前没有可操作的临时 Mod Spot'), spotId: fullSpotId(mutation.modName, '') };
    }
    if (this.revision === 0 && this.registry.loadedModNames.has(mutation.modName)) {
      return { diagnostic: diagnostic('mod-conflict', `modName 已被当前 Registry 占用：${mutation.modName}`), spotId: fullSpotId(mutation.modName, '') };
    }

    if (operation === 'create' || operation === 'replace') {
      if (!isRecord(mutation.spot)) {
        return { diagnostic: diagnostic('invalid-field', 'Spot 输入必须是对象', 'spot'), spotId: fullSpotId(mutation.modName, '') };
      }
      const inputDiagnostic = this.validateSpotInput(mutation.spot);
      if (inputDiagnostic) {
        return { diagnostic: inputDiagnostic, spotId: fullSpotId(mutation.modName, typeof mutation.spot.idName === 'string' ? mutation.spot.idName : '') };
      }
      if (operation === 'replace' && mutation.idName !== mutation.spot.idName) {
        return { diagnostic: diagnostic('invalid-spot-id', 'replace 的 idName 必须与 spot.idName 一致', 'idName'), spotId: fullSpotId(mutation.modName, mutation.spot.idName) };
      }
      const idName = mutation.spot.idName;
      const spotId = fullSpotId(mutation.modName, idName);
      const currentSpot = this.spots.get(spotId);
      if (operation === 'create' && currentSpot) {
        return { diagnostic: diagnostic('spot-not-owned', `临时 Mod 中已存在 Spot：${spotId}`), spotId };
      }
      if (operation === 'replace' && !currentSpot) {
        return { diagnostic: diagnostic('spot-not-found', `当前临时 Mod 不拥有 Spot：${spotId}`), spotId };
      }
      const nextSpot = this.toSpotDef(mutation.spot, mutation.modName);
      return {
        mutation,
        registryMutation: operation === 'create'
          ? { operation: 'create', ownerModName: mutation.modName, spot: nextSpot }
          : { operation: 'replace', ownerModName: mutation.modName, spot: nextSpot },
        modName: mutation.modName,
        spotId,
        previousSpot: currentSpot,
        currentSpot: nextSpot,
        transition: definitionChange(spotId, operation === 'create' ? 'missing' : 'resolved', 'resolved'),
      };
    }

    const idName = mutation.idName;
    const idDiagnostic = this.validateIdName(idName);
    if (idDiagnostic) return { diagnostic: idDiagnostic, spotId: fullSpotId(mutation.modName, typeof idName === 'string' ? idName : '') };
    const spotId = fullSpotId(mutation.modName, idName);
    if (operation === 'suspend' || operation === 'resume') {
      const previousSpot = this.spots.get(spotId);
      if (!previousSpot) {
        return { diagnostic: diagnostic('spot-not-found', `当前临时 Mod 不拥有 Spot：${spotId}`), spotId };
      }
      if (operation === 'suspend' && this.suspendedSpotIds.has(spotId)) {
        return { diagnostic: diagnostic('spot-not-owned', `Spot 已经挂起：${spotId}`), spotId };
      }
      if (operation === 'resume' && !this.suspendedSpotIds.has(spotId)) {
        return { diagnostic: diagnostic('spot-not-found', `Spot 当前未挂起：${spotId}`), spotId };
      }
      return {
        mutation,
        registryMutation: { operation, ownerModName: mutation.modName, spotId },
        modName: mutation.modName,
        spotId,
        previousSpot,
        currentSpot: previousSpot,
        transition: definitionChange(spotId, operation === 'suspend' ? 'resolved' : 'suspended', operation === 'suspend' ? 'suspended' : 'resolved'),
      };
    }
    if (mutation.playerData !== 'retain' && mutation.playerData !== 'purge') {
      return { diagnostic: diagnostic('invalid-field', 'delete 的 playerData 必须是 retain 或 purge', 'playerData'), spotId };
    }
    if (!this.spots.has(spotId)) {
      return { diagnostic: diagnostic('spot-not-found', `当前临时 Mod 不拥有 Spot：${spotId}`), spotId };
    }
    const previousSpot = this.spots.get(spotId);
    return {
      mutation,
      registryMutation: { operation: 'delete', ownerModName: mutation.modName, spotId },
      modName: mutation.modName,
      spotId,
      previousSpot,
      currentSpot: undefined,
      transition: definitionChange(spotId, this.suspendedSpotIds.has(spotId) ? 'suspended' : 'resolved', 'missing'),
    };
  }

  private validateSpotInput(input: Record<string, unknown>): RuntimeContentDiagnostic | undefined {
    const allowed = new Set<string>(RUNTIME_SPOT_FIELDS);
    const extraField = Object.keys(input).find(key => !allowed.has(key));
    if (extraField) {
      return diagnostic('invalid-field', `Spot 字段不在首阶段白名单中：${extraField}；不接受 functionalities、gachaPools、color/theme 或复杂引用`, `spot.${extraField}`);
    }
    for (const field of RUNTIME_SPOT_FIELDS) {
      if (!(field in input)) return diagnostic('invalid-field', `Spot 缺少字段：${field}`, `spot.${field}`);
    }
    const idDiagnostic = this.validateIdName(input.idName);
    if (idDiagnostic) return idDiagnostic;
    for (const field of ['areaId', 'baseCostResource', 'baseYieldResource'] as const) {
      if (typeof input[field] !== 'string' || !input[field].trim()) {
        return diagnostic('invalid-field', `${field} 必须是非空字符串`, `spot.${field}`);
      }
    }
    const area = parseEntityId(input.areaId as string);
    if (!area || area.type !== 'area') {
      return diagnostic('invalid-field', `areaId 必须是完整 Area ID：${input.areaId}`, 'spot.areaId');
    }
    for (const field of ['name', 'description'] as const) {
      if (typeof input[field] !== 'string' || (field === 'name' && !input[field].trim())) {
        return diagnostic('invalid-field', `${field} 必须是${field === 'name' ? '非空' : ''}字符串`, `spot.${field}`);
      }
    }
    for (const field of ['baseCost', 'baseYield', 'baseCapacity'] as const) {
      if (typeof input[field] !== 'number' || !Number.isFinite(input[field]) || input[field] < 0) {
        return diagnostic('invalid-field', `${field} 必须是非负有限数字`, `spot.${field}`);
      }
    }
    return undefined;
  }

  private validateIdName(idName: unknown): RuntimeContentDiagnostic | undefined {
    if (typeof idName !== 'string' || !SPOT_NAME_PATTERN.test(idName)) {
      return diagnostic('invalid-spot-id', 'Spot idName 必须是非空 [a-z0-9_-]+ 名称，不能传入完整实体 ID', 'idName');
    }
    return undefined;
  }

  private toSpotDef(input: RuntimeSpotInput, modName: string): SpotDef {
    return {
      id: fullSpotId(modName, input.idName),
      areaId: input.areaId.trim(),
      name: input.name.trim(),
      description: input.description.trim(),
      baseCost: constantExpression(input.baseCost),
      baseCostResource: input.baseCostResource.trim(),
      baseYield: constantExpression(input.baseYield),
      baseYieldResource: input.baseYieldResource.trim(),
      baseCapacity: input.baseCapacity,
      levelUpgrades: [],
      tags: [],
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
      this.spots.set(prepared.spotId, cloneSpot(prepared.currentSpot!));
      this.suspendedSpotIds.delete(prepared.spotId);
    }
    this.revision++;
  }
}
