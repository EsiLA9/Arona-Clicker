# G01：从 Strategy Park 可靠游玩一轮且旧旋转木马样例仍可玩

状态：completed — PB-01～PB-05 已按 Owner 默认规则实现，并通过定向自动化回归。

## 对最终目标的贡献

本阶段先把 Gameplay B 已有玩法中的阶段识别、显示文案、Cost 表现、状态名称和站位提示修到可信。玩家可以从夏莱办公室启动 Strategy Park，沿一条正常路线完成碰碰车区、烟花排练广场与中央舞台设备井三处战斗，理解场景行动、费用、事实和角色站位；已有旋转木马样例保留原来的战斗、现场行动、路线和结案玩法。

这是一轮可独立体验的 V1 修复结果。完成它不表示已经建立通用 Scene、统一不同牌源的计划流程或完成 Roadmap 的后续架构阶段。

## 完成定义

- [x] Strategy Park 三处战斗都显示可读计划、可替换行动与本回合提交；非战斗地点不显示错误的战斗入口。
- [x] Strategy Park 的开场、战斗阶段、路线/结案文字与事件相符；当前 Cost、风险/事实/持有物名称、前后排和可用行动提示均可读。
- [x] 西门入场后的 6 点余额与可视标记一致；余额与离场携带上限分开表达。
- [x] 旧旋转木马样例保留战斗、现场行动、转场与事件专属文案回归。

## 依赖与边界

- 前置 Goal：无。
- 本阶段任务：[[docs/plan-work/archive/task-0251-pb-01-runtime-combat-stage-projection]]、[[docs/plan-work/archive/task-0252-pb-02-event-correct-operation-copy]]、[[docs/plan-work/archive/task-0253-pb-03-cost-balance-slot-projection]]、[[docs/plan-work/archive/task-0254-pb-04-readable-operation-state-names]]、[[docs/plan-work/archive/task-0255-pb-05-actor-position-and-action-eligibility]]（均已完成）。
- 本阶段明确暂缓：新 Scene 身份/生命周期、ActionOffer / ScenePlan、统一目标选择和撤销、结算原子边界重构、多场景地点、M 选 N、小商店、Datapack Editor 新字段与清理旧兼容分支。
- `task-0250-galhcg-node-extraction-and-responsibility-aggregation` 是 PB-13 之后的参考，不是 PB-01～PB-05 的前置条件。

## 施工前未知项与结论

- PB-01 已关闭：现有字段不足以无歧义区分所有战斗与场景 Location，故新增必填 Location stage，并由 OperationView 投影；UI 不以 PreparedBeat 或 Location ID 推断。
- PB-03 已关闭：没有新增“场景 Cost 容量”；UI 表示当前余额，`maxCarryCost` 保留离场限制语义。
- PB-04 已关闭：Track / Fact / Item 标签存于 Event-local presentation map；本阶段没有新增全局字典或 Datapack 字段。

## 正式文档入口

- Draft：[[draft-0251-gameplay-b-atomic-scenes-phase-i-v1-corrections]]
- Task：[[docs/plan-work/archive/task-0251-pb-01-runtime-combat-stage-projection]]、[[docs/plan-work/archive/task-0252-pb-02-event-correct-operation-copy]]、[[docs/plan-work/archive/task-0253-pb-03-cost-balance-slot-projection]]、[[docs/plan-work/archive/task-0254-pb-04-readable-operation-state-names]]、[[docs/plan-work/archive/task-0255-pb-05-actor-position-and-action-eligibility]]

## 完成记录（2026-10-08）

- 定向 9 文件 Vitest 套件通过：133 项；`npx tsc --noEmit` 通过；Schema 由生成器同步。
- 已完成的 Task 已迁入 `docs/plan-work/archive/`。本次依据自动化回归结案，未单独记录浏览器手动游玩会话。
