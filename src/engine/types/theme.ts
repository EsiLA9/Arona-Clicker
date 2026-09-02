// ============================================================
// engine/types/theme.ts — 声明式主题与实体主题槽
// ============================================================

export type ThemeToken = string;
export type ThemeOrderScope = 'player' | 'area' | 'student';

export interface ThemeDef {
  /** @label 引用色彩组 @ref colorGroups */
  colorGroupId?: string;
  /** @label 局部覆盖 */
  tokens?: Partial<Record<ThemeToken, string>>;
}

export interface EntityThemeSlot {
  kind: 'default' | 'equipment' | 'design' | 'custom';
  designId?: string;
  equipmentId?: string;
  customTheme?: ThemeDef;
}
