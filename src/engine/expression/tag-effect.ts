import type { GameNum } from './game-num-eval';
import type { ValueExpression } from '../types/expression';
import type { TagPath } from '../core/tag';
import { tagKey } from '../core/tag';

/** tag 效果分类：直接加成 / 通用乘区 / 自定义乘区 / 乘区上下限。 */
export type TagEffectCategory = 'flat' | 'mul' | 'custom' | 'bound';

/**
 * 某 tag 上记录的一条效能（PlayerState 级）。value 即「效能结果 GameNum」，
 * 求值时按当前状态计算；category 决定它如何与同 tag 其它效果合并。
 */
export interface TagEffectRecord {
  id: string;
  category: TagEffectCategory;
  /** 自定义乘区标识（category='custom' 时按此分组连乘）。 */
  multiplierId?: string;
  /** 直接加成值 / 乘区系数（bound 类无需 value）。 */
  value?: GameNum;
  /** bound 类：夹取下界（缺省 -Infinity）。 */
  min?: number;
  /** bound 类：夹取上界（缺省 +Infinity）。 */
  max?: number;
  /** 限定作用的资源；缺省 = 作用所有资源。 */
  resource?: string;
  /** 来源标识（如 Affector 实例 id），撤销时按 source O(k) 移除。 */
  source?: string;
}

/** 实体引用：解析其声明 tags，以自下而上聚合 tag 效果。global 为资源树全局层（Phase 6）。 */
export interface EntityRef {
  kind: 'spot' | 'area' | 'init' | 'enhancement' | 'global';
  id: string;
}

/** 区修饰器的作用标定维度。 */
export type ZoneTarget =
  | { kind: 'tag'; tag: TagPath }
  | { kind: 'entity'; ref: EntityRef };

/** 把 EntityRef 稳定序列化为索引键。ref.id 为 '*' 表示该类全部实体。 */
export function entityKey(ref: EntityRef): string {
  return `${ref.kind}:${ref.id}`;
}

/** Affector 声明的按作用目标（tag 或指定实体）加成（经桥接层转写为 TagEffectRecord）。 */
export interface ZoneModifierDecl {
  /** 作用标定：按 tag 树状自下而上命中，或定点作用于某个 typed-id 实体（id 为 '*' 表示该类全部实体）。 */
  target: ZoneTarget;
  category: TagEffectCategory;
  value: number | ValueExpression;
  multiplierId?: string;
  /** 限定作用的资源；缺省 = 作用所有资源。 */
  resource?: string;
  min?: number;
  max?: number;
}

/** 自下而上（末端 tag → 顶端 tag）展开每条 tag 路径的全部前缀键，去重。
 * 顺序：更具体的子 tag 在前，更泛化的父 tag 在后（父统辖子）。 */
export function tagPrefixesBottomUp(tags: TagPath[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const path of tags) {
    for (let i = path.length; i >= 1; i--) {
      const key = tagKey(path.slice(0, i));
      if (!seen.has(key)) {
        seen.add(key);
        out.push(key);
      }
    }
  }
  return out;
}
