# docs-830/00-INDEX — 基础机制入口

本文按系统组成、内容生命周期、通用 Engine、产品领域和 UI 呈现组织新 Wiki 的阅读入口。

先从下方选择主题总览，了解职责与协作；需要字段、边界和具体行为时，沿页面中的“继续阅读”进入机制详解或实例。源码和相关测试是核实当前实现的依据。

## 架构与启动

| 主题 | 页面 |
| --- | --- |
| 系统职责与 Runtime 组合 | [[system-composition]] |
| 启动、包应用、Lobby 与 Init | [[startup-and-runtime]] |

## 内容、状态与存档

| 主题 | 页面 |
| --- | --- |
| Datapack 装载与 Registry | [[datapack-and-registry]] |
| 包 I/O 与来源层解析 | [[package-io-and-source-layers]] |
| 定义来源层的覆盖与暂停 | [[definition-source-resolution]] |
| 作者策略与定义构建 | [[authoring-policy-and-builders]] |
| Runtime 内容目录与图片资源 | [[runtime-content-browser-and-assets]] |
| 存档介质、恢复与 Init 快照 | [[save-system-and-recovery]] |
| PlayerState、Mutation 与事件 | [[state-and-events]] |
| Init 状态快照与世界线切换 | [[init-state-snapshots]] |

## Engine 与会话

| 主题 | 页面 |
| --- | --- |
| Engine 声明工厂 | [[definition-factories]] |
| EventBus、Effect 与 Trigger | [[event-effects-triggers]] |
| Trigger 规则与欢迎剧情实例 | [[trigger-mechanism]]、[[trigger-welcome-example]] |
| Affector 生命周期与贡献 | [[affectors-and-contributions]] |
| 条件、依赖索引与可见性 | [[conditions-and-visibility]] |
| Value、Extra 与 GameNum 生产 | [[expressions-and-production]] |
| Stats 与 TagStats | [[statistics]] |
| Session 与 Tick 调度 | [[session-and-tick]] |

## 产品领域

[[1-项目/ACProgram/docs/docs-830/05-domains/00-INDEX|00-INDEX]] 按世界与 Spot、资源交易、角色获取培养、剧情、Runtime 内容编辑、地图和 Operation 进入领域流程页。

## 呈现与工具

| 主题 | 页面 |
| --- | --- |
| ReadModel、UIContext 与命令边界 | [[read-model-and-ui]] |
| Workspace 路由与渲染 | [[workspace-navigation-and-rendering]] |
| Workspace 栏复用与自由布局 | [[workspace-columns-and-layout]] |
| Workspace 路由身份与返回 | [[workspace-route-lifecycle]] |
| 局部刷新、焦点与滚动 | [[ui-refresh-focus-scroll]] |
| 更新调度与 Surface | [[update-dispatch-and-surface]] |
| Story/Chat 与主题投影 | [[story-chat-and-theme-presentation]] |
| UI 风格体系与复用约定 | [[ui-style-conventions]] |
| 独立 Datapack Editor 与 Schema | [[datapack-editor-and-schema]] |
| 从 Schema 到编辑器表单 | [[editor-schema-to-form]] |
| Operation 内容作者案例 | [[operation-content-authoring]] |
| Runtime Editor 与项目检查 | [[runtime-editor-and-project-checks]] |

## 项目协作参考

GALHCG 查询与 AI Read Set 约定见 [[ai/guide/galhcg-project-map]]、[[ai/guide/task-read-set-routing]]；任务工作流见 [[ai/guide/task-workflow]]。这些页面描述项目协作，不重复收入产品运行机制页。

页面按职责和协作链组织；字段合同与运行规则以源码和相关测试核实。
