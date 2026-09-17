import {
  applyAuthoringMutation,
  authoringEntityId,
  buildAuthoringDef,
  cloneAuthoringDef,
  requireContentPolicy,
  validateAuthoringInput,
} from '../../data-services/authoring/content-policy';
import type { AuthoringMutationReceipt, ContentAuthoringPolicy } from '../../data-services/authoring/content-policy';
import type { AreaDef, InitDef } from '../../data-services/contracts/world';
import { Registry } from '../../data-services/registry/registry';
import type {
  RuntimeAreaInput,
  RuntimeContentDiagnostic,
  RuntimeInitInput,
  RuntimeWorldCommit,
  RuntimeWorldCoordinatorOptions,
  RuntimeWorldCoordinatorSettings,
  RuntimeWorldDraft,
  RuntimeWorldStateSnapshot,
  RuntimeWorldApplyResult,
} from '../contracts/runtime-content';

export type {
  RuntimeAreaInput,
  RuntimeInitInput,
  RuntimeWorldCommit,
  RuntimeWorldCoordinatorOptions,
  RuntimeWorldCoordinatorSettings,
  RuntimeWorldDraft,
  RuntimeWorldStateSnapshot,
  RuntimeWorldApplyResult,
} from '../contracts/runtime-content';

const RUNTIME_MOD_PATTERN = /^[a-z0-9-]+$/;
const INIT_POLICY = requireContentPolicy('inits');
const AREA_POLICY = requireContentPolicy('areas');

interface AppliedReceipt {
  readonly receipt: AuthoringMutationReceipt;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function diagnostic(code: RuntimeContentDiagnostic['code'], message: string, path?: string): RuntimeContentDiagnostic {
  return path === undefined ? { code, message } : { code, path, message };
}

function sameDefinition(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function initId(modName: string, idName: string): string {
  return authoringEntityId(INIT_POLICY, modName, idName);
}

function areaId(modName: string, idName: string): string {
  return authoringEntityId(AREA_POLICY, modName, idName);
}

function inputContext(registry: Registry) {
  return {
    resourceIds: new Set(registry.resourceDisplays.keys()),
  };
}

function validateRecord(policy: ContentAuthoringPolicy, input: object, registry: Registry): void {
  const problem = validateAuthoringInput(policy, input, inputContext(registry));
  if (problem) throw new Error(problem.message);
}

function initInputDef(modName: string, input: RuntimeInitInput): InitDef {
  return buildAuthoringDef(INIT_POLICY, modName, {
    ...input,
    defaultAreas: [...input.defaultAreas],
    purchaseCost: input.purchaseCost ? [...input.purchaseCost] : undefined,
    tags: input.tags ? [...input.tags] : undefined,
    revealTriggers: input.revealTriggers ? [...input.revealTriggers] : undefined,
  }) as InitDef;
}

function areaInputDef(modName: string, input: RuntimeAreaInput): AreaDef {
  return buildAuthoringDef(AREA_POLICY, modName, {
    ...input,
    defaultSpots: [...input.defaultSpots],
    adjacentAreaIds: input.adjacentAreaIds ? [...input.adjacentAreaIds] : undefined,
    tags: input.tags ? [...input.tags] : undefined,
    revealTriggers: input.revealTriggers ? [...input.revealTriggers] : undefined,
  }) as AreaDef;
}

/**
 * Init / Area 的真正局部热物化协调器。
 *
 * 这里刻意不调用 GameInstance.reload：一次 Apply 只对临时 Mod 自有的
 * Init / Area 做有序 mutation，所有成功写入都有 receipt，失败时按逆序恢复。
 */
export class RuntimeWorldContentCoordinator {
  private readonly registry: Registry;
  private readonly sourceId: string;
  private readonly onCommitted: ((commit: RuntimeWorldCommit) => void) | undefined;
  private readonly inits = new Map<string, InitDef>();
  private readonly areas = new Map<string, AreaDef>();
  private modName: string | null = null;
  private revision = 0;

  constructor(options: RuntimeWorldCoordinatorOptions);
  constructor(registry: Registry, settings?: RuntimeWorldCoordinatorSettings);
  constructor(
    registryOrOptions: Registry | RuntimeWorldCoordinatorOptions,
    settings: RuntimeWorldCoordinatorSettings = {},
  ) {
    const options = registryOrOptions instanceof Registry
      ? { registry: registryOrOptions, ...settings }
      : registryOrOptions;
    this.registry = options.registry;
    this.sourceId = options.sourceId?.trim() || 'runtime-editor-world';
    this.onCommitted = options.onCommitted;
  }

  getRevision(): number {
    return this.revision;
  }

  getState(): RuntimeWorldStateSnapshot {
    return {
      modName: this.modName,
      sourceId: this.sourceId,
      inits: new Map([...this.inits].map(([id, value]) => [id, cloneAuthoringDef(value)])),
      areas: new Map([...this.areas].map(([id, value]) => [id, cloneAuthoringDef(value)])),
      revision: this.revision,
    };
  }

  setModName(modName: string): void {
    if (!RUNTIME_MOD_PATTERN.test(modName)) throw new Error(`临时 Mod 名称格式无效：${modName}`);
    if (this.modName !== null && this.modName !== modName) {
      throw new Error(`当前已有临时 Mod：${this.modName}，不能提交 ${modName}`);
    }
    this.modName = modName;
  }

  reset(): void {
    this.inits.clear();
    this.areas.clear();
    this.modName = null;
    this.revision = 0;
  }

  /** 兼容已有临时 Mod / candidate 路径：之后的 Init / Area 编辑仍走本协调器。 */
  adoptRuntimeMod(modName: string, initIds: readonly string[] = [], areaIds: readonly string[] = []): void {
    this.reset();
    this.setModName(modName);
    for (const rawId of initIds) {
      const id = rawId.includes(':') ? rawId : initId(modName, rawId);
      const definition = this.registry.inits.get(id);
      if (definition && id.startsWith(`${modName}:init:`)) this.inits.set(id, cloneAuthoringDef(definition));
    }
    for (const rawId of areaIds) {
      const id = rawId.includes(':') ? rawId : areaId(modName, rawId);
      const definition = this.registry.areas.get(id);
      if (definition && id.startsWith(`${modName}:area:`)) this.areas.set(id, cloneAuthoringDef(definition));
    }
  }

  applyWorldDraft(draft: RuntimeWorldDraft): RuntimeWorldApplyResult {
    const diagnostics: RuntimeContentDiagnostic[] = [];
    try {
      if (!RUNTIME_MOD_PATTERN.test(draft.modName)) throw new Error('临时 Mod 名称必须匹配 [a-z0-9-]+');
      if (this.modName !== null && this.modName !== draft.modName) {
        throw new Error(`当前已有临时 Mod：${this.modName}，不能提交 ${draft.modName}`);
      }
      if (this.modName === null) {
        if (this.registry.loadedModNames.has(draft.modName)) throw new Error(`modName 已被当前 Registry 占用：${draft.modName}`);
        this.modName = draft.modName;
      }

      const desiredInits = this.prepareInits(draft.modName, draft.inits);
      const desiredAreas = this.prepareAreas(draft.modName, draft.areas);
      this.validateFinalReferences(desiredInits, desiredAreas);
      this.assertOwnedOrFree(desiredInits, desiredAreas);

      const receipts: AppliedReceipt[] = [];
      const deletedAreaIds = new Set([...this.areas.keys()].filter(id => !desiredAreas.has(id)));
      const deletedInitIds = new Set([...this.inits.keys()].filter(id => !desiredInits.has(id)));

      const mutate = (request: Parameters<typeof applyAuthoringMutation>[1]): void => {
        receipts.push({ receipt: applyAuthoringMutation(this.registry, request) });
      };

      try {
        this.stageInits(desiredInits, deletedAreaIds, deletedInitIds, mutate);
        this.stageAreas(desiredAreas, deletedAreaIds, mutate);

        for (const id of deletedAreaIds) {
          mutate({ table: 'areas', operation: 'delete', ownerModName: draft.modName, defId: id });
        }
        for (const id of deletedInitIds) {
          mutate({ table: 'inits', operation: 'delete', ownerModName: draft.modName, defId: id });
        }

        this.materializeAreas(desiredAreas, draft.modName, mutate);
        this.materializeInits(desiredInits, draft.modName, mutate);

        const changedInitIds = [...new Set([...desiredInits.keys(), ...deletedInitIds])];
        const changedAreaIds = [...new Set([...desiredAreas.keys(), ...deletedAreaIds])];
        const commit: RuntimeWorldCommit = {
          modName: draft.modName,
          changedInitIds,
          changedAreaIds,
          revisionBefore: this.revision,
          revisionAfter: this.revision + 1,
        };
        this.onCommitted?.(commit);
        this.inits.clear();
        for (const [id, value] of desiredInits) this.inits.set(id, cloneAuthoringDef(value));
        this.areas.clear();
        for (const [id, value] of desiredAreas) this.areas.set(id, cloneAuthoringDef(value));
        this.revision += 1;
        return { ok: true, revision: this.revision, diagnostics: [], message: `Init / Area 已热应用：${changedInitIds.length + changedAreaIds.length} 项。` };
      } catch (error) {
        for (const item of receipts.reverse()) {
          try { item.receipt.rollback(); } catch (rollbackError) {
            diagnostics.push(diagnostic('rollback-failed', `Init / Area 回滚失败：${errorMessage(rollbackError)}`));
          }
        }
        throw error;
      }
    } catch (error) {
      const message = errorMessage(error);
      diagnostics.unshift(diagnostic('registry-rejected', message));
      return { ok: false, revision: this.revision, diagnostics, message };
    }
  }

  private prepareInits(modName: string, inputs: readonly RuntimeInitInput[]): Map<string, InitDef> {
    const result = new Map<string, InitDef>();
    for (const input of inputs) {
      validateRecord(INIT_POLICY, input, this.registry);
      const definition = initInputDef(modName, input);
      if (result.has(definition.id)) throw new Error(`Draft 中 Init ID 重复：${definition.id}`);
      result.set(definition.id, definition);
    }
    return result;
  }

  private prepareAreas(modName: string, inputs: readonly RuntimeAreaInput[]): Map<string, AreaDef> {
    const result = new Map<string, AreaDef>();
    for (const input of inputs) {
      validateRecord(AREA_POLICY, input, this.registry);
      const definition = areaInputDef(modName, input);
      if (result.has(definition.id)) throw new Error(`Draft 中 Area ID 重复：${definition.id}`);
      result.set(definition.id, definition);
    }
    return result;
  }

  private assertOwnedOrFree(desiredInits: Map<string, InitDef>, desiredAreas: Map<string, AreaDef>): void {
    for (const id of desiredInits.keys()) {
      if (!this.inits.has(id) && this.registry.inits.has(id)) throw new Error(`Init "${id}" 不属于当前临时 Mod，不能覆盖`);
    }
    for (const id of desiredAreas.keys()) {
      if (!this.areas.has(id) && this.registry.areas.has(id)) throw new Error(`Area "${id}" 不属于当前临时 Mod，不能覆盖`);
    }
  }

  private validateFinalReferences(desiredInits: Map<string, InitDef>, desiredAreas: Map<string, AreaDef>): void {
    const finalArea = (id: string): AreaDef | undefined => {
      if (desiredAreas.has(id)) return desiredAreas.get(id);
      if (this.areas.has(id)) return undefined;
      return this.registry.areas.get(id);
    };
    const finalInit = (id: string): InitDef | undefined => {
      if (desiredInits.has(id)) return desiredInits.get(id);
      if (this.inits.has(id)) return undefined;
      return this.registry.inits.get(id);
    };
    for (const init of desiredInits.values()) {
      for (const id of init.defaultAreas) {
        const area = finalArea(id);
        if (!area) throw new Error(`Init "${init.id}" references missing default Area：${id}`);
        if (area.initId !== init.id) throw new Error(`Init "${init.id}" 的默认 Area "${id}" 不属于该 Init`);
      }
    }
    for (const area of desiredAreas.values()) {
      const ownerInit = finalInit(area.initId);
      if (!ownerInit) throw new Error(`Area "${area.id}" references missing Init：${area.initId}`);
      for (const spotId of area.defaultSpots) {
        const spot = this.registry.spots.get(spotId);
        if (!spot) throw new Error(`Area "${area.id}" references missing default Spot：${spotId}`);
        if (spot.areaId !== area.id) throw new Error(`Area "${area.id}" 的默认 Spot "${spotId}" 不属于该 Area`);
      }
      for (const adjacentId of area.adjacentAreaIds ?? []) {
        const adjacent = finalArea(adjacentId);
        if (!adjacent) throw new Error(`Area "${area.id}" references missing adjacent Area：${adjacentId}`);
        if (adjacent.initId !== area.initId) throw new Error(`Area "${area.id}" 的邻接 Area 必须属于同一 Init`);
      }
    }
  }

  private stageInits(
    desiredInits: Map<string, InitDef>,
    deletedAreaIds: Set<string>,
    deletedInitIds: Set<string>,
    mutate: (request: Parameters<typeof applyAuthoringMutation>[1]) => void,
  ): void {
    const stage = (init: InitDef): InitDef => ({
      ...init,
      defaultAreas: init.defaultAreas.filter(id => this.registry.areas.has(id) && !deletedAreaIds.has(id)),
    });
    for (const [id, init] of desiredInits) {
      const current = this.inits.get(id);
      const staged = stage(init);
      if (!current) mutate({ table: 'inits', operation: 'create', ownerModName: this.modName!, defId: id, def: staged });
      else if (!sameDefinition(current, staged)) mutate({ table: 'inits', operation: 'replace', ownerModName: this.modName!, defId: id, def: staged });
    }
    for (const id of deletedInitIds) {
      const current = this.inits.get(id);
      if (!current) continue;
      const staged = { ...current, defaultAreas: current.defaultAreas.filter(areaId => !deletedAreaIds.has(areaId)) };
      if (!sameDefinition(current, staged)) mutate({ table: 'inits', operation: 'replace', ownerModName: this.modName!, defId: id, def: staged });
    }
  }

  private stageAreas(
    desiredAreas: Map<string, AreaDef>,
    deletedAreaIds: Set<string>,
    mutate: (request: Parameters<typeof applyAuthoringMutation>[1]) => void,
  ): void {
    for (const [id, area] of desiredAreas) {
      const current = this.areas.get(id);
      const staged = { ...area, adjacentAreaIds: (area.adjacentAreaIds ?? []).filter(adjacentId => this.registry.areas.has(adjacentId) && !deletedAreaIds.has(adjacentId)) };
      if (current && !sameDefinition(current, staged)) {
        mutate({ table: 'areas', operation: 'replace', ownerModName: this.modName!, defId: id, def: staged });
      }
    }
    for (const area of this.registry.areas.values()) {
      if (!area.adjacentAreaIds?.some(id => deletedAreaIds.has(id))) continue;
      if (this.areas.has(area.id)) {
        const staged = {
          ...area,
          adjacentAreaIds: area.adjacentAreaIds.filter(id => !deletedAreaIds.has(id)),
        };
        if (!sameDefinition(area, staged)) {
          mutate({ table: 'areas', operation: 'replace', ownerModName: this.modName!, defId: area.id, def: staged });
        }
        continue;
      }
      throw new Error(`Area "${area.id}" 仍引用待删除 Area：${area.adjacentAreaIds.filter(id => deletedAreaIds.has(id)).join('、')}`);
    }
  }

  private materializeAreas(
    desiredAreas: Map<string, AreaDef>,
    modName: string,
    mutate: (request: Parameters<typeof applyAuthoringMutation>[1]) => void,
  ): void {
    for (const [id, area] of desiredAreas) {
      const current = this.registry.areas.get(id);
      if (!current) {
        mutate({ table: 'areas', operation: 'create', ownerModName: modName, defId: id, def: { ...area, adjacentAreaIds: [] } });
      }
    }
    for (const [id, area] of desiredAreas) {
      const current = this.registry.areas.get(id);
      if (!current || !sameDefinition(current, area)) {
        mutate({ table: 'areas', operation: 'replace', ownerModName: modName, defId: id, def: area });
      }
    }
  }

  private materializeInits(
    desiredInits: Map<string, InitDef>,
    modName: string,
    mutate: (request: Parameters<typeof applyAuthoringMutation>[1]) => void,
  ): void {
    for (const [id, init] of desiredInits) {
      const current = this.registry.inits.get(id);
      if (!current || !sameDefinition(current, init)) {
        mutate({ table: 'inits', operation: 'replace', ownerModName: modName, defId: id, def: init });
      }
    }
  }
}
