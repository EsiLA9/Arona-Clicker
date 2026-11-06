import type { GameReadModel } from '../../arona-clicker/contracts/runtime/runtime';
import type { UserThemeDraft } from '../../arona-clicker/types/user-theme';
import { normalizeUserThemeLayerIds, validateUserThemeDraft, type UserThemeEditSession } from '../../arona-clicker/services/presentation/user-theme-service';
import { RuntimeThemeManager, type ResolvedTheme, type ThemeLayer } from '../../engine/core/theme-runtime';
import type { ThemeDef } from '../../engine/types/theme';
import { SYSTEM_DEFAULT_PRIMARY } from '../../engine/core/theme-defaults';
import { deriveNode } from '../presentation/theme-tree';

/** Editor session appearance; never writes player state or Story authoring data. */
export class StoryEditorTheme {
  selection: 'initial' | 'scene' | 'color-group' | 'custom' = 'initial';
  groupId?: string;
  label = '打开时主题';
  custom?: UserThemeDraft;
  private layer?: ThemeLayer;
  private previewDraft?: UserThemeDraft;
  private contentPreview?: ResolvedTheme;
  private initial!: ResolvedTheme;
  constructor(private readonly game: GameReadModel, initial?: ResolvedTheme) {
    this.setInitial(initial);
  }
  setInitial(theme?: ResolvedTheme): void {
    this.initial = structuredClone(theme ?? new RuntimeThemeManager(() => ({})).resolve());
    const primary = this.initial.tokens.primary ?? SYSTEM_DEFAULT_PRIMARY;
    this.initial.tokens = {
      bg: deriveNode('canvas', primary), bgAlt: deriveNode('panel-light', primary),
      text: deriveNode('ink', primary), textDim: deriveNode('muted', primary),
      ...this.initial.tokens,
    };
  }
  resolve(includePreview = true): ResolvedTheme {
    const preview = includePreview ? this.previewDraft : undefined;
    if (includePreview && !preview && this.contentPreview) return this.contentPreview;
    if (!preview && !this.layer) return this.initial;
    const manager = new RuntimeThemeManager(layer => this.game.colorSystem.themeFromThemeDef({ colorGroupId: layer.groupId, tokens: layer.tokens }));
    manager.setPlayer(preview ? this.customLayer(preview) : this.layer!);
    return manager.resolve();
  }
  selectGroup(id: string | null): boolean {
    if (!id) { this.contentPreview = undefined; this.layer = undefined; this.selection = 'initial'; this.groupId = undefined; this.label = '打开时主题'; return true; }
    const group = this.game.registry.colorGroups.get(id);
    if (!group) return false;
    this.selectDefinition({ colorGroupId: id }, group.name);
    this.selection = 'color-group'; this.groupId = id;
    return true;
  }
  selectDefinition(theme: ThemeDef, label: string): void {
    this.contentPreview = undefined;
    const group = theme.colorGroupId ? this.game.registry.colorGroups.get(theme.colorGroupId) : undefined;
    this.layer = { scope: 'player', groupId: theme.colorGroupId, tokens: theme.tokens,
      palette: theme.palette ?? group?.slots.map(slot => slot.color), nodeOverrides: theme.nodes,
      background: theme.background, systemColorLayerIgnored: theme.systemColorLayerIgnored ?? group?.systemColorLayerIgnored, presentation: theme.presentation };
    this.selection = 'scene'; this.groupId = undefined; this.label = label;
  }
  selectCustom(draft = this.custom): boolean {
    if (!draft) return false;
    this.contentPreview = undefined;
    this.custom = structuredClone(draft); this.layer = this.customLayer(this.custom);
    this.selection = 'custom'; this.groupId = undefined; this.label = '编辑器自定义';
    return true;
  }
  beginEdit(): UserThemeEditSession {
    return { id: `story-editor-theme-${crypto.randomUUID()}`, baseRevision: 0, readonly: false,
      draft: structuredClone(this.custom ?? { version: 1, palette: this.resolve().palette }) };
  }
  preview(draft: UserThemeDraft | null): void { this.previewDraft = draft ?? undefined; }
  previewContent(theme?: ResolvedTheme): void { this.contentPreview = theme ? structuredClone(theme) : undefined; }
  apply(draft: UserThemeDraft): string[] {
    normalizeUserThemeLayerIds(draft);
    const issues = validateUserThemeDraft(draft, this.game.pics);
    if (!issues.length) { this.preview(null); this.selectCustom(draft); }
    return issues;
  }
  private customLayer(draft: UserThemeDraft): ThemeLayer {
    const global = draft.presentation?.hosts?.find(host => host.id === 'global');
    return { scope: 'player', palette: draft.palette?.filter((color, index) => color && draft.paletteUiEnabled?.[index] !== false), tokens: draft.tokens,
      nodeOverrides: draft.nodes, scopeNodeOverrides: draft.scopes, background: global?.layers ?? draft.background,
      backgroundLayerOrder: global?.layerOrder ?? draft.backgroundLayerOrder,
      systemColorLayerIgnored: draft.systemColorLayerIgnored, presentation: draft.presentation };
  }
}
