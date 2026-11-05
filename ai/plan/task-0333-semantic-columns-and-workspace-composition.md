# Task 0333：提取按内容命名的栏，由 Workspace 组织经典界面

状态：代码与自动化验收完成 — 内容与对应 Workspace 迁移、独立复核缺项均已补齐；用户明确暂缓浏览器视觉验收，保留该待办而不归档。

2026-10-28 独立完成度复核摘要曾指出：旧位置分发入口清理和直接调用迁移已确认，但可见栏刷新仍受旧位置状态限制、区域栏动作配置未接通、默认适配覆盖调用方回调、独立聊天滚动仍受全局页签限制。复核报告正文已随旧归档清理；下文后续施工和验收记录为当前依据。

## 目标与范围

将 `right-panels`、`center-panel`、`rail` 中仍按左中右组织的内容，提取为按用途命名的完整栏，交由 Workspace 决定调用、排序、宽度、页签及导航。默认界面保留现有功能和外观；同一内容栏可以在另一位置、另一 Workspace 或普通容器中使用。

本 Task 承接 Task 0332（原归档已删除） 的有序栏、实例、动作和滚动基础，补齐经典游戏页的实际内容迁移。0332 已归档，但它记录的浏览器视觉验收仍未完成；本 Task 不自动关闭或代替该验收。

直接范围：

- 经典 Game 的区域导航、聊天、日志、设施、学生信息、强化及“其他”内容；复用已有聊天、通讯录、角色栏，而非再实现一份。
- Game Workspace 的内容选择、页签组织、显式业务绑定与导航适配。
- Area、Area Map、Map Entry 对旧区域左面板的调用，以及 Story 对 `rail.ts` 故事导航正文的调用。
- 上述栏相关的事件、元素/区域刷新、滚动、主题、浮层和返回位置兼容。

边界：

- 不仅改文件名，也不把 `renderRightPanel(activeTab)` 原样搬成另一个总分发器。
- 不把全部页签同时展开成更多默认栏，不重新设计业务流程；默认排列与按钮文案保持。
- 不建设栏注册市场、布局 DSL、通用工作流引擎、拖拽编排器或后台页签缓存。
- Map / Operation 的复杂 Run 协调器、Shop 交易流程继续由各自 Workspace 持有；本次只迁移其直接依赖的公共栏，不复制业务 Runtime。
- 保留既有主题 host、scope 和存档中的主题配置含义；不以消灭所有 `left / center / right` 字符串作为完成条件，不改 Schema 或业务存档。
- 只面向现有桌面宽屏；沿用项目主题、几何、顶栏高度和内部滚动约定。

## 调查结论与证据

**当前基础支持此方向，但经典 Game 仍是“有序栏外壳包着旧位置面板”。需要继续拆分内容所有权、装配和更新定位。**

| 调查时已核实事实 | 对应内容入口（调查前 → 当前） | 施工后要求 |
| --- | --- | --- |
| Game 当时仍用 left / center / right key 调用位置面板；外层 surface 为 none，内层才是真面板 | 当前由 `src/ui/workspace/workspace-renderer.ts` 装配 `src/ui/columns/index.ts` 的具名栏 | 已改为稳定展示组 key；每个栏仅有一个 Panel surface |
| 右面板当时同时决定四个页签、正文分派、主题和资源条显隐 | 当前由 `src/ui/columns/index.ts` 提供设施、角色、强化、其他工厂，Game 装配页签及资源条 | 默认资源条仅设施与强化显示，保留原标签与功能 |
| “其他”当时含物品使用、完整背包入口及 Affector 摘要 | 当前正文位于 `src/ui/columns/inventory-effects.ts` | 保持原组合，不额外增加产品页签 |
| 中面板当时决定聊天/日志页签和对话替换；Chat / Log 正文及发送按钮与位置分发器耦合 | 当前正文入口为 `src/ui/columns/chat-content.ts`，栏装配在 `src/ui/columns/index.ts` | Chat 与 Log 独立装配，聊天/发送实现不再依赖位置分发器 |
| 已有 Chat / Contacts / Character 工厂但 Game 未调用；Chat 与发送按钮仍反向依赖位置分发器 | 当前内容工厂在 `src/ui/columns/content-columns.ts`，发送按钮由 `src/ui/columns/chat-content.ts` 提供 | 已收敛为同一套真实内容实现，保持 owner、门控、送达与多实例语义 |
| 区域正文被 Game、Area、Area Map、Map Entry 共用；Story 导航也在同一位置文件 | 当前区域内容在 `src/ui/columns/area-navigation.ts`，Story 导航在 `src/ui/columns/story-navigation.ts`，调用方位于 `src/ui/components/world/area-workspace.ts`、`src/ui/components/map/area-map-workspace.ts`、`src/ui/components/map/map-entry-workspace.ts`、`src/ui/components/story/story-workspace.ts` | 页面直接调用具名内容入口，不再调用左面板分发器 |
| 页签动作集中在全局顶栏绑定函数，解析 `data-tab="right:enh"` 等位置协议后写 PanelState 并刷新固定别名 | `controller/controller-actions-topbar.ts`：`bindTopBarActions()` | 区分 Workspace 页签切换与打开另一个 Workspace；动作交由装配绑定到当前实例 |
| 设施、强化、区域揭示刷新仍依据 rightTab / leftTab；集合核对在全 root 搜索；元素查找只返回首个同实体节点 | `controller.ts`：`refreshCurrentSpotCards()`、`refreshCurrentEnhancementCards()`、`refreshCurrentAreaNav()`、`findSpotCard()`；`controller-core.ts`：`refreshRevealIfChanged()` | 更新入口须定位可见的内容实例；多份设施栏不能被当成重复业务集合或只更新第一份 |
| 聊天、日志的局部更新仍有首个 `.center-panel` 查询；角色动作部分回退到 right 刷新 | `controller.ts`：`refreshChatPanel()`、`refreshLogPanel()`；`controller-actions-contacts.ts` | 以定义/绑定找实际消费者，按实例保留现有局部补丁，不能退化为每次重建整个栏 |
| 区域地图还用旧 data-game-panel 定位左侧正文；设施浮层的方向偏好依赖 `.right-panel` | `workspace/area-map-controller.ts`：`refreshLeft()`；`interaction/popovers.ts` | 改为实例/正文语义定位；浮层方向按实际空间或显式展示配置决定 |
| region 请求已有实例与 ColumnToken；element 请求和去重身份主要是实体 key + hostId，合并覆盖也按 host 前缀 | `update/ui-update-types.ts`、`ui-update-dispatcher.ts`；`controller.ts`：`requestColumnRefresh()` | 复用现有调度器，按需补元素目标的实例范围与失效保护；不可把主题 host 当唯一显示实例 |
| 资源数值行为本身遍历匹配的全部节点，而非只取第一份 | `update/ui-behaviors.ts` | 保留同业务数据的多显示广播；区分有意广播与特定实例的 UI 更新 |
| 位置名称也是真实的主题兼容标识，包含顶部 Tabs、按钮、气泡等子宿主 | `runtime/ui-host-registry.ts`、`shared/tabs.ts`、`presentation-service.ts` | 旧主题映射可以保留；内容类型、动作目标、挂载实例不得因此绑定物理位置 |

机制入口：[[workspace-columns-and-layout]]、[[workspace-navigation-and-rendering]]、[[ui-refresh-focus-scroll]]、[[update-dispatch-and-surface]]、[[story-chat-and-theme-presentation]]。这些页面描述已实现事实，本 Task 下述接口与路径为计划。

## 方案与职责

### 内容栏按用途拆分

优先建立 `src/ui/columns/` 作为完整栏工厂的入口，按职责拆文件；既有领域正文留在原业务组件目录。最终文件名在施工时确定，但不得继续以 left / center / right 表达内容身份。

| 计划内容栏 | 复用来源 | 保留行为 |
| --- | --- | --- |
| 区域导航栏 / `createAreaNavigationColumn` | rail 的区域正文、`renderAreaNavItem()` | 当前区域、可达项、揭示/移动门控、打开区域概览与区域地图 |
| 聊天栏 / `createChatColumn` | 已有 Chat 工厂和 Story / Conversation 正文 | 显式 owner、历史、发送状态、门控、横幅、入口浮层、唯一聊天主滚动 |
| 日志栏 / `createLogColumn` | `renderLogTab()` | 日志列表、计数、导出、清空和诊断；双显示不能共享重复 DOM id 定位 |
| 设施栏 / `createFacilitiesColumn` | `renderProductionNodes()`、`renderSpotCard()` | 设施卡、费用/升级/功能入口、揭示与产出；保留当前区域查询语义 |
| 角色栏 / `createCharacterColumn` | 已有 Character 工厂 | 显式 variantId、装备和培养反馈；未选择的占位状态 |
| 强化栏 / `createEnhancementsColumn` | `renderEnhancements()`、强化卡渲染 | 可见性、购买、管理、条件与数值更新 |
| 物品与效果概览栏 / `createInventoryEffectsColumn` | `renderOtherTab()` | 现有“其他”的物品使用、完整背包入口和效果追踪；不复制完整 Inventory Workspace |
| 通讯录栏 | 已有 `createContactsColumn()` | 统一提取入口与绑定约定，保持现有选择/未读/导航结果 |

栏工厂只接收需要的只读查询、绑定数据、动作回调和表现选项，不接收整个 UIController，不为了读取一个选择项持有全部 PanelState。设施查询当前区域、角色绑定 variant、聊天绑定 stream owner；任何扩展到非当前区域的操作需另行核实领域命令，不在本次臆造能力。

`src/ui/components/shared/content-columns.ts` 保留兼容 re-export；生产 Workspace 直接使用 `src/ui/columns/index.ts`。区域/故事导航正文、聊天/发送正文已移入按内容命名的模块，生产调用不再依赖旧位置分发器。

### Workspace 组织，而不是栏决定所在位置

沿用 `WorkspaceFrameSpec.columns`、`WorkspaceColumns`、`ColumnActions` 与已有 width / onBack 机制，不再引入另一套 Column runtime。

- Game Workspace 声明区域导航、聊天/日志、设施/角色/强化/其他的默认装配。页签对应哪个内容栏、何时显示资源条、切换时退出哪个对话上下文，均由 Game 装配决定。
- 区域栏头部的通讯录、故事是进入另一 Workspace 的动作，不伪装为区域栏的内部正文页签。
- 内容栏本身可以接收已有 heading / header、资源条等窄配置，不内置“自己总在右边，所以拥有 RIGHT_TABS”的决策。
- 不建设通用页签容器系统：先用 Game 的显式映射和少量绑定完成现有产品；其他 Workspace 逐个设计自己的头部与导航。
- 默认仍保持三处展示区域，但使用有意义的装配 key；一个可切换展示区可有稳定的组 key，当前内容的 definitionId 与 bindingKey 单独表达。内容定义变化时旧 token 必须失效，不能被稳定的组 key 掩盖。
- Area / Area Map / Map Entry 直接调用区域导航栏，在装配中传入各自允许的导航动作与门控；保持其专用更新协调器，不将它们强行改成 Game。
- Story 导航正文迁移到按内容命名的入口；Story / Contacts / Character 继续复用现有内容栏，不另建平行版本。

概念示意，仅表示职责，不是已存在的新 API：

```text
Game Workspace
  区域导航栏（打开通讯录 / Story 的装配动作）
  activity 展示区（Workspace 选择 Chat 或 Log）
  tools 展示区（Workspace 选择 Facilities / Character / Enhancements / Overview）

另一个 Workspace
  同一 Facilities 栏工厂 + 显式查询 / 动作绑定 + 自己的顺序和 width
```

### 更新、状态与兼容收敛

- 先列清现有 `leftTab / centerTab / rightTab` 的读写和 returnTo 恢复路径，收敛到 Workspace 装配状态；允许短期别名适配，但只有一个权威值，不维护两套互相同步的状态。它们是 UI 位置状态，本次不写入 PlayerState 或存档。
- 新内容栏不读取这些位置字段决定业务目标；旧 `refreshPanels()` 仅在适配边界映射到实例。迁移完成后删除无生产调用的固定位置面板渲染函数和总分派逻辑，剩余主题/返回兼容逐项注明用途。
- 通过已挂载的栏定义和 binding 查找可见消费者；一次业务变化可以更新多个实例，每份更新限定在自己的根内。实体 id 相同不代表显示实例相同。
- 设施、强化、区域集合比较在各实例内进行；元素请求、去重、父区域覆盖与过期检查必须区分实例。A 的区域更新不得吞掉 B 的元素更新。共享数值广播应继续更新全部真实消费者。
- 日志按可见日志实例更新；聊天和角色使用显式 owner。日志按钮改为实例范围动作选择器，避免 `#export-log` / `#clear-log` 等首个 id 查询遗漏第二份。
- UI 命令仍由 Controller / GameCommands 适配；一次点击执行一次，不因共享工厂动作与旧全局绑定同时存在而双触发。跨栏选择和页面返回由 Workspace 回调协调。
- 小数值变化保留原位补丁；卡片变化只替换对应卡，集合变化只恢复所属内容区；切换内容可替换所属栏，兄弟栏与 Shell 不变。缺失恢复按元素 → 所属栏 → 当前 Workspace 逐级扩大，不默认全 App 重建。
- 换序、改宽继续移动已有节点或更新 track；实例更新保留焦点、阅读位置和范围外浮层。替换前执行现有 popover 生命周期，释放实例绑定和旧异步 token。

### 表现与 DOM 约束

- 旧 `rightPanel.spot`、`centerPanel.chat` 等 host / scope 作为来源外观映射保留；Tabs、按钮、气泡、资源条也保持原主题继承。未重新设计主题，不能顺手全量重命名 registry / Schema。
- 一个完整栏由共享列根承载身份与 Panel surface，内含头部、可选资源条、正文/固定操作区。优先复用已有节点层级；若需要保留内层业务 Panel，须明确唯一 surface 的归属，不出现双边框、双背景和双主滚动。
- 默认样式不可继续靠目标物理位置决定；浮层方向采用实际可用空间或显式展示配置。保留旧 class 仅为外观兼容时注明用途。
- 必须纳入最近已修复的布局回归：上栏统一最小内容高度并可换行，topbar 不收缩，MapRun / Map Entry 外层占用剩余高度，中右面板内容撑满宽度，底部操作区不被挤出。
- 本轮只调查，不修改 `ui-style/` 为“已实现”；施工稳定后再更新对应条目和机制说明。

## 实施步骤与验收

1. 建立默认界面的行为/外观基线，完成位置字段、主题、动作和刷新调用清单；先补关键的多实例与跨位置行为失败用例。
2. 提取设施、强化、其他、日志、区域导航栏；收敛 Chat / Character / Contacts 的正式入口及正文依赖。逐项保持原默认表现。
3. Game 改为显式组织栏、页签、资源条与导航；迁移 Area / Area Map / Map Entry、Story 的公共调用和返回恢复路径。
4. 收敛事件与按实例的元素/区域更新，验证真实业务联动；删除失效分发器与无调用适配，记录保留的主题兼容标识。
5. 完成定向回归、类型/架构/文档/构建检查和桌面视觉验收，更新机制与风格记录；集中做直接路径的地图只读复核。

| 验收场景 | 必须可观察的结果 |
| --- | --- |
| 独立栏 | 设施、强化、日志、区域导航等均能由正式工厂直接调用；不必伪造 rightTab / centerTab 或先进入原 Workspace |
| 默认 Game | 原页签、资源条显隐、对话替换、设施动作、角色操作、日志管理和其他摘要完整；没有新的默认内容展开或入口丢失 |
| 装配 | 同一设施/强化栏能移到首位、另一 Workspace 和普通容器；只改装配与业务绑定，内容、动作、主题实现无需复制 |
| 多显示与作用范围 | 两份同主题设施栏显示同一设施，更新两份且不把集合误判为变化；日志双实例动作准确；角色/聊天不同 owner 不串目标 |
| 调度 | A 的区域更新与 B 的同实体元素更新同批次提交，B 不被误合并丢弃；旧绑定请求不覆盖新内容；数值广播保留有意的多显示更新 |
| 连续性 | 换序/改宽保留根节点和阅读位置；购买、揭示、培养、日志追加更新实际消费者，兄弟输入/焦点/滚动/浮层不动；无重复业务命令 |
| 导航 | 区域、通讯录、Story、Character 的进入/退出和 returnTo 保持；复用栏的返回结果可以由新 Workspace 绑定 |
| 共享页面 | Area / Area Map / Map Entry 使用正式区域栏；区域地图刷新不再找 data-game-panel=left，门控/地图会话行为不回归 |
| 外观与高度 | 原主题映射可用，未出现双层 Panel、标题变矮、内容横向收缩、全页被内容撑长或双主滚动；准备/续行/阻塞/不可用页均核验 |
| 旧入口清理 | 生产代码不再调用 `renderRightPanel()` / `renderCenterPanel()` / `renderLeftPanel()` 位置总分发器；剩余位置名称只承担明确的主题、旧请求或导航恢复兼容 |

## 相关文件与验证入口

以下路径是调查与施工入口，不是修改白名单；实际变更记录见当前进度和验证结果。

| 路径 / 范围 | 用途 |
| --- | --- |
| `src/ui/columns/index.ts`、`content-columns.ts`、`chat-content.ts`、`area-navigation.ts`、`story-navigation.ts`、`inventory-effects.ts` | 具名栏工厂与按职责拆出的正文 |
| `src/ui/components/shared/rail.ts`、`production.ts`、`header.ts`、`tabs.ts` | `rail.ts` 仅保留兼容内容导出；设施、资源条、标题与顶部动作由正式入口复用 |
| `src/ui/components/character/contacts.ts`、`src/ui/components/inventory/enhancements.ts` | 保留业务正文、发送与角色动作入口 |
| `src/ui/workspace/workspace-renderer.ts`、`workspace-router.ts`、`area-map-controller.ts` | Game 装配、返回位置和共享区域栏更新 |
| `src/ui/components/world/area-workspace.ts`、`src/ui/components/map/area-map-workspace.ts`、`map-entry-workspace.ts`、`src/ui/components/story/story-workspace.ts` | 更新旧公共栏/正文的直接使用者 |
| `src/ui/controller/controller.ts`、`controller-core.ts`、`controller-actions-topbar.ts`、`controller-actions-inventory.ts`、`controller-actions-contacts.ts`、`controller-actions-story.ts` | 动作适配、揭示/内容变更、日志、聊天及位置状态收敛 |
| `src/ui/workspace/workspace-columns.ts`、`column-actions.ts`、`src/ui/update/`、`src/ui/interaction/` | 复用实例生命周期，补元素作用域与浮层/滚动边界 |
| `src/ui/components/shared/workspace-frame.ts`、`src/ui/runtime/ui-host-registry.ts`、`src/ui/css/` | 共享外壳和布局、主题映射；不默认重写 registry |
| `tests/ui/workspace-columns.test.ts`、`content-columns.test.ts`、`workspace-lifecycle.test.ts`、`ui-update-dispatcher.test.ts` | 补真实新栏装配、更新隔离、单次动作及实例失效测试 |
| `tests/ui/context.test.ts`、`theme-tree.test.ts`、`presentation-service.test.ts`、`popovers.test.ts`、`scroll.test.ts` | 默认与跨位置的主题/背景、浮层、滚动回归 |
| `tests/ui/character-cultivation.test.ts`、`spot-payment-modal.test.ts`、`story-node-input.test.ts`、`story-node-delivery.test.ts`、`foreground-interaction.test.ts` | 保留真实命令、门控、培养与 Story 行为 |
| `tests/ui/area-map-controller.test.ts`、`gameplay-b-basic-map-p0-p3.test.ts`、`map-shell-layout.test.ts` | 共享区域栏、进入/续行及最近高度/宽度修复回归 |
| `docs/docs-830/04-presentation/`、`ui-style/patterns.md`、`ui-style/foundations.md` | 施工后同步事实与风格记录；计划不提前写成机制事实 |

测试使用 `npm test`，完整输出写入 `.test-artifacts/latest.log`。施工时新增关键行为回归并运行 UI 验证、`npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs` 和输出到 `.test-artifacts/` 的构建；当前仍有两份已知 Map 夹具测试失败，结果按实际情况记录，视觉验收独立记录。

0332 记录过三份测试中的 26 项既有失败。本轮将 `presentation-text-color-css.test.ts` 的旧路径和过时样式契约迁至现行入口后，13 项全部通过；两份 Map 夹具回归本轮重跑仍有 22 项失败、26 项通过，失败集中在既有 Map 数据/契约问题（缺失 `verify-clue`、空 Enemy roster、没有声明 manual completion action、地图边夹具包含查询投影字段、候选数不符）。本 Task 未改这些夹具或断言，也没有扩大范围修复它们。

## 当前进度与结果

- [x] 核对项目身份、现行栏能力和旧位置组件的直接调用。
- [x] 调查装配、主题、事件、状态、元素/区域刷新及共享页面依赖。
- [x] 写明拆分对象、职责、迁移顺序、兼容边界和验收条件。
- [x] 实施内容栏提取与 Workspace 迁移；正式列入口移入 `src/ui/columns/`，Game 通过 `area-navigation` / `activity` / `tools` 组装。
- [x] 收敛 Controller 页签动作、日志实例动作与区域/设施/强化按栏更新；调度按 column instance/token 区分，浮层方向按可用空间决定。
- [x] 完成定向行为/类型/架构/文档/构建检查，并对直接影响路径做地图只读复核。
- [ ] 完成桌面浏览器视觉验收及可见外观最终核验。

施工时已有自动化行为验证已完成，但独立复核仍发现上述行为缺项，浏览器视觉验收也未执行。默认 Game 保留三处展示位置和现有文案；切换 activity/tools 时保持稳定组 key，并按 `definitionId` / `bindingKey` 失效旧 token。Area / Area Map / Map Entry 使用正式区域导航栏，Story 使用独立故事导航正文。旧 `renderRightPanel()`、`renderCenterPanel()`、`renderLeftPanel()` 生产分发入口已删除；`rail.ts` 仅保留 helper 兼容导出。

子 Agent 交付已整合：一个抽取 Chat/Log 正文和发送按钮到 `src/ui/columns/chat-content.ts`，一个为 UIUpdateDispatcher 增加栏实例/代次隔离与过期校验。主 Agent 已复核调用方、Controller token 来源和实例根查找，并纳入定向回归；均未触及地图写入。

| 本轮检查 | 实际结果 |
| --- | --- |
| UI 回归 | `npm test -- --maxWorkers=4 --minWorkers=1 tests/ui --exclude tests/ui/gameplay-b-map-workspace.test.ts --exclude tests/ui/gameplay-b-map-vertical-slice.test.ts`：98 个测试文件、844 项通过；覆盖内容装配、多实例隔离、导航、Story/Chat、培养、支付、滚动、浮层、主题与视觉样式契约。重点定向子集另有 21 个文件、210 项通过；完整输出 `.test-artifacts/latest.log` |
| Task 0332 Map 夹具既有失败复核 | `gameplay-b-map-workspace.test.ts` 与 `gameplay-b-map-vertical-slice.test.ts`：22 项失败、26 项通过；失败类型与 0332 记录的 Map 数据/契约夹具问题一致，未修改夹具或断言 |
| TypeScript | `npx tsc --noEmit` 通过 |
| 架构 | `npm run check:architecture` 通过 |
| 文档 | `npm run check:docs` 通过，扫描 103 份 Markdown，0 错误 |
| 生产构建 | `npm run build -- --outDir .test-artifacts/task-0333-build-final` 通过；Vite 报现有 game chunk 超过 500 kB 提示 |
| 地图直接路径只读复核 | 已逐路径复核本 Task 直接影响集。已映射路径显示 `content_changed`；旧 `center-panel.ts` / `right-panels.ts` 映射显示 `missing`；新 `src/ui/columns/*`、旧/归档 Task 位置及若干共享页面/测试显示 `unreferenced_path`。这些结果未处理，因为本轮未授权修改图；未刷新文件清单或写 freshness |
| 浏览器视觉验收 | 未执行。0332 记录本机浏览器访问审批曾被拒；需有有效访问批准后再验收默认页、换序/多实例、Area / Map Entry 高度和外观，不通过其他浏览器或原始调试协议绕行 |

以上为初次施工和独立审查后的历史验证记录；本轮修复与验收以下文为准。0332 已归档但仍保留其独立视觉验收未完成状态。

## 2026-10-28 补齐施工与独立验收

用户授权主 Agent 负责指令发布与验收，并可使用 Luna。主 Agent 保留审查职责，Luna 实施修复；0334 同时在稳定栏接口上统一结构。未恢复旧位置分发器，不以位置别名或旧主题 host 名称本身判断是否漏迁。

| 审查缺项 / 追加边界 | 本次落实 |
| --- | --- |
| F1：刷新受原 Game 页签/路由限制 | 设施、强化、区域导航与角色消费者从真实挂载实例收集；揭示、Runtime 与实体表现入口均按消费者处理，不因 Area Map / Shop 等页面的专用刷新提前短路其他实例 |
| 集合或当前区域/Init 变化 | 语义工厂保留 `semanticRefresh(ctx)`，重算正文并保留宿主配置、动作和返回；设施/区域追随当前区域，强化追随 Init，更换绑定使旧 token 失效 |
| F2：区域栏未接通配置 | 接通 `heading`、`actions` 及显式区域地图入口策略；仅接收实际需要的窄状态，默认导航作为 header，显式 heading 由调用方完整拥有 |
| F3：默认动作覆盖宿主 | collectColumns 仅填补调用方未提供的 selector；区域导航、日志和 Game 默认页签动作遵守同一优先级 |
| F4：独立聊天恢复受页签限制 | 按真实流宿主恢复，不以 centerTab / 当前对话选择屏蔽；独立 WorkspaceColumns 更新同一流保留位置，更换 owner 不串位 |
| App 与外部挂载生命周期 | App 重建只释放自己的 DOM 范围；外部已连接实例保留，完整 Controller 销毁才释放全部；脱离文档的实例正常清理 |
| 公开实例刷新 | requestColumnRefresh / flushUIUpdates 可更新独立容器中带 provider 的语义栏；手写静态栏无 provider 时不猜测正文，仍由其调用方提供新 spec |
| 0334 滚动/固定区整合 | 多滚动区按实例和稳定区域 key 捕获/恢复，保留旧栏兼容与 FlowScroll；Shop 完整 region 替换后重新登记栏根并恢复全部滚动区，footer 结算动作仍可用 |

正式回归覆盖原复现、跨页签/路由/服务的独立设施和强化、旅行重绑定、旧 token 拒绝、宿主回调只执行一次、公开刷新、App 重建后外部实例、同流/跨 owner 聊天、多滚动区换序及 Shop 固定操作。原 `.test-artifacts/task-0333-audit.test.ts` 五个复现保持不改，纳入主 Agent 的全 UI 验收。

第一轮定向修复验证 6 文件、52 项通过，日志 `.test-artifacts/task-0333-fixes-test.log`；这是多滚动区和后续生命周期修复之前的记录，不能冒充最终结果。整合 UI 验收不再排除两份旧 Map 套件；其 fixture 按现行业务合同修复，保留命令、门控和 DOM 连续性验证，不修改产品 Runtime 来适配旧测试。

用户明确选择“暂不允许，先完成代码与自动化验证”。本轮未使用浏览器；实际桌面外观、短视口和自定义主题视觉继续待办，代码交付不关闭该项。

最终验收结论：**0333 范围内的内容及对应 Workspace 调用已完成迁移，旧位置状态不再屏蔽独立语义栏的更新；原审查 F1–F4 关闭。** 复杂 Map / Operation / Shop 继续按已声明边界保留业务协调器，不据此宣称所有业务栏能脱离专用协调器自动工作。

| 本次最终检查 | 实际结果 |
| --- | --- |
| 全 UI 与原五项审查复现 | 102 个文件、918 项全部通过，无排除 Map 套件；配置 `.test-artifacts/task-0333-0334-acceptance.config.mts`，完整日志 `.test-artifacts/task-0333-0334-acceptance-final.log`，运行时也写入 latest.log |
| 原两份 Map 套件 | 48 项通过，包含于上面的整合结果；修复测试 fixture / 断言以符合当前条件完成、战斗自动完成、候选投影合同，未跳过用例 |
| TypeScript / 架构 | `npx tsc --noEmit`、`npm run check:architecture` 均通过 |
| 构建 | `npm run build -- --outDir .test-artifacts/task-0333-0334-build` 通过；沿用现有大 chunk 提示，未写 dist / web-dist |
| 集中地图只读复核 | 52 个直接路径：26 content_changed、26 unreferenced_path；已有 36 条 stale evidence，旧两个分发器为 missing。完整记录 `.test-artifacts/task-0333-0334-map-health.json`，逐项/必要分页完整；未改图、刷新或写 freshness |
| 视觉 | 用户明确暂缓，未执行；与代码/自动化验收分开保留 |

独立审查期间的 908/914、917/918 等中途失败与修复路径保留在各阶段日志；上表最终完整运行是在产品代码冻结、正式回归夹具修正之后执行。文档与空白检查随本次交付统一收尾，结果见 0334 的最终验证记录。
