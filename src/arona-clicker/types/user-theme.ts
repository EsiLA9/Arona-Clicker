import type { BackgroundLayerDef, PresentationDef, ThemeNodeName } from '../../engine/types/theme';

export type UserThemeToken =
  | 'primary' | 'primaryStrong' | 'bg' | 'bgAlt' | 'panel'
  | 'panelAlt' | 'text' | 'muted' | 'accent' | 'danger';

export interface UserThemeDraft {
  version: 1;
  palette?: string[];
  /** 与 palette 同索引；false 表示保留给头像/色板，但不参与 UI 自动取色。 */
  paletteUiEnabled?: boolean[];
  /** true 时忽略本用户主题提供的系统颜色层，但保留表现层配置。 */
  systemColorLayerIgnored?: boolean;
  /** 全局表现层稳定 ID 的底到顶顺序。 */
  backgroundLayerOrder?: string[];
  tokens?: Partial<Record<UserThemeToken, string>>;
  nodes?: Partial<Record<ThemeNodeName, string>>;
  scopes?: Record<string, Partial<Record<ThemeNodeName, string>>>;
  background?: BackgroundLayerDef[];
  presentation?: Pick<PresentationDef, 'layers' | 'components' | 'panels' | 'hosts'>;
  motionPreferences?: { reducedMotion?: 'system' | 'always' | 'never' };
}

export interface ThemeBaseRef {
  kind: 'system' | 'color-group' | 'theme-design';
  id?: string;
}

/** 独立存储的用户主题；它只保存用户覆盖，不回写任何 Datapack 定义。 */
export interface StoredCustomTheme extends UserThemeDraft {
  id: string;
  name: string;
  baseThemeRef?: ThemeBaseRef;
  createdAt: number;
  updatedAt: number;
}

/** 自定义主题的实体挂靠关系；target 使用 Area / 学生等实体稳定键。 */
export interface ThemeAttachment {
  target: string;
  customThemeId: string;
  enabled: boolean;
}

export interface UserThemeState {
  enabled: boolean;
  revision: number;
  updatedAtFrame?: number;
  /** 当前编辑/应用的独立用户主题索引；真实主题内容位于 PlayerState.customThemes。 */
  customThemeId?: string;
}
