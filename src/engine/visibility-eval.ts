// ============================================================
// engine/visibility-eval.ts — 可见性求值（纯函数/查询）
// 被 VisibilityEngine 调用。共享类型 EntityKind/EntityKey/DefWithTriggers
// 亦供 visibility-index 引用（type-only，无运行时环）。
// ============================================================

import {
  PlayerState,
  VisibilitySnapshot,
  InitId,
  AreaId,
  SpotId,
  EnhancementId,
  StoryId,
  ItemId,
  RevealTrigger,
} from './types';
import { Registry } from './registry';
import { ConditionSystem } from './condition-system';
import { existenceMet } from './reveal';

export type EntityKind = 'inits' | 'areas' | 'spots' | 'enhancements' | 'items' | 'stories';
export type EntityKey = string; // `${kind}:${id}`

export interface DefWithTriggers {
  revealTriggers?: RevealTrigger[];
}

export function emptySnapshot(): VisibilitySnapshot {
  return { inits: {}, areas: {}, spots: {}, enhancements: {}, items: {}, stories: {} };
}

/** 对 registry + conditionSystem 的可见性求值门面。 */
export class VisibilityEval {
  constructor(
    private readonly registry: Registry,
    private readonly conditionSystem: ConditionSystem,
  ) {}

  /** existenceMet：无 existence 门槛 = 默认可见；有且任一满足即见。 */
  evaluate(triggers: RevealTrigger[] | undefined, state: PlayerState): boolean {
    return existenceMet(triggers, c => this.conditionSystem.evaluateExpr(c, state));
  }

  evaluateEntity(kind: EntityKind, id: string, state: PlayerState): boolean {
    const def = this.lookup(kind, id);
    return def ? this.evaluate(def.revealTriggers, state) : false;
  }

  /** 整类重算：inits/areas/spots/enhancements/items/stories。 */
  recomputeCategory(state: PlayerState, kind: EntityKind): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    for (const [id, def] of this.entriesOf(kind)) {
      out[id] = this.evaluate(def?.revealTriggers, state);
    }
    return out;
  }

  allTrue(ids: Iterable<string>): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    for (const id of ids) out[id] = true;
    return out;
  }

  /** 全部故事入口 id（active + passive）。 */
  allStoryEntryKeys(): string[] {
    return [...this.registry.activeStories.keys(), ...this.registry.passiveStories.keys()];
  }

  private entriesOf(kind: EntityKind): [string, DefWithTriggers | undefined][] {
    switch (kind) {
      case 'inits': return [...this.registry.inits.entries()] as [string, DefWithTriggers | undefined][];
      case 'areas': return [...this.registry.areas.entries()] as [string, DefWithTriggers | undefined][];
      case 'spots': return [...this.registry.spots.entries()] as [string, DefWithTriggers | undefined][];
      case 'enhancements': return [...this.registry.enhancements.entries()] as [string, DefWithTriggers | undefined][];
      case 'items': return [...this.registry.items.entries()] as [string, DefWithTriggers | undefined][];
      case 'stories':
        return [...this.registry.storyEntries.entries()] as [string, DefWithTriggers | undefined][];
    }
  }

  private lookup(kind: EntityKind, id: string): DefWithTriggers | undefined {
    switch (kind) {
      case 'inits': return this.registry.inits.get(id as InitId);
      case 'areas': return this.registry.areas.get(id as AreaId);
      case 'spots': return this.registry.spots.get(id as SpotId);
      case 'enhancements': return this.registry.enhancements.get(id as EnhancementId);
      case 'items': return this.registry.items.get(id as ItemId);
      case 'stories':
        return this.registry.activeStories.get(id as StoryId) ?? this.registry.passiveStories.get(id as StoryId);
    }
  }
}