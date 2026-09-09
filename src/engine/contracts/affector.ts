import type { ConditionGroup, Effect, ValueExpression } from '../types/expression';
import type { ZoneModifierDecl } from '../expression/tag-effect';
import type { ExtraCompound } from './extra';

export type AffectorState = 'Latent' | 'Active' | 'Removed';
export type ServiceCapabilityId = 'user-theme.editor' | (string & {});
export interface AffectorCapabilityGrant {
  kind: 'service';
  id: ServiceCapabilityId;
  mode: 'enable';
}
/** 持续流：Affector 激活期间每 tick 懒求值入账的资源产出。 */
export interface AffectorFlow {
  /** 目标资源。 */
  resource: string;
  /** 每 tick 数量（数值或表达式，如 spotLevel × amountPerLevel）。 */
  value: number | ValueExpression;
}
export interface AffectorEffect { id: string; condition?: ConditionGroup; effects: Effect[]; perTickEffects?: Effect[]; flows?: AffectorFlow[]; zoneModifiers?: ZoneModifierDecl[]; }
export interface AffectorPackDef {
  /** @label ID */
  id: string;
  entries: AffectorEffect[];
  /** 声明由 Active Affector 提供的高级服务能力；多个来源可并存。 */
  capabilities?: AffectorCapabilityGrant[];
  /** Extra 附加数据（数据包声明的结构化元数据，见 docs/13）。 */
  extra?: ExtraCompound;
}
export type AffectorPackRef = string | AffectorPackDef;
export interface AffectorInstance {
  instanceId: string;
  packId: string;
  mountEntityId: string;
  state: AffectorState;
  activeEntryIds: string[];
  /** 非持久化查询索引；数组仍是序列化与展示的稳定顺序来源。 */
  readonly activeEntryIdSet?: ReadonlySet<string>;
}
