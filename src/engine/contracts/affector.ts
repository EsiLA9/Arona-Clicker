import type { ConditionGroup, Effect, ValueExpression } from '../types/expression';
import type { AreaId } from '../types/ids';
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
  /** Spot 功能生成的主产出进入 Spot/Area/Init 乘区；普通 Affector flow 默认不进入。 */
  applySpotMultiplier?: boolean;
}
/** Affector 激活期间追加的 Area 连通边。默认单向；twoWay 同时提供反向边。 */
export interface AreaConnectionDef {
  fromAreaId: AreaId;
  toAreaId: AreaId;
  direction?: 'oneWay' | 'twoWay';
}
/** 当前活跃连接及其提供来源；同一条边可有多个来源。 */
export interface ActiveAreaConnection extends AreaConnectionDef {
  source: {
    instanceId: string;
    packId: string;
    entryId: string;
    mountEntityId: string;
  };
}
export interface AffectorEffect { id: string; condition?: ConditionGroup; effects: Effect[]; perTickEffects?: Effect[]; flows?: AffectorFlow[]; zoneModifiers?: ZoneModifierDecl[]; areaConnections?: AreaConnectionDef[]; }
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
