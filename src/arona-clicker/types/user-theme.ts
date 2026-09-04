import type { PresentationDef, ThemeNodeName } from '../../engine/types/theme';

export type UserThemeToken =
  | 'primary' | 'primaryStrong' | 'bg' | 'bgAlt' | 'panel'
  | 'panelAlt' | 'text' | 'muted' | 'accent' | 'danger';

export interface UserThemeDraft {
  version: 1;
  palette?: string[];
  /** 与 palette 同索引；false 表示保留给头像/色板，但不参与 UI 自动取色。 */
  paletteUiEnabled?: boolean[];
  tokens?: Partial<Record<UserThemeToken, string>>;
  nodes?: Partial<Record<ThemeNodeName, string>>;
  scopes?: Record<string, Partial<Record<ThemeNodeName, string>>>;
  presentation?: Pick<PresentationDef, 'layers' | 'components' | 'panels'>;
  motionPreferences?: { reducedMotion?: 'system' | 'always' | 'never' };
}

export interface UserThemeState {
  enabled: boolean;
  draft?: UserThemeDraft;
  applied?: UserThemeDraft;
  revision: number;
  updatedAtFrame?: number;
}
