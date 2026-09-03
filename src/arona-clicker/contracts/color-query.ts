import type { ColorGroupDef, ThemeDesignDef } from '../../data-services/contracts/color';
import type { ColorGroupId } from '../types/character';
import type { ThemeDef } from '../../engine/types/theme';
import type { PlayerState } from '../types/state';
import type { ResolvedTheme, ThemeLayer, ThemeTokens } from '../../engine/core/theme-runtime';

export interface ColorEntityThemeOption {
  kind: 'default' | 'equipment' | 'design' | 'custom';
  id?: string;
  name: string;
  theme?: ThemeDef;
  swatch?: string;
  owned: boolean;
  active: boolean;
}

export interface ColorGroupDescription {
  autoConstructed: boolean;
  tokens: { key: string; value: string; source: 'defined' | 'derived' }[];
}

export interface ColorQueryPort {
  runtimeTheme(): ResolvedTheme;
  getGroup(groupId: ColorGroupId): ColorGroupDef | undefined;
  getAllGroups(): ColorGroupDef[];
  isGroupOwned(state: PlayerState, groupId: string): boolean;
  ownedGroups(state: PlayerState): ColorGroupDef[];
  describeGroup(def: ColorGroupDef): ColorGroupDescription;
  themeSwatchColor(theme: ThemeDef): string | undefined;
  scopeThemeTokens(scope: ThemeLayer['scope']): ThemeTokens;
  entityThemeOptions(state: PlayerState, entityKey: string, opts: { declaredTheme?: ThemeDef; equippedEquipmentId?: string | null }): ColorEntityThemeOption[];
  ownedDesigns(state: PlayerState, entityKey: string): ThemeDesignDef[];
  isDesignOwned(state: PlayerState, entityKey: string, designId: string): boolean;
  entityThemeOverride(state: PlayerState, entityKey: string, equippedEquipmentId?: string | null): ThemeDef | null;
}
