import type { PresentationDef } from '../../engine/types/theme';

export type UserThemeToken =
  | 'primary' | 'primaryStrong' | 'bg' | 'bgAlt' | 'panel'
  | 'panelAlt' | 'text' | 'muted' | 'accent' | 'danger';

export interface UserThemeDraft {
  version: 1;
  tokens?: Partial<Record<UserThemeToken, string>>;
  presentation?: Pick<PresentationDef, 'layers' | 'components'>;
  motionPreferences?: { reducedMotion?: 'system' | 'always' | 'never' };
}

export interface UserThemeState {
  enabled: boolean;
  draft?: UserThemeDraft;
  applied?: UserThemeDraft;
  revision: number;
  updatedAtFrame?: number;
}
