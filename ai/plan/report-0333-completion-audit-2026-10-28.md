# Task 0333 完成度复核

> 范围：具名内容栏、对应 Workspace 调用、动作装配、实例更新与滚动。只审查并补复现，不修改产品实现。

后续状态：本报告保留初次审查事实。用户授权补齐后，F1–F4 已修复并纳入正式回归；0333 / 0334 的整合验收 102 文件、918 项通过，视觉按用户要求暂缓。当前交付见 [[ai/plan/task-0333-semantic-columns-and-workspace-composition]] 与 [[ai/plan/task-0334-unified-workspace-column-structure]]。

## 结论与迁移清单

**主要内容搬迁与默认页面接入已经完成，但尚不能确认全量转移。** 独立复核得到 4 类行为缺项、5 个失败复现；不能将当前状态仅描述为“实现完成，只欠视觉验收”。

| 内容 / 调用方 | 当前证据与完成度 |
| --- | --- |
| 区域导航 | `src/ui/columns/index.ts` 的 createAreaNavigationColumn 与 area-navigation.ts 正文；栏已提取，动作移交未完成，见 F2 |
| Chat / Contacts / Character | `src/ui/columns/content-columns.ts`；发送按钮/聊天正文位于 chat-content.ts；入口收敛完成，独立聊天滚动见 F4 |
| Log | createLogColumn / renderLogContent，按钮使用 data-action；栏与动作入口已提取，Controller 覆盖调用方回调见 F3 |
| Facilities / Enhancements / InventoryEffects | createFacilitiesColumn / createEnhancementsColumn / createInventoryEffectsColumn，复用业务正文；提取完成，实例刷新门控见 F1 |
| Game | `src/ui/workspace/workspace-renderer.ts` 的 createGameWorkspaceFrame，使用 area-navigation / activity / tools key 和正式栏工厂；装配已迁移 |
| Area / Area Map / Map Entry | 各 create*WorkspaceFrame 直接调用 createAreaNavigationColumn；公共区域栏调用已全部迁移 |
| Area Map 更新 | `src/ui/workspace/area-map-controller.ts` 按 data-column-definition=area-navigation 查找，不再依赖 data-game-panel=left |
| Story | `src/ui/components/story/story-workspace.ts` 调用独立 renderStoryNavigation 正文与 Chat 栏；达到本 Task 的正文迁移范围，不代表每个 Story 栏都有独立工厂 |
| Contacts / Character Workspace | 从正式 columns 入口调用 Chat / Contacts / Character 工厂，未发现旧位置分发调用 |
| 旧入口 | right-panels.ts、center-panel.ts 已删除；生产源码未找到 renderRightPanel / renderCenterPanel / renderLeftPanel 调用；rail 与 shared/content-columns 只保留兼容 re-export |

0333 明确没有要求重写 Map / Operation Run 或 Shop 交易协调器，也没有要求一次性把全部页面现场定义的业务栏都提成工厂；这些保留不判为漏迁。主题 host、来源外观 class、返回位置字段可以兼容保留。问题在于它们是否仍决定其他可见栏的业务行为，而不是名称里是否还有左右中。

## 4 类可复现缺项

### F1 · P2：设施/强化刷新仍受原 Game 位置选择限制

`src/ui/controller/controller.ts:832` 检查 rightTab=spot，第 833 行对非 Game 路由直接返回；第 882–883 行的强化刷新有同类门控。`src/ui/controller/controller-core.ts:72` 也按 rightTab 在设施与强化之间二选一；Runtime 内容刷新、实体表现刷新还有同类条件。

复现：将真实 Facilities 栏挂入 ctrl.columns 管理的独立容器，确认其有设施卡；分别让 Game 的 tools 选“其他”，或进入 Area Workspace，再调用设施刷新。两种情况都没有元素更新；前者拒绝刷新，后者可返回 true 却没有更新可见设施。

现有 `tests/ui/content-columns.test.ts:116` 在双显示设施验证前主动把 rightTab 改为 spot，所以证明了两份设施能更新，未证明更新与原位置选择无关。

应由已挂载定义、实例与业务 binding 收集可见消费者。旧页签只用于原 Workspace 的装配，不应决定其他位置的设施/强化是否更新。

### F2 · P2：区域栏未接通调用方动作与头部配置

`src/ui/columns/index.ts:45` 的 createAreaNavigationColumn 接收带 actions / heading 的 SemanticColumnOptions，但没有把顶层 actions 写入返回栏，也未使用 heading；第 47–51 行仍内置区域/通讯录/故事按钮，接口继续接收完整 PanelState。正文还直接判断 Workspace 路由以决定区域地图入口。

复现：显式传入通讯录动作，使用 mountColumn 挂到普通容器，点击工厂生成的通讯录按钮，回调次数为 0。

应接通明确传入的动作、导航与头部配置，按计划收窄状态依赖；Game 默认行为由其装配提供。当前独立区域栏仍依赖游戏 Controller 补齐导航。

### F3 · P2：Controller 默认适配覆盖宿主显式回调

`src/ui/controller/controller.ts:1123` 的 collectColumns 先复制 column.actions，随后在第 1132–1134 行无条件覆盖区域导航，在第 1156–1163 行无条件覆盖日志 clear/export/debug 回调。

复现：给自定义日志 Workspace 提供 clear-log 回调，经现有收集入口取得实际装配，再挂载点击；自定义回调调用 0 次，动作被默认游戏命令接管。本用例直接调用内部收集入口，以验证装配转换的优先级，并非声称已有一个产品路由使用自定义日志命令。

默认适配须有适用范围与优先级，不能覆盖调用方显式绑定；否则新宿主可能误操作游戏日志或被强制导航到原页面。

### F4 · P2：聊天滚动恢复仍受全局 centerTab 门控

`src/ui/interaction/scroll.ts:71` 在遍历真实聊天宿主前，以 centerTab 不是 chat 且全局 conversationVariantId 为空直接退出。

复现：独立挂载全局 Chat 栏，设可滚动几何，捕获 scrollTop=133，再重置宿主位置；以 Game 选择 log 的状态恢复，结果仍为 0。现有同流双显示测试仅使用 centerTab=chat。

应根据实际可见宿主和实例策略恢复阅读位置；旧参数如保留，只能作兼容，不能屏蔽独立聊天显示。实例 key 和 FlowScroll 已具备，不需要再建滚动系统。

## 验证方式与结果

复现只放在临时测试目录，未修改产品或正式测试：

- `.test-artifacts/task-0333-audit.test.ts`：5 个新用例，分别覆盖 F2、F1 两种挂载情况、F3、F4。
- `.test-artifacts/task-0333-audit.config.mts`：限定复现和下面 5 份现有测试。
- `.test-artifacts/task-0333-completion-audit.log`：保留完整输出，运行时也写入 `.test-artifacts/latest.log`。

```text
npm test -- --config .test-artifacts/task-0333-audit.config.mts --maxWorkers=3 --minWorkers=1 --silent --reporter=dot
```

| 检查 | 实际结果 |
| --- | --- |
| workspace-columns、content-columns、ui-update-dispatcher、controller-tab-linkage、area-map-controller | 5 份既有测试、38 项通过 |
| 新增复用边界 | 5 项失败，均到达目标行为断言，非导入、环境或夹具错误 |
| 合计 | 6 个文件，38 项通过、5 项失败，72.54 秒；对应 4 类缺项 |
| 运行边界 | 首轮临时配置数组合并意外扩大范围，发现后终止本次审查 runner，该轮不计入结果；上表为纠正配置后的独立运行 |
| 未执行 | 未重跑全量 UI、类型、构建或浏览器；施工记录中的 844 项通过不代表覆盖了以上新增场景 |

这些失败与既有地图夹具的 22 项失败、浏览器视觉访问限制无关。

## 后续处理

1. 在 0333 内补齐 F1–F4，并将复现转为正式回归；保持已经迁移的内容入口，不恢复旧面板总分发器。
2. 明确默认动作与调用方覆盖优先级；重新验收真实跨位置、跨 Workspace、独立容器及与原页签不同的显示组合。
3. 共享 header/surface/高度结构仍交给 0334，不用后续结构统一替代 0333 的行为验收。
4. 行为闭环和桌面视觉验收全部满足后再确认全量完成，当前维持进行中。

本轮仅修改报告、0333 完成度说明与活动索引。`npm run check:docs` 通过，扫描 104 份 Markdown，0 错误；直接改动的 diff / 行尾空白检查通过。三份文档路径的地图只读复核均为 unreferenced_path，未改图、刷新或写 freshness。
