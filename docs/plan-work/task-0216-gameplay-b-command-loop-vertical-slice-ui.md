# Task 0216 — 玩法 B 核心可玩切片与只读 UI

状态：complete — U1–U6、浏览器试玩与文档/GALHCG 收尾完成。Task 0215 已于 2026-10-05 按 Task Owner 确认归档，不影响本切片验收。

## 目标

用一个最小现场地点和 AC 游戏 UI 验证核心决策链：学生自主计划 → Sensei 有限修订 → 单次 Commit → 统一 Resolution → 可观察的现场状态变化。

## Why

行为测试能验证规则，但不能证明玩家在 Commit 前确实能看懂行动、意图、指挥范围和后果。先做单地点切片，可及早检查这套玩法是否产生真实决策。

## Scope

- 建立一个新 Operation Workspace 或等价的独立 UI Surface，不大改 AC 主 Workspace 导航。
- 用只读 `OperationView` 投影事件/地点状态、Actor、Action、Intent、目标、费用、可改理由、组合预测与 Resolution。
- Controller 命令只更改一次 InterventionDraft，或发出 Commit；UI 不直接写 EventRun。
- 采用中性叙事的游乐园设备安全事件：三名行为 Profile 不同的 AC 学生、两名对手、一个环境参与者/状态目标、最多两个 Beat；不借用既有长线剧情设定。
- 至少一个学生 Profile 拥有影响关键目标可行解法的专属能力。
- 同一 Beat 至少有两项合理但互相冲突的可干预计划；不干预、改动计划 A、改动计划 B 导向可解释的不同状态或代价。
- 确保至少一次合法干预、一次标签协同、一次事件轨道变化以及可观察的成功/失败两种局部结果。
- 通过局部更新呈现准备变化和结算结果，保持焦点、滚动、目标选择与日志阅读连续性。
- 开始 UI 施工前声明 DOM budget、稳定节点、behavior/region/structure 刷新范围、full render 条件，以及 focus/scroll/hover 连续性方案。
- 使用按内容职责单独组织的 TypeScript 临时事件定义模块；该纵切只在当前 `activeInit === 'base:init:schale_office'` 时提供入口，借用夏莱办公室作为体验挂载世界线，不把 EventRun 状态写进该 Init 的 PlayerState/Snapshot。具体目录由实施时依据实际内容边界确定。
- 在同一纵切验证角色随机技能只于 Commit 后结算；不加入非战斗 SceneAction/PlayerCost/场景卡，后者由 Task 0224/0225 承接。

## 体验与 Runtime 边界

- 事件入口放在现有中心聊天流内，不新增全局导航项。进入事件后使用独立 Operation Surface；返回时恢复原聊天列表、面板标签、焦点与滚动位置，中心事件日志继续采用 AC 的对话流式呈现。
- 1280×720 为验收设计基准；若宿主浏览器不能精确设定 viewport，记录实际宽桌面截图尺寸并确认中心对话流至少占可用宽度的 60%。不额外验收窄屏内容移位；目标/轨道放入侧栏，学生计划、敌方 Intent、干预槽和 Commit 保留在主要对话流内。
- OperationView 是 `operationEntry` 提供的只读 detached 投影；UI 组件不读取 EventRun owner、resolver、ActionDef 或 mutable GameInstance 规则对象。读取按 Operation Surface 需要调用，不塞进全局 GameView。
- 0215 尚无 Beat 上限或正式 Objective/Outcome 机制。两次有效 Commit 后，样例只依据游乐设施危险轨道展示“安全处置 / 处置失败”的**试玩切片结果**并禁用继续提交；不得把此 UI 判读显示为 `EventRun.status` 或 EventOutcome。正式成功、部分成功、失败与结束状态由 Task 0217 提供。

## Non-goals

- 不制作视觉稿驱动的新工作区导航，不对 UI 进行全局改版。
- 不实现多地点路线、存档续局、长线剧情或全部事件目标种类。
- 临时 TypeScript 定义不进入正式 default Datapack/Registry；Task 0220/0222 将内容合同稳定后再迁移正式样例。
- 不以动画、实时输入速度或隐藏概率作为核心验收。

## Current AC facts

| 已核实事实 | 证据 | 设计影响 |
| --- | --- | --- |
| UI 通过 Controller 命令 Runtime，UIContext 使用 detached GameView。 | `docs/docs-829/06-wiki/50-ui/controller-commands.md`；`docs/docs-829/06-wiki/50-ui/read-model-context.md` | Operation 使用自身只读投影和命令，不向组件传可变 Runtime。 |
| 更新派发支持行为、区域或元素级收敛，并维护焦点/滚动连续性。 | `docs/docs-829/06-wiki/50-ui/refresh-update.md`；`docs/docs-829/06-wiki/50-ui/workspace-routing.md` | 新 Surface 按状态变化范围更新。 |

## Data / API

- `OperationView`：当前 Event/Location、事件轨道、学生/敌方/环境 Actor、合法 Action/Target 选项与阻塞理由、PreparedBeat、InterventionDraft、组合预览、Commit 可用性、Runtime status/Resolution 及样例局部判读。不给 UI 暴露规则定义或完整 Run。
- UI 命令：选择合法替代 Action/Target、撤销待提交修订、Commit；事件路线命令留待 Task 0218。
- 组件读取稳定 ID 和 value snapshot，不依赖 Resolver 内部对象或定义对象的可变引用。

## Runtime Flow

中心聊天流展示游乐园事件入口 → Controller 启动受控 Operation Run → Runtime Entry 返回只读 OperationView → 用户以一个干预槽修改计划 → Controller 调窄 Operation Entry 并取得新投影 → 用户 Commit → Resolver 生成 Resolution → 只刷新 Operation Surface 的主体区域 → 第二个 Beat 后显示样例局部判读并返回原聊天流。

## Acceptance

- [x] 宿主浏览器宽桌面截图中能同时看到地点目标/事件轨道、学生计划、敌方/环境 Intent、一次指挥余量、关键目标与 Commit 控件；实测截图 1412×811 px，中心列按 `.78fr / 2.22fr` 占约 74%。
- [x] 用户能识别每名学生的行动及原因、可修改范围、不可选原因和修订后的差异；未干预学生保持原计划。
- [x] 同一 Beat 有两项有成本的冲突干预；无干预、紧急停机和游客疏导由玩家选出不同局面与代价，不由随机单独决定。
- [x] 替换/移除专属 Profile 能力会改变一个有效方案或目标结果；学生卡/理由说明该能力的实际作用。
- [x] 角色随机技能只在有效 Commit 结算后显示其实际结果；运行时测试覆盖预览不掷骰及 seed 17 重复结果。
- [x] Commit 后每个行动/协同只结算一次，事件轨道、Actor 状态和日志与 Resolver 结果一致。
- [x] 未完成选择、非法目标、费用不足与终局状态清楚禁用 Commit 并解释原因。
- [x] 改选/scroll 不触发全 Workspace 重建；提交结果后焦点和滚动位置保持可预期，返回焦点落在聊天流试玩入口。
- [x] hover/scroll 不重建 Runtime 计划，不触发 Resolver；UI 测试核对单命令 View/region 数、节点 identity 与 refresh observation。
- [x] 浏览器试玩观测无干预 3→4→5（失败）、紧急停机 3→1→2（成功）、游客疏导 3→3→4（失败）；同 seed 重跑紧急停机仍得 3→1→2。

## Patch Units 与 Receipt

本 Task 拆成六个职责 Unit；每个 Unit 的 `Allowed Files` 与验证口径以对应文件为准。U1–U6 均已完成并记录 Unit Receipt；最终 Receipt 位于 `task-0216-gameplay-b-command-loop-vertical-slice-ui-units/receipts/`。

1. [[task-0216-gameplay-b-command-loop-vertical-slice-ui-units/0216-u01-operation-view-contract-and-owner-projection]] — `operationEntry.getView()` 安全只读投影。
2. [[task-0216-gameplay-b-command-loop-vertical-slice-ui-units/0216-u02-amusement-park-demo-content]] — 夏莱办公室专属的临时游乐园事件与固定 Seed 样例。
3. [[task-0216-gameplay-b-command-loop-vertical-slice-ui-units/0216-u03-operation-workspace-route-and-surface]] — 可恢复的独立 Operation route 与稳定 Surface identity。
4. [[task-0216-gameplay-b-command-loop-vertical-slice-ui-units/0216-u04-chat-centered-operation-workspace]] — 中心聊天式布局、目标侧栏、计划/Intent/Outcome 呈现。
5. [[task-0216-gameplay-b-command-loop-vertical-slice-ui-units/0216-u05-operation-entry-commands-and-local-refresh]] — 中心流入口、Controller Operation 命令和局部更新连续性。
6. [[task-0216-gameplay-b-command-loop-vertical-slice-ui-units/0216-u06-ux-documentation-and-galhcg]] — 浏览器验收、当前机制/模块/Wiki 说明、GALHCG 与最终 Receipt。

## Tests

- **Unit：**OperationView 投影、按钮可用性、命令回执和局部更新选择。
- **Runtime：**使用 Task 0215 固定输入检查视图与 Resolution 一致。
- **Integration：**Workspace→Controller→OperationRuntime→OperationView 完成完整操作。
- **UI：**浏览器交互走查；覆盖干预、取消、非法目标、Commit、日志连续性与减少动态设置。
- **Perf / DOM：**按 `docs/ai/frontend-design-project-overlay.md` 记录 DOM budget，使用 UI refresh diagnostics 核对一次命令的 View 构建数、刷新范围和无关节点 identity。

## Dependencies

- 依赖 Task 0213（EventRun）、Task 0214（学生 Profile/Actor）、Task 0215（准备/指挥/Resolution）。
- Task 0217 与 Task 0218 在此 UI 投影基础上扩展目标和路线。

## Documentation / GALHCG

- 稳定后更新 `docs/docs-829/02-modules/ui.md`、`docs/docs-829/03-data-structures/game-view.md` 所属边界说明或新增 Operation View 页面，以及 UI Wiki 路由。
- GALHCG 只记录 Operation UI/ReadModel 稳定职责；单个组件、DOM wrapper、局部渲染 helper 不建 Concept。
- Read Set：`docs/docs-829/02-modules/ui.md`、`docs/docs-829/03-data-structures/game-view.md`、`docs/docs-829/06-wiki/50-ui/controller-commands.md`、`read-model-context.md`、`refresh-update.md`、`docs/docs-829/05-conventions/architecture-discipline.md`、`docs/ai/frontend-design-project-overlay.md`。

## 收尾核验与后续边界

- 真实浏览器在可用宿主尺寸 1412×811 px 完成三条两 Beat 路线与同 seed 重复；未将该像素截图冒充成精确 1280×720 viewport。
- U1–U6 实现、Runtime/UI 定向测试、类型/架构/文档检查、GALHCG 映射与 freshness 结果见两层 receipts。
- OperationRun 仍是每 GameInstance 私有易失状态；Task 0217 接续正式 Objective/Outcome 与终止契约。Task 0215 是否归档仍由 Task Owner 单独确认。

## 相关路由

- [[draft-0212-gameplay-b-ac-native-design-roadmap]]
- [[task-0215-gameplay-b-prepared-actions-and-intervention-resolution]]
- [[docs/docs-829/05-conventions/testing]]
