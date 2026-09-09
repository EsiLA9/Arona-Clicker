import type { ExtraPath, ExtraValue } from './extra';
import type { ValueExpression } from './expression';
import type { AffectorInstance, AffectorPackDef, AffectorFlow } from './affector';
import type { FuncletDef } from '../types/expression';
import type { TagPath } from '../core/tag';
import type { SpotTagOverrideState } from './state-query';

/** Value 求值所需的最小读取端口。实现可以来自 Runtime 或独立测试宿主。 */
export interface ValueEvaluationContext {
  readonly funcletDefs: ReadonlyMap<string, FuncletDef>;
  readonly extraReader: (path: ExtraPath) => ExtraValue | undefined;
}

/** Condition 求值所需的最小读取端口。实体和存档的具体形状不泄漏到引擎契约。 */
export interface ConditionEvaluationContext<State = unknown> {
  readonly tagIndex: (tag: TagPath) => string[];
  readonly statReader: (dsl: string) => number | null;
  readonly storyRunChecker: (storyId: string) => boolean;
  readonly storyChainChecker: (storyId: string) => boolean;
  readonly extraReader: (path: ExtraPath) => ExtraValue | undefined;
  readonly tagCountReader: (key: string) => number;
  readonly affectionLevelReader: (variantId: string, state: State) => number;
}

export interface GameNumSpotSource {
  readonly id: string;
  readonly areaId: string;
  readonly baseYieldResource: string;
  readonly baseYield: ValueExpression;
  readonly yieldPerLevel?: number;
}

export interface GameNumAreaSource {
  readonly id: string;
  readonly initId: string;
}

export interface GameNumInitSource {
  readonly id: string;
}

export interface GameNumTaggedSource {
  readonly tags?: readonly TagPath[];
}

/** GameNum 建树/求值所需的 Registry 最小只读端口。 */
export interface GameNumRegistryContext {
  readonly spots: ReadonlyMap<string, GameNumSpotSource>;
  readonly areas: ReadonlyMap<string, GameNumAreaSource & GameNumTaggedSource>;
  readonly inits: ReadonlyMap<string, GameNumInitSource & GameNumTaggedSource>;
  readonly enhancements: ReadonlyMap<string, GameNumTaggedSource>;
  readonly resourceDisplays?: ReadonlyMap<string, unknown>;
  effectiveSpotTags(spotId: string, overrides?: Record<string, SpotTagOverrideState>): TagPath[];
  tagOwnerOf?(entityId: string): string;
}

/** GameNum 读取 Affector 生命周期数据所需的最小端口。 */
export interface GameNumAffectorContext {
  getActiveInstances(): readonly AffectorInstance[];
  getPack(id: string): AffectorPackDef | undefined;
}

/** GameNum 内部维护的活跃 flow 来源；按 resource / mount bucket 查询。 */
export interface GameNumFlowSource {
  readonly flow: AffectorFlow;
}
