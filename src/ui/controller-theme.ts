// ============================================================
// ui/controller-theme.ts — UI 控制器：主题运行时注入
// 从 controller.ts 拆出：applyTheme / restoreThemeFloat
//   （theme-tree.ts 是纯色彩树/静态映射；本模块负责场景栈合并 +
//    CSS 变量注入的运行时逻辑）
// ============================================================

import { THEME_NODES, buildThemeVars, heroGradient, type ThemeVarName } from './theme-tree';
import { entityKeyOf, hexToRgbTriplet } from '../arona-clicker/services/color-system';
import type { UIController } from './controller';
import { buildBackgroundView } from './background-service';
import { buildPresentationView } from './presentation-service';
import { buildScopedThemeCompatibilityVars, buildScopedThemeNodeVars, buildThemeNodeVars, deriveBackgroundGradient, resolveScopedThemeNodes, resolveThemeNodes, type ThemeMode } from './theme-palette';

/**
 * 主题浮窗跨 render 重建 #app 的存活：render 全量重建会销毁浮窗 DOM，
 * 这里在重建后依据持久化的开关键与位置重新打开并归位，使其不被其它 DOM 刷新干掉。
 */
export function restoreThemeFloat(ctrl: UIController): void {
  const float = ctrl.root.querySelector<HTMLElement>('[data-theme-float]');
  if (!float) return;
  if (ctrl.themeFloatOpen) {
    float.classList.add('open');
    if (ctrl.themeFloatPos) {
      float.style.left = `${ctrl.themeFloatPos.x}px`;
      float.style.top = `${ctrl.themeFloatPos.y}px`;
      float.style.right = 'auto';
    }
  } else {
    float.classList.remove('open');
  }
}

/**
 * 重建运行时场景层（保留玩家基色与临时演出层）：
 * 先清空 area/student 场景栈，再按当前场景（学生对话 > Area）重推。
 * 必须在任何依赖运行时层状态的 UI（如层级优先级色胶囊）生成之前调用，
 * 否则胶囊会读到上一帧的层 → 换色后落后一拍。
 */
export function syncRuntimeTheme(ctrl: UIController): void {
  ctrl.game.colorSystem.popSceneTheme('area');
  ctrl.game.colorSystem.popSceneTheme('student');
  ctrl.game.colorSystem.syncPlayerThemeFromState(ctrl.game.state);
  ctrl.game.colorSystem.syncUserThemeFromState(ctrl.game.state, ctrl.game.userThemeService.capability().active);
  // 剧情未播放时清除剧情临时演出层（setTheme 仅在演出期间生效）
  if (!ctrl.game.getView().currentStory) {
    ctrl.game.colorSystem.clearStoryTheme();
  }
  const areaId = ctrl.game.getView().currentAreaId;
  if (areaId) {
    const area = ctrl.game.world.areas.get(areaId);
    // 实体主题槽覆盖（设计/自定义）优先，否则声明默认
    const override = area
      ? ctrl.game.colorSystem.entityThemeOverride(ctrl.game.state, entityKeyOf('area', areaId))
      : null;
    const theme = override
      ? { ...override, background: override.background ?? area?.theme?.background }
      : area?.theme;
    if (theme) {
      ctrl.game.colorSystem.pushSceneTheme({ scope: 'area', groupId: theme.colorGroupId, palette: theme.palette, tokens: theme.tokens, nodeOverrides: theme.nodes, background: theme.background, presentation: theme.presentation });
    }
  }
  const convId = ctrl.panelState.conversationVariantId;
  if (convId) {
    const variant = ctrl.game.rosterSystem.getVariant(convId);
    if (variant) {
      const entry = ctrl.game.state.roster?.[convId];
      const equipped = entry?.equippedEquipment ?? null;
      const override = ctrl.game.colorSystem.entityThemeOverride(
        ctrl.game.state,
        entityKeyOf('variant', convId),
        equipped,
      );
      if (override) {
        // 实体主题槽覆盖（设计/装备/自定义）：直接采用
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

/**
 * 激活主题 → CSS 变量注入。
 * 运行时主题：玩家全局层 + 场景层（当前 Area / 对话学生）按优先级合并。
 */
export function applyTheme(ctrl: UIController): void {
  const style = document.documentElement.style;
  const removeInjected = () => {
    // 索引遍历而非展开（CSSStyleDeclaration 迭代器在 happy-dom 下不可用）
    for (let i = 0; i < style.length; i++) {
      const key = style.item(i);
      // 清理所有引擎 / 语义层注入：--ac-*、背景节点自身、以及背景感知文字色（ink-on/muted-on）
      if (key.startsWith('--ac-') || key.startsWith('--ink-on-') || key.startsWith('--muted-on-') || key.startsWith('--theme-node-')) {
        style.removeProperty(key);
      }
    }
    for (const name of Object.keys(THEME_NODES) as ThemeVarName[]) {
      style.removeProperty(`--${name}`);
    }
    style.removeProperty('--hero-gradient');
    style.removeProperty('--theme-bg-gradient');
  };
  removeInjected();
  syncRuntimeTheme(ctrl);
  const resolved = ctrl.game.colorSystem.runtimeTheme();
  const tokens = resolved.tokens;
  // 引擎强制设色层：合并后的 token 注入为 --ac-*
  for (const [key, value] of Object.entries(tokens)) {
    style.setProperty(`--ac-${key}`, value);
  }
  style.setProperty('--ac-primary-rgb', hexToRgbTriplet(tokens['primary'] ?? '#3b9eff'));
  // 界面语义层：由色彩树展开，引擎 --ac-* 优先、否则自动衍生；
  // 传入真实 tokens 使背景节点上的文字色（--ink-on-*）按背景明暗正确选白/黑
  const vars = buildThemeVars(tokens['primary'] ?? '#3b9eff', {}, tokens);
  for (const [key, value] of Object.entries(vars)) {
    style.setProperty(`--${key}`, value);
  }
  const palette = resolved.palette.length > 0 ? resolved.palette : [tokens['primary'] ?? '#3b9eff'];
  const themeMode: ThemeMode = 'light';
  const nodeOverrides = new Map(Object.entries(resolved.nodeOverrides) as [import('./theme-palette').ThemeNodeName, string][]);
  for (const [key, value] of Object.entries(buildThemeNodeVars({ colors: palette }, tokens, nodeOverrides))) {
    style.setProperty(key, value);
  }
  const rootNodes = resolveThemeNodes({ colors: palette }, tokens, nodeOverrides);
  for (const [key, value] of Object.entries(buildScopedThemeCompatibilityVars(rootNodes))) style.setProperty(key, value);
  applyThemeScopes(ctrl, tokens, palette, nodeOverrides, resolved.scopeNodeOverrides, resolved.presentation);
  style.setProperty('--theme-bg-gradient', resolved.systemColorLayerIgnored ? 'transparent' : deriveBackgroundGradient(palette, themeMode));
  // area-hero 横幅渐变（跟随主题 primary 的光晕）
  style.setProperty('--hero-gradient', heroGradient(tokens['primary'] ?? '#3b9eff', tokens));
}

function applyThemeScopes(ctrl: UIController, tokens: Record<string, string>, palette: string[], rootOverrides: ReadonlyMap<import('./theme-palette').ThemeNodeName, string>, scopeOverrides: Record<string, Partial<Record<import('./theme-palette').ThemeNodeName, string>>>, presentation: import('../engine/types/theme').PresentationDef): void {
  const rootNodes = resolveThemeNodes({ colors: palette }, tokens, rootOverrides);
  const resolvedByScope = new Map<string, typeof rootNodes>();
  ctrl.root.querySelectorAll<HTMLElement>('[data-theme-scope]').forEach(element => {
    const scope = element.dataset.themeScope ?? '';
    const parentScope = scope.includes('.') ? scope.slice(0, scope.lastIndexOf('.')) : 'root';
    // 当前阶段作用域只建立父级继承链；节点覆盖接入后在此处按 scope 查表应用。
    const localOverrides = scopeOverrides[scope];
    const inherited = resolveScopedThemeNodes(
      resolvedByScope.get(parentScope) ?? rootNodes,
      new Map(Object.entries(localOverrides ?? {}) as [import('./theme-palette').ThemeNodeName, string][]),
    );
    resolvedByScope.set(scope, inherited);
    const panelRegion = scope === 'left' ? 'leftPanel' : scope === 'center' ? 'centerPanel' : scope === 'right' ? 'rightPanel' : undefined;
    if (panelRegion) {
      const configured = presentation.panels?.find(panel => panel.region === panelRegion)?.opacity;
      element.style.setProperty('--theme-cluster-opacity', String(Math.max(0, Math.min(1, configured ?? 0.8))));
    }
    for (const [key, value] of Object.entries(buildScopedThemeNodeVars(inherited))) {
      element.style.setProperty(key, value);
    }
    for (const [key, value] of Object.entries(buildScopedThemeCompatibilityVars(inherited))) element.style.setProperty(key, value);
  });
}

export function backgroundView(ctrl: UIController) {
  const theme = ctrl.game.colorSystem.runtimeTheme();
  return buildBackgroundView(theme.background, ctrl.game.pics, theme.tokens);
}

export function presentationView(ctrl: UIController) {
  const theme = ctrl.game.colorSystem.runtimeTheme();
  return buildPresentationView(theme.presentation, ctrl.game.pics, {
    evaluateCondition: condition => ctrl.game.conditionSystem.evaluate(condition, ctrl.game.state),
  });
}
