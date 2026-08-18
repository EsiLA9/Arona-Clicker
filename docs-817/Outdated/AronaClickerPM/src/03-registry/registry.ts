import type {
  Value, Condition, FuncList,
} from "../01-foundation/types"
import type {
  RawDatapack, RawDatapackContents, FullKey, ModName, TypeName,
  Definition, ResourceDef, InitDef, AreaDef, SpotDef,
  EnhancementDef, EffectDef, StoryDef, ActiveStoryEntryDef, PassiveStoryEntryDef,
  ChatConfigDef,
} from "./types"
import { makeFullKey, parseFullKey } from "./types"

// ── Compile: idName → FullKey ──

class Compiler {
  private mod: ModName
  private errors: string[] = []

  constructor(mod: ModName) { this.mod = mod }

  key(idName: string, type: TypeName): FullKey {
    return makeFullKey(this.mod, type, idName)
  }

  resolveRef(ref: string, expectedType: TypeName, context: string): string | null {
    if (ref.includes("/")) {
      // already a full key — validate format
      const parts = ref.split("/")
      if (parts.length < 3) {
        this.errors.push(`${context}: invalid full key "${ref}"`)
        return null
      }
      if (parts[1] !== expectedType) {
        this.errors.push(`${context}: reference "${ref}" expected type ${expectedType}, got "${parts[1]}"`)
        return null
      }
      return ref
    }
    return makeFullKey(this.mod, expectedType, ref)
  }

  get errors_(): readonly string[] { return this.errors }
}

// ── Validator ──

class Validator {
  private errors: string[] = []
  private seenKeys = new Set<FullKey>()

  checkUnique(key: FullKey, context: string): boolean {
    if (this.seenKeys.has(key)) {
      this.errors.push(`${context}: duplicate key "${key}"`)
      return false
    }
    this.seenKeys.add(key)
    return true
  }

  checkValue(v: any, path: string): boolean {
    if (v == null) return true // null/undefined = absent, allowed
    if (typeof v !== "object") return true
    if (v.type == null) {
      this.errors.push(`${path}: Value/Condition missing "type" field`)
      return false
    }
    return true
  }

  checkCondition(c: any, path: string): boolean {
    if (c == null) return true
    if (typeof c !== "object" || c.type == null) {
      this.errors.push(`${path}: invalid Condition`)
      return false
    }
    return true
  }

  checkFuncList(funcs: any, path: string): boolean {
    if (funcs == null) return true
    if (!Array.isArray(funcs)) {
      this.errors.push(`${path}: FuncList must be an array`)
      return false
    }
    for (let i = 0; i < funcs.length; i++) {
      const f = funcs[i]
      if (f == null || f.type == null) {
        this.errors.push(`${path}[${i}]: Funclet missing "type"`)
      }
    }
    return true
  }

  get errors_(): readonly string[] { return this.errors }
}

// ── Merger: field-level priority merge ──

function mergeRawContents(
  base: RawDatapackContents,
  overlay: RawDatapackContents,
): RawDatapackContents {
  const result: RawDatapackContents = { ...base }

  for (const key of Object.keys(overlay) as (keyof RawDatapackContents)[]) {
    const overlayArr = overlay[key]
    if (!Array.isArray(overlayArr)) {
      // scalar fields (chat): overlay wins
      if (overlayArr !== undefined) (result as any)[key] = overlayArr
      continue
    }
    const baseArr = (base[key] as any[]) ?? []
    const merged = new Map<string, any>()
    for (const item of baseArr) {
      if (item.idName) merged.set(item.idName, item)
    }
    for (const item of overlayArr) {
      if (item.idName) merged.set(item.idName, item)
    }
    (result as any)[key] = Array.from(merged.values())
  }

  return result
}

// ── GameRegistry ──

export interface RegistryMeta {
  loadedDatapacks: { id: string; name: string; version: string; priority: number }[]
  loadTimestamp: number
  version: string
}

export class GameRegistry {
  private _all = new Map<FullKey, Definition>()
  private _byMod = new Map<ModName, FullKey[]>()
  private _byType = new Map<TypeName, FullKey[]>()
  private _byModAndType = new Map<string, FullKey[]>()
  private _areasByInit = new Map<string, FullKey[]>()
  private _spotsByArea = new Map<string, FullKey[]>()
  private _storiesByArea = new Map<string, { active: string[]; passive: string[] }>()
  private _effectsByTarget = new Map<string, string[]>()
  private _enhancementsByCategory = new Map<string, string[]>()
  private _tagsByType = new Map<string, Map<string, string[]>>()
  private _meta: RegistryMeta = { loadedDatapacks: [], loadTimestamp: 0, version: "0.0.0" }
  private _chatConfig: ChatConfigDef | null = null
  private _errors: string[] = []
  private _valid = false

  get all(): ReadonlyMap<FullKey, Definition> { return this._all }
  get byMod(): ReadonlyMap<string, FullKey[]> { return this._byMod }
  get byType(): ReadonlyMap<string, FullKey[]> { return this._byType }
  get byModAndType(): ReadonlyMap<string, FullKey[]> { return this._byModAndType }
  get areasByInit(): ReadonlyMap<string, FullKey[]> { return this._areasByInit }
  get spotsByArea(): ReadonlyMap<string, FullKey[]> { return this._spotsByArea }
  get storiesByArea(): ReadonlyMap<string, { active: string[]; passive: string[] }> { return this._storiesByArea }
  get effectsByTarget(): ReadonlyMap<string, string[]> { return this._effectsByTarget }
  get enhancementsByCategory(): ReadonlyMap<string, string[]> { return this._enhancementsByCategory }
  get tagsByType(): ReadonlyMap<string, Map<string, string[]>> { return this._tagsByType }
  get meta(): RegistryMeta { return this._meta }
  get chatConfig(): ChatConfigDef | null { return this._chatConfig }
  get errors(): readonly string[] { return this._errors }
  get valid(): boolean { return this._valid }

  // ── Load ──

  load(datapacks: RawDatapack[]): void {
    this._errors = []
    this._valid = false

    // 1. sort by priority
    const sorted = [...datapacks].sort((a, b) => a.priority - b.priority)

    // 2. merge
    let merged: RawDatapackContents = {}
    const metaList: RegistryMeta["loadedDatapacks"] = []
    for (const pack of sorted) {
      merged = mergeRawContents(merged, pack.contents)
      metaList.push({ id: pack.id, name: pack.name, version: pack.version, priority: pack.priority })
    }

    // 3. compile & validate
    const compiler = new Compiler(sorted[0]?.id ?? "unknown")
    const validator = new Validator()

    const resources = this.compileResources(merged.resources ?? [], compiler, validator)
    const effects = this.compileEffects(merged.effects ?? [], compiler, validator)
    const spots = this.compileSpots(merged.spots ?? [], compiler, validator, resources, effects)
    const areas = this.compileAreas(merged.areas ?? [], compiler, validator, spots)
    const enhancements = this.compileEnhancements(merged.enhancements ?? [], compiler, validator, effects)
    const inits = this.compileInits(merged.inits ?? [], compiler, validator, areas)
    const stories = this.compileStories(merged.stories ?? [], compiler, validator)
    const activeEntries = this.compileActiveEntries(merged.activeStoryEntries ?? [], compiler, validator, stories, areas)
    const passiveEntries = this.compilePassiveEntries(merged.passiveStoryEntries ?? [], compiler, validator, stories, areas)

    if (merged.chat) {
      this._chatConfig = {
        baseReward: merged.chat.baseReward,
        baseIntervalTicks: merged.chat.baseIntervalTicks,
        passiveStoryEntrySlots: merged.chat.passiveStoryEntrySlots,
      }
    }

    if (validator.errors_.length > 0 || compiler.errors_.length > 0) {
      this._errors.push(...validator.errors_, ...compiler.errors_)
      return
    }

    // 4. populate main index
    const allEntries: [FullKey, Definition][] = [
      ...resources, ...effects, ...spots, ...areas,
      ...enhancements, ...inits, ...stories,
      ...activeEntries, ...passiveEntries,
    ]
    for (const [key, def] of allEntries) {
      this._all.set(key, def)
    }

    // 5. build auxiliary indexes
    this.buildIndexes(allEntries)

    this._meta = {
      loadedDatapacks: metaList,
      loadTimestamp: Date.now(),
      version: sorted[sorted.length - 1]?.version ?? "0.0.0",
    }
    this._valid = true
  }

  // ── Query API ──

  getDefinition<T extends Definition>(key: FullKey): T | undefined {
    return this._all.get(key) as T | undefined
  }

  queryByType<T extends Definition>(type: TypeName): T[] {
    const keys = this._byType.get(type)
    if (!keys) return []
    return keys.map((k) => this._all.get(k) as T).filter(Boolean)
  }

  queryByMod(mod: ModName): Definition[] {
    const keys = this._byMod.get(mod)
    if (!keys) return []
    return keys.map((k) => this._all.get(k)).filter(Boolean) as Definition[]
  }

  queryByModAndType<T extends Definition>(mod: ModName, type: TypeName): T[] {
    const key = `${mod}/${type}`
    const keys = this._byModAndType.get(key)
    if (!keys) return []
    return keys.map((k) => this._all.get(k) as T).filter(Boolean)
  }

  queryAreasByInit(initKey: FullKey): AreaDef[] {
    const keys = this._areasByInit.get(initKey)
    if (!keys) return []
    return keys.map((k) => this._all.get(k) as AreaDef).filter(Boolean)
  }

  querySpotsByArea(areaKey: FullKey): SpotDef[] {
    const keys = this._spotsByArea.get(areaKey)
    if (!keys) return []
    return keys.map((k) => this._all.get(k) as SpotDef).filter(Boolean)
  }

  queryEffectsByTarget(targetKey: string): EffectDef[] {
    const keys = this._effectsByTarget.get(targetKey)
    if (!keys) return []
    return keys.map((k) => this._all.get(k) as EffectDef).filter(Boolean)
  }

  queryTagsByType(typeName: TypeName): Map<string, string[]> | undefined {
    return this._tagsByType.get(typeName)
  }

  // ── Private: compilers ──

  private compileResources(
    raws: any[], c: Compiler, v: Validator,
  ): [FullKey, ResourceDef][] {
    return raws.map((r) => {
      const key = c.key(r.idName, "resource")
      v.checkUnique(key, `resource ${r.idName}`)
      return [key, {
        id: key as any,
        name: r.name ?? "",
        icon: r.icon ?? "",
        description: r.description ?? "",
        category: r.category ?? "material",
        baseValue: r.baseValue ?? 0,
        maxValue: r.maxValue,
        persistent: r.persistent ?? false,
      }] as [FullKey, ResourceDef]
    })
  }

  private resolveTargetId(target: any, c: Compiler): { scope: string; id?: string } {
    if (!target || !target.id || target.id.includes("/")) return target ?? { scope: "global" }
    const scopeToType: Record<string, TypeName> = {
      spot: "spot", area: "area", init: "init", enhancement: "enhancement",
    }
    const expectedType = scopeToType[target.scope] ?? "resource"
    return { scope: target.scope, id: c.resolveRef(target.id, expectedType, "effect target") ?? target.id }
  }

  private compileEffects(
    raws: any[], c: Compiler, v: Validator,
  ): [FullKey, EffectDef][] {
    return raws.map((r) => {
      const key = c.key(r.idName, "effect")
      v.checkUnique(key, `effect ${r.idName}`)
      return [key, {
        id: key as any,
        type: r.type ?? "custom",
        target: this.resolveTargetId(r.target, c),
        operation: r.operation ?? "add",
        value: r.value ?? 0,
        duration: r.duration,
      }] as [FullKey, EffectDef]
    })
  }

  private compileSpots(
    raws: any[], c: Compiler, v: Validator,
    _resources: [FullKey, ResourceDef][],
    _effects: [FullKey, EffectDef][],
  ): [FullKey, SpotDef][] {
    return raws.map((r) => {
      const key = c.key(r.idName, "spot")
      v.checkUnique(key, `spot ${r.idName}`)
      const parentArea = c.resolveRef(r.parentArea, "area", `spot ${r.idName}`) ?? ""
      const effects = (r.effects ?? []).map((e: string) => c.resolveRef(e, "effect", `spot ${r.idName} effects`) ?? e)
      const productions = (r.productions ?? []).map((p: any) => ({
        resource: c.resolveRef(p.resource, "resource", `spot ${r.idName} production`) ?? p.resource,
        baseAmount: p.baseAmount ?? 0,
        intervalTicks: p.intervalTicks ?? 60,
        perLevel: p.perLevel ?? 0,
      }))
      return [key, {
        id: key as any,
        name: r.name ?? "",
        description: r.description ?? "",
        icon: r.icon ?? "",
        parentArea: parentArea as any,
        productions,
        cost: {
          resource: c.resolveRef(r.cost?.resource, "resource", `spot ${r.idName} cost`) ?? r.cost?.resource ?? "",
          amount: r.cost?.amount ?? 0,
          scaling: r.cost?.scaling,
        },
        costScaling: r.costScaling,
        maxLevel: r.maxLevel,
        visibility: r.visibility,
        effects,
        tags: r.tags ?? [],
      }] as [FullKey, SpotDef]
    })
  }

  private compileAreas(
    raws: any[], c: Compiler, v: Validator,
    _spots: [FullKey, SpotDef][],
  ): [FullKey, AreaDef][] {
    return raws.map((r) => {
      const key = c.key(r.idName, "area")
      v.checkUnique(key, `area ${r.idName}`)
      return [key, {
        id: key as any,
        name: r.name ?? "",
        description: r.description ?? "",
        parentInit: (c.resolveRef(r.parentInit, "init", `area ${r.idName}`) ?? r.parentInit) as any,
        visibility: r.visibility,
        adjacentAreas: (r.adjacentAreas ?? []).map((a: string) =>
          c.resolveRef(a, "area", `area ${r.idName} adjacent`) ?? a) as any,
        discoveryCost: r.discoveryCost,
        purchaseCost: r.purchaseCost,
        spots: (r.spots ?? []).map((s: string) =>
          c.resolveRef(s, "spot", `area ${r.idName} spots`) ?? s) as any,
        passiveStoryEntries: (r.passiveStoryEntries ?? []).map((s: string) =>
          c.resolveRef(s, "passiveStoryEntry", `area ${r.idName} passive`) ?? s) as any,
        activeStoryEntries: (r.activeStoryEntries ?? []).map((s: string) =>
          c.resolveRef(s, "activeStoryEntry", `area ${r.idName} active`) ?? s) as any,
        explorationMax: r.explorationMax ?? 100,
        isExitPoint: r.isExitPoint ?? false,
        environmentTags: r.environmentTags ?? [],
      }] as [FullKey, AreaDef]
    })
  }

  private compileEnhancements(
    raws: any[], c: Compiler, v: Validator,
    _effects: [FullKey, EffectDef][],
  ): [FullKey, EnhancementDef][] {
    return raws.map((r) => {
      const key = c.key(r.idName, "enhancement")
      v.checkUnique(key, `enhancement ${r.idName}`)
      const parentArea = r.parentArea ? c.resolveRef(r.parentArea, "area", `enhancement ${r.idName} parentArea`) : undefined
      return [key, {
        id: key as any,
        name: r.name ?? "",
        description: r.description ?? "",
        icon: r.icon ?? "",
        category: r.category ?? "utility",
        scope: r.scope ?? "init",
        parentArea,
        cost: {
          resource: c.resolveRef(r.cost?.resource, "resource", `enhancement ${r.idName} cost`) ?? r.cost?.resource ?? "",
          amount: r.cost?.amount ?? 0,
        },
        effects: (r.effects ?? []).map((e: string) =>
          c.resolveRef(e, "effect", `enhancement ${r.idName} effects`) ?? e) as any,
        prerequisites: r.prerequisites,
        togglable: r.togglable ?? false,
        tags: r.tags ?? [],
      }] as [FullKey, EnhancementDef]
    })
  }

  private compileInits(
    raws: any[], c: Compiler, v: Validator,
    _areas: [FullKey, AreaDef][],
  ): [FullKey, InitDef][] {
    return raws.map((r) => {
      const key = c.key(r.idName, "init")
      v.checkUnique(key, `init ${r.idName}`)
      v.checkCondition(r.entryRequirements, `init ${r.idName} entryRequirements`)
      v.checkFuncList(r.startingActions, `init ${r.idName} startingActions`)
      return [key, {
        id: key as any,
        name: r.name ?? "",
        description: r.description ?? "",
        icon: r.icon ?? "",
        areas: (r.areas ?? []).map((a: string) =>
          c.resolveRef(a, "area", `init ${r.idName} areas`) ?? a) as any,
        startingArea: (c.resolveRef(r.startingArea, "area", `init ${r.idName} startingArea`) ?? r.startingArea) as any,
        defaultArea: (c.resolveRef(r.defaultArea, "area", `init ${r.idName} defaultArea`) ?? r.defaultArea) as any,
        defaultAreaCooldown: r.defaultAreaCooldown ?? 0,
        entryRequirements: r.entryRequirements,
        exitConditions: r.exitConditions ?? [],
        startingActions: r.startingActions ?? [],
        inheritResources: r.inheritResources ?? false,
        inheritSpots: r.inheritSpots ?? false,
        inheritEnhancements: r.inheritEnhancements ?? false,
      }] as [FullKey, InitDef]
    })
  }

  private compileStories(
    raws: any[], c: Compiler, v: Validator,
  ): [FullKey, StoryDef][] {
    return raws.map((r) => {
      const key = c.key(r.idName, "story")
      v.checkUnique(key, `story ${r.idName}`)
      return [key, {
        id: key as any,
        talklets: r.talklets ?? [],
      }] as [FullKey, StoryDef]
    })
  }

  private compileActiveEntries(
    raws: any[], c: Compiler, v: Validator,
    _stories: [FullKey, StoryDef][],
    _areas: [FullKey, AreaDef][],
  ): [FullKey, ActiveStoryEntryDef][] {
    return raws.map((r) => {
      const id = r.idName ?? "unknown"
      const key = c.key(id, "activeStoryEntry")
      v.checkUnique(key, `activeStoryEntry ${id}`)
      v.checkCondition(r.prerequisites, `activeStoryEntry ${id} prerequisites`)
      return [key, {
        id: key,
        story: (c.resolveRef(r.story, "story", `activeStoryEntry ${id} story`) ?? r.story) as any,
        prerequisites: r.prerequisites,
        weight: r.weight ?? 1,
        cooldownTicks: r.cooldownTicks ?? 0,
        visibility: r.visibility,
        contextBehavior: r.contextBehavior,
        tags: r.tags ?? [],
        parentArea: (c.resolveRef(r.parentArea, "area", `activeStoryEntry ${id} parentArea`) ?? r.parentArea) as any,
        category: r.category,
      }]
    })
  }

  private compilePassiveEntries(
    raws: any[], c: Compiler, v: Validator,
    _stories: [FullKey, StoryDef][],
    _areas: [FullKey, AreaDef][],
  ): [FullKey, PassiveStoryEntryDef][] {
    return raws.map((r) => {
      const id = r.idName ?? "unknown"
      const key = c.key(id, "passiveStoryEntry")
      v.checkUnique(key, `passiveStoryEntry ${id}`)
      v.checkCondition(r.prerequisites, `passiveStoryEntry ${id} prerequisites`)
      return [key, {
        id: key,
        story: (c.resolveRef(r.story, "story", `passiveStoryEntry ${id} story`) ?? r.story) as any,
        prerequisites: r.prerequisites,
        weight: r.weight ?? 1,
        cooldownTicks: r.cooldownTicks ?? 0,
        visibility: r.visibility,
        contextBehavior: r.contextBehavior,
        tags: r.tags ?? [],
        parentArea: (c.resolveRef(r.parentArea, "area", `passiveStoryEntry ${id} parentArea`) ?? r.parentArea) as any,
      }]
    })
  }

  // ── Private: indexes ──

  private buildIndexes(entries: [FullKey, Definition][]): void {
    this._byMod.clear()
    this._byType.clear()
    this._byModAndType.clear()
    this._areasByInit.clear()
    this._spotsByArea.clear()
    this._storiesByArea.clear()
    this._effectsByTarget.clear()
    this._enhancementsByCategory.clear()
    this._tagsByType.clear()

    for (const [key, def] of entries) {
      const { mod, type } = parseFullKey(key)
      const modAndType = `${mod}/${type}`

      // byMod
      this.pushToMapList(this._byMod, mod, key)

      // byType
      this.pushToMapList(this._byType, type, key)

      // byModAndType
      this.pushToMapList(this._byModAndType, modAndType, key)

      // tags
      this.indexTags(key, def, type, mod)

      // type-specific indexes
      switch (type) {
        case "init": {
          const initDef = def as InitDef
          for (const areaKey of initDef.areas) {
            this.pushToMapList(this._areasByInit, key, areaKey)
          }
          break
        }
        case "area": {
          const areaDef = def as AreaDef
          for (const spotKey of areaDef.spots) {
            this.pushToMapList(this._spotsByArea, key, spotKey)
          }
          const stories = this._storiesByArea.get(key) ?? { active: [], passive: [] }
          stories.active.push(...areaDef.activeStoryEntries)
          stories.passive.push(...areaDef.passiveStoryEntries)
          this._storiesByArea.set(key, stories)
          break
        }
        case "enhancement": {
          const enhDef = def as EnhancementDef
          this.pushToMapList(this._enhancementsByCategory, enhDef.category, key)
          break
        }
        case "effect": {
          const effDef = def as EffectDef
          const targetKey = effDef.target.id ? `${effDef.target.scope}:${effDef.target.id}` : effDef.target.scope
          this.pushToMapList(this._effectsByTarget, targetKey, key)
          break
        }
      }
    }
  }

  private indexTags(key: FullKey, def: Definition, type: TypeName, _mod: ModName): void {
    const tags: string[] = (def as any).tags
    if (!tags || tags.length === 0) return

    if (!this._tagsByType.has(type)) {
      this._tagsByType.set(type, new Map())
    }
    const tagMap = this._tagsByType.get(type)!
    for (const tag of tags) {
      this.pushToMapList(tagMap, tag, key)
    }
  }

  private pushToMapList(map: Map<string, string[]>, key: string, value: string): void {
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(value)
  }
}
