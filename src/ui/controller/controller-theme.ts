// ============================================================
// ui/controller-theme.ts — UI 控制器：主题运行时注入
// 从 controller.ts 拆出：applyTheme / restoreThemeFloat
//   （theme-tree.ts 是纯色彩树/静态映射；本模块负责场景栈合并 +
//    CSS 变量注入的运行时逻辑）
// ============================================================

import { THEME_NODES, buildThemeTree, buildThemeVars, heroGradient, type ThemeTree, type ThemeVarName } from '../presentation/theme-tree';
import { rgbTriplet } from '../../engine/core/color';
import type { UIController } from './controller';
import { buildBackgroundView, renderBackground } from '../presentation/background-service';
import type { ResolvedTheme } from '../../engine/core/theme-runtime';
import { buildPresentationView, renderPresentationHostBackground } from '../presentation/presentation-service';
import { createThemeScopeCascade } from '../presentation/theme-cascade-service';
import { DEFAULT_PANEL_OPACITY } from '../presentation/presentation-config';
import { createUIContext, type UIContext } from '../runtime/context';
import { buildScopedThemeCompatibilityVars, buildScopedThemeNodeVars, buildThemeNodeVars, resolveThemeNodes, type ThemeNodeName } from '../presentation/theme-palette';
import { SYSTEM_DEFAULT_PRIMARY } from '../../engine/core/theme-defaults';
import { syncOuterBackground } from '../presentation/outer-background';

/**
 * 主题浮窗跨 render 重建 #app 的存活：render 全量重建会销毁浮窗 DOM，
 * 这里在重建后依据持久化的开关键与位置重新打开并归位，使其不被其它 DOM 刷新干掉。
 */
export function restoreThemeFloat(ctrl: UIController): void {
  const float = ctrl.root.querySelector<HTMLElement>('[data-theme-float]');
  if (!float) return;
  const button = ctrl.root.querySelector<HTMLButtonElement>('#theme-palette-btn');
  if (ctrl.themeFloatOpen) {
    float.classList.add('open');
    button?.classList.add('is-active');
    if (button) {
      button.dataset.themeState = 'active';
      button.setAttribute('aria-expanded', 'true');
    }
    if (ctrl.themeFloatPos) {
      float.style.left = `${ctrl.themeFloatPos.x}px`;
      float.style.top = `${ctrl.themeFloatPos.y}px`;
      float.style.right = 'auto';
    }
  } else {
    float.classList.remove('open');
    button?.classList.remove('is-active');
    if (button) {
      button.dataset.themeState = 'inactive';
      button.setAttribute('aria-expanded', 'false');
    }
  }
  refreshPresentationHostElements(ctrl, ['header.button']);
}

/**
 * 重建普通游戏页的单一主题选择：玩家选择优先；选择场景默认时使用当前 Area 的主题。
 * Init 主题只投影到外部 Init 选择页；通讯录学生对话会临时完整替代普通界面选择。
 */
export function syncRuntimeTheme(ctrl: UIController): void {
  ctrl.game.storyPresentation.activate(ctrl.panelState.conversationVariantId);
  ctrl.game.colorSystem.syncSelectedThemeFromState(
    ctrl.game.state,
    ctrl.game.userThemeService.capability().active,
    ctrl.panelState.workspace?.type === 'contacts'
      ? ctrl.panelState.workspace.conversationVariantId
      : undefined,
  );
}

export function clearInjectedThemeVars(style: CSSStyleDeclaration): void {
  const prefixes = ['--ac-', '--ink-on-', '--muted-on-', '--theme-node-', '--theme-palette-', '--ui-'];
  // 从后向前删除，避免 CSSStyleDeclaration 删除后索引前移而跳过相邻变量。
  for (let i = style.length - 1; i >= 0; i--) {
    const key = style.item(i);
    if (prefixes.some(prefix => key.startsWith(prefix))) style.removeProperty(key);
  }
  for (const name of Object.keys(THEME_NODES) as ThemeVarName[]) style.removeProperty(`--${name}`);
  style.removeProperty('--hero-gradient');
  style.removeProperty('--theme-bg-gradient');
}

/**
 * 激活主题 → CSS 变量注入。
 * 运行时主题：当前唯一选中的主题完整提供界面内容。
 */
export function applyTheme(ctrl: UIController, syncRuntime = true): void {
  const style = document.documentElement.style;
  clearInjectedThemeVars(style);
  if (syncRuntime) syncRuntimeTheme(ctrl);
  const resolved = ctrl.game.colorSystem.runtimeTheme();
  const tokens = resolved.tokens;
  // 引擎强制设色层：合并后的 token 注入为 --ac-*
  for (const [key, value] of Object.entries(tokens)) {
    style.setProperty(`--ac-${key}`, value);
  }
  style.setProperty('--ac-primary-rgb', rgbTriplet(tokens['primary'] ?? SYSTEM_DEFAULT_PRIMARY));
  // 界面语义层：由色彩树展开，引擎 --ac-* 优先、否则自动衍生；
  // 传入真实 tokens 使背景节点上的文字色（--ink-on-*）按背景明暗正确选白/黑
  const vars = buildThemeVars(tokens['primary'] ?? SYSTEM_DEFAULT_PRIMARY, {}, tokens);
  for (const [key, value] of Object.entries(vars)) {
    style.setProperty(`--${key}`, value);
  }
  const palette = resolved.palette.length > 0 ? resolved.palette : [tokens['primary'] ?? SYSTEM_DEFAULT_PRIMARY];
  // 画布文字色按当前主题自身背景图层的合成色判定，而非只看 tokens.bg。
  const ink = buildBackgroundView(resolved.background, ctrl.game.pics, tokens, resolved.systemColorLayerIgnored, palette, rootThemeVars(resolved)).ink;
  if (ink) {
    style.setProperty('--ink-on-canvas', ink.text);
    style.setProperty('--muted-on-canvas', `color-mix(in srgb, ${ink.text} 58%, transparent)`);
  }
  style.setProperty('--theme-palette-1', palette[0] ?? tokens['primary'] ?? SYSTEM_DEFAULT_PRIMARY);
  style.setProperty('--theme-palette-2', palette[1] ?? palette[0] ?? tokens['primary'] ?? SYSTEM_DEFAULT_PRIMARY);
  const nodeOverrides = new Map(Object.entries(resolved.nodeOverrides) as [import('../presentation/theme-palette').ThemeNodeName, string][]);
  for (const [key, value] of Object.entries(buildThemeNodeVars({ colors: palette }, tokens, nodeOverrides))) {
    style.setProperty(key, value);
  }
  const semantic = {
    '--ui-button-bg': 'var(--theme-node-panel-light)',
    '--ui-button-bg-active': 'var(--theme-node-active)',
    '--ui-button-text': 'var(--theme-node-text)',
    '--ui-button-text-active': 'var(--ink-on-active)',
    '--ui-warning': 'var(--theme-node-warning)',
    '--ui-danger': 'var(--theme-node-danger)',
    '--ui-success': 'var(--theme-node-success)',
  };
  for (const [key, value] of Object.entries(semantic)) style.setProperty(key, value);
  const rootNodes = resolveThemeNodes({ colors: palette }, tokens, nodeOverrides);
  for (const [key, value] of Object.entries(buildScopedThemeCompatibilityVars(rootNodes))) style.setProperty(key, value);
  applyThemeScopes(ctrl, tokens, palette, nodeOverrides, resolved.scopeNodeOverrides, resolved.presentation);
  // area-hero 横幅渐变（跟随主题 primary 的光晕）
  style.setProperty('--hero-gradient', heroGradient(tokens['primary'] ?? SYSTEM_DEFAULT_PRIMARY, tokens));
  // 主题变量重算后同步表现目标状态与文字颜色模式，避免状态属性滞留在默认态。
  refreshPresentationHostElements(ctrl);
  refreshBackgroundElements(ctrl);
}

function applyThemeScopes(ctrl: UIController, tokens: Record<string, string>, palette: string[], rootOverrides: ReadonlyMap<import('../presentation/theme-palette').ThemeNodeName, string>, scopeOverrides: Record<string, Partial<Record<import('../presentation/theme-palette').ThemeNodeName, string>>>, presentation: import('../../engine/types/theme').PresentationDef): void {
  const rootNodes = resolveThemeNodes({ colors: palette }, tokens, rootOverrides);
  const themeCascade = createThemeScopeCascade(rootNodes, scopeOverrides);
  ctrl.root.querySelectorAll<HTMLElement>('[data-theme-scope]').forEach(element => {
    const scope = element.dataset.themeScope ?? '';
    const inherited = themeCascade.nodesFor(scope);
    const panelRegion = scope === 'left' || scope.startsWith('left.')
      ? 'leftPanel'
      : scope === 'center' || scope.startsWith('center.')
        ? 'centerPanel'
        : scope === 'right' || scope.startsWith('right.')
          ? 'rightPanel'
          : undefined;
    if (panelRegion) {
      const panelHost = presentation.hosts?.find(host => host.id === panelRegion);
      const configured = panelHost?.opacity
        ?? presentation.panels?.find(panel => panel.region === panelRegion)?.opacity;
      element.style.setProperty('--theme-cluster-opacity', String(Math.max(0, Math.min(1, configured ?? DEFAULT_PANEL_OPACITY))));
      element.style.removeProperty('--theme-cluster-background');
    }
    for (const [key, value] of Object.entries(buildScopedThemeNodeVars(inherited))) {
      element.style.setProperty(key, value);
    }
    for (const [key, value] of Object.entries(buildScopedThemeCompatibilityVars(inherited))) element.style.setProperty(key, value);
  });
}

/**
 * :root 实际注入的变量表（与 applyTheme 同一构造路径）。
 * 背景合成色服务用它求值 var()——只有这里才是 :root 作用域的真值。
 */
export function rootThemeVars(resolved: ResolvedTheme): ThemeTree {
  const primary = resolved.tokens['primary'] ?? SYSTEM_DEFAULT_PRIMARY;
  const palette = resolved.palette.length > 0 ? resolved.palette : [primary];
  const nodeOverrides = new Map(Object.entries(resolved.nodeOverrides) as [ThemeNodeName, string][]);
  return buildThemeTree(resolved.tokens, primary, palette, nodeOverrides);
}

export function backgroundView(ctrl: UIController) {
  const theme = ctrl.game.colorSystem.runtimeTheme();
  return buildBackgroundView(
    theme.background,
    ctrl.game.pics,
    theme.tokens,
    theme.systemColorLayerIgnored,
    theme.palette,
    rootThemeVars(theme),
  );
}

export function presentationView(ctrl: UIController) {
  const theme = ctrl.game.colorSystem.runtimeTheme();
  return buildPresentationView(theme.presentation, ctrl.game.pics, {
    evaluateCondition: condition => ctrl.game.conditionSystem.evaluate(condition, ctrl.game.state),
  });
}

/** Init / GlobalEnh 选择页共享的全局基底视图，不继承离开前的 Init、Area、Student 或剧情临时层。 */
export function selectorBaseBackgroundView(ctrl: UIController) {
  const theme = ctrl.game.colorSystem.selectorBaseTheme();
  return buildBackgroundView(
    theme.background,
    ctrl.game.pics,
    theme.tokens,
    theme.systemColorLayerIgnored,
    theme.palette,
    rootThemeVars(theme),
  );
}

export function selectorBasePresentationView(ctrl: UIController) {
  const theme = ctrl.game.colorSystem.selectorBaseTheme();
  return buildPresentationView(theme.presentation, ctrl.game.pics, {
    evaluateCondition: condition => ctrl.game.conditionSystem.evaluate(condition, ctrl.game.state),
  });
}

export function refreshPresentationHostElements(ctrl: UIController, hostIds?: readonly string[]): void {
  const context = createUIContext(ctrl.game, backgroundView(ctrl), presentationView(ctrl));
  refreshPresentationHostElementsIn(ctrl.root, context, hostIds);
}

/** 在指定只读上下文中刷新表现宿主；选择页用它投影聚焦主题而不污染运行时主题。 */
export function refreshPresentationHostElementsIn(root: ParentNode, context: UIContext, hostIds?: readonly string[]): void {
  const filter = hostIds ? new Set(hostIds) : undefined;
  root.querySelectorAll<HTMLElement>('[data-theme-host-id]').forEach(element => {
    const hostId = element.dataset.themeHostId;
    if (!hostId || (filter && !filter.has(hostId))) return;
    const current = element.querySelector<HTMLElement>(':scope > .presentation-host-background');
    const state = element.dataset.themeState === 'active'
      ? 'active'
      : element.dataset.themeState === 'disabled'
        ? 'disabled'
        : element.dataset.themeState === 'inactive'
          ? 'inactive'
          : 'default';
    const resolved = context.presentationHostState(hostId, state);
    element.dataset.themeTextMode = resolved.textColorMode;
    if (state === 'inactive') element.dataset.themeHoverTextMode = context.hoverTextColorModeForHost(hostId);
    else delete element.dataset.themeHoverTextMode;
    const next = renderPresentationHostBackground(context, hostId, 'presentation-host-background', state);
    if (next) {
      if (current) current.outerHTML = next;
      else element.insertAdjacentHTML('afterbegin', next);
    } else {
      current?.remove();
    }
  });
}

/** 仅更新已存在的背景节点，不重建游戏主体 DOM。 */
export function refreshBackgroundElements(ctrl: UIController): void {
  const context = createUIContext(ctrl.game, backgroundView(ctrl), presentationView(ctrl));
  syncOuterBackground(context.background);
  ctrl.root.querySelectorAll<HTMLElement>('.ui-cluster > .console-panel-background').forEach(current => {
    const cluster = current.parentElement;
    const scope = cluster?.dataset.themeScope;
    if (!scope) return;
    const [region, tab] = scope.split('.', 2);
    const hostId = region === 'left' ? `leftPanel.${tab ?? 'area'}` : region === 'center' ? `centerPanel.${tab ?? 'chat'}` : region === 'right' ? `rightPanel.${tab ?? 'spot'}` : undefined;
    if (!hostId) return;
    const background = scope === 'center.conversation'
      ? context.background
      : context.backgroundForHost(hostId);
    current.outerHTML = renderBackground(background, 'console-panel-background');
  });
}
