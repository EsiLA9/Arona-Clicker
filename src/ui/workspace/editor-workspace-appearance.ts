import type { GameReadModel } from '../../arona-clicker/contracts/runtime/runtime';
import type { UserThemeDraft } from '../../arona-clicker/types/user-theme';
import { normalizeUserThemeLayerIds, validateUserThemeDraft, type UserThemeEditSession } from '../../arona-clicker/services/presentation/user-theme-service';
import { RuntimeThemeManager, type ResolvedTheme, type ThemeLayer } from '../../engine/core/theme-runtime';
import type { ThemeDef } from '../../engine/types/theme';
import { SYSTEM_DEFAULT_PRIMARY } from '../../engine/core/theme-defaults';
import { buildThemeTree, deriveNode, type ThemeTree } from '../presentation/theme-tree';
import { parseColor } from '../../engine/core/color';
import { buildBackgroundView } from '../presentation/background-service';
import { buildPresentationView } from '../presentation/presentation-service';
import type { ThemeNodeName } from '../presentation/theme-palette';

function editorTokens(primary: string): ResolvedTheme['tokens'] {
  return { primary, bg: deriveNode('canvas', primary), bgAlt: deriveNode('panel-light', primary),
    text: deriveNode('ink', primary), textDim: deriveNode('muted', primary) };
}

const defaultEditorTheme: ResolvedTheme = {
  groupId: null, tokens: editorTokens(SYSTEM_DEFAULT_PRIMARY), palette: [SYSTEM_DEFAULT_PRIMARY],
  nodeOverrides: {}, scopeNodeOverrides: {}, layers: [], background: [],
  systemColorLayerIgnored: true, presentation: {},
};

export type EditorThemeIntent =
  | { kind: 'scene'; theme: ThemeDef; label: string }
  | { kind: 'color-group'; groupId: string | null }
  | { kind: 'custom'; draft?: UserThemeDraft };

/** Editor session appearance; never writes player state or Story authoring data. */
export class EditorWorkspaceTheme {
  selection: 'initial' | 'scene' | 'color-group' | 'custom' = 'initial';
  groupId?: string;
  label = '打开时主题';
  custom?: UserThemeDraft;
  private previewTheme?: ResolvedTheme;
  private initial = defaultEditorTheme;
  private initialFailed = false;
  private committed = defaultEditorTheme;
  private failed = false;

  constructor(private readonly game: GameReadModel, initial?: ResolvedTheme | (() => ResolvedTheme | undefined),
    private readonly onFailure: () => void = () => {}) {
    this.initialFailed = !this.commit(() => {
      const sampled = typeof initial === 'function' ? initial() : initial;
      this.initial = sampled ? this.project(sampled) : defaultEditorTheme;
      return this.initial;
    });
  }

  resolve(includePreview = true): ResolvedTheme {
    return (includePreview ? this.previewTheme : undefined) ?? this.committed;
  }

  projectViews() {
    const theme = this.resolve();
    try {
      return this.buildViews(theme);
    } catch (error) {
      if (theme === defaultEditorTheme) throw error;
      this.fail();
      return this.buildViews(defaultEditorTheme);
    }
  }

  applyEditorTheme(intent: EditorThemeIntent): boolean {
    switch (intent.kind) {
      case 'color-group': return this.selectGroup(intent.groupId);
      case 'custom': return this.selectCustom(intent.draft);
      case 'scene': this.selectDefinition(intent.theme, intent.label); return true;
    }
  }

  private project(source: ResolvedTheme): ResolvedTheme {
    const theme = structuredClone(source);
    const primary = theme.tokens.primary ?? SYSTEM_DEFAULT_PRIMARY;
    theme.tokens = { ...editorTokens(primary), ...theme.tokens };
    if (!theme.palette.length) theme.palette = [primary];
    const vars = this.themeTree(theme);
    const lookup = Object.fromEntries(Object.entries(vars).map(([key, value]) => [key.startsWith('--') ? key : `--${key}`, value]));
    for (const value of [...Object.keys(defaultEditorTheme.tokens).map(key => theme.tokens[key]), ...theme.palette,
      vars.canvas, vars['panel-light'], vars.ink, vars.muted]) {
      if (typeof value !== 'string' || !parseColor(value, lookup)) throw new Error('Invalid editor theme color');
    }
    this.buildViews(theme, vars);
    return theme;
  }

  private themeTree(theme: ResolvedTheme): ThemeTree {
    return buildThemeTree(theme.tokens, theme.tokens.primary, theme.palette,
      new Map(Object.entries(theme.nodeOverrides) as [ThemeNodeName, string][]));
  }

  private buildViews(theme: ResolvedTheme, vars = this.themeTree(theme)) {
    const background = buildBackgroundView(theme.background, this.game.pics, theme.tokens,
      theme.systemColorLayerIgnored, theme.palette, vars, theme === defaultEditorTheme);
    const presentation = buildPresentationView(theme.presentation, this.game.pics, {
      evaluateCondition: condition => this.game.conditionSystem.evaluateExpr(condition, this.game.state),
    });
    // Background ink is lazy. Resolve it within the same failure boundary as the view.
    void background.ink;
    return { theme, background, presentation };
  }

  private resolveLayer(layer: ThemeLayer): ResolvedTheme {
    if (layer.groupId && !this.game.registry.colorGroups.has(layer.groupId)) throw new Error('Missing editor color group');
    const manager = new RuntimeThemeManager(layer => this.game.colorSystem.themeFromThemeDef({ colorGroupId: layer.groupId, tokens: layer.tokens }));
    manager.setPlayer(layer);
    return this.project(manager.resolve());
  }

  private fail(): void {
    this.previewTheme = undefined;
    this.committed = defaultEditorTheme;
    this.selection = 'initial';
    this.groupId = undefined;
    this.label = '编辑器默认';
    if (!this.failed) {
      this.failed = true;
      this.onFailure();
    }
  }

  private commit(resolve: () => ResolvedTheme): boolean {
    this.previewTheme = undefined;
    try {
      this.committed = resolve();
      this.failed = false;
      return true;
    } catch {
      this.fail();
      return false;
    }
  }

  private setPreview(resolve?: () => ResolvedTheme): void {
    this.previewTheme = undefined;
    if (!resolve || this.failed) return;
    try {
      this.previewTheme = resolve();
    } catch {
      this.fail();
    }
  }

  selectGroup(id: string | null): boolean {
    if (!id) {
      if (this.initialFailed) {
        this.fail();
        return true;
      }
      this.commit(() => this.initial);
      this.selection = 'initial';
      this.groupId = undefined;
      this.label = '打开时主题';
      return true;
    }
    const group = this.game.registry.colorGroups.get(id);
    if (this.selectDefinition({ colorGroupId: id }, group?.name ?? id)) {
      this.selection = 'color-group'; this.groupId = id;
    }
    return true;
  }
  selectDefinition(theme: ThemeDef, label: string): boolean {
    const group = theme.colorGroupId ? this.game.registry.colorGroups.get(theme.colorGroupId) : undefined;
    const layer: ThemeLayer = { scope: 'player', groupId: theme.colorGroupId, tokens: theme.tokens,
      palette: theme.palette ?? group?.slots.map(slot => slot.color), nodeOverrides: theme.nodes,
      background: theme.background, systemColorLayerIgnored: theme.systemColorLayerIgnored ?? group?.systemColorLayerIgnored, presentation: theme.presentation };
    if (!this.commit(() => this.resolveLayer(layer))) return false;
    this.selection = 'scene'; this.groupId = undefined; this.label = label;
    return true;
  }
  selectCustom(draft = this.custom): boolean {
    if (!draft) return false;
    if (!this.commit(() => this.resolveLayer(this.customLayer(draft)))) return true;
    this.custom = structuredClone(draft);
    this.selection = 'custom'; this.groupId = undefined; this.label = '编辑器自定义';
    return true;
  }
  beginEdit(): UserThemeEditSession {
    return { id: `editor-workspace-theme-${crypto.randomUUID()}`, baseRevision: 0, readonly: false,
      draft: structuredClone(this.custom ?? { version: 1, palette: this.resolve().palette }) };
  }
  preview(draft: UserThemeDraft | null): void { this.setPreview(draft ? () => this.resolveLayer(this.customLayer(draft)) : undefined); }
  previewContent(theme?: ResolvedTheme): void { this.setPreview(theme ? () => this.project(theme) : undefined); }
  apply(draft: UserThemeDraft): string[] {
    normalizeUserThemeLayerIds(draft);
    const issues = validateUserThemeDraft(draft, this.game.pics);
    if (!issues.length) { this.applyEditorTheme({ kind: 'custom', draft }); }
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
