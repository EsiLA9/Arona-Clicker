# Task 0335：Story Editor E0 · 最小创建与编辑

状态：完成 — E0 原型交付；全 UI 103 份测试、939 项通过，包含新增 26 项作者编辑测试；类型、架构、文档与构建检查通过。本轮用户明确不要求浏览器验收。

## 目标

在游戏内提供独立的三栏 Story 编辑工作区，让作者用聊天式输入创建、修改和整理 Story，再保存为可重新打开的本地草稿，无需手写 JSON。

E0 的完成闭环：从 topbar-right 进入 → 浏览已注册 Story 或新建空 Story → 追加正文与 Click → 右栏修改 → 调整顺序 → 保存 → 重新打开后恢复全部内容与顺序。

本任务延续 [[ai/plan/task-0333-semantic-columns-and-workspace-composition]]、[[ai/plan/task-0334-unified-workspace-column-structure]] 的栏组织与共享结构。现有代码和自动化已验收，浏览器视觉验收仍按用户要求暂缓；本任务也不据此推定获得浏览器访问授权。

## E0 的最小决定

| 问题 | 本轮采用的模式 |
| --- | --- |
| “独立编辑器”放在哪里 | 游戏内 `src/ui/` 的独立 Workspace；不是独立网页或 `tools/datapack-editor/` 的新功能 |
| 编辑态与播放态 | 只实现编辑态，所有节点立即可见。选中气泡是选择节点，点击 Click 是选择该节点；不执行、推进或预览剧情。二态切换另行设计 |
| 编辑已注册 Story | 从当前只读内容目录打开工作副本；首次保存形成对应本地草稿。之后优先打开该草稿，保留来源标识，不改 Registry、编辑包或运行中 Story |
| 新建与保存 | 可直接新建空草稿，不要求先创建 Mod、StoryEntry 或完整流程。保存只写本地作者草稿 |
| 输入和插入位置 | 文本发送、＋ Click、＋ Operation、＋ Transfer 一律追加到末尾；需要中间插入时用上移/下移调整。选中节点不改变输入框的追加语义 |
| 字段编辑 | 右栏修改立即进入内存草稿并更新对应节点；“保存草稿”持久化。切换 Story、返回或离开编辑器前同样保存已有修改；只浏览且未修改来源时不创建草稿。保存失败则留在当前编辑位置，保留内容并明确提示 |
| 删除的作用范围 | 删除本地草稿，使用一次确认；已注册的来源仍存在于列表。来源本身不提供运行时删除，不能把“删草稿”呈现成“删除已注册 Story” |
| 未来扩展 | 三个语义栏独立提供内容、动作与绑定，由 Workspace 排序和定宽；本轮不做栏切换、拖拽排布或通用节点插件系统 |

以下是本轮原型的实施边界。若后续要求保存直接覆盖可执行 Story，应另增完整校验与内容提交任务，不在 E0 内顺带接入。

## P0：进入与三栏骨架

- `topbar-right` 增加直接入口“Story 编辑器”，沿用现有顶栏按钮和主题宿主；不要求进入 Runtime Editor 菜单，也不要求先进入某个 Init。
- 使用独立 `story-editor` Workspace 路由，避免复用现有播放用途的 `story` 路由。重复点击入口保持当前编辑会话；返回恢复进入前位置，目标已失效时回到游戏。
- 采用有序 `columns`、显式宽度、稳定 `key / definitionId / bindingKey`，沿用共享顶部、表面、高度和滚动机制。宽度先用项目默认三栏比例，不增加用户调宽功能。
- 三栏均有通用顶部栏，标题分别为“Story”“编辑”“属性”；实际 Story 名称可作为中栏标题内容。顶部保留未来 Switch 的装配位置，不放无功能按钮。

| 栏 | 内容与行为 |
| --- | --- |
| 左栏：Story 列表 | 同时列出当前注册的 Story 和本地新建草稿；按名称/ID 搜索；新建、重命名本地工作副本、删除草稿、快速切换。已注册来源与对应草稿合为一项，以简短“草稿”状态区分，不重复列两份 |
| 中栏：节点流 | 严格按 `nodes` 数组显示全部节点；正文复用聊天气泡/旁白外观，Click、Operation、Transfer 使用简洁可选节点。空 Story 显示空态；中栏底部固定输入区 |
| 右栏：属性 | 选中节点时显示其类型、只读节点 ID、支持的字段和删除/上移/下移；未选中时显示 Story 名称、只读 Story ID、来源和保存状态。提供“Story 信息”入口清除节点选择 |

列表来源是 Story 定义目录，不是 StoryEntry 导航目录，也不受游戏中解锁、拥有角色或可接取状态筛选。搜索只改变左栏可见项，不切走当前文档。无注册内容时仍可新建。

## P1：聊天式追加与节点修改

固定输入区：`[发出方选择器] [多行文本输入框] [确认发送]`，附加独立的 `＋ Click`、`＋ Operation`、`＋ Transfer` 入口。

| 输入/类型 | 创建的数据与 E0 可编辑字段 |
| --- | --- |
| Chara 发言 | 从已注册角色目录选择，写入 `type: talklet`、`content.kind: talk`、`content.speaker`、`content.text`，默认左侧；右栏可修改文本和发出方 |
| 老师回复 | 写入普通 `talklet`，`content.kind: talk`、speaker 为“老师”、`presentation.side: right`；不转换成 Click.reply，不暗中插入 Click |
| 旁白 | 写入 `talklet`、`content.kind: narration` 和 text，采用现有旁白外观；右栏可修改文本和发出方 |
| Click | 显式点击 ＋ Click 后追加 `type: click`、`interaction.kind: button`、`interaction.text: ''`；选中并在右栏填写“按钮文案”。允许空文案草稿，不预填“继续” |
| Operation | 追加 `type: operation` 的未配置草稿节点；显示“未配置”，保留 action 槽位为空，不假造无效果 action；E0 仅支持选择、删除、移动 |
| Transfer | 追加 `type: transfer` 的未配置草稿节点；显示“未配置”，保留 transfer 槽位为空，不填虚假目标或默认跳转；E0 仅支持选择、删除、移动 |

- 新节点自动产生文档内稳定且唯一的局部 ID；删除、编辑、移动不得重编其他节点 ID。顺序只有 `nodes` 一份，不另存“聊天顺序”。
- 文本按普通文本处理、保留换行并转义显示；纯空白不能发送。Enter 默认换行，只有确认发送按钮提交，不设计额外快捷键。
- 发送成功后清空输入文本、保留发出方选择、显示新增节点；提交失败保留输入。未发送文字不是 StoryNode，不因保存或切换而自动发送；会话内按文档保留输入缓冲，E0 不承诺恢复刷新前未发送的文字。
- 左键和右键节点都只选中它并打开右栏，不必另做右键菜单。Click 的可视按钮不得带入播放命令。
- 上移/下移移动整个节点，边界按钮禁用；选中身份跟随节点。删除后清除选择，右栏回到 Story 信息。
- 右栏更换发出方只调整本轮明确管理的内容种类、speaker 与侧向字段；已有 image/pacing/头像/对齐等未开放字段原样保留。若目标类型与已有字段不兼容，应禁用该转换并说明，不能静默丢字段。
- 现有 choice / entryCard Click 可浏览其摘要并移动/删除，右栏显示“此类型暂未提供编辑”；只对 button Click 开放文案修改，不能把其他交互重建为 button。

Chara 的显示名与头像沿用现有内容查询和渲染解析；当前契约没有独立 `senderType / charaId` 作者字段，E0 不为选择器新增这些字段。老师以右侧 talk、旁白以 narration 区分。打开既有自定义 speaker 时保留原值，即使目录中找不到，也不能回退成第一个角色。

### 阶段信息的最小处理

现行 `StoryDef` 除 `nodes` 外还有 `stages`，talklet/click 通过 `stageId` 引用它；这些元数据不能因“只编辑节点流”而丢失。

- 新建空 Story 使用 `nodes: []`、`stages: {}`。
- E0 新建的每个正文节点分配独立 `auto` 阶段；每个显式 Click 分配独立 `input` 阶段。这样追加和移动无需推断作者要将哪几条合为一阶段，也不自动补 Click。
- 打开已有 Story 时保留其阶段分组与声明；移动只改变 `nodes` 顺序，不自动拆并或重写原阶段。由此产生的阶段不连续、Click 非末位等可暂存为草稿问题，不阻止保存，也不假装已经可执行。
- 删除节点时，仅清理已无节点引用的阶段声明；共享阶段仍在时保留原声明与 advance。E0 不增加阶段编排面板或自动修复器。

以上是编辑器新增节点的保守创建策略，不改变播放器的阶段合同；未来阶段编排设计可再扩展。

## P2：本地草稿与数据边界

1. 草稿文档沿用 StoryDef 的 `id / name / nodes / stages / extra` 形状；`nodes` 是唯一作者节点数组。不引入旧 `talklets` 数组、旧解释器或另一份“聊天转 JSON”协议。
2. 未配置 Operation/Transfer 以编辑器专用草稿类型表达对应载荷可缺省；正式 `StoryNode` 的 action/transfer 仍然必填。不要用 `as StoryDef` 掩盖不完整数据，也不要放宽生产契约以便保存。
3. 持久化信封另存草稿身份、来源 Story ID、版本与保存时间。新建 Story 自动分配稳定 ID，名称可重复但身份不能冲突；Story ID 在 E0 只读，重命名仅改 name。来源草稿按 source ID 对应，不能和新建草稿混淆。
4. 通过现有 `StorageAdapter / LocalStorageAdapter` 保存到独立 Story Editor key；借鉴 Runtime Editor 的版本信封和错误反馈，不往它目前仅支持 Init/Area/Spot/Enhancement 的草稿结构硬塞 Story。
5. 草稿属于当前浏览器作者工作区，独立于 PlayerState、Init 和游戏存档。切换世界线、读游戏存档不清理作者草稿；重新打开时仍能编辑来源已不在当前 Registry 的本地草稿。
6. 手动保存、切换 Story、退出编辑器均经同一保存入口。保存成功才标记“已保存”；存储失败保留内存数据、当前选择和输入，不继续切换/退出。加载遇到损坏或不支持的版本，明确提示并保留原存储内容，不能静默覆盖为新空草稿库。
7. 保存只检查持久化需要的基本形状和稳定身份，允许空 Story、空 Click、未配置节点和暂时不完整的阶段/引用。完整 Story 校验不能成为草稿保存门槛。
8. 完整来源文档深拷贝后编辑，保留所有未开放字段，包括 stages、extra、presentation、pacing、Click 的 reply/result/press/options 以及 Operation/Transfer 的已有载荷；原始 Registry 对象不能被共享引用修改。

`StoryTalkletNode` 的 `type: talklet` 是现行节点类型名称，可以继续使用；本任务拒绝的是旧 Talklet 作者协议，并非删除这个合法节点类型。需求中的 clickText 是产品叫法，实际写入 `interaction.text`，不新增顶层 clickText。

## 结构、复用与刷新约束

```text
console-shell / topbar-right 的 Story 编辑器入口
└─ workspace-page-content
   └─ WorkspaceFrame(story-editor)
      ├─ story-editor-list：header / body(搜索 + 列表)
      ├─ story-editor-flow：header / body(全部有序节点) / footer(输入与追加)
      └─ story-editor-inspector：header / body(Story 或 Node 属性)
```

- 三个栏工厂各自接受显式文档/选择状态和回调，不读取 Game 的 leftTab/centerTab/rightTab 来决定内容。返回动作由 Workspace 装配；不在共享 Frame 添加 Story 业务状态。
- 共用 `renderWorkspaceFrame`、`renderWorkspaceTitlebar` / 顶部区域、公共按钮与 Presentation surface。正文、列表、属性各自滚动；输入区使用共享 footer，不重复写 viewport 高度、负外边距或额外外框。
- 气泡/旁白优先复用 `renderChatEntry` / 纯 Flow 呈现，把 StoryNode 映射为只读展示数据；编辑身份来自 Story ID + node.id。不要直接挂载游戏 `createChatColumn`、`ChatStream`、StoryService 或玩家聊天历史，因为它们还承载运行态输入与投递语义。
- 不复用运行态流的条数裁剪；作者超过 200 个节点时仍必须完整保存和编辑。无需提前实现虚拟列表。
- 新增的编辑专用节点外层仅承载 node key、选择状态和事件委托，输入区内层只组织控件；其余沿用共享骨架。不为聊天式外观再套一层页面 surface。
- Controller 持有编辑会话，独立草稿模块负责增删改排和持久化；编辑动作不经玩家 Story 命令。新页面命令在 Controller 中接线，不把编辑逻辑散落到顶栏或通用渲染器。
- 搜索、选择仅更新对应列表状态与右栏；属性输入仅 patch 对应流节点及保存状态；追加/删除/重排按 node.id 协调流列表。保留三栏根、顶部、输入框、未改节点和滚动容器身份，不全页重建。
- 使用现有 update 生命周期：文档切换更新三栏消费者；普通编辑以 `region` 进入目标栏并在栏内做最小 patch；`structure` 仅用于进入/退出路由或当前 Frame 丢失。缺失节点先在所属流/属性区域恢复，不默认升级为 App render。
- 仅进入新文档或作者追加时定位相应节点；在上方修改、选择、重排不强制拉到底部。属性输入与中栏输入的焦点、光标不能因其他区域刷新丢失；浮层替换沿用 mutation range 清理。

## 明确不做

- 播放预览、编辑/播放模式切换、Story 启动或推进、typing/thinking 节奏模拟。
- 导出、发布、应用到 Runtime/编辑包、创建 StoryEntry、条件/奖励/投递配置；这些入口落地前必须补完整解析、结构和引用校验。E0 不放可误用的“运行/发布”按钮。
- Operation/Transfer 行为表单、choice/entryCard 细编、阶段编排、图片上传、主题/演出编辑。
- 拖拽排序、撤销重做、多选、节点类型转换器、跨 Story 复制、协作/跨设备同步。
- 栏切换功能、移动端适配、通用编辑器框架或旧数据兼容迁移。

## 已核实依据与施工入口

| 路径 | 已核实事实 / 后续用途 | 状态 |
| --- | --- | --- |
| `src/data-services/contracts/story.ts`、`story-node.ts`、`story-node-actions.ts` | StoryDef 直接使用节点文档；四类节点、显式阶段、Click.interaction、Operation/Transfer 载荷 | 已核对；本轮不改生产契约 |
| `src/data-services/validation/story-node-structure.ts` | 结构检查要求阶段连续、input 末位 Click 等；它不代替完整 JSON/引用校验 | 已核对；保存草稿不得直接用作阻断门槛 |
| `src/arona-clicker/contracts/runtime/content-catalog.ts`、`src/ui/runtime/context.ts` | 只读 stories/characters 目录与 UIContext | 已核对；列表/发出方来源 |
| `src/ui/components/shared/header.ts`、`app-shell.ts` | 顶部入口、PanelState/UI-only 会话接入 | 已修改并验证 |
| `src/ui/workspace/workspace-router.ts`、`workspace-renderer.ts` | 独立路由、页面高度 owner 与三栏装配；同步 resolve/返回，避免 legacy 推导覆盖回 game | 已修改并验证 |
| `src/ui/components/shared/workspace-frame.ts`、`workspace-titlebar.ts`、`src/ui/workspace/workspace-columns.ts` | 栏宽、header/body/footer、实例及绑定生命周期 | 已核对；直接复用 |
| `src/ui/components/story/story.ts`、`src/ui/flow/flow-entry.ts` | 复用纯条目呈现；运行态流上限 200 不适用于作者文档 | 原文件未修改；新 view 已适配 |
| `src/ui/runtime-editor/state.ts`、`persistence.ts`、`src/data-services/persistence/storage-adapter.ts` | 现有编辑器内容种类不含 Story；可借鉴持久化模式并复用存储 Port | 已核对；独立草稿库不侵入旧结构 |
| `src/ui/story-editor/` | model、persistence、view、dom、controller 五份职责文件 | 已新增并验证 |
| `src/ui/css/story-editor.css`、`src/ui/main.ts`、`src/ui/runtime/service-definitions.ts` | 编辑器局部样式、样式导入与三栏主题宿主注册 | 已新增/修改并验证 |
| `src/ui/controller/controller.ts`、`controller-actions-topbar.ts` | 会话持有、生命周期、导航保存、dispatcher 接线及运行态同步隔离 | 已修改并验证；保留施工前已有变更 |
| `tests/ui/story-editor-model.test.ts`、`story-editor-workspace.test.ts`、`topbar-settings-workspace.test.ts` | 26 项新增作者测试；更新顶栏新增入口断言 | 已新增/修改；全 UI 回归通过 |
| [[workspace-columns-and-layout]]、[[story-chat-and-theme-presentation]]、[[runtime-editor-and-project-checks]]、[[ui-style/patterns]] | 当前机制与样式入口 | Workspace/工具/样式页已更新；剧情主题页仅参考 |

## 施工顺序与验收

- [x] 核对现有格式、复用入口与保存边界，写成独立 Task。
- [x] 实现并验证草稿模型：稳定 ID、追加、字段修改、重排、删除、保留未开放字段、部分节点保存。
- [x] 接入独立存储与来源目录；验证保存/恢复、来源隔离及失败行为。
- [x] 接入独立路由、topbar-right 入口与三个栏；完成发送、选中、属性编辑及局部更新。
- [x] 运行定向行为与回归验证、类型和架构检查；更新机制文档与任务结果。
- [x] 本轮按用户“直接进行原型施工，不需要进行浏览器验收”的要求，不执行浏览器验收；不将自动化结果表述为视觉通过。

### 自动化必须覆盖

1. 从顶栏进入，搜索/切换当前已注册 Story；无 Init 也能新建空 Story。返回与重复进入不误进播放工作区。
2. 角色、旁白、老师三次发送分别只增加一个 talklet；显式 ＋ Click 只增加一个 button Click，未操作时从不补 Click。
3. 点击/右键选中，右栏改正文、发出方和按钮文案；节点 ID 不变，输入控件与其他栏 DOM 身份保留。
4. 上移/下移、边界禁用、删除后的选中状态，以及保存后完整顺序恢复。
5. 空 Story、空 Click、Operation/Transfer 未配置节点保存并恢复；正式 Story 类型和 Registry 验证不因此放宽。
6. 已注册 Story 的阶段、复杂 Click、动作和 extra 等未开放字段无损保留；注册对象、运行中游标、玩家状态、聊天历史均未被编辑命令写入。
7. 本地草稿与来源同项显示，重命名只改草稿；删草稿后来源仍可打开；来源消失后本地草稿仍可用。
8. 多 Story 切换/退出保存、重新创建编辑会话和持久化对象后恢复、存储写入失败和损坏数据保护。不能只在同一内存对象上“重新打开”。
9. 超过 200 节点与长文本不被运行态流裁剪；字段输入时保持光标、中栏输入和滚动；不因普通 Tick 或选中触发整页 render。

通过 `npm test` 运行新增测试及 Workspace 路由/结构、Story 纯渲染和 Runtime Editor 的受影响回归，完整输出写 `.test-artifacts/latest.log`。执行 `npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs`；仅当实际更改生产契约时才按 Schema 同步流程扩展验证，不为本任务预设该改动。

### 桌面验收脚本（后续参考，本轮不执行）

在 1366×768 与 1920×1080 检查默认及一套自定义主题：顶部入口打开三栏 → 新建“E0 草稿” → 分别发送角色发言、旁白、老师回复 → 插入 Click 并填文案 → 选中改字 → 调整顺序 → 保存 → 退出重进并刷新后恢复。再快速切换两个已注册 Story、保存来源工作副本，确认来源不被改写。检查统一顶部高度、长标题扩展、中栏输入固定、三栏独立滚动和长内容完整可见。

## 原型交付与验证（2026-10-28）

| 交付项 | 实际结果 |
| --- | --- |
| 三栏与入口 | 顶栏直接进入，大厅无 Init 可创建；三栏共享顶部与表面，列表/正文/属性独立滚动，中栏输入固定 footer |
| 编辑闭环 | 三种发出方、显式 Click、Operation/Transfer 占位、点选/右键属性、改名、上移/下移、节点与草稿删除、保存恢复均接通 |
| 作者数据 | 独立版本信封；深拷贝来源；保留复杂字段与原阶段；源定义/游戏存档不被作者命令修改；超过 200 个节点无裁剪 |
| 错误与生命周期 | 保存或删除写入失败保留原稿并可重试；损坏存储保留且进入只读；文档内输入缓冲、焦点、光标、滚动和返回导航保留；卸载清理事件 |
| 主题与 DOM 修复 | 背景与内容层分配不同协调身份，避免主题插入背景后替换输入；缺失 Frame 局部恢复，shell 缺失才重建当前页面 |

| 验证 | 实际结果 / 证据 |
| --- | --- |
| 两个作者测试文件 | 最终全量运行包含 26 项新增测试；前一次定向 25 项通过，日志 `.test-artifacts/task-0335-targeted.log` |
| 全 UI 回归 | `npm test -- --config .test-artifacts/task-0335-ui.config.mts --maxWorkers=2 --minWorkers=1 --silent --reporter=dot`：103 文件、939 项全部通过，342.23 秒；无排除 Map 或 Runtime Editor 套件 |
| 全量日志 | `.test-artifacts/task-0335-ui-final.log`，完整输出也在 `.test-artifacts/latest.log` |
| 类型 / 架构 | `npx tsc --noEmit`、`npm run check:architecture` 均通过 |
| 构建 | `npm run build -- --outDir .test-artifacts/task-0335-build` 通过，511 modules；仅现有大分块提示，未改发布目录 |
| 文档 / 空白 | `npm run check:docs` 与差异空白检查通过；归档后再次检查链接及新增文件直接空白 |
| 地图只读核对 | 22 个直接路径集中核对：11 个 content_changed、11 个 unreferenced_path（含任务归档与索引），18 份旧 Evidence 已变化；已查看关联 owner 分页，详见 `.test-artifacts/task-0335-map-health.json`；未改图、刷新或写 freshness |
| 浏览器 | 按用户本轮要求未执行，不作为原型交付的未完成项 |

首轮定向失败涉及大厅空 Init 的既有空字符串表示与存储失败注入位置，已修正测试夹具。扩大回归发现主题背景导致的输入失焦，已修复实际 DOM 协调；原顶栏四按钮断言更新为包含 Story 入口的五按钮。最终全部回归通过，不保留临时豁免。

本任务内无剩余施工项。播放二态、导出/发布、复杂节点表单和阶段编排继续按前述范围留待后续任务；它们不构成本轮原型的承诺。按工作流归档本 Task，机制事实已写回工具 Wiki 和 Workspace/样式页。
