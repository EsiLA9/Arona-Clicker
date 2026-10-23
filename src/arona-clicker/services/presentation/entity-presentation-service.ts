import type { AreaDef, InitDef, SpotDef } from '../../../data-services/contracts/world';
import type { EnhancementDef } from '../../../data-services/contracts/enhancement';
import type { CharacterVariantDef } from '../../../data-services/contracts/character-variant';
import type { EntityPresentationDef, EntityPresentationKey, EntityPresentationOption } from '../../../data-services/contracts/entity-presentation';
import type { ConditionSystem } from '../../../engine/expression/condition-system';
import type { ThemeDef } from '../../../engine/types/theme';
import type { VisibilityEngine } from '../../../engine/visibility/visibility-engine';
import type { EventBus } from '../../../engine/core/event-bus';
import type { EntityPresentationOverrideLifetime } from '../../../engine/types/expression';
import type { EntityPresentationOptionView, EntityPresentationQueryPort, EntityPresentationResolution, EntityPresentationResolveOptions } from '../../contracts/presentation/entity-presentation-query';
import type { PlayerState } from '../../types/state';
import { Registry } from '../../../data-services/registry/registry';
import { ColorSystem } from '../progression/color-system';

type PresentationTarget = {
  presentation?: EntityPresentationDef;
  legacy: { name: string; description: string; theme?: ThemeDef };
};

interface RuntimePresentationOverride {
  optionId: string;
  owner: string;
  lifetime: EntityPresentationOverrideLifetime;
  sequence: number;
  /** 新StoryNode的story生命周期覆写只由对应run关闭；不复用旧storyCompleted故事ID。 */
  runId?: string;
}

function runtimeOwnerKey(owner: string, lifetime: EntityPresentationOverrideLifetime, runId?: string): string {
  return lifetime === 'story' && runId !== undefined
    ? `\u0000story-node:${JSON.stringify([runId, owner])}`
    : owner;
}

function splitKey(key: EntityPresentationKey): { kind: string; id: string } {
  const separator = key.indexOf(':');
  return separator < 0 ? { kind: key, id: '' } : { kind: key.slice(0, separator), id: key.slice(separator + 1) };
}

export class EntityPresentationService implements EntityPresentationQueryPort {
  constructor(
    private readonly registry: Registry,
    private readonly colorSystem: ColorSystem,
    private readonly conditionSystem: ConditionSystem,
    private readonly visibility: VisibilityEngine,
    private readonly eventBus: EventBus,
  ) {}

  private readonly runtimeOverrides = new Map<EntityPresentationKey, Map<string, RuntimePresentationOverride>>();
  private runtimeSequence = 0;

  resolve(
    state: Readonly<PlayerState>,
    key: EntityPresentationKey,
    options: EntityPresentationResolveOptions = {},
  ): EntityPresentationResolution | undefined {
    const target = this.targetOf(key);
    if (!target || !this.entityVisible(key, state)) return undefined;
    const presentation = target.presentation;
    const base = presentation?.default ?? target.legacy;
    const runtimeOverride = this.runtimeOverrideOf(key);
    const selectedOptionId = options.selectedOptionId === undefined
      ? runtimeOverride?.optionId ?? state.entityPresentationSelections?.[key]
      : options.selectedOptionId;
    const selectedByRuntime = options.selectedOptionId === undefined && runtimeOverride?.optionId === selectedOptionId;
    const selected = selectedOptionId === undefined || selectedOptionId === null
      ? undefined
      : presentation?.additions?.find(option => option.id === selectedOptionId);
    const fallbackReason = selectedOptionId !== undefined && selectedOptionId !== null
      ? selected === undefined
        ? 'unknown-option'
        : selectedByRuntime || this.isAvailable(selected, state)
          ? undefined
          : 'unavailable-option'
      : undefined;
    const activeOption = selected && !fallbackReason ? selected : undefined;
    const value = {
      name: activeOption?.override.name ?? base.name,
      description: activeOption?.override.description ?? base.description,
      theme: activeOption?.override.theme ?? base.theme ?? target.legacy.theme,
    };
    const theme = this.colorSystem.resolveEntityTheme(state, key, {
      declaredTheme: value.theme,
      equippedEquipmentId: options.equippedEquipmentId,
    }).theme;
    return {
      key,
      name: value.name,
      description: value.description,
      theme,
      swatch: theme ? this.colorSystem.themeSwatchColor(theme) : undefined,
      source: runtimeOverride && activeOption ? 'runtime' : activeOption ? 'addition' : presentation ? 'default' : 'legacy',
      optionId: activeOption?.id,
      fallbackReason,
    };
  }

  options(
    state: Readonly<PlayerState>,
    key: EntityPresentationKey,
    resolveOptions: EntityPresentationResolveOptions = {},
  ): EntityPresentationOptionView[] {
    const target = this.targetOf(key);
    if (!target?.presentation || !this.entityVisible(key, state)) return [];
    return (target.presentation.additions ?? []).map(option => {
      const available = this.isAvailable(option, state);
      const selected = { ...resolveOptions, selectedOptionId: option.id };
      const resolved = available ? this.resolve(state, key, selected) : undefined;
      return {
        id: option.id,
        label: option.label,
        available,
        active: available
          && (resolveOptions.selectedOptionId === undefined
            ? this.runtimeOverrideOf(key)?.optionId ?? state.entityPresentationSelections?.[key]
            : resolveOptions.selectedOptionId) === option.id,
        ...(resolved ? {
          value: {
            name: resolved.name,
            description: resolved.description,
            theme: resolved.theme,
            swatch: resolved.swatch,
          },
        } : {}),
      };
    });
  }

  setRuntimeOverride(key: EntityPresentationKey, optionId: string, owner: string, lifetime: EntityPresentationOverrideLifetime = 'manual', runId?: string): boolean {
    if (!owner || lifetime === 'story' && runId !== undefined && !runId.trim()
      || !this.targetOf(key)?.presentation?.additions?.some(option => option.id === optionId)) return false;
    const owners = this.runtimeOverrides.get(key) ?? new Map<string, RuntimePresentationOverride>();
    const keyOwner = runtimeOwnerKey(owner, lifetime, runId);
    const current = owners.get(keyOwner);
    if (current?.optionId === optionId && current.lifetime === lifetime && current.runId === runId) return true;
    owners.set(keyOwner, { optionId, owner, lifetime, sequence: ++this.runtimeSequence, ...(runId === undefined ? {} : { runId }) });
    this.runtimeOverrides.set(key, owners);
    this.emitRuntimeChange(key);
    return true;
  }

  clearRuntimeOverride(key: EntityPresentationKey, owner: string, runId?: string): boolean {
    const owners = this.runtimeOverrides.get(key);
    if (!owners) return false;
    let removed = false;
    if (runId !== undefined) {
      for (const [keyOwner, override] of owners) {
        if (override.owner === owner && override.lifetime === 'story' && override.runId === runId) {
          owners.delete(keyOwner);
          removed = true;
          break;
        }
      }
      // A new StoryNode may still clear a matching manual/area/init owner, but
      // cannot erase a story override attached to another run.
      if (!removed) {
        const unscoped = owners.get(owner);
        if (unscoped && unscoped.owner === owner && (unscoped.lifetime !== 'story' || unscoped.runId === undefined)) {
          owners.delete(owner);
          removed = true;
        }
      }
    } else removed = owners.delete(owner);
    if (!removed) return false;
    if (owners.size === 0) this.runtimeOverrides.delete(key);
    this.emitRuntimeChange(key);
    return true;
  }

  clearRuntimeOverrides(filter: { owner?: string; lifetime?: EntityPresentationOverrideLifetime; runId?: string } = {}): number {
    let cleared = 0;
    for (const [key, owners] of [...this.runtimeOverrides.entries()]) {
      let clearedForKey = 0;
      for (const [owner, override] of [...owners.entries()]) {
        if (filter.owner !== undefined && filter.owner !== override.owner) continue;
        if (filter.lifetime !== undefined && filter.lifetime !== override.lifetime) continue;
        if (filter.runId !== undefined && filter.runId !== override.runId) continue;
        owners.delete(owner);
        cleared += 1;
        clearedForKey += 1;
      }
      if (owners.size === 0) this.runtimeOverrides.delete(key);
      if (clearedForKey > 0) this.emitRuntimeChange(key);
    }
    return cleared;
  }

  private isAvailable(option: EntityPresentationOption, state: Readonly<PlayerState>): boolean {
    return !option.availableWhen || this.conditionSystem.evaluateExpr(option.availableWhen, state);
  }

  private runtimeOverrideOf(key: EntityPresentationKey): RuntimePresentationOverride | undefined {
    return [...(this.runtimeOverrides.get(key)?.values() ?? [])]
      .sort((a, b) => b.sequence - a.sequence)[0];
  }

  private emitRuntimeChange(key: EntityPresentationKey): void {
    this.eventBus.emit({ type: 'entityPresentationChanged', entityKey: key, optionId: this.runtimeOverrideOf(key)?.optionId ?? null });
  }

  private entityVisible(key: EntityPresentationKey, state: Readonly<PlayerState>): boolean {
    const { kind, id } = splitKey(key);
    switch (kind) {
      case 'init': return this.visibility.isInitVisible(id, state);
      case 'area': return this.visibility.isAreaVisible(id, state);
      case 'spot': return this.visibility.isSpotVisible(id, state);
      case 'enhancement': return this.visibility.isEnhancementVisible(id, state);
      case 'variant': return true;
      default: return false;
    }
  }

  private targetOf(key: EntityPresentationKey): PresentationTarget | undefined {
    const { kind, id } = splitKey(key);
    switch (kind) {
      case 'init': {
        const def = this.registry.inits.get(id) as InitDef | undefined;
        return def ? { presentation: def.presentation, legacy: { name: def.name, description: def.description, theme: def.theme } } : undefined;
      }
      case 'area': {
        const def = this.registry.areas.get(id) as AreaDef | undefined;
        return def ? { presentation: def.presentation, legacy: { name: def.name, description: def.description, theme: def.theme } } : undefined;
      }
      case 'spot': {
        const def = this.registry.spots.get(id) as SpotDef | undefined;
        return def ? { presentation: def.presentation, legacy: { name: def.name, description: def.description, theme: def.theme } } : undefined;
      }
      case 'enhancement': {
        const def = this.registry.enhancements.get(id) as EnhancementDef | undefined;
        return def ? { presentation: def.presentation, legacy: { name: def.name, description: def.description, theme: def.theme } } : undefined;
      }
      case 'variant': {
        const def = this.registry.characterVariants.get(id) as CharacterVariantDef | undefined;
        return def ? { presentation: def.presentation, legacy: { name: def.displayName || def.name, description: def.description, theme: def.theme } } : undefined;
      }
      default:
        return undefined;
    }
  }
}
