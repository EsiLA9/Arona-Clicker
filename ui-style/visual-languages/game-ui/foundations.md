# 游戏界面基础与主题特例

**已采用。** 游戏界面的通用面板、文字和卡片角色见 [[ui-style/foundations|共享视觉基础]]。下列规则适用于游戏主体与星图。

## 外壳间距

内部 `.console-shell` 的顶部与水平留白对齐星图 `.selector-graph-shell > .selector-topbar`：顶部 22px，左右 `clamp(18px, 3vw, 44px)`，保留内部页脚需要的底部 20px。正文仍在顶栏下方按正常流占满剩余高度。三栏比例、栏间距、面板内边距与各自滚动宿主保持现有入口。依据为 `layout.css`、`selectors.css`。共享框架回归见 `tests/ui/area-map/map-shell-layout.test.ts`、`workspace-structure.test.ts`。

## 品牌与背景对比

顶部 `.brand-lockup`（AronaClicker 标识）的前景色使用 `--ink-on-canvas`，按实际背景图层的合成代表色自动选择深 / 浅字色，随主题变量更新保留原 DOM。选择页使用当前聚焦背景的局部投影。`readableOnColor` 无法解析颜色，或画布没有可判定背景时，默认浅色文字。仍可判定的亮底继续使用深字。入口为 `engine/core/color.ts`、`controller-theme.ts`、`selector-theme.ts` 与 `layout.css`。行为与样式验证见 `tests/ui/theme/header-brand-color.test.ts`。
