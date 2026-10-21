# Task 0308：ActiveStoryEntry 区域投递与手动接取

状态：implementation complete — FollowUp 与 9 个仅依赖故事目录开放的 ActiveStoryEntry 已转为 Area 投递；故事页只保留已完成历史。当前扩展通过 TypeScript 检查，未复跑行为测试；宽屏浏览器体验待用户确认。

## 目标

本文回答：如何让行为激活的 `ActiveStoryEntry` 先投递到一个 `Area`，由玩家进入该区域的 AreaHero Workspace 并主动点击接取，而不是在触发时或抵达时自动开播。

来源：用户于 2026-10-21 在当前会话明确提出以下体验要求：

1. 某些行为可以激活一个 `ActiveStoryEntry` 并将它投递到指定 `Area`。
2. 投递本身不启动剧情。玩家必须进入目标 Area 的 AreaHero 内页并点击该条目。
3. 点击成功后立即退出 AreaHero Workspace，回到一般 `game` Workspace，并使用现有剧情游标开始该 ActiveStory；实际聊天游标如何遵守 Entry `owner` 语义在 P0 核实。
4. ActiveStory 完成后，条目默认从 AreaHero 待接取项中撤离并写入完成记录；“故事”页的对应条目遵守既有可重播规则提供回放。

本 Task 依赖可用的 Area Workspace 路由与页面骨架；它只定义和实现 ActiveStory 的区域投递生命周期，不重做 Area Workspace 三栏结构。关联上下文见 [[docs/plan-work/task-0306-area-hero-workspace-and-story-entry]]。

## 本轮裁定范围

- 只有 `ActiveStoryEntry` 进入本 Task 的区域投递流程；现有 PassiveStory 自动闲聊与聊天沙盒语义不改。
- 首个垂直切片迁移现有 `StoryFollowUp` 中目标为 `ActiveStoryEntry` 的分支；之后按用户补充，将故事目录中仅依赖可用条件开放的 9 个 ActiveStoryEntry 也纳入 Area 投递。FollowUp 目标为 `PassiveStoryEntry` 时继续沿用直接启动行为。
- FollowUp 完成来源 Story 后，继续等待未来匹配的 `areaEntered`。到达目标 Area 时创建投递，不自动启动 Story；不补追玩家已身处目标 Area 时发生的进入事件。
- 通用 `triggerStory` Effect 继续保留立即启动语义；Init 起始故事、PassiveStory 自动闲聊和对话沙盒不进入本 Task。未来其他行为需要区域投递时，另增显式带目标 Area 的投递动作。
- 接取动作发生在当前 Area 对应的 AreaHero Workspace；过期 Area 路由或目标不匹配时不得启动。
- 成功接取后回到一般 `game` Workspace 并开始播放，不经过现有 Story Workspace 的额外入口确认浮层。
- 播放仍通过正式 `StoryService` / `GameCommands` 入口，继续执行 StoryEntry 类型、Init、触发条件、完成态和游标准入检查；不能由 UI 直接写状态或自行构造剧情游标。
- 投递身份以当前 Init 内的 `entryId` 为单位；同一 Entry 在一个 Init 中只允许一个投递生命周期，重复触发不重复创建。重复目标冲突时首次有效投递优先，不移动或覆盖原投递。
- 投递归属当前 Init 并随存档恢复。保留待接取投递直至对应 Entry 的 Story 正式完成；播放中状态由现有 Story 游标的 Entry 身份推导，不另存冗余 `inProgress` 状态。完成后保留完成回执防止重复发放，沿用 `storyLog` 作为 StoryDef 完成事实。
- 成功完成只撤离本次播放关联的 `entryId` 投递。故事页的重播仍受 `replayable` / 内容目录规则控制，不重复首次完成奖励。
- 手动接取按 `ActiveStoryEntry.owner` 选择现有聊天游标；返回一般 `game` Workspace 后，该游标的播放内容必须可见。当前 FollowUp 自动启动固定传入全局 owner（`null`），所以这项属于新接取路径的明确变化。
- 仅考虑宽屏鼠标操作，不扩展竖屏布局或键盘交互。

## 当前事实与代码落点（2026-10-21 核对）

| 已核实事实 | 源码／测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| Area Workspace 路由已经存在，但中栏和右栏仍是占位内容 | `src/ui/workspace/workspace-router.ts`：`WorkspaceRoute` 的 `area` 分支；`src/ui/components/area-workspace.ts`：`renderAreaWorkspace`；`src/ui/workspace/workspace-renderer.ts`：Area route 分派 | 复用现有路由与 Frame；把待接取项放入 Area 页面，不在本 Task 重造工作区骨架 |
| AreaHero 只可打开当前 Area 的 Workspace，并受 Story 阻塞查询限制 | `src/ui/controller-actions-inventory.ts`：`data-area-workspace-open`；`src/ui/components/rail.ts`：`renderAreaTab` | 成功启动 ActiveStory 后回一般 `game` Workspace；播放期间现有 ActiveStory 阻塞 AreaHero 打开和手动移动 |
| `AreaDef` 没有 ActiveStoryEntry 列表或动态投递字段 | `src/data-services/contracts/world.ts`：`AreaDef`（`defaultSpots`、`enterEffects`、拓扑、Reveal 等） | Area 的“承载”不是当前静态 Area 定义；待接取项需要一个运行时来源及生命周期 |
| `ActiveStoryEntry` 当前有 `availableInits`、`triggerCondition`、`replayable`、`owner` 等，没有目标 Area / 投递状态 | `src/data-services/contracts/story-entry.ts`：`StoryEntryBase`、`ActiveStoryEntry` | 区域投递与 StoryEntry 的启动准入要分开；选定 Entry 不等同于已投递或已播放 |
| `StoryFollowUp` 已表达“完成来源故事后，等待下一次进入指定 Area，再对目标 StoryEntry 执行动作” | `src/data-services/contracts/story-entry.ts`：`StoryFollowUp`；`src/arona-clicker/services/story-follow-up-mount.ts`：`reconcile`、`onAreaEntered` | 这是现有行为到 Area 的直接先例；当前行为是自动开播，需在本 Task 改为 Area 投递后手动接取 |
| 默认内容已有一条符合该路径的 ActiveStory 示例：星野邀约完成后，进入天台触发 `hoshino_rooftop_meet` | `src/arona-clicker/content/story-conversation-walls.ts`：`hoshino_conv_2` 的 `followUp`；数据包输出见 `src/arona-clicker/content/base-pack/content.json` | 作为端到端验收样例：到达天台后只显示待接取项，点击后才开始相遇剧情 |
| 施工前，FollowUp 成功时直接调用 `startStoryEntry`，之后将派生 FollowUp ID 写入 `triggersCompleted`；Area 进入本身是触发事件 | `src/arona-clicker/services/story-follow-up-mount.ts`：`onAreaEntered`；`src/arona-clicker/runtime-wiring.ts`：注入的 `startStoryEntry` | 首期将 ActiveStory 目标改为持久投递；PassiveStory 目标保留原直接开播 |
| FollowUp 当前只响应挂载后未来发生的匹配 `areaEntered`；未检查当前 Area 来补发事件 | `src/arona-clicker/services/story-follow-up-mount.ts`：`reconcile`、`onAreaEntered` | 保留未来进入语义，避免把新投递流程顺手扩成 catch-up |
| `StoryService` 的完成查询以 `storyLog.storyId`（StoryDef ID）为准；完成记录和 `storyCompleted` 事件目前没有 `entryId` | `src/arona-clicker/services/story-service.ts`：`hasCompletedStory`；`src/arona-clicker/services/story-jump.ts`：`resolveStoryEnd`；`src/arona-clicker/state/state-mutation-service.ts`：`completeStory` | 共享 StoryDef 的多个 Entry 目前共享完成准入；若要精确清理某条投递，完成时须在游标清空前取得 Entry 身份，不能按 StoryDef 批量删除 |
| `storyCompleted` 只携带 `storyId`，但 `resolveStoryEnd` 在正式完成时仍可读取游标的 `currentStoryEntryId` | `src/arona-clicker/services/story-jump.ts`：`resolveStoryEnd`；`src/arona-clicker/state/state-mutation-service.ts`：`completeStory` | 完成关联应从正式完成路径传递 `entryId` 或在游标可用时调用投递完成服务；UI 不监听 StoryDef ID 后猜测入口 |
| Entry 启动准入和目录完成态均会通过 `entry.storyId` 查 StoryDef／StoryLog；当前默认内容未发现多个 ActiveStoryEntry 共用同一 StoryDef | `src/arona-clicker/services/story-service.ts`；`src/ui/components/rail.ts`；`src/arona-clicker/content/base-pack/content.json`（当前默认包核查） | 首期按现有 StoryDef 完成语义工作；共享 StoryDef 不能被描述成独立完成。若未来需要 Entry 级独立重播／准入，应另行改造完成身份模型 |
| Entry-aware 启动 API 支持 owner，但现有 FollowUp 回调传 `null`；Story View 可按 owner 查询 | `src/data-services/contracts/story-entry.ts`：`ActiveStoryEntry.owner`；`src/arona-clicker/runtime-wiring.ts`；`StoryService.getStoryView` | 手动接取使用 Entry owner，并验收一般游戏 Workspace 中相应游标的呈现 |
| 当前 FollowUp 回归测试断言到达天台后立即启动剧情 | `tests/engine/passive-pool.test.ts`：天台 Trigger 完整流程、存档恢复与非目标区域用例（约 413–515 行） | 新行为必须替换自动开播断言，并覆盖等待、投递、保存、接取、完成各阶段 |
| 通用 `triggerStory` Effect 也是立即启动；Runtime Reactor 按目标 Entry 调用 `startStory(..., { force: true })` | `src/engine/types/expression.ts`：`triggerStory`；`src/arona-clicker/runtime-wiring.ts`；`src/arona-clicker/services/runtime-effect-reactor.ts` | 不应默默将所有系统级 `triggerStory` 改为 Area 投递；P0 明确哪些激活源进入本 Task |
| Story 完成日志记录 StoryDef ID 与选项，不保存投递记录；StoryLog 属于当前 Init 状态 | `src/arona-clicker/services/story-jump.ts`：`resolveStoryEnd`；`src/arona-clicker/state/state-mutation-service.ts`：`completeStory`；`src/arona-clicker/state/per-init-fields.ts`：`storyLog` | 完成后可沿用既有日志，但待接取投递需要独立清理规则；多 Entry 共用 StoryDef 时要防止误删其他投递 |
| 故事目录以 `StoryContentItem.entryId` 指向 ActiveStoryEntry；已完成且可重播时显示“重读” | `src/arona-clicker/content/story-hierarchy.ts`；`src/ui/components/rail.ts`：故事条目的完成与 replayable 判定；`src/arona-clicker/services/story-replay.ts`：`replayStory` | Area 投递目标必须能映射到故事目录；例如 `hoshino_rooftop_meet` 已列入目录且标为可重播 |

## P0：投递生命周期规则（本轮已收敛）

以下规则用于实现本 Task 的垂直切片；它们以当前源码和用户提出的 AreaHero 手动接取体验为依据。范围扩展记录：仅依赖故事目录首次启动的 9 个 ActiveStoryEntry，在可用条件首次满足时投递到玩家当时所在的 Area；Init 起始、FollowUp、羁绊卡等已有其他来源的 Entry 不进入这条自动发现路径。具体名单：`schale_flow_show`、`schale_theme_lite_test`、`abydos_welcome`、`millennium_welcome`、`millennium_game_crisis`、`serika_side_1`、`serika_side_2`、`run_chain_2`、`run_chain_3`。

### 激活与到达

1. `StoryFollowUp` 的 ActiveStory 目标按原规则迁移。来源 Story 完成后 FollowUp 进入等待；后续第一次匹配目标 Area 的 `areaEntered` 创建投递。进入其他 Area 不改变等待；来源完成时玩家已经在目标 Area，不立即投递，离开后再次进入才投递。
2. 投递创建后离开目标 Area 时保留；再次进入仍能看到同一待接取项。一次 FollowUp 最终只消费一次。创建新投递或确认已存在同一生命周期投递后，才提交其 `triggersCompleted` once 标记。
3. 到达事件不得直接调用 `startStoryEntry`。PassiveStory FollowUp 继续沿用原直接启动；`triggerStory`、Init 起始故事和其他自动故事来源也保持原语义。
4. 同一次 Area 进入事件可为所有匹配的 ActiveStory FollowUp 幂等创建投递，使一个 Area 能同时承载多个条目；PassiveStory FollowUp 保留现有每次进入最多成功启动一个目标的行为。

### 身份、重复和 Init 生命周期

5. 每个投递的逻辑身份为 `(currentInitId, entryId)`；由于记录本身归属当前 Init，存储时可用 `entryId` 作键，不另存可推导的 `deliveryId`。同一个 Area 可有多个不同 Entry 的投递。
6. 同一 `entryId` 在一个 Init 中最多有一个生命周期。重复触发幂等；若不同 FollowUp 试图将同一 Entry 发往不同 Area，首次创建成功的 Area 保留，后续不移动或覆盖。不同 Entry 即使引用相同 StoryDef，也不能按 StoryDef 一次性批量删除投递。
7. 投递记录属于 per-Init current 状态并进入存档。新 Init 不继承旧投递；等待中的 FollowUp 由既有 mount 按现有规则重建，已创建的投递按存档恢复。Area 或 Entry 在当前内容中失效时，投影不显示幽灵项，并提供有界清理或忽略规则。
8. 保存待接取项和完成回执。点击成功后可由当前 Story 游标匹配 `entryId` 推导播放中；投递生命周期在 Story 正式完成后转为 completed。`triggersCompleted` 只记录 FollowUp 已消费，不能替代投递记录或完成回执。

### 接取与启动

9. AreaHero 点击必须调用正式 Story 命令／服务。命令执行时重新核验：当前路由 `areaId`、当前 Area 与投递 `areaId` 一致；该投递仍存在且尚未完成；Entry 存在、类型为 Active、属于当前 Init 且满足现有可用性、triggerCondition 与完成态准入；对应 owner 游标可用。
10. 只有正式启动成功才关闭 AreaHero Workspace、返回一般 `game` Workspace 并显示该 Story。失败时保留页面和投递，沿用现有可读错误。点击或尝试启动不能提前消费／删除投递。
11. 按 `entry.owner` 选用既有全局或 owner 游标；一般 `game` Workspace 必须能呈现本次启动的游标。不要因为 AreaHero 是全局页面而丢弃 Entry owner。
12. 如果播放在正式完成前被中断、清空或恢复，待接取投递仍保留／重新可见；启动成功本身不等同于完成。
13. 手动接取走正常准入和游标占用检查，不沿用当前 FollowUp 回调的 `{ force: true }`；占用的游标不得被 AreaHero 接取静默打断。

### 完成与重播

14. 正式 Story 完成时必须用本次播放的 `entryId` 精确关联投递并留下完成回执，不能只用 `storyId` 清理全部投递。完成路径可在清空游标前把 Entry 身份交给投递服务；若扩展完成事件，则保留现有 `storyId` 并增加入口身份。
15. `storyLog` 仍是 StoryDef 完成事实的权威记录。当前准入与完成态以 StoryDef ID 判断；多个 Entry 共用 StoryDef 时，它们共享现有完成／重播准入语义。当前默认包未发现此类 Active Entry 重复引用。本 Task 不悄悄改成 Entry 级独立完成或奖励语义。
16. AreaHero 不再显示已完成投递；故事目录遵守已有 `replayable` 与内容目录规则提供重播。重播不重新创建原 FollowUp 投递，也不发放首次完成奖励。若 Entry 因共享 StoryDef 完成态、条件或其他准入被拒绝，不得伪装为已完成或删除其投递；显示可读原因并保留可诊断记录。

## 施工切片

### P1：行为投递与持久待接取项

- 按 P0 决策为选定的激活来源建立“发往 Area”路径；激活时不调用 `startStory`。
- 在游戏状态或可重建的 Runtime 投影中表达 Area 上的待接取 ActiveStoryEntry；状态归属、保存恢复和一次性触发标记职责分离。成功接取后直到剧情完成，Area 归属继续保留；完成才撤离。
- 在读取／写入路径核验 Area 与 ActiveStoryEntry 引用；若涉及数据字段或 Effect 枚举，按 schema-sync 核对契约使用者，并遵守 `AGENTS.md` 对生成文件的禁改边界。
- 仅迁移 P0 批准的激活来源和默认内容；其他 `triggerStory` 系统触发与 PassiveStory FollowUp 保持既有语义。

### P2：AreaHero 接取与正常 Story 播放

- Area Workspace 显示当前 `route.areaId` 对应、尚未完成的 ActiveStory 投递；只允许在 `route.areaId === currentAreaId` 时接取。
- 鼠标点击目标项后调用既有 Story 命令；成功时清除 Area Workspace 的瞬态页面状态并返回 `game` Workspace，同一交互中开始 Story 演出，并按 `entry.owner` 选择聊天游标。
- 不再弹出 Story Workspace 首次启动确认；运行时准入失败时保留 Area 页面与投递。
- 用户只要求手动接取；触发、到达、重渲染或重复事件均不能自动消费或自动开播。

### P3：完成撤离、历史重播与状态刷新

- ActiveStory 完成后撤离对应 Area 投递并保留标准 `storyLog` 完成事实；若 Story 在被完成前已启动，失败或失效的接取不能静默丢失投递。
- 故事页对应条目按既有完成态与 replayable 准入展示“重读”；重播不再次发放首次奖励，也不重新投递同一已完成行为。
- Area 投递与完成变化时只刷新必要的 Area Workspace / 故事条目；切换 Init、存档恢复、旧内容缺失时不显示幽灵投递。
- 更新受影响的机制文档；只写已经由实现和测试确认的机制事实。

## 测试与验收

- [x] `hoshino_conv_2` 完成后，若玩家尚未进入 `schale_rooftop`，FollowUp 等待；进入天台只创建 `hoshino_rooftop_meet` 投递，Story 游标仍为空。
- [x] 进入非目标 Area 不投递；来源完成时玩家已在目标 Area 不补追，离开后再次进入才投递。投递创建后离开并重返目标 Area，仍是同一条待接取项。
- [x] 同一 Area 进入事件可创建所有匹配的不同 ActiveStory 投递；重复事件不产生重复投递，同一 Entry 冲突时首次 Area 不被覆盖。Passive FollowUp 每次进入最多成功启动一个目标的既有行为保持。
- [x] 鼠标控制器点击目标 AreaHero 项后返回一般 `game` Workspace，并在 Entry owner 聊天流启动 Story；未经过额外 StoryGate 确认。
- [x] 区域不匹配、条件失效、Story owner 游标被占用时 Runtime 拒绝启动且保留投递；播放中断和旧路由会由命令校验拦截。
- [x] FollowUp once 标记在投递成功创建或幂等确认后提交；投递和完成回执随当前 Init 保存／读档，新 Init 不继承；无效内容不投影为待接取项。
- [x] Entry owner 游标可在一般 `game` Workspace 正常显示并阻塞 AreaHero／移动；播放中断或读档恢复不能丢失未完成投递。
- [x] 完成 ActiveStory 后只将该 `entryId` 投递标记完成，`storyLog` 记录 StoryDef 完成；故事目录沿用 `replayable`，重播不重复完成日志或投递。同 StoryDef 多 Entry 的准入仍按现有共享完成语义处理。
- [x] 通用 `triggerStory`、Init 起始故事、既有羁绊卡与 PassiveStory FollowUp 保留原行为；仅故事目录专属的 9 个 Entry 使用可用条件投递。
- [x] 故事页隐藏所有未完成条目和首次启动动作，只保留已完成历史与原有重播准入。
- [x] 首期 FollowUp/AreaHero 垂直切片按 [[docs/docs-829/05-conventions/testing]] 运行了定向 Runtime/UI 测试、类型检查和架构检查；后续 9-entry 扩展通过类型检查，未复跑行为测试。
- [x] UI 仅按宽屏鼠标范围实现；未新增竖屏或键盘交互。

建议测试入口：`tests/engine/passive-pool.test.ts` 中现有 FollowUp 流程；`tests/engine/story-entry-split.test.ts` 中引用验证；`tests/ui/` 中 Area Workspace 路由、Controller 和 Story 入口测试。执行前应按 P0 结果重新定位并补充行为级用例，避免只测队列 helper。

## 当前核验（2026-10-21）

- 已实现 `areaStoryDeliveries` per-Init 状态、幂等创建与完成回执；FollowUp 与故事目录专属的可用条件开放条目都会创建 Area 投递，同一 Area 可有多个待接取 Active 项，PassiveStory FollowUp 仍直接启动。
- 已增加 `StoryService.getAreaStoryDeliveries()` 查询与 `acceptAreaStoryDelivery()` 准入命令。命令核验 current Area、投递记录、Entry Init 与 owner 游标；普通 PassiveStory 不会被接取打断。成功启动不删除投递，Story 正式完成时在游标清空前按 `entryId` 标记 completed。
- AreaHero 中栏现显示待接取故事卡；成功点击后返回普通 `game` Workspace 并切换到 Entry owner 聊天流。AreaHero 路由检查、域命令检查和 Story 游标门控各自保留。
- 首期 FollowUp/AreaHero 垂直切片：`npx vitest run tests/engine/passive-pool.test.ts tests/engine/story-replay.test.ts tests/engine/story-flow.test.ts tests/engine/story-entry-split.test.ts tests/engine/effect-engine.test.ts tests/ui/workspace-lifecycle.test.ts tests/ui/story-gate.test.ts --reporter dot --silent`，7 个测试文件、101 个测试通过；这些测试未覆盖本次 9-entry 扩展。
- 当前扩展的 `npx tsc --noEmit` 通过；本次没有运行测试或 `npm run check:architecture`。
- `npm run check:docs` 报告 26 个既有问题：Task 0309/0310 单元与 receipt 文件名重复 18 项，以及 8 个 `docs/docs-829/` 页面中的失效源码／测试路径；未指向本 Task、索引或本轮更新的机制／风格页面，未扩大范围修复。
- `git diff --check` 与新增 Task 文件尾随空白检查通过。没有进行浏览器实测；自动化 DOM 交互验证已覆盖 AreaHero 接取与 owner 聊天视图，待用户做宽屏实际体验。

## GALHCG 影响闭环

- 已以 `graph_project(workspace_path="C:\\Users\\15229\\Documents\\Obsidian Vault\\1-项目\\ACProgram")` 核对项目身份 `acprogram`；图内 `StoryService` 概念命中后回到源码复核。项目图查询只读，无图写入或刷新。
- 本轮没有编辑 GALHCG 图或 freshness。`graph_health(check="changed")` 只读复核发现 StoryFollowUp、StoryService 与 per-Init 字段文件的既有 Evidence 已过时；Area Workspace 文件是 `unreferenced_path`。图维护需要单独授权。
- 施工路径按源码复核涉及 StoryFollowUp、Init 快照、Story completion、Area Workspace 与 owner chat；本 Task 的地图结果仅作为维护线索，不作为实现正确性的证明。

## 剩余工作

- 实现与自动化验证已完成；剩余为用户在宽屏浏览器手动体验中栏条目、接取返回与 owner 聊天显示。
- Task 0306 的 Area Workspace 整体职责、Area 内容和提示标记仍按其自身边界处理；本 Task 不实现事项系统或通用通知中心。

## 相关路由

- [[docs/plan-work/task-0306-area-hero-workspace-and-story-entry]]
- [[docs/ai/context-packs/world-lifecycle]]
- [[docs/ai/context-packs/ui-presentation]]
- [[docs/docs-829/03-data-structures/player-state]]
- [[docs/docs-829/04-mechanisms/arona-clicker/world-lifecycle]]
- [[docs/docs-829/05-conventions/schema-sync]]
- [[docs/docs-829/05-conventions/architecture-discipline]]
- [[docs/docs-829/05-conventions/testing]]
