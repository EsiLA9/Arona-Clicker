import type { Condition } from './expression';

// ============================================================
// engine/types/theme.ts — 声明式主题与实体主题槽
// ============================================================

export type ThemeToken = string;
export type ThemeMode = 'light' | 'dark';
export type ThemeOrderScope = 'player' | 'area' | 'student';
export type ThemeNodeName =
  | 'primary' | 'primaryStrong' | 'bg' | 'bgAlt' | 'panel' | 'panelLight'
  | 'text' | 'muted' | 'line' | 'active' | 'highlight'
  | 'success' | 'warning' | 'danger' | 'accent' | 'playerBubble' | 'npcBubble';

export type BackgroundLayerKind = 'solid' | 'gradient' | 'image';

export type PresentationRegion =
  | 'shell'
  | 'header'
  | 'leftPanel'
  | 'centerPanel'
  | 'rightPanel'
  | 'footer'
  | 'story'
  | 'modal';

export type PlacementAnchor = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
export type MotionPreset = 'none' | 'fade' | 'fade-up' | 'soft-scale' | 'slide-in' | 'pulse';

export interface MotionDef {
  enter?: MotionPreset;
  exit?: MotionPreset;
  hover?: MotionPreset;
  duration?: 'fast' | 'normal' | 'slow';
}

export interface StateAppearanceDef {
  state: 'locked' | 'available' | 'active' | 'completed' | 'warning';
  label?: string;
  icon?: string;
  colorToken?: string;
  emphasis?: 'quiet' | 'normal' | 'strong';
}

export interface PanelPresentationDef {
  region: PresentationRegion;
  /** @label 簇背景透明度 */
  opacity?: number;
  layers?: PresentationLayerDef[];
  header?: { icon?: string; eyebrow?: string; accent?: string };
  emptyState?: { icon?: string; title?: string; description?: string };
}

export interface InfoItemPresentationDef {
  id: string;
  label: string;
  valueSource: string;
  icon?: string;
  colorToken?: string;
  visibleWhen?: Condition;
  priority?: number;
}

export interface BackgroundLayerDef {
  /** @label 层 ID；同一运行时主题层内可用来覆盖已有背景层。 */
  id?: string;
  /** @label 背景类型 */
  kind: BackgroundLayerKind;
  /** @label 背景值；image 使用 Pic 引用或受控 URL。 */
  value: string;
  /** @label 透明度 */
  opacity?: number;
  /** @label 背景位置 */
  position?: string;
  /** @label 背景尺寸 */
  size?: string;
  /** @label 重复方式 */
  repeat?: string;
  /** @label 混合模式 */
  blendMode?: string;
  /** @label 附着方式 */
  attachment?: 'scroll' | 'fixed' | 'local';
}

export interface PresentationLayerDef extends BackgroundLayerDef {
  /** @label 表现区域 */
  region: PresentationRegion;
}

export interface ComponentPlacementDef {
  /** @label 组件 ID */
  id: string;
  /** @label 父区域或父组件 ID */
  parent: string;
  /** @label 图片资源 @ref pics */
  asset?: string;
  /** @label 锚点 */
  anchor: PlacementAnchor;
  /** @label 相对偏移 */
  offset?: { x: number; y: number; unit: 'percent' | 'px' };
  /** @label 尺寸 */
  size?: { width?: number; height?: number; unit: 'percent' | 'px' | 'auto' };
  /** @label 图片适配 */
  fit?: 'contain' | 'cover' | 'natural';
  /** @label 显示条件 */
  visibleWhen?: Condition;
  /** @label 窄屏覆盖 */
  responsive?: {
    narrow?: Partial<Pick<ComponentPlacementDef, 'anchor' | 'offset' | 'size' | 'fit'>> & { visible?: boolean };
  };
}

export interface PresentationDef {
  /** @label 区域图层 */
  layers?: PresentationLayerDef[];
  /** @label 区域组件 */
  components?: ComponentPlacementDef[];
  /** @label 面板语义表现 */
  panels?: PanelPresentationDef[];
  /** @label 信息项表现 */
  infoItems?: InfoItemPresentationDef[];
  /** @label 命名动效预设 */
  motions?: Record<string, MotionDef>;
  /** @label 状态外观 */
  states?: StateAppearanceDef[];
}

export interface ThemeDef {
  /** @label 引用色彩组 @ref colorGroups */
  colorGroupId?: string;
  /** @label 有序主题色列表（最多六个） */
  palette?: string[];
  /** @label 局部覆盖 */
  tokens?: Partial<Record<ThemeToken, string>>;
  /** @label 语义颜色节点覆盖 */
  nodes?: Partial<Record<ThemeNodeName, string>>;
  /** @label 背景视觉层 */
  background?: BackgroundLayerDef[];
  /** @label UI 表现配置 */
  presentation?: PresentationDef;
}

export interface EntityThemeSlot {
  kind: 'default' | 'equipment' | 'design' | 'custom';
  designId?: string;
  equipmentId?: string;
  customTheme?: ThemeDef;
}
