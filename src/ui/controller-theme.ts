// ============================================================
// ui/controller-theme.ts — UI 控制器：主题运行时注入
// 从 controller.ts 拆出：applyTheme / restoreThemeFloat
//   （theme-tree.ts 是纯色彩树/静态映射；本模块负责场景栈合并 +
//    CSS 变量注入的运行时逻辑）
// ============================================================

import { THEME_NODES, buildThemeTree, buildThemeVars, heroGradient, type ThemeTree, type ThemeVarName } from './theme-tree';
import { entityKeyOf } from '../arona-clicker/services/color-system';
import { rgbTriplet } from '../engine/core/color';
import type { UIController } from './controller';
import { buildBackgroundView, renderBackground } from './background-service';
import type { ResolvedTheme } from '../engine/core/theme-runtime';
import { buildPresentationView, renderPresentationHostBackground } from './presentation-service';
import { DEFAULT_PANEL_OPACITY } from './presentation-config';
import { createUIContext, type UIContext } from './context';
import { buildScopedThemeCompatibilityVars, buildScopedThemeNodeVars, buildThemeNodeVars, resolveScopedThemeNodes, resolveThemeNodes, type ThemeNodeName } from './theme-palette';
import { SYSTEM_DEFAULT_PRIMARY } from '../engine/core/theme-defaults';
import { syncOuterBackground } from './outer-background';

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
 * 重建运行时场景层（保留玩家基色与临时演出层）：
 * 先清空 area/student 场景栈，再按当前场景（学生对话 > Area）重推。
 * 必须在任何依赖运行时层状态的 UI（如层级优先级色胶囊）生成之前调用，
 * 否则胶囊会读到上一帧的层 → 换色后落后一拍。
 */
export function syncRuntimeTheme(ctrl: UIController): void {
  ctrl.game.colorSystem.popSceneTheme('area');
  ctrl.game.colorSystem.popSceneTheme('init');
  ctrl.game.colorSystem.popSceneTheme('student');
  ctrl.game.colorSystem.syncPlayerThemeFromState(ctrl.game.state);
  ctrl.game.colorSystem.syncUserThemeFromState(ctrl.game.state, ctrl.game.userThemeService.capability().active);
  // 剧情未播放时清除剧情临时演出层（setTheme 仅在演出期间生效）
  if (!ctrl.game.getView().currentStory) {
    ctrl.game.colorSystem.clearStoryTheme();
  }
  const activeInitId = ctrl.game.getView().activeInit;
  const activeInit = activeInitId ? ctrl.game.world.inits.get(activeInitId) : undefined;
  if (activeInit) {
    const resolution = ctrl.game.colorSystem.resolveEntityTheme(ctrl.game.state, entityKeyOf('init', activeInit.id), { declaredTheme: activeInit.theme });
    const theme = resolution.theme;
    if (theme) {
      ctrl.game.colorSystem.pushSceneTheme({ scope: 'init', groupId: theme.colorGroupId, palette: theme.palette, tokens: theme.tokens, nodeOverrides: theme.nodes, background: theme.background, presentation: theme.presentation });
    }
  }
  const areaId = ctrl.game.getView().currentAreaId;
  if (areaId) {
    const area = ctrl.game.world.areas.get(areaId);
    // 实体主题槽覆盖（设计/自定义）优先，否则声明默认
    const resolution = area
      ? ctrl.game.colorSystem.resolveEntityTheme(ctrl.game.state, entityKeyOf('area', areaId), { declaredTheme: area.theme })
      : { theme: null };
    const theme = resolution.theme
      ? { ...resolution.theme, background: resolution.theme.background ?? area?.theme?.background }
      : null;
    if (theme) {
      ctrl.game.colorSystem.pushSceneTheme({ scope: 'area', groupId: theme.colorGroupId, palette: theme.palette, tokens: theme.tokens, nodeOverrides: theme.nodes, background: theme.background, presentation: theme.presentation });
    }
  }
  const convId = ctrl.panelState.conversationVariantId;
  if (convId) {
    const variant = ctrl.game.rosterSystem.getVariant(convId);
    if (variant) {
      const entry = ctrl.game.state.roster?.[convId];
      const equipped = entry?.colorEquipment ?? null;
      const resolution = ctrl.game.colorSystem.resolveEntityTheme(
        ctrl.game.state,
        entityKeyOf('variant', convId),
        { declaredTheme: variant.theme, equippedEquipmentId: equipped },
      );
      if (resolution.theme) {
        // 统一解析实体主题来源（自定义 / 设计 / 装备 / 声明默认）
        const override = resolution.theme;
        ctrl.game.colorSystem.pushSceneTheme({
          scope: 'student',
          groupId: override.colorGroupId,
          palette: override.palette,
          tokens: override.tokens,
          nodeOverrides: override.nodes,
          background: override.background ?? variant.theme?.background,
          presentation: override.presentation ?? variant.theme?.presentation,
        });
      } else {
        // 学生层：优先用其 ColorGroup（装备 > 差分声明）驱动参考树；
        // variant.theme 作为显式覆盖层（仍可被作者手动指定组覆盖）。
        let studentGroupId: string | undefined = variant.theme?.colorGroupId;
        const groupId = equipped
          ? ctrl.game.colorEquipmentSystem.groupOf(equipped)?.id
          : variant.colorGroupId;
        if (!studentGroupId && groupId) {
          studentGroupId = groupId;
        }
        ctrl.game.colorSystem.pushSceneTheme({
          scope: 'student',
          groupId: studentGroupId,
          palette: variant.theme?.palette,
          tokens: variant.theme?.tokens,
          nodeOverrides: variant.theme?.nodes,
          background: variant.theme?.background,
          presentation: variant.theme?.presentation,
        });
      }
    }
  }
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
 * 运行时主题：玩家全局层 + 场景层（当前 Area / 对话学生）按优先级合并。
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
  // 画布文字色按「多图层背景栈的实际合成色」判定，而非只看 tokens.bg：
  // Area / 自定义主题常用深色图层（或半透明叠加）覆盖整页，只读 bg 会写反字色。
  const ink = buildBackgroundView(resolved.background, ctrl.game.pics, tokens, resolved.systemColorLayerIgnored, palette, rootThemeVars(resolved)).ink;
  if (ink) {
    style.setProperty('--ink-on-canvas', ink.text);
    style.setProperty('--muted-on-canvas', `color-mix(in srgb, ${ink.text} 58%, transparent)`);
  }
  style.setProperty('--theme-palette-1', palette[0] ?? tokens['primary'] ?? SYSTEM_DEFAULT_PRIMARY);
  style.setProperty('--theme-palette-2', palette[1] ?? palette[0] ?? tokens['primary'] ?? SYSTEM_DEFAULT_PRIMARY);
  const nodeOverrides = new Map(Object.entries(resolved.nodeOverrides) as [import('./theme-palette').ThemeNodeName, string][]);
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

function applyThemeScopes(ctrl: UIController, tokens: Record<string, string>, palette: string[], rootOverrides: ReadonlyMap<import('./theme-palette').ThemeNodeName, string>, scopeOverrides: Record<string, Partial<Record<import('./theme-palette').ThemeNodeName, string>>>, presentation: import('../engine/types/theme').PresentationDef): void {
  const rootNodes = resolveThemeNodes({ colors: palette }, tokens, rootOverrides);
  const resolvedByScope = new Map<string, typeof rootNodes>();
  const resolveMissingParent = (scope: string): typeof rootNodes => {
    if (!scope || scope === 'root') return rootNodes;
    const cached = resolvedByScope.get(scope);
    if (cached) return cached;
    const parentScope = scope.includes('.') ? scope.slice(0, scope.lastIndexOf('.')) : 'root';
    const resolved = resolveScopedThemeNodes(
      resolveMissingParent(parentScope),
      new Map(Object.entries(scopeOverrides[scope] ?? {}) as [import('./theme-palette').ThemeNodeName, string][]),
    );
    resolvedByScope.set(scope, resolved);
    return resolved;
  };
  ctrl.root.querySelectorAll<HTMLElement>('[data-theme-scope]').forEach(element => {
    const scope = element.dataset.themeScope ?? '';
    const parentScope = scope.includes('.') ? scope.slice(0, scope.lastIndexOf('.')) : 'root';
    // 当前阶段作用域只建立父级继承链；节点覆盖接入后在此处按 scope 查表应用。
    const localOverrides = scopeOverrides[scope];
    const inherited = resolveScopedThemeNodes(
      resolvedByScope.get(parentScope) ?? resolveMissingParent(parentScope),
      new Map(Object.entries(localOverrides ?? {}) as [import('./theme-palette').ThemeNodeName, string][]),
    );
    resolvedByScope.set(scope, inherited);
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
