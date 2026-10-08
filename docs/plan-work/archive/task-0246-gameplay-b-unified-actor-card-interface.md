# Task 0246：Gameplay B 统一角色持牌与行动卡交互

状态：completed — U0–U3 完成；角色持牌统一投影/交互、定向验证、机制文档和 GALHCG 闭环已完成。

## 目标

让 Operation 中“角色当前持有/负责的牌”共享一个角色手牌投影和交互入口，呈现在对应角色卡区域，并统一角色分配、目标预览、拖放与键盘替代路径。玩家能直观看出哪张牌属于谁，也不再因牌源不同而使用互不相干的操作方式。

这里的“角色手牌”指本场交互中挂靠在角色名下的可执行牌集合，语义接近 Gameplay B Demo 的 `OperationCharacterHandSnapshot`，即有限的本轮候选牌面；不另造每角色独立的 draw/hand/discard 物理牌堆。战斗 CharacterHand、地点 SceneAction、有限玩家 SceneCard 继续由现有 Runtime 来源、费用、锁定及提交事务管理；统一它们的角色归属面和 performer/target 输入。

## 调查结论与依据

| 当前牌源 | 当前事实 | 本 Task 决策 |
| --- | --- | --- |
| 战斗行动 | `OperationCharacterHandSnapshot` 是由场景、位置、CardPool 与 Strategy 解析出的临时候选；战术牌按当前计划/替代行动投影至角色锚点。 | 保持现有候选抽取及计划归属；纳入统一 Actor Card projection/交互。 |
| Global / Individual SceneAction | Location 命令，通过 SceneAction batch draft 选择、校验、扣费和结算；Global 当前支持拖到角色分配执行者。 | 选中角色后以其角色牌槽作为统一呈现；执行者与效果目标保持独立。Individual 每名角色各自的选择仍逐角色暂存。 |
| Player SceneCard | 有限共享 draw/hand/discard 牌堆，以 `cardInstanceId` 标识实体；目前在中央手牌扇区用按钮选择执行者/目标。 | 共享牌区继续作为来源/抽牌信息；要求角色执行的牌选定执行者后投影到该角色牌槽。 |
| actorless 卡 | 免执行者牌没有角色 owner。 | 留在场景/公共手牌区域，不伪造角色归属。 |

源代码核验：`operation-card-candidate-resolver.ts`、`operation-view-projector.ts`、`operation-workspace.ts`、`controller-actions-operation.ts`；测试覆盖 Gameplay B 角色 Hand、PlayerSceneDeck、SceneAction batch 与 Operation UI。Gameplay B 的角色 Hand 并非物理 draw/discard zones；不能把三种牌源合并为一种 Runtime 实体，否则会混淆 SceneAction 批次和 player card instance 生命周期。

## 范围

- 建立统一的角色持牌 View 投影/接口，至少明确 `card identity / kind / source / ownerActorId / selection state / performer eligibility / target set / lock state`；由现有 OperationView 与 draft 派生，保持 UI 只读。
- 战斗行动牌、已选的角色执行 SceneAction、分配到角色的 PlayerSceneCard 在同一角色持牌区使用一致牌面与 owner 锚点。
- 用同一套交互意图区分“指定执行角色”与“选择效果目标”；支持拖放和等价的键盘/点击入口。允许合法牌在角色间改派；目标 Hover/focus 可显示已有合法目标关系线，拖拽命中反馈与现有卡牌保持一致。
- 已归属牌拖到另一名合格角色时优先改派；若该角色 ID 同时也是当前合法效果目标，可按住 Alt 拖放来选择目标。目标按钮仍提供不依赖拖动的目标选择。
- 角色牌区展现牌源、所需费用/目标以及 fixed/required 锁定状态；fixed 项不可取消须由交互与提交校验共同保证。
- 角色执行牌仍能引用/拖到目标角色；无目标牌按现有合法性直接生效。
- 保留中央玩家手牌的抽牌堆/弃牌堆提示与 actorless 卡操作。

## 明确非目标

- 不把 CharacterHand、SceneAction、PlayerSceneCard 合并为同一个引擎 Action/实体或新的 draw/discard 规则。
- 不改变 Global exactly-one、Individual 每名存活角色一项、fixed 默认加入不可撤销、required 可选、Cost 汇总扣除和牌实例进入弃牌堆等现有批次语义。
- 不改 Datapack Schema、独立编辑器、卡池权重/发牌算法、效果结算或保存格式；不实现自动化 AI。
- 不要求浏览器验收；以 DOM/UI 行为、Runtime 回归测试和类型检查验证。

## 施工单元

### U0 — 事实调查（完成）

- 核对 Demo CharacterHand 与 AC Operation 战斗手牌、SceneAction 和 PlayerSceneCard 数据来源及生命周期。
- 核对角色牌呈现、Scene performer、目标 Hover/拖放及固定卡交互差异。
- 本 Task 按“统一角色归属面和操作入口、保留事务差异”裁定；若实现中发现必须改变批次规则才能统一，则停在局部并把选项、影响写入本 Task 的“文本-潜在解决方案”，不得自行改变规则。

### U1 — 统一 Actor Card 投影与可访问交互（完成）

- 从只读 View + 当前 draft 导出角色牌集合；UI 不读取 Runtime 内部对象、不持有写引用。
- 让 SceneAction / PlayerSceneCard 的 selected-student performer assignment 与战斗角色行动在角色卡牌槽中共存且可识别来源。
- 统一 owner/target 拖放和 Hover/focus 目标反馈；为不能拖拽的键盘/点击提供等价的分配与撤销路径。
- 消除多个 UI 分支互相覆盖同一张卡、重复呈现或错误将 performer 当 target 的情况。

### U2 — 命令边界与回归（完成）

- 领域命令仍分别提交 battle intervention、scene action batch、player card selection；统一交互 adapter 按 card kind 路由并校验 run/version/owner/合法目标。
- 更新定向 Engine/UI 测试，覆盖改派、同角色显示、目标 hover/focus 与 drag、actorless 卡、fixed/required 锁定、费用和弃牌不回归。
- 检查普通 pointer/hover/focus 不调用全量 render；运行相关 Vitest、`npx tsc --noEmit` 与 `git diff --check`。

### U3 — 机制文档与 GALHCG（完成）

- 当前机制文档只记录最终稳定的角色牌投影与交互边界，不把提案写成既有引擎规则。
- 对直接改动文件执行 GALHCG review、刷新其 Evidence token 并核验相关 maps_to；结果写入本 Task。

## 验收

- [x] 每张已分配角色的可执行牌都锚定并显示在同一角色持牌区域；不出现角色归属只存在于中央小按钮、牌却留在公共扇区的双重交互。
- [x] 角色 Hand、SceneAction 与 PlayerSceneCard 的来源和语义仍可辨认，三个 Runtime 提交路径及实例生命周期不变。
- [x] performer 与 target 明确分离；改派、合法目标 Hover/focus 连线、拖放和键盘路径一致。
- [x] actorless 卡留在公共区域；fixed 项不可撤销，required 项按原规则选取。
- [x] 测试证明批次模式、费用、结算、弃牌及 Run/version 校验未回归；定向测试、类型检查、差异空白检查通过。
- [x] 受影响的当前机制文档和 GALHCG 映射已维护，工具受限项如实记录。

已完成验收证据：`npx tsc --noEmit` 通过；`tests/ui/operation-workspace-view.test.ts`、`tests/ui/gameplay-b-operation-controller.test.ts` 与 `tests/ui/gameplay-b-card-inspector.test.ts` 共 29 项通过，覆盖角色牌槽、PlayerSceneCard 拖入/改派、键盘选择框改派、目标 Hover 关系线和 Scene batch 流程。card-inspector 用例将过时的“stage 后二次 commit”步骤更新为当前一次确认提交，并完整走通隔离试玩到路线切换。`npm run check:docs` 通过。未使用浏览器；没有修改 Engine、Datapack Schema 或存档。

## 文本-潜在解决方案

- **角色手牌是否应真的拥有物理 zones**：本轮解释为“统一的角色持牌呈现/归属接口”，不是把有限玩家牌堆改造成每角色独立 draw/discard。前者符合现有牌源与提交事务；后者需新增抽牌来源、每角色副本、补牌时机、弃牌/重抽规则以及存档字段，属于玩法规则变更，留待单独裁定。
- **中央共享 PlayerSceneCard 如何兼容角色槽**：保留中央扇区作为共享来源和 deck 状态；选中角色后把牌面挂靠到 actor slot，清除分配时返回共享扇区。fixed/required 的可撤销约束不由视觉归属改变。
- **角色与目标 ID 重合时的拖放意图**：拖到另一名合格 performer 默认改派；若该 ID 同时是当前合法目标，按住 Alt 拖放可选择目标。目标按钮仍可不经拖动直接选择。

## GALHCG 记录

- 项目绑定：`acprogram`，`workspace_path` / `root_path` 均匹配工作区。
- 查询词：`operation character hand scene action player scene card`；组合未命中地图候选，随后以已有概念与精确路径复核，不新增泛化节点。
- 映射复用：Workspace renderer 与 CSS → `concept:ui-workspace-renderer`；操作控制器与 UI 回归 → `concept:ui-command-to-runtime`；OperationView 机制页 → `concept:operation-event-run-runtime`；Task 与 plan-work 索引 → 既有 `concept:goal-workflow` / `module:planning-records`。
- 三个 UI 实现文件、当前机制文档、Task、索引及三份 UI 测试共九个直接变更路径的 Evidence/maps_to 均已按预览 token 更新并写后复核：`unchanged`、stale Evidence 0、映射保留。更新均先 dry-run 通过再提交。
- 完成后将 Task 归档至 `docs/plan-work/archive/`：`plan_path_migration` 为只读盘点；新 File 节点复用 `concept:goal-workflow` maps_to，先以 dry-run 校验新增关系、提交新关系，再对旧 maps_to 做单独 `update_map(dry_run=true)` / 提交，并精确刷新 `docs/plan-work` 清除旧清单项。最终归档文件与 `00-index.md` 均 `unchanged`、stale Evidence 0；旧路径 `unreferenced_path` 是预期结果。未新增概念。
- 不确定或无源码依据的跨模块关系未建图；GALHCG 工具本轮可用。

## 相关资料

- [[task-0240-gameplay-b-operation-card-presentation-and-action-targeting]]
- [[archive/task-0245-gameplay-b-operation-scene-card-performer-target-cost-model]]
- [[docs/docs-829/03-data-structures/operation-view]]
- [[docs/docs-829/04-mechanisms/arona-clicker/operation-runtime]]
- [[docs/ai/context-packs/ui-presentation]]
