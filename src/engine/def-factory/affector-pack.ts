// ============================================================
// engine/def-factory/affector-pack.ts — AffectorPackDef 链式 Builder
// .entry(id) 开启一条 AffectorEffect，后续 .effect()/.mod*() 附着到该条目。
// ============================================================

import type { TagPath } from '../core/tag';
import type { ExtraCompound } from '../types/extra';
import type { ConditionGroup, Effect, ValueExpression } from '../types/expression';
import type { AffectorEffect, AffectorPackDef, AffectorFlow } from '../types/trigger';
import type { TagEffectCategory, ZoneModifierDecl } from '../expression/tag-effect';

export class AffectorPackBuilder {
  private readonly _id: string;
  private _entries: AffectorEffect[] = [];
  private _persistent = false;
  private _extra?: ExtraCompound;

  constructor(id: string) {
    this._id = id;
  }

  /** 开启一条 AffectorEffect（后续 effect/flow/mod* 附着到该条目）。 */
  entry(id: string, condition?: ConditionGroup): this {
    this._entries.push(condition
      ? { id, condition, effects: [], flows: [], zoneModifiers: [] }
      : { id, effects: [], flows: [], zoneModifiers: [] });
    return this;
  }

  private last(): AffectorEffect {
    const last = this._entries[this._entries.length - 1];
    if (!last) throw new Error(`AffectorPackBuilder(${this._id}): 需先调用 entry()`);
    return last;
  }

  /** 效果（附着到当前 entry）。 */
  effect(...effs: Effect[]): this {
    this.last().effects.push(...effs);
    return this;
  }

  /** 持续流：激活期间每 tick 懒求值产出（附着到当前 entry）。 */
  flow(resource: string, value: number | ValueExpression): this {
    this.last().flows!.push({ resource, value });
    return this;
  }

  /** 区修饰：按 tag 目标（自下而上命中）。 */
  modTag(tag: TagPath, category: TagEffectCategory, value: number, life: ZoneModifierDecl['life'] = 'init'): this {
    this.last().zoneModifiers!.push({ target: { kind: 'tag', tag }, category, value, life });
    return this;
  }

  /** 区修饰：作用于某类实体全部（spot id '*'）。 */
  modEntity(
    kind: 'spot' | 'area' | 'init' | 'enhancement',
    id: string,
    category: TagEffectCategory,
    value: number,
    life: ZoneModifierDecl['life'] = 'init',
  ): this {
    this.last().zoneModifiers!.push({ target: { kind: 'entity', ref: { kind, id } }, category, value, life });
    return this;
  }

  /** 任意区修饰声明（兜底）。 */
  modifier(mod: ZoneModifierDecl): this {
    this.last().zoneModifiers!.push(mod);
    return this;
  }

  /** @label 持久 */
  persistent(): this { this._persistent = true; return this; }
  extra(value: ExtraCompound): this { this._extra = value; return this; }

  build(): AffectorPackDef {
    if (!this._entries.length) throw new Error(`AffectorPackBuilder(${this._id}): 至少需要一条 entry()`);
    const def: AffectorPackDef = {
      id: this._id,
      entries: this._entries.map((e: AffectorEffect): AffectorEffect => {
        const out: AffectorEffect = { id: e.id, effects: e.effects };
        if (e.condition) out.condition = e.condition;
        if (e.flows && e.flows.length) out.flows = e.flows;
        if (e.zoneModifiers && e.zoneModifiers.length) out.zoneModifiers = e.zoneModifiers;
        return out;
      }),
    };
    if (this._persistent) def.persistent = true;
    if (this._extra) def.extra = this._extra;
    return def;
  }
}

export const affectorPack = (id: string): AffectorPackBuilder => new AffectorPackBuilder(id);