# Task：StoryDef 起始对话空间与演出移动

状态：实施完成，待验收确认 — StoryDef 场景、两类移动节点、编辑器、Runtime、路由和重播隔离已实现。

## 目标与范围

- 目标：让故事本体 `StoryDef` 声明重播的初始演出上下文；让故事节点能表达演出型空间移动；重播期间只呈现移动、不提交一般 Operation 副作用。
- 领域约定：`ActiveStoryEntry`、`PassiveStoryEntry` 等是通用投放/准入入口；其名称不决定故事本体结构或起始场景。故事最终都归到 `StoryDef` 的节点结构。
- 初始演出场景：`StoryDef` 直接声明一种场景类型：
  - `Area`：游戏正常三栏与外界通用聊天流。
  - `Chara`：通讯录中指定角色与通讯录三栏；必须显式指定角色 ID，不沿用 Entry owner 或当前选中角色。
  - 普通播放默认不因该字段自动移动 Area 或切换对话空间；Entry 的 `travelToStartContext` 可显式要求真实前往。重播始终虚拟切到该上下文。
- 演出移动：新增与一般 Operation 分离的 StoryNode 移动节点，支持切换 Area 与 Chara 对话空间。
  - 节点数据区分 `moveToArea` 与 `moveToCharaspace` 两种类型；Story 编辑器分别提供各自字段配置。
  - Area → Chara：表现从 Init 上的通用聊天流切到角色聊天空间；Init 与角色聊天空间视为不同空间。
  - Area → Area：仍属于同一个 Init 聊天空间。
  - Chara → Chara：表现角色聊天空间之间切换。
  - 正常播放时执行实际移动；重播时只播放切换表现，不改实际 Area / Chara 位置。
- Operation 隔离：一般 Operation（包括资源变更、内容设置及其他任何现有 Operation action）仅非重播时执行。重播仍按同一节点顺序呈现对话与输入；不得提交这些 Operation 副作用。
- 重播 Operation 提示：可在编辑器/机制说明中解释“重播不执行一般 Operation”，但运行时不执行或模拟任何一般 Operation；独立移动节点仍可在重播时呈现。
- 强制旅行：Entry 开启 `travelToStartContext` 或 Story 显式 `moveToArea` 时，不检查玩家可及性/邻接，按强制旅行到目标 Area；保留正式状态变更及进入事件/效果。
- 非目标：本 Task 不实现未来的角色聊天存储重构，也不要求把 Init 与角色流无跳动地融合；不重新定义 Entry 的触发、打断或奖励策略。
- 审阅裁定：
  1. Chara 起始场景必须指定角色 ID。
  2. 移动分为 `moveToArea` / `moveToCharaspace` 两种；编辑器分别配置。
  3. 可解释重播 Operation 的行为，但一般 Operation 不执行。
  4. 显式 `moveToArea` 是强制移动，不检查可及性。施工时按强制旅行保留目标 Area 的正式进入流程；若现有旅行 API 无法分离邻接检查与进入效果，再按实现核实。
  5. 普通播放默认沿用触发位置；Entry 可用 `travelToStartContext` 要求真实前往，重播始终虚拟前往 StoryDef 起始上下文。

## 当前进度

- [x] 核对 `StoryDef` 当前只承载 id/name/nodes/stages/extra，没有起始场景字段。
- [x] 核对当前 StoryNode 只有 Talklet、Click、Operation、Transfer；Operation 到达时会预检并执行 action，再进入结果呈现等待点。
- [x] 核对重播由 Story session 的 replay 标记控制完成记账/奖励，但 StoryNodePlayer 目前仍会执行一般 Operation action。
- [x] 核对当前重读路由根据 Entry type 进入游戏/通讯录；Active 只设置 area tab，不设置场所，Passive 根据 owner 选择角色，通讯录组由角色 school 与持有状态派生。
- [x] 用户审阅并裁定场景角色 ID、移动节点分类、重播 Operation 行为与强制旅行。
- [x] 完成 StoryDef 起始场景、移动节点定义与 Schema/Story Editor 合同；Base 内容与测试 fixture 已补显式起始场景。
- [x] 实现正常强制 Area 移动、Chara owner 切换与重播 presentation-only 移动；Player 在重播时跳过所有一般 Operation 节点。
- [x] 按 StoryDef 起始场景和移动事件路由普通播放/重播；重播场景切换信息只进入一次性流。
- [x] 更新机制文档并完成构建、架构和差异格式静态验收。
- [x] 修复启动时依赖包按错误保存顺序装载的问题：依赖优先装载，并在 Apply 成功后同步显示顺序。
- [x] 按最新需求移除普通播放自动前往 startContext Area / Chara 空间；由触发时 owner 确定运行空间，显式移动节点仍可移动。
- [x] 按后续裁定让所有重播虚拟返回起始上下文，并为 Entry 增加 `travelToStartContext` 真实前往开关。
- [x] 重播期间以虚拟场景驱动 Area 三栏与移动门控；播放结束后解除临时门控并恢复真实 Area 渲染。
- 正在进行：等待用户确认浏览器交互结果。
- 下一步：按用户验收反馈修正；自动化测试及浏览器操作本轮未运行。

## 相关文件与资料

| 路径或链接 | 用途 | 当前状态 |
| --- | --- | --- |
| `src/data-services/contracts/story-node.ts`、`src/data-services/contracts/story-entry.ts`、`src/data-services/validation/story-node-structure.ts` | StoryDef 起始场景、Entry 真实前往开关与两种移动节点合同/校验 | 已修改；Area/Chara 与移动目标必填 |
| `src/data-services/contracts/story-entry.ts` | Active/Passive Entry 职责与 owner 字段 | 已核对 |
| `src/arona-clicker/services/story/story-node-player.ts` | Operation 执行与移动节点顺序 | 已修改；replay 跳过一般 Operation |
| `src/arona-clicker/services/story/story-service.ts` | 普通播放触发空间、Entry 起始空间旅行开关、重播隔离 | 已修改；重播虚拟返回，Entry 可选真实前往 |
| `src/ui/controller/controller-actions-story.ts`、`controller-events.ts`、`src/ui/components/shared/app-shell.ts` | StoryDef 上下文路由和 replay 一次性场景状态 | 已修改 |
| `src/ui/story-editor/model.ts`、`property-fields.ts`、`view.ts`、`controller.ts` | Story 起始场景和移动节点编辑 | 已修改；新增两个独立移动节点选项 |
| `src/data-services/registry/runtime-content-reference-rules.ts` | StoryDef / 移动目标引用校验 | 已增加 Area 与角色差分引用 |
| `src/ui/components/character/contacts-workspace.ts`、`src/arona-clicker/services/character/roster-system.ts` | Chara 对话空间与通讯录组派生 | 已核对 |
| `tools/datapack-editor/schema/engine-defs.gen.json` | StoryDef 与新节点的生成 Schema | 由 `npm run gen:schema` 更新；未手改 |
| `src/arona-clicker/content/story/`、`src/arona-clicker/content/character/`、`src/arona-clicker/content/base-pack/` | Base Story 场景标注与内置包同步 | 45 个 builder Story 显式标注；打包 JSON/manifest 更新至 1.0.3 |
| `docs/docs-830/05-domains/story-and-effects.md`、`docs/docs-830/04-presentation/story-chat-and-theme-presentation.md` | 当前机制事实 | 已更新 |
| `tests/` 下 Story fixtures | 必填 startContext 类型同步 | 76 个 StoryDef/StoryNodeDocument fixture 补 Area 上下文；未新增或运行测试 |

## 事实与决定

| 问题 / 决定 | 已核实事实及依据 | 待解决问题 |
| --- | --- | --- |
| Entry 与 StoryDef 的职责 | `StoryEntryDef` 承载 type、owner、availableInits、条件、奖励和投放属性，并可选择真实前往起始上下文；StoryDef 持有必填 `startContext` 与正文节点。普通播放默认继承触发空间；重播始终虚拟返回 `startContext`。 | 无；旧 Base 内容已显式迁移。第三方旧包缺字段会在验证时被拒绝，需作者补字段。 |
| 现有 Operation 语义 | `StoryNodePlayer.drain()` 对 operation action 执行 `preflight` 和 `apply`，再进入 operation 呈现等待点。 | 重播时的副作用抑制需在通用 action 执行边界生效，不能只隐藏结果通知。 |
| 重播语义 | replayId 通道保持输出隔离；播放器跳过所有一般 Operation 节点，独立移动节点发出演出上下文事件。 | 无；重播移动显示为一次性聊天流中的场景/移动记录。 |
| Area 与 Chara 空间 | StoryDef 现在直接声明 Area 或指定 VariantId 的 Chara；通讯录组仍按角色 school/持有状态派生。 | 未拥有的 Chara 仍使用对应 owner 聊天流展示；未来独立聊天存储不在本 Task 范围。 |
| Area 初始位置 | 普通播放默认不因 startContext 自动旅行；Entry 开启 `travelToStartContext` 后通过正式强制旅行前往。重播始终虚拟切到 startContext；Entry 开启该 flag 时额外真实前往。显式 `moveToArea` 正常播放正式旅行、重播仅演出。 | 真实前往会执行既有 Area 进入流程及效果。 |

## 验收草案（审阅后细化）

- StoryDef 数据合同必填声明 Area 或带角色 ID 的 Chara 起始场景，并在内容装载、生成 Schema、Story Editor 中一致表达。
- 普通播放按 StoryDef 场景打开正确三栏与聊天空间，不由 Active/Passive 名称隐式决定。
- `moveToArea` / `moveToCharaspace` 可分别在 Story 编辑器配置；正常 Area 移动强制执行、不检查可及性，重播仅呈现空间变化。
- 重播不会执行任何一般 Operation action（包含无状态/纯展示 Operation）；普通播放的一般 Operation 行为保持原样。
- 节点顺序、输入、StoryDef 重播和 Entry 投放不因场景字段或新节点而被破坏。
- 有针对性 Runtime/UI 回归覆盖，并按 Schema 同步规范生成产物；不手改生成 Schema。

## 验证与结果

| 检查对象与方式 / 命令 | 实际结果 | 失败后的排查与处理 / 未执行原因 |
| --- | --- | --- |
| 源码合同与运行流程核对 | 已修改 StoryDef、StoryEntry 启动路由、StoryNodePlayer、StoryService 与通讯录路由 | 机制文件和 Base 内容已同步；未运行自动化测试或浏览器交互。 |
| `npm run gen:schema` | 通过；生成 `StoryStartContext` 与两类移动节点协议 | 未手工编辑生成文件。 |
| `npm run datapack:export-base -- <临时导出目录>` | 通过；同步内置 Base `content.json` 与 manifest 至 1.0.3 | 临时导出目录因执行环境拒绝外部递归删除而保留在项目同级。 |
| `npx tsc --noEmit` | 仅余既有 `tests/ui/workspace-lifecycle.test.ts:346` 对只读 `areaStoryDeliveries` 赋值错误 | 新增/变更的 `src/` 与 `tools/` 无 TypeScript 诊断。 |
| `npm run check:architecture` | 通过 | Engine / Data Services 边界通过。 |
| `npm run check:docs` | 失败：6 条既有归档计划链接缺失，与本 Task 文档无关 | 未扩大范围修复旧计划链接。 |
| `npm run build` | 通过 | Vite 有既有大型 chunk 提示；未改构建拆分。 |
| 依赖包顺序恢复检查 | 修复 `gameplay-b` 排在 `base` 前时，校验与实际装载仍先加载 `base`；Apply 后列表顺序同步 | 包依赖顺序现由共享 PackManager 处理；未运行测试套件或浏览器启动。 |
| `git diff --check` | 通过 | 仅 CRLF/ LF 警告。 |
| GALHCG 项目地图只读复核 | 搜索 StoryService、UI Story/Chat 与通讯录概念；未写图、刷新或记录 freshness | 查询为局部候选，代码事实仍以本地源码核实。 |

- 当前结果：StoryDef 场景及节点数据、Base 内容、生成 Schema、Story Editor、正常/重播 Runtime 与 UI 路由均已修改；启动包校验现按依赖顺序装载；静态构建通过。未运行自动化测试或浏览器验收。

## 剩余工作与交接

- 等待用户确认浏览器中的 Area → Chara → Area、Chara → Chara 路由，重播场景提示及通讯录消息流隔离。
- 普通 `moveToArea` 会执行正式 Area 进入流程及其效果；若目标通讯录空间已有普通 Story，会以 `StorySpaceOccupied` 拒绝移动，避免覆盖运行中的角色会话。
- 第三方旧 StoryDef 缺少 startContext 时需补齐后才能保存/运行；未实现自动迁移。
- Base 导出产生的临时文件夹因执行环境拒绝外部递归删除，暂留于 `C:\Users\15229\Documents\Obsidian Vault\1-项目\ACProgram-export-base-tmp`；其 `content.json` 与 `datapack.json` 已同步至内置 Base 包。
