// ============================================================
// engine/types/common.ts — 跨领域共享定义
// ============================================================

import type { TagPath } from '../core/tag';
import type {
  Character,
  CharacterRarity,
  CharacterSchool,
} from './ids';
import type { ExtraCompound } from './extra';

/**
 * 数据包可声明的资源显示条目：驱动 UI 资源条渲染哪些资源、如何标注。
 * 将 header 等 UI 中硬编码的货币注解（信用点 / 青辉石）解耦为数据配置，
 * 数据包编辑者可自定义显示的货币、标签、可选策略与排序。
 */
export interface ResourceDisplayDef {
  /**
   * 资源 ID（三段式，如 base:resource:credit）。
   * @label 资源 ID
   */
  resourceId: string;
  /**
   * 资源条上显示的标签（如「信用点」「青辉石」）。
   * @label 标签
   */
  label: string;
  /**
   * 详情面板 / tooltip 中显示的完整名称（可选，默认回退 label）。
   * @label 详情标签
   */
  detailLabel?: string;
  /**
   * 显示策略：always 常显；hasAmount 仅持有量 > 0 时显示（稀有/可选货币）。默认 always。
   * @label 显示条件
   * @enum always=常显
   * @enum hasAmount=仅持有量>0 显示
   */
  showWhen?: 'always' | 'hasAmount';
  /**
   * 资源条上的排序权重（越小越靠前，默认 0）。
   * @label 排序
   */
  order?: number;
}

// --- 标签（Tag）表现 ---

export interface TagDef {
  /**
   * 层级标签路径串（与 spot.tags / enhancement.productionTags 的 TagPath 对齐），
   * 如 'office' 或 'office/defense'。
   * @label 路径
   */
  id: string;
  /**
   * 展示名（如「办公室」）。
   * @label 名称
   */
  name: string;
  /**
   * 简介（可选）：tooltip 中展示的补充说明。
   * @label 简介
   */
  description?: string;
}

// --- 角色元数据 ---

export interface CharacterData {
  /** @label ID */
  id: Character;
  /** @label 名称 */
  name: string;
  /** @label 显示名 */
  displayName: string;
  /** @label 学校 */
  school: CharacterSchool;
  /** @label 稀有度 */
  rarity: CharacterRarity;
  /** @label 描述 */
  description: string;
  /**
   * 对特定标签 Spot 的产出加成倍率 (1.0 = 无加成)
   * @label 标签产出加成
   */
  spotTagBonus: Record<string, number>;
  /**
   * 全局效果描述
   * @label 被动描述
   */
  passiveDescription: string;
  /**
   * 层级标签（用于按 tag 聚合的收集统计；如 school/combat 主题）。
   * @label 标签
   */
  tags?: TagPath[];
  /** Extra 附加数据（数据包声明的结构化元数据，见 docs/13）。 */
  extra?: ExtraCompound;
}

export interface CharacterBonusTable {
  /** @label 角色 */
  characterId: Character;
  /** @label 设施 */
  spotId: string;
  /** @label 倍率 */
  multiplier: number;
}

export interface ResourceAmount {
  resourceId: string;
  amount: number;
}
