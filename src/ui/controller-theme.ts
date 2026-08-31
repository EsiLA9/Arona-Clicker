// ============================================================
// ui/controller-theme.ts — UI 控制器：主题运行时注入
// 从 controller.ts 拆出：applyTheme / restoreThemeFloat
//   （theme-tree.ts 是纯色彩树/静态映射；本模块负责场景栈合并 +
//    CSS 变量注入的运行时逻辑）
// ============================================================

import { THEME_NODES, buildThemeVars, heroGradient, type ThemeVarName } from './theme-tree';
import { entityKeyOf, hexToRgbTriplet } from '../engine/system/color-system';
import type { UIController } from './controller';

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
  // 剧情未播放时清除剧情临时演出层（setTheme 仅在演出期间生效）
  if (!ctrl.game.getView().currentStory) {
    ctrl.game.colorSystem.clearStoryTheme();
  }
  const areaId = ctrl.game.getView().currentAreaId;
  if (areaId) {
    const area = ctrl.game.registry.areas.get(areaId);
    // 实体主题槽覆盖（设计/自定义）优先，否则声明默认
    const override = area
      ? ctrl.game.colorSystem.entityThemeOverride(ctrl.game.state, entityKeyOf('area', areaId))
      : null;
    const theme = override ?? area?.theme;
    if (theme) {
      ctrl.game.colorSystem.pushSceneTheme({ scope: 'area', groupId: theme.colorGroupId, tokens: theme.tokens });
    }
  }
  const convId = ctrl.panelState.conversationVariantId;
  if (convId) {
    const variant = ctrl.game.registry.characterVariants.get(convId);
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
        ctrl.game.colorSystem.pushSceneTheme({ scope: 'student', groupId: override.colorGroupId, tokens: override.tokens });
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
          tokens: variant.theme?.tokens,
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
      if (key.startsWith('--ac-') || key.startsWith('--ink-on-') || key.startsWith('--muted-on-')) {
        style.removeProperty(key);
      }
    }
    for (const name of Object.keys(THEME_NODES) as ThemeVarName[]) {
      style.removeProperty(`--${name}`);
    }
    style.removeProperty('--hero-gradient');
  };
  removeInjected();
  syncRuntimeTheme(ctrl);
  const resolved = ctrl.game.colorSystem.runtimeTheme();
  if (resolved.layers.length === 0) return; // 无任何层：移除覆盖，回退到 :root fallback
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
  // area-hero 横幅渐变（跟随主题 primary 的光晕）
  style.setProperty('--hero-gradient', heroGradient(tokens['primary'] ?? '#3b9eff', tokens));
}
