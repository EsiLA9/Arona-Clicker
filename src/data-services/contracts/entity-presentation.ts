import type { Condition, ConditionGroup } from '../../engine/types/expression';
import type { ThemeDef } from '../../engine/types/theme';

/** 面向玩家显示的实体表现值；theme 缺省时由现有 ColorSystem 解析。 */
export interface EntityPresentationValue {
  /** @label 名称 */
  name: string;
  /** @label 描述 */
  description: string;
  /** @label 主题 */
  theme?: ThemeDef;
}

/** 附加内容对 default 的局部覆盖；至少应覆盖一个字段。 */
export interface EntityPresentationOverride {
  /** @label 名称覆盖 */
  name?: string;
  /** @label 描述覆盖 */
  description?: string;
  /** @label 主题覆盖 */
  theme?: ThemeDef;
}

/** 一个可被玩家选择、或被运行时原因引用的附加表现内容。 */
export interface EntityPresentationOption {
  /** @label ID */
  id: string;
  /** @label 选择标签 */
  label: string;
  /** @label 内容覆盖 */
  override: EntityPresentationOverride;
  /** @label 可用条件 */
  availableWhen?: Condition | ConditionGroup;
}

/** 实体的默认表现内容与附加表现内容列表。 */
export interface EntityPresentationDef {
  /** @label 默认内容 */
  default: EntityPresentationValue;
  /** @label 附加内容 */
  additions?: EntityPresentationOption[];
}

export type EntityPresentationEntityType = 'init' | 'area' | 'spot' | 'enhancement' | 'variant';
export type EntityPresentationKey = `${EntityPresentationEntityType}:${string}`;
