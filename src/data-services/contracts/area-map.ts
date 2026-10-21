import type { RevealTrigger } from '../../engine/types/reveal';

/** 区域导航地图 ID，格式 mod:area-map:name；不属于 Gameplay MapRun。 */
export type AreaMapId = string;
/** 当前地图内唯一的节点 ID；完整身份由 mapId 与 nodeId 共同确定。 */
export type AreaMapNodeId = string;

/** 单张平面导航图；可以共享入口和循环引用，不拥有 Area。 */
export interface AreaMapDef {
  id: AreaMapId;
  name: string;
  description?: string;
  revealTriggers?: RevealTrigger[];
  nodes: AreaMapNodeDef[];
  edges: AreaMapEdgeDef[];
}

export interface AreaMapNodeDef {
  id: AreaMapNodeId;
  name?: string;
  description?: string;
  /** 有限逻辑坐标；只控制布局。 */
  position: { x: number; y: number };
  appearance?: {
    /** 外观不推导节点动作。 */
    kind?: 'point' | 'landmark' | 'portal';
    /** @ref pics */
    iconPicId?: string;
  };
  revealTriggers?: RevealTrigger[];
  /** 缺省为 inspect；每节点最多一个声明式动作。 */
  action?: AreaMapNodeAction;
}

export type AreaMapNodeAction =
  | { kind: 'inspect' }
  | { kind: 'attemptAreaTravel'; /** @ref areas */ areaId: string }
  | { kind: 'openMap'; /** @ref areaMaps */ mapId: AreaMapId };

/** 候选连线；仅当两端 Area 存在真实有向连接时才渲染，不授予移动权限。 */
export interface AreaMapEdgeDef {
  fromNodeId: AreaMapNodeId;
  toNodeId: AreaMapNodeId;
}
