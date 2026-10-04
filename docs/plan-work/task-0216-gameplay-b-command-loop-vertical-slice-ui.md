# Task 0216 — 玩法 B 核心可玩切片与只读 UI

状态：proposed — 等待 Task 0213–0215 完成

## 目标

用一个最小现场地点和 AC 游戏 UI 验证核心决策链：学生自主计划 → Sensei 有限修订 → 单次 Commit → 统一 Resolution → 可观察的现场状态变化。

## Why

行为测试能验证规则，但不能证明玩家在 Commit 前确实能看懂行动、意图、指挥范围和后果。先做单地点切片，可及早检查这套玩法是否产生真实决策。

## Scope

- 建立一个新 Operation Workspace 或等价的独立 UI Surface，不大改 AC 主 Workspace 导航。
- 用只读 `OperationView` 投影事件/地点状态、Actor、Action、Intent、目标、费用、可改理由、组合预测与 Resolution。
- Controller 命令只更改一次 InterventionDraft，或发出 Commit；UI 不直接写 EventRun。
- 采用中性内容：三名行为 Profile 不同的学生、两名对手、一个环境参与者/状态目标、最多两个 Beat。
- 至少一个学生 Profile 拥有影响关键目标可行解法的专属能力。
- 同一 Beat 至少有两项合理但互相冲突的可干预计划；不干预、改动计划 A、改动计划 B 导向可解释的不同状态或代价。
- 确保至少一次合法干预、一次标签协同、一次事件轨道变化以及可观察的成功/失败两种局部结果。
- 通过局部更新呈现准备变化和结算结果，保持焦点、滚动、目标选择与日志阅读连续性。
- 开始 UI 施工前声明 DOM budget、稳定节点、behavior/region/structure 刷新范围、full render 条件，以及 focus/scroll/hover 连续性方案。
- 使用按内容职责单独组织的 TypeScript 临时事件定义模块；该纵切只在当前 `activeInit === 'base:init:schale_office'` 时提供入口，借用夏莱办公室作为体验挂载世界线，不把 EventRun 状态写进该 Init 的 PlayerState/Snapshot。具体目录由实施时依据实际内容边界确定。
- 在同一纵切验证角色随机技能只于 Commit 后结算；不加入非战斗 SceneAction/PlayerCost/场景卡，后者由 Task 0224/0225 承接。

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

- `OperationView`：当前 Event/Location、事件轨道、学生/敌方/环境 Actor、PreparedBeat、InterventionDraft、组合预览、Commit 可用性、终局/Resolution。
- UI 命令：选择合法替代 Action/Target、撤销待提交修订、Commit；事件路线命令留待 Task 0218。
- 组件读取稳定 ID 和 value snapshot，不依赖 Resolver 内部对象或定义对象的可变引用。

## Runtime Flow

Workspace 请求当前 OperationView → 展示 PreparedBeat 与 Intent → 用户发命令更新草稿 → Controller 调 Runtime 返回新投影 → 用户 Commit → Resolver 生成 Resolution → dispatcher 局部更新状态/日志。

## Acceptance

- [ ] 1280×720 桌面布局能同时让玩家看到地点目标/事件轨道、学生计划、敌方/环境 Intent、一次指挥余量、关键目标与 Commit 控件。
- [ ] 用户能识别每名学生的行动及原因、可修改范围、不可选原因和修订后的差异；未干预学生保持原计划。
- [ ] 同一 Beat 同时显示至少两项有代价冲突的合理干预机会；不干预和两种不同干预都能经玩家选择稳定到达不同结果，不由随机单独决定。
- [ ] 替换/移除专属 Profile 能力会改变一个有效方案或目标结果；学生卡/理由说明该能力的实际作用。
- [ ] 角色随机技能只在有效 Commit 结算后显示其实际结果；改选、hover 与预览不先掷骰，重复固定 Seed 可复现。
- [ ] Commit 后每个行动/协同只结算一次，事件轨道、Actor 状态和日志与 Resolver 结果一致。
- [ ] 未完成选择、非法目标、费用不足与终局状态清楚禁用 Commit 并解释原因。
- [ ] 改选/hover/scroll 不触发全 Workspace 重建；提交结果后焦点和滚动位置保持可预期。
- [ ] hover/scroll 不重建 Runtime 计划，不触发 Resolver；一次用户命令只生成所需 OperationView 并请求一个合并区域更新。
- [ ] 人工能在同一切片通过不同合法决定观察成功和失败两种结果，重复固定 Seed 可复现。

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

## 当前核验与剩余工作

当前只读取 AC View、Controller 和局部更新约定；未实现、未运行浏览器验收。视觉样式由施工时现有主题和内容确定，本 Task 冻结信息和行为要求。

## 相关路由

- [[draft-0212-gameplay-b-ac-native-design-roadmap]]
- [[task-0215-gameplay-b-prepared-actions-and-intervention-resolution]]
- [[docs/docs-829/05-conventions/testing]]
