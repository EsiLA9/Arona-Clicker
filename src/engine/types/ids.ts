// ============================================================
// engine/types/ids.ts — 通用 ID 类型与字符串分类
// ============================================================

// --- 基础 ID 类型 ---

export type InitId = string;
export type AreaId = string;
export type SpotId = string;
export type EnhancementId = string;
export type StoryId = string;
export type ItemId = string;
export type FuncletId = string;

// 角色枚举与学校/稀有度词表属于具体产品；基础引擎只承认字符串标识。
export type Character = string;
export type CharacterRarity = string;
export type CharacterSchool = string;
