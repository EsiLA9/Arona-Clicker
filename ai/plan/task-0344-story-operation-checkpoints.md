# Task 0344：Story Operation 顺序效果播放

状态：代码与构建验收完成 — Operation 效果逐条入流、播放期间禁止推进、完成后自动衔接；未运行自动化或浏览器交互

## 目标与范围

- 目标：Operation 动作执行一次后，将玩家可读的状态效果按顺序逐条展示在聊天流；展示期间禁用底部推进，最后一条显示后自动确认当前 Operation 并衔接后继节点。
- 连续 Operation 逐个执行、逐条展示，不需要用户额外确认；展示等待有界，不能永久卡在 Operation。条件跳过的 Operation 不产生效果条目。
- 保持现有动作顺序与同步执行语义：动作在进入效果展示前执行；执行拒绝仍走当前 Story 失败路径；被替换的 Story 不生成过期效果序列。
- 存档恢复：Operation delivery pending 仍记录当前节点；动作已在快照前执行。恢复时从聊天流中已展示的效果数量处继续，不重放动作或重复播报。无存档格式或 StoryDef Schema 变更。
- 明确非目标：不为 Operation 增加结果回滚；不展示全套 Runtime action 预览；不改变 Talklet / Click / Transfer 语义。Operation 中可读的玩家状态效果会逐条加入聊天流，内部 flag / Extra 不作为奖励播报。

## 交互与状态草图

- Runtime 到达 Operation → 依次 preflight / execute → 设置 Operation checkpoint (`StoryNodePlaybackView.status='operation'`) → 投影 `operationEffects`；ChatStream 为每条效果建立有序定时序列，播放期间底部显示禁用的处理中状态。
- 最后一条效果呈现后复用 `onAutoAdvance(streamKey, token)` / `clickSend` 确认当前票据；下一个 Operation 启动新序列，遇到 Talklet / Click 则回到现有播放状态，文档结束则完成。
- 序列使用当前 StoryNode token / run / owner / history 隔离；存档仍以 `nodeId + pending.kind='delivery'` 编码已执行的 Operation，不新增 Snapshot 字段。
- Operation 不伪造聊天台词；可读状态效果复用 reward 流样式，逐条追加。处理期间显示橙色禁用态；Story 页码仍只计算 Talklet / Click。

## 事实与决定

| 问题 / 决定 | 已核实事实 | 当前裁定 |
| --- | --- | --- |
| Operation 为什么卡住 | Player 在已执行动作后暂停于 operation pending；旧处理需要用户再点确认，且效果显示与推进共用按钮门控。 | 用 ChatStream 管理有限的效果播放序列；队列结束自动调用现有 delivery ack，不等待额外点击。 |
| 用户如何看见效果 | Operation 不转成 Talklet 正文；StoryService 按 Registry 名称生成只读效果行，ChatStream 追加为独立 reward 条目。 | 每条之间有短间隔；播放中按钮禁用并显示处理中状态。 |
| 如何防止重复效果 | StoryNodeSnapshot 在 wait boundary 保存当前 nodeId 与 pending.kind；聊天条目有当前节点 `storyPageKey`。 | 恢复从同 fingerprint 的 reward 条目计数续播；动作不重放。 |
| 阅读进度 | `markTalkletDelivered()` 以 Talklet 节点计算作者正文序号。 | Operation checkpoint 不增加 Talklet 已读序号。 |

## 验收条件

- [x] 单个 Operation 执行一次后，可读效果逐条进入聊天流；最后一条后自动衔接到后继节点。
- [x] 连续多个 Operation 逐个展示，每个都按序完成后再运行下一个；不隐式批量越过等待中的效果。
- [x] Operation 之后的 Talklet / Click 按原规则显示；Operation 在 Story 末尾时自动衔接后正常完成。
- [x] requiresFlag 不满足时跳过 Operation 且不生成效果；本地标记写入、外部动作、transfer replace / cancellation 保持现有顺序与结果。
- [x] 在 Operation 效果序列中恢复，从已写入聊天流的条目数续播；动作不重复执行，效果不重复追加。
- [x] Operation 不写虚假的 Talklet 内容或阅读序号；不同 owner / run / token 仍相互隔离。
- [x] 效果播放期间提供禁用态并忽略推进点击；播放完成后自动确认 Operation。

## 当前进度

- [x] 核对 Player drain、StoryService send-state、StoryView 投影、ChatStream 与 StoryNodeSnapshot 的等待路径。
- [x] 裁定 Operation 执行后生成 delivery checkpoint，复用 token / snapshot kind，不增加契约字段。
- [x] 实现 Player operation pending、restore 复原、Operation StoryView 投影及 send-button 文案。
- [x] 更新 Story 机制说明并通过类型、文档和差异静态核验；当前执行约束不运行或新增自动化测试。
- [x] 将 Operation 处理期间改为橙色禁用态，并从领域状态清理残留 Talklet 节奏门控。
- [x] 将状态效果串接到 ChatStream 有序播放序列，完成后通过当前 delivery token 自动确认并推进。
- 正在进行：无。
- 下一步：代码与静态核验完成；待浏览器交互验收。

## 相关文件与资料

| 路径 | 用途 | 当前状态 |
| --- | --- | --- |
| `src/arona-clicker/services/story/story-node-player.ts` | Operation 动作执行、operation pending、快照恢复 | 已修改；恢复时不重放动作 |
| `src/arona-clicker/contracts/runtime/story-node-playback.ts` | Player wait view 的 operation 状态 | 已修改；Talklet delivery 类型保持窄化 |
| `src/arona-clicker/services/story/story-node-session.ts`、`src/arona-clicker/services/story/story-service.ts` | wait view 到 StoryView 投影、Operation 效果文案与 Talklet 阅读序号 | 已修改；Operation 不增加 Talklet 阅读计数，按状态效果生成玩家可读行 |
| `src/arona-clicker/services/story/story-service.ts` | advance / send-state 路由与确认文案 | 已修改；Operation 状态可确认并输出继续文案 |
| `src/engine/contracts/story-node-snapshot.ts` | 当前 wait 节点存档形状 | 已修改注释；使用既有 delivery/input 结构 |
| `src/ui/columns/chat-content.ts`、`src/ui/controller/controller-actions-story.ts`、`src/ui/css/chat-input.css`、`src/ui/presentation/chat-stream.ts` | Operation 有序效果序列和推进门控 | 已修改；效果按顺序进入流，播放中禁止推进，完成后调用现有自动推进路由 |
| `docs/docs-830/05-domains/story-and-effects.md` | Runtime Operation / Talklet / Click 推进机制 | 已更新 |

## 验证与结果

| 检查对象与方式 / 命令 | 实际结果 | 未执行原因 / 处理 |
| --- | --- | --- |
| 源码调用链核对 | 已完成；Operation 当前同步 drain 且无等待视图 | 无 |
| `npx tsc --noEmit` | 通过 | 无 |
| `npx vite build --outDir .test-artifacts/story-operation-unblock-build --emptyOutDir` | 通过；构建写入临时目录，没有覆盖 `dist/` | Vite 提示现存的大 chunk 警告 |
| `npm run check:docs` | 通过；114 篇 Markdown，0 错误 | 无 |
| 定向 `git diff --check` | 通过 | 无 |
| 自动化 / 浏览器交互 | 未运行 | 本次只做静态与生产构建验收；尚未做浏览器交互验收 |

- 当前结果：Operation 动作在到达时执行一次，然后以 `StoryNodePlaybackView.status='operation'` 暂停在内部 delivery 边界；ChatStream 逐条追加可读效果，期间显示禁用的处理中按钮。最后一条呈现后由现有 `onAutoAdvance` 调用 `clickSend` 并使用同一 token 确认，自动进入下一节点，不需要用户额外点击。恢复时按 `storyPageKey` 统计已写入条目续播，不重放动作、不重复播报；Talklet 阅读序号不受影响。

## 剩余工作与交接

- 已按 GALHCG 项目地图只读复核直接影响源码路径；自动化和浏览器交互验收可后续补充。本次未改图、未刷新、未写 freshness。

2026-10-30 队列迁移交接：本页保留本 Task 的作者语义与实施记录；Runtime 已由 Task 0345（原归档已删除） 统一承担当前等待点的有限表现步骤、计时和自动交接。ChatStream / Controller 不再持有 Story 自动确认或通知计数恢复。对应节点、UI 与保存行为已纳入 0345 的完整自动化回归；当前机制见 [[story-and-effects]]、[[story-chat-and-theme-presentation]]。
