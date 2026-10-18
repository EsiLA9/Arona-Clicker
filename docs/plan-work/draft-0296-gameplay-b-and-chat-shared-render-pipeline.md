# Draft 0296 — Gameplay B 信息流与外部聊天信息流：实现背景、现状与统一渲染管线建议

状态：只读调查 + 草案；不批准具体 Schema、渲染组件 API、删除清单或施工 Task。  
日期：2026-10-18  
关联：`report-0287-gameplay-b-core-migration-investigation.md`（玩法 B 迁移阶段 A 现状）、`06-wiki/50-ui/refresh-update.md`、`06-wiki/30-arona-clicker-domain/story-and-chat.md`、`archive/.../0216-u04-chat-centered-operation-workspace.md`。

> 本文先澄清两条"信息流"各自是怎么来的、现在到底各自跑在哪套机制上，再指出它们目前是**分裂编写**的，最后提出未来应让二者**共享一套渲染流程与机制**的方向，以避免重复造轮子。本文不主张让两条数据流在"产生"层面合并——它们必须保持各自的数据源与 Owner。

---

## 1. TL;DR

- 玩法 B（新版本移植）的信息流与外部"一般聊天信息流"**数据源不同源**：前者来自 `OperationView` / `MapRunWorkspaceView`（玩法 Run 的只读投影），后者来自 `StoryService` / `ChatStream`（剧情 `StoryDef`/`Talklet`）。详见 `report-0287` 第 19–35 行与 `story-and-chat.md`。
- 但二者**呈现形态高度同质**：都是"顶部标题 + 滚动对话流 + 条目（文本/图片/动作卡/提示）+ 底部决策区"，玩法 B 工作区明确以"AC 聊天风格"为设计基线（`0216-u04` 第 54–55 行）。
- 现状是**两套独立渲染实现**：外部聊天用 `.chat-stream` + `ChatStream` + `renderChatHistory/renderChatTexts` + `scroll.ts` 观察器；玩法 B 旧工作区自建 `.operation-chat-stream`（`operation-workspace.ts:1181`），新 Map 工作区自建 `MapRunWorkspaceView` 回执流 + `patchMapDOM`。**没有任何一侧引用另一侧的核心渲染组件。**
- 问题：滚动跟随、条目渲染、覆盖层/横幅、异步指示、读档恢复等被各写一遍，属于资源分裂编写。
- 方向：保留各自数据源与 Owner，**共享"聊天风格流"的渲染原语与机制**（容器、条目模型、滚动策略、覆盖层、刷新集成），让玩法 B 复用而非另起炉灶。

---

## 2. 一、实现背景：两条流各自为何存在

### 2.1 外部一般聊天信息流（Arona Clicker 剧情/聊天）

- 这是 AC 主界面的核心表达层：剧情演出（`StoryEntry` → `StoryDef` 的一页页 `Talklet`）、角色闲聊、羁绊尾巴、好感台阶都经由它呈现。
- 设计上把"演出/聊天"与"玩家状态写入"解耦：`ChatFlowService` 只发表现事件（`clearAll`/`showText`/`showOpeningTitle`），不写 `PlayerState`；已读标记、被动冷却等运行进度经领域 mutation 落地；UI 订阅事件并渲染（`story-and-chat.md` 第 9–13 行）。
- `ChatStream`（`src/ui/chat-stream.ts`）是**前端领域对象**，负责自增 ID、按流隔离的剧情页指纹去重、页级节奏门控（typing/thinking/pause 三阶段）、开幕标题横幅、读档恢复与重渲染回调。它不是数据源，而是"聊天流运行时"。

### 2.2 玩法 B 信息流（为何以聊天样式呈现）

- 玩法 B 的"信息流"是**玩法运行投影的呈现**，不是剧情。最早在 `task-0216` 的 `0216-u04` 中，为降低认知负荷，决定把 `OperationView` 以"AC 聊天风格的主要中心内容"呈现（`0216-u04` 第 3–5 行）：日志与主要决策放在中心对话流，目标/风险放侧栏。
- 新版本移植（C1a 起，见 `report-0287` 第 173–201 行）把语义收敛为 Map / Node / Edge / Encounter。当前 Map 工作区（`task-0288` 起）的信息流是"最近回执"流：以 `requestId` 标识变化，只有原本位于信息流底部时才跟随新回执（`refresh-update.md` 第 46 行），跨遭遇保留的最近回执不等于完整历史日志。
- 关键约束（来自 `0216-u04` 第 54–55、第 11 行）：玩法 B 工作区**只延续 AC 主题 token 与既有 Chat flow 的"皮肤"**；它**不读取 raw definitions/rules**，所有候选由 `OperationView` 提供，文本仅来自样例静态展示 catalog。即"聊天"在这里是 UI 风格，不是聊天系统。

---

## 3. 二、当前实际内容：两侧机制对照

| 维度 | 外部一般聊天信息流 | 玩法 B 信息流（旧聊天中心工作区） | 玩法 B 信息流（新 Map 工作区） |
|---|---|---|---|
| 数据源 / Owner | `StoryService` + `ChatFlowService`；`StoryDef`/`Talklet` 演出内容 | `OperationView`（GameInstance 内 `OperationRuntimeService` 私有 Owner 的只读投影） | `MapRunWorkspaceView`（来自 `MapRunService`，detached 投影） |
| 文案来源 | 剧情内容 + 角色 owner 就绪队列 | `gameplay-b-presentation` 等静态展示 catalog（`GAMEPLAY_B_PRESENTATION`） | `MapRunWorkspaceView` 投影 + 静态坐标/区域常量 |
| 渲染入口 | `center-panel.ts` `renderChatTab` / `contacts.ts` | `operation-workspace.ts` | `map-workspace.ts` `renderMapWorkspace` + `map-dom-updates.ts` `patchMapDOM` |
| 流容器 DOM | `.chat-stream`（通用聊天宿主） | **`.operation-chat-stream`**（`operation-workspace.ts:1181`，独立类） | Map 内"最近回执"区域（独立 region） |
| 条目渲染 | `story.ts`：`renderChatHistory`(ChatEntry) / `renderChatTexts`(ChatTextEntry) / `renderChatImage` | 直接在 `operation-workspace.ts` 内按 `OperationView` 拼 HTML（无 `renderChatHistory` 调用） | 在 `map-workspace.ts` / `map-dom-updates.ts` 内拼 HTML |
| 滚动跟随 | `scroll.ts` 观察 `.chat-stream`，统一"跟随底部 / 保留锚点"逻辑 | 自写：提交前记录 `scrollTop`，原在底部才跟随（`0216-u04` 第 35 行，用 `data-scroll="content-region"`） | 自写：`requestId` 变化 + "原在底部才跟随"（`refresh-update.md` 第 46 行，`data-map-focus-key` 焦点保持） |
| 异步/节奏指示 | `ChatStream` 门控（typing 省略号 / thinking / pause）+ 开幕横幅 `story-gate.ts` | 各自的状态色阶/危险提示（无聊天节奏门控） | 各自的状态/焦点提示 |
| 覆盖层 | `story-gate.ts`：`renderOpeningBanner` / `renderStoryGate` | 玩法自有 gate/提示（未复用 story-gate） | 玩法自有浮层清理（`refresh-update.md` 第 45 行） |
| 刷新集成 | `ChatStream.onChange` 触发重渲染；`controller-events.ts` 调 `ctrl.chat.clearAll/clearAllTexts` | `UIController` behavior/region/structure 刷新（`0216-u04` 第 23–38 行） | `UIController.refreshMapWorkspaceRegion` → `patchMapDOM`，沿用 dispatcher 收敛（`refresh-update.md` 第 42–44 行） |
| 读档恢复 | `ChatStream.restoreHistoryState`（`chat-stream.ts:77`）重建去重指纹与 ID 计数 | 由 Registry 重建 `OperationView`（不进聊天历史） | 由 Registry 重建 `MapRunWorkspaceView` |
| 是否引用对方核心组件 | 否 | **否**（导入仅 `OperationView` 类型 + 展示文案，`workspace-frame`，无 `story.ts`/`ChatStream`） | **否**（导入仅 `MapRunWorkspaceView` 类型 + `workspace-frame`，无 `ChatStream`） |

**事实印证（可直接复核）：**
- 外部聊天容器与观察器：`src/ui/components/center-panel.ts:82` 的 `<div class="chat-stream">`；`src/ui/scroll.ts:47,71,92` 注释"对话空间或一般聊天：两者都有 `.chat-stream`"。
- 玩法 B 旧工作区独立容器：`src/ui/components/operation-workspace.ts:1181` 的 `<div class="operation-chat-stream" data-scroll="content-region" data-operation-log role="log" ...>`。
- 玩法 B 新工作区源投影：`src/ui/components/map-workspace.ts:1-15` 仅导入 `MapRunWorkspaceView` 类型与 `workspace-frame`，无聊天组件。
- 二者"聊天样式"只是主题 token 复用：`0216-u04` 第 54–55 行"延续 AC 主题 token 与既有 Chat flow"。

---

## 4. 三、问题：资源分裂编写

当前三条（外部聊天、玩法 B 旧工作区、玩法 B 新 Map 工作区）各写一遍以下能力，彼此不共享：

1. **流容器与 CSS**：`.chat-stream` vs `.operation-chat-stream` vs Map 内部 region，三套样式与布局约定。
2. **滚动跟随策略**：`scroll.ts` 的 `.chat-stream` 观察器是一套实现；玩法 B 两侧各自记录 `scrollTop` / `requestId` 重做"在底部才跟随"逻辑。同一语义三份代码。
3. **消息条目渲染**：`ChatEntry`/`ChatTextEntry` + `renderChatHistory`/`renderChatTexts`/`renderChatImage` 是一套；玩法 B 两侧在各自文件内直接拼 HTML，无共享条目模型。
4. **覆盖层 / 横幅 / 确认 gate**：`story-gate.ts`（开幕横幅 + 剧情确认浮层）是一套；玩法 B 两侧另写自己的 gate/提示与浮层清理。
5. **异步/等待指示**：`ChatStream` 的 typing/thinking/pause 节奏门控是一套机制；玩法 B 如需要"AI 思考中 / 待提交"等提示，大概率又会重写一遍。
6. **读档恢复 / 去重**：`ChatStream.restoreHistoryState` 处理去重指纹与 ID 计数；玩法 B 由 Registry 重建投影，但"流内连续性（锚点、未读、焦点）"仍需各做。

后果：任何聊天流体验的改进（滚动手感、无障碍 `aria-live`、输入法组合、主题背景增删不重建宿主）都要在多处同步维护；玩法 B 的聊天风格 UI 也享受不到聊天侧已沉淀的交互细节。

---

## 5. 四、未来方向：共享一套渲染流程与机制

### 5.1 原则

- **数据仍分源、呈现可共享。** `StoryService`/`ChatStream` 与 `OperationRuntimeService`/`MapRunService` 是不同 Owner，绝不能互相写入或合并投影。共享的是"聊天风格流"的**渲染原语与机制**，不是数据源。
- **玩法 B 把投影"翻译"成统一条目，再交给共享渲染器。** `OperationView` / `MapRunWorkspaceView` 在进入共享组件前，仍由各自 View 投影提供；只有"怎么画成聊天流"这一层统一。
- **不在玩法 B 里引入剧情专属机制。** `ChatStream` 的剧情页指纹去重、节奏门控、被动闲聊是剧情语义，玩法 B 不应复用；可复用的是**通用容器、条目、滚动、覆盖层骨架**。
- **尊重现有架构纪律。** 改 UI 呈现仍按 `refresh-update.md` 的 behavior/region/structure 刷新等级与 `workspace-routing` Surface token；共享渲染器应接入 `UIController` 的 dispatcher 收敛点，而不是各自 `render()`。

### 5.2 建议的共享层（概念，待阶段 B/负责人裁定 API）

| 能力 | 现状（分裂） | 建议（共享） |
|---|---|---|
| 流容器 | `.chat-stream` / `.operation-chat-stream` / Map region 各一套 | 统一"聊天流宿主"组件 + 主题 token；玩法 B 复用 `.chat-stream` 作为宿主，不再新建独立类 |
| 条目模型 | `ChatEntry`/`ChatTextEntry` vs 玩法 B 内联 HTML | 统一可选条目类型（文本 / 图片 / 动作卡 / 提示 / 分隔 / 状态变更），玩法 B 把 `OperationView`/`MapRunWorkspaceView` 投影成同一类条目 |
| 条目渲染器 | `story.ts` 一组 + 玩法 B 两组 | 一组共享 `renderStreamEntry`；玩法 B 只提供投影，不自带渲染 |
| 滚动跟随 | `scroll.ts` + 玩法 B 两处自写 | `scroll.ts` 的 `.chat-stream` 观察器作为唯一实现；玩法 B 通过同一宿主与观察器获得"底部跟随 / 锚点保持" |
| 覆盖层 / 横幅 / gate | `story-gate.ts` + 玩法 B 各自 | `story-gate.ts` 作为通用覆盖层基线（开幕横幅、确认浮层、提示），玩法 B 复用其 DOM 与清理协议 |
| 异步指示 | `ChatStream` 门控 + 玩法 B 自写 | 把"省略号 / 思考中 / 待提交"做成可插拔装饰层，由共享渲染器统一管理，剧情与玩法各自提供状态 |
| 刷新集成 | `ChatStream.onChange` / `patchMapDOM` 各自 | 共享渲染器暴露 region/behavior 刷新入口，统一接入 `UIController` dispatcher（已是单次收敛点，`refresh-update.md` 第 18 行） |
| 读档 / 连续性 | `restoreHistoryState` + 玩法 B 各自 | 统一"流连续性"接口（锚点、焦点 `data-map-focus-key`、底部跟随标志），各数据源各自填充 |

### 5.3 迁移注意事项

- **不要硬接 `ChatStream`。** `ChatStream` 携带剧情语义（StoryDef 指纹、节奏门控、被动闲聊）。玩法 B 应只接入"通用流容器 + 条目渲染 + 滚动观察器 + 覆盖层骨架"，而不是把 Run 文本塞进 `ChatStream` 的剧情去重逻辑。
- **保留玩法 B 的 Surface token 纪律。** Map 工作区已有 `data-map-focus-key`、`requestId` 回执标识、范围外浮层清理等约定（`refresh-update.md` 第 44–46 行），共享渲染器需容纳这些专属键，而不是削平它们。
- **逐工作区切换。** 建议先在玩法 B 新 Map 工作区试点统一渲染器（它已是 `patchMapDOM` + dispatcher 模式，耦合面最小），再回退替换旧的 `operation-workspace.ts` 的 `.operation-chat-stream`。
- **验收：** 玩法 B 工作区与聊天在滚动跟随、`aria-live`、条目渲染、覆盖层行为上共用同一实现（单测分别覆盖两侧场景）；改一处滚动/条目逻辑，两侧同时受益且无回归。

---

## 6. 待负责人裁定

- 共享渲染器的边界：哪些条目类型进"统一条目模型"，哪些仍是玩法/剧情专属？
- 是否把 `.operation-chat-stream` 在新版本中直接改为复用 `.chat-stream`（含 CSS 迁移）？
- 异步指示层是否需要在阶段 B 就定义，还是留到玩法 B 的交互命令（Swap/Command/Commit）定型后？
- 是否需要在 `frontend-design` 领域包里正式登记"聊天风格流"为共享 UI 原语？

---

## 7. 调查范围与限制

- 本文基于源码与 docs-829 的只读核查；未修改产品代码、Schema、Datapack 或测试。
- 引用的行号来自当前工作区快照（`operation-workspace.ts`、`map-workspace.ts`、`chat-stream.ts`、`scroll.ts`、`center-panel.ts`、`story-gate.ts`、`refresh-update.md`、`story-and-chat.md`、`0216-u04`、`report-0287`）；若相关文件后续改动，需重新核对行号与导入。
- 本文是草案，不授权任何施工、删除或架构合并；进入实现前需负责人确认第 6 节议题与第 5.2 节 API 边界。
