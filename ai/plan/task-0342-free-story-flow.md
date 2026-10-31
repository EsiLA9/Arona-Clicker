# Task 0342：自由 Story 流与输入衔接

状态：代码与静态验收完成 — 顺序自由编排、Talklet 自由继续/Click 衔接和连续 Click 已实现；自动化与浏览器交互未运行

## 目标与范围

- 目标：让 `nodes` 成为 Story 播放和编辑顺序的唯一控制依据。作者可以任意交错 Talklet、Click、Operation 与 Transfer，不因旧阶段分组而无法保存。
- 输入行为：Talklet 后紧邻且当前可用的 Click 时，Talklet 送达后直接衔接 Click 输入；没有紧邻可用 Click 时，Talklet 送达后等待用户自由点击继续；连续 Click 逐个显示并提交，前一个完成后接下一个。
- 兼容边界：保留正式 StoryDef 中现有 `stageId` 与 `stages` 字段及其序列化形状，不增加 Schema 或迁移；这些字段成为兼容元数据，不再表达播放边界、Click 数量或节点连续性。仍检查局部 ID 与声明引用的基本完整性。
- 编辑器：节点顺序直接决定流程；隐藏阶段分组与推进方式控件，移动节点不要求重分组。新建和类型切换仍自动填充兼容字段。
- 明确非目标：不合并或重写 StoryNode 类型；不改变 Click 自身提交/动作语义、局部标记跳过、Transfer 或保存恢复协议。

## 易用性与交互结构

- 中栏节点列表及拖动/插入锚点继续作为唯一作者顺序。没有增加 wrapper 或播放编辑器结构；右栏 Talklet / Click 属性移除旧阶段折叠组。
- 正常阅读沿用既有 ChatStream：邻接的可用 Click 仍使用 `nextIsInput` 衔接；没有 Click 时，Talklet 展示内容后从节奏等待态转为可点击继续，不再由计时器自动推进。
- 连续 Click 沿用 StoryNodePlayer 提交后从下一节点继续的顺序执行；不合并选项、按钮、动作或结果。

## 事实与决定

| 问题 / 决定 | 已核实事实与依据 | 当前裁定 |
| --- | --- | --- |
| 播放顺序由谁决定 | `StoryNodePlayer.drain()` 顺序读取 `document.nodes[index]`；`submit()` / `ackDelivery()` 推进一个节点。Runtime 未用 stage advance 决定播放。 | 保持 `nodes` 单一顺序来源。 |
| stage 为何阻挡自由流 | `validateStoryNodeStructure()` 按连续 stage run 强制 auto/input 与 Talklet/Click 数量；`projectStoryDefinition()` 和 `StoryNodePlayer.document()` 都调用它。 | 删除 stage run 形状、连续性及 unused stage 阻断；保留 stage ID/引用有效性检查。 |
| Talklet 的自由继续 | `ChatStream.afterDelivery()` 对所有 delivery token 安排自动推进；只有下一节点是可用 Click 时，Story 投影设 `nextIsInput`。 | 有可用 Click 时延续现有衔接；无 Click 时保留等待票据，节奏等待结束后让用户点击继续。 |
| 连续 Click | Player 在 Click submit 后递增节点索引并继续 drain；下一个 Click 会直接成为新的 input pending。 | 不加额外阶段/空 Talklet；保持逐个输入。 |
| schema 与存档兼容 | `StoryNode` 契约要求 Talklet/Click 有 stageId，StoryDef 有 stages；字段本身未用于节点执行。 | 字段保留为兼容元数据；不改类型合同、生成 Schema 或存档版本。 |

## 验收条件

- [ ] p2 等同一 stage 的 Talklet / Click 被其他 stage 节点隔开时仍可投影、保存并启动；不再出现 exactly-one-Click 或 non-contiguous-stage 结构错误。
- [ ] stage advance 与节点分组不控制 Runtime 播放；旧字段仍原样保留在正式定义中。
- [ ] Talklet 后紧邻且 `requiresFlag` 当前可通过的 Click 时，Talklet 送达后衔接到该 Click 的输入；不会出现额外自由继续或自动越过该 Click。
- [ ] Talklet 后没有紧邻可用 Click 时，文本送达后等待一次用户点击继续；不得自动跳过该节点。
- [ ] Talklet 后的 Click 被 `requiresFlag` 跳过时，Talklet 按无可用 Click 的情形等待自由点击。
- [ ] 连续 Button / Choice / EntryCard Click 逐个显示；提交前一个后下一个成为当前输入，动作与条件各执行一次。
- [ ] Operation、Transfer、局部标记门控、`insert` 返回栈及会话恢复仍按节点顺序工作。
- [ ] Story 编辑器不再暴露阶段 ID / 推进方式编辑；节点换序不自动改写兼容 metadata。

## 当前进度

- [x] 核对 StoryNode 合同、投影校验、Runtime Player/Service、ChatStream 及 Story Editor 的 stage 数据路径。
- [x] 裁定 stage 字段保留为兼容元数据；自由节点顺序成为唯一流程来源。
- [x] 移除 stage shape / non-contiguous / unused-stage 的阻塞校验，同时保留基础 ID 与引用校验。
- [x] 让无后续可用 Click 的 Talklet 等待用户继续；保留 Talklet-to-Click 衔接和连续 Click 现有行为。
- [x] 移除属性栏阶段分组编辑，并更新 Story 流机制文档、编辑器说明与视觉模式。
- [x] 类型、文档与差异静态核验；按当前执行约束不运行或新增自动化测试。
- 正在进行：无。
- 下一步：代码和静态检查完成；待自动化与浏览器交互验收。

## 相关文件与资料

| 路径 | 用途 | 当前状态 |
| --- | --- | --- |
| `src/data-services/validation/story-node-structure.ts` | 运行与投影共用的节点结构校验 | 已核对；待移除 stage 分组限制 |
| `src/data-services/authoring/story-definition-projection.ts` | 草稿到正式 StoryDef 的结构校验入口 | 已核对；stage 元数据仍通过既有合同投影 |
| `src/arona-clicker/services/story/story-node-player.ts` | 节点顺序执行与 Click / delivery 等待 | 已核对；顺序推进不依赖 stage |
| `src/arona-clicker/services/story/story-node-session.ts` | StoryView 投影及 `nextIsInput` 邻接判断 | 已核对；邻接输入衔接可复用 |
| `src/ui/presentation/chat-stream.ts` | Talklet 送达后的节奏、自动继续与门控 | 已核对；无 Click 时需从自动推进改为手动继续 |
| `src/ui/story-editor/property-fields.ts`、`controller.ts`、`property-model.ts` | 阶段属性编辑入口与内部字段维护 | 已核对；右栏可移除，内部 metadata 自动生成保留 |
| `src/data-services/contracts/story-node.ts` | 兼容 stage 字段定义 | 已核对；本任务不改合同或生成 Schema |
| `docs/docs-830/05-domains/story-and-effects.md` | Story 播放与推进机制事实 | 待更新 |
| `docs/docs-830/07-tooling/runtime-editor-and-project-checks.md` | Story Editor 保存与阶段说明 | 待更新 |
| `ui-style/patterns.md` | Story 属性栏与流程编辑器复用模式 | 待更新 |

## 验证与结果

| 检查对象与方式 / 命令 | 实际结果 | 未执行原因 / 处理 |
| --- | --- | --- |
| 源码调用链核对 | 已完成；Runtime 顺序播放器已有自由节点执行基础 | 无 |
| `npx tsc --noEmit` | 通过 | 无 |
| `npm run check:docs` | 通过；112 篇 Markdown，0 错误 | 无 |
| 定向 `git diff --check` | 首轮发现 `chat-stream.ts` EOF 多余空行，已删除；复核结果见最终状态 | 无 |
| 自动化 / 浏览器交互 | 未运行 | 当前执行约束未授权新增或运行测试；本轮未做浏览器交互验收 |

- 当前结果：节点顺序现在独立决定 Story 流程；stage 校验不再要求分组连续或每组 Click 数量，stage 字段仍保留。无紧邻可用 Click 的 Talklet 文本送达后等待用户继续；紧邻可用 Click 时自动衔接。编辑器阶段控件已移除。类型与文档检查通过，自动化与浏览器交互未验收。

## 剩余工作与交接

- 自动化与浏览器交互验收可后续补充；不影响本次代码实现和静态检查结果。
- 已按 GALHCG 项目地图只读复核三个直接源码路径；`module:game-ui` 目前无映射文件。本次未改图、未刷新、未写 freshness。
- 收尾时按项目地图对本任务直接影响范围做只读复核，不改图、不刷新、不写 freshness。

2026-10-30 队列迁移交接：本页保留本 Task 的作者语义与实施记录；Runtime 已由 Task 0345（原归档已删除） 统一承担当前等待点的有限表现步骤、计时和自动交接。ChatStream / Controller 不再持有 Story 自动确认或通知计数恢复。对应节点、UI 与保存行为已纳入 0345 的完整自动化回归；当前机制见 [[story-and-effects]]、[[story-chat-and-theme-presentation]]。
