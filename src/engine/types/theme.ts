import type { Condition } from './expression';
import type { ColorGroupId } from './character';

// ============================================================
// engine/types/theme.ts — 声明式主题与实体主题槽
// ============================================================

export type ThemeToken = string;
export type ThemeMode = 'light' | 'dark';
export type ThemeOrderScope = 'player' | 'init' | 'area' | 'student';
export type ActiveThemeSelection =
  | { kind: 'system' }
  | { kind: 'color-group'; id: ColorGroupId }
  | { kind: 'custom'; id: string };
export type ThemeNodeName =
  | 'primary' | 'primaryStrong' | 'bg' | 'bgAlt' | 'panel' | 'panelLight'
  | 'text' | 'muted' | 'line' | 'active' | 'highlight'
  | 'success' | 'warning' | 'danger' | 'accent' | 'playerBubble' | 'npcBubble';

export type BackgroundLayerKind = 'empty' | 'solid' | 'gradient' | 'image';
export type PresentationTextColorMode = 'auto' | 'light' | 'dark';
export type PresentationShape = 'rounded-rectangle' | 'rounded-parallelogram';
export type PresentationDecorationStyle = 'solid' | 'dashed' | 'dotted';

export interface PresentationDecorationDef {
  /** @label 装饰线颜色；支持主题变量或颜色值。 */
  color?: string;
  /** @label 装饰线粗细（像素）。 */
  width?: number;
  /** @label 装饰线与宿主形状边缘的间距（像素）；缺省为 0，显式增大后才向内缩。 */
  inset?: number;
  /** @label 装饰线透明度。 */
  opacity?: number;
  /** @label 装饰线样式。 @enum solid=实线 @enum dashed=虚线 @enum dotted=点线 */
  style?: PresentationDecorationStyle;
}

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
  /** @label 缩放比例 */
  scale?: number;
  /** @label 旋转角度 */
  rotation?: number;
}

export interface ThemeBackgroundVariant {
  /** @label 状态变体 ID；由选择页等只读投影使用受控语义值。 */
  id: string;
  /** @label 该状态的背景层。 */
  layers: BackgroundLayerDef[];
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

export interface PresentationHostDef {
  /** @label UI 宿主 ID；可引用内置宿主或稳定组件 ID。 */
  id: string;
  /** @label 父簇或父宿主 ID。 */
  parent?: string;
  /** @label 宿主背景图层。 */
  layers?: BackgroundLayerDef[];
  /** @label 宿主图层顺序。 */
  layerOrder?: string[];
  /** @label 宿主背景透明度；簇宿主使用时覆盖旧 panels 配置。 */
  opacity?: number;
  /** @label 宿主形状；缺省为圆角矩形。 @enum rounded-rectangle=圆角矩形 @enum rounded-parallelogram=圆角平行四边形 */
  shape?: PresentationShape;
  /** @label 圆角半径（像素）；缺省为 8。 */
  cornerRadius?: number;
  /** @label X 轴倾斜角（deg）；圆角矩形缺省为 0，圆角平行四边形缺省为 -6。 */
  skewXDeg?: number;
  /** @label 宿主内嵌装饰线。 */
  decoration?: PresentationDecorationDef;
  /** @label 宿主文字颜色模式。 */
  textColorMode?: PresentationTextColorMode;
  /** @label 状态表现覆盖；未设置时继承宿主默认态。 */
  states?: Partial<Record<PresentationHostState, PresentationHostStateDef>>;
}

export type PresentationHostState = 'default' | 'active' | 'inactive' | 'disabled';

export interface PresentationHostStateDef {
  /** @label 状态图层。 */
  layers?: BackgroundLayerDef[];
  /** @label 状态内嵌装饰线；仅覆盖已填写字段。 */
  decoration?: Partial<PresentationDecorationDef>;
  /** @label 状态图层顺序。 */
  layerOrder?: string[];
  /** @label 状态文字颜色模式。 */
  textColorMode?: PresentationTextColorMode;
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
  /** @label 控件宿主表现；用于面板、按钮、Tab、卡片等 UI 宿主。 */
  hosts?: PresentationHostDef[];
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
  /** @label 背景状态变体；例如 new / active / advanced / completed。 */
  backgroundVariants?: ThemeBackgroundVariant[];
  /** @label UI 表现配置 */
  presentation?: PresentationDef;
}

export interface EntityThemeSlot {
  kind: 'default' | 'equipment' | 'design' | 'custom';
  designId?: string;
  equipmentId?: string;
  customTheme?: ThemeDef;
}
