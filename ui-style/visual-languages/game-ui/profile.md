# 游戏界面视觉语言

**已采用。** 适用 Game、人物、服务、背包、Area、准备页、地图与战斗、剧情／通讯和星图。主界面以主题化面板承载操作，让当前位置、主要内容和上下文各有清楚的区域。剧情与星图将背景、角色、画布作为信息的一部分。

- 普通界面继承 `--canvas`、`--panel`、`--panel-light` 及对应文字和强调角色。面板节奏沿用 `--panel-radius`、`--panel-content-padding` 与 `--panel-region-gap`。同类 Mini Card 沿用 `--card-*`，业务卡面可以按牌面和交互需求使用专用布局。依据为 `src/ui/css/variables.css`、`src/ui/css/layout.css`、`src/ui/css/cards.css`。
- **已观察。** 常规 Console 与星图顶栏的顶部及水平留白已有对齐。品牌标识随背景投影选择 `--ink-on-canvas`，星图标签对照图面背景。进入服务页时的主题来源由现有主题投影延续。依据为 `src/ui/css/layout.css`、`src/ui/css/selectors.css`、`tests/ui/theme/header-brand-color.test.ts`。
- **已观察。** 启动壳在游戏样式就绪前使用自己的深色静态界面，阶段、进度和诊断原位更新。入口为 `src/ui/index.html`，机制见 [[startup-and-runtime]]。

[[ui-style/visual-languages/game-ui/patterns|游戏模式]] · [[ui-style/00-index|返回索引]]
