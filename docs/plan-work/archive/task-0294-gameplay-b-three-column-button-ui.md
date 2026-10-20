# Task 0294：Gameplay B 三栏按钮 UI 第一步

状态：implemented — 2026-10-18 第一阶段代码、定向测试、独立审查及默认内容浏览器验收完成；结果见下文。

## 目标与边界

依据 [[docs/plan-work/archive/draft-0294-gameplay-b-three-column-ui-first-step]]，将新版 Map Workspace 改为左我方、中信息流与操作区、右敌方与背景；只使用文本和按钮。复用普通游戏三栏顶部、共享宽度入口和内部滚动，命令后各栏保持一致且不重建稳定根。

Map／Encounter／Hand／Command／Commit／Save 行为保持原合同。起始到存档复用现有流程，不实现独立标题页、多存档槽、完整历史信息流、卡牌或拖拽。

## 已核实实现与施工安排

- 施工前 `map-workspace.ts` 将整个 Encounter 放右侧，`map-workspace.css` 使用独立标题栏和 22/48/30 宽度；两位 Luna 已核对普通游戏 Talk／三栏顶部与新版只读数据。
- `UIController.requestMapWorkspaceRefresh`／`refreshMapEncounterRegion` 原来将稳定遭遇命令只更新右侧。布局拆分后改为一次 detached View 生成候选 DOM，再在 Map 专属协调入口内更新变化的节点，保留有语义 key 的控件和区域。
- Luna 布局施工：`src/ui/components/map-workspace.ts`、`src/ui/css/map-workspace.css`。
- Luna 行为回归：`tests/ui/gameplay-b-map-workspace.test.ts`、`tests/ui/gameplay-b-map-vertical-slice.test.ts`；先记录新布局测试失败，再验证实现。
- 主控集成：`src/ui/controller.ts`、Map 专属 `src/ui/workspace/map-dom-updates.ts`、文档和浏览器核验；保持通用 Operation 刷新不变。

## 验收

1. 四种页面状态统一顶部；三列角色、全部按钮与真实滚动归属符合 Draft；宽度消费共享变量。
2. Swap／Target／Ability／Item 不重建三列、滚动 owner、信息流和无关队员；Commit 后左方 HP、信息流回执、右方敌人和操作区一致。
3. 默认正常 Spot 入口和合成战斗均可运行；返回／保存／读取后可继续同一地图，不重抽、不重置 Node。
4. 定向 UI、保存恢复、命中共享结构测试与类型检查；真实浏览器对照顶部、长内容、较窄窗口和基本交互。未完成的验收明确记录，不能用 headless 测试替代。

## 结果记录

### 实际实现

- 左我方与角色候选／目标按钮、中 Talk 式当前信息／最近回执与固定操作区、右敌方与背景／路线已经落地；未引入卡牌、拖拽或新的运行状态。
- active、success、failure、unavailable 共用 `renderPanelHeaderRegion` 顶部。宽度恢复消费三列共享变量；真实内容区独立滚动，较窄窗口由 Map 根承接堆叠结构滚动，避免页脚被挤出或覆盖。
- `patchMapDOM` 保留列、宿主、滚动 owner 和控件身份；主题背景兄弟增删也不会重建内容宿主。删除旧范围前处理浮层；失去焦点时恢复有效控件或当前遭遇标题。回执按 requestId 去重／跟随，原本阅读上文时不跳动。
- 保存／读取仍使用原本地存档服务；正常 Spot 开始、返回、保存、读取、继续由 UI 端到端回归覆盖，不新增 B 专属存档。

### 实际验证

- 最终组合定向测试：五个文件全部通过，共 **40/40**（Map Workspace 15、正常入口 vertical slice 2、Map DOM 连续性 4、共享 Workspace Frame 13、Map 保存恢复 6）。覆盖相同回执文字但 requestId 改变时的底部跟随，以及 HTML 来源名称的文本转义。
- `npx tsc --noEmit`、`npm run check:docs`（errors: 0）与本轮文件差异空白检查通过；未执行全量测试或会写入生成目录的构建。
- 第三位 Luna 独立只读审查未发现剩余阻断代码问题。其提出的回执 ID 跟随与过时风格说明均已处理；新增名称转义回归，确保 Action／Ability／Item 标签以文本显示。
- 浏览器正常路径：从世界线选择进入夏莱办公室，经联络点获取队员、获取地图终端、开始地图、移动现场、选择目标、提交两轮；左方资源、中栏回执与共享余额同步，控制台没有 error。
- 1440×900：三列顶部均约 50.571px、底线 y≈124.571；左侧长内容独立滚动，底部提交操作可见。820×900：两列＋右侧背景堆叠由 Map 根内部滚动，document 高度仍为 900，页脚保持在底部。420×900：三栏堆叠且各栏约 629px，Map 根有界内部滚动；键盘 PageDown 后提交按钮位于 y≈480–512，可达并可提交。
- 浏览器暴露并修正两类 headless 无法证明的问题：Talk 提示／回执文字错误使用 panel ink 导致低对比；共享小屏 height:auto 规则覆盖 Map 内滚动边界。修正仅作用于 Map。
- 截图保存在本次会话的 visualization 目录：`gameplay-b-desktop.jpg`、`gameplay-b-narrow.jpg`、`gameplay-b-mobile.jpg`。浏览器仅实际走默认调查内容；敌方战斗、Ability／Item 与失败终态由合成 fixture 的定向 UI 测试验证，没有把它们宣称为默认内容已有完整战斗。

### 过程与边界

初次测试 collection 曾因布局文件重写时短暂缺失失败，不能算行为 red；文件恢复后观察到属性迁移、稳定节点与焦点断言失败，再逐项修正。另有测试使用了当前 Vitest 不支持的 matcher，已改为受支持的断言后复验；所有失败均未被算成通过。

第一阶段完成，不代表完整历史信息流、独立 B 起始／保存页面、宽度偏好设置或全站顶部迁移完成。本 Task 不结项原 Task 0291／0292 的内容与作者链路。

GALHCG 已按直接改动路径只读复核：Controller、风格页、刷新 Wiki 与计划索引可查询且分页完整；新增 Map 文件／测试／施工记录尚无直接 Evidence 或 maps_to，返回 `unreferenced_path`。没有据此宣称新文件图谱检查通过，也未改图、刷新清单或写 freshness。
