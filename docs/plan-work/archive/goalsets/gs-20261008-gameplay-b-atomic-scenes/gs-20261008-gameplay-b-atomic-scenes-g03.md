# G03：可独立完成的原子场景骨架

状态：completed（2026-10-08）。PB-13～18 已实现；实现和验证 evidence 记于归档 Draft / Tasks 与当前机制文档。

## 对最终目标的贡献

在 Operation 工作区中运行一个由内容声明的微型 Scene：它有可辨认的身份和生命周期，能够展示可选行为、编辑计划、读取纯预览、提交一次原子结算并标记自身完成。完成 Scene 后玩家仍处在 Location 的流程中；地图、路线、EventRun 存档和全局奖励继续由各自现有 Operation / AC 边界管理。

此阶段是原语切片，不代表所有 Strategy Park 内容都已迁移，也不预先确定 Scene 类型或状态归属。Scene 自身不成为地图、存档或全局奖励系统的 owner。

## 完成定义

- [x] 正式 `gameplay-b@1.0.0` 内容包含两名 Registry Profile 派生学生、一个环境参与者、一项 selected-student SceneAction 和一张 actorless 0-cost SceneCard；入口按钮传递相同的两名 `characterIds`，不自动补发。
- [x] 玩家可见 Scene 身份 / 状态、选择并预览行动；pure preview 不写 Run；UI Controller 点击测试实际启动、选择、提交并核对结果。
- [x] 版本保护的提交复用现有独立 atomic paths；失败不部分写入。Scene empty skip 不推进完成，Scene-stage 直接 `commitBeat` 会拒绝且 Run / 通知不变。
- [x] Scene completion 记录在 EventRun 当前 Location progress 中；完成后仍留原 Location，Location / Route / Event / reward 由原流程决定。
- [x] Scene 内容内嵌 Location、有序 local ID、EventRun owner 与 checkpoint 持久化已按 Owner ruling 裁定并实现；无 Scene owner、sceneInstanceId、SaveData 顶层字段或旧档迁移。

## 依赖与边界

- 前置 Goal：G02 操作语义统一；G01 只提供修复后的现有 Operation 验收基线，不阻止本阶段的事实核对。
- 继承：已完成 PB-0245～0248 已建立 SceneAction / PlayerSceneCard 的 performer、target、cost、卡片投影、可跳过批次和拖放语义；本阶段复用这些能力，不重做卡牌或另造效果语言。
- 参考而不阻塞：Task 0250 已按本轮要求冻结归档；冻结时记录为已交 Luna 子代理施工、主代理复核未完成。只把可由当前源码重核的部分当作导航，不假定映射提取已完成，也不作为本阶段 Runtime 的代码前置。
- 本阶段明确暂缓：全 Strategy Park 迁移、多 Location / 多 Scene 顺序与地图编辑器、M/N 选择、商店、通用 Narrative 系统、独立存档系统、历史存档迁移及移除旧内容特判。

## 已裁定并实现的设计点

- `OperationLocationDef.scenes[]` 是嵌入 Location 的有序数组，Scene ID 在 Location 内稳定；没有数组时投影隐式 `main`。
- EventRun `locationProgress` 保存 completed Scene IDs、Scene batch progress；状态从内容 / progress 派生并随当前 checkpoint / 同 Run 的 Location revisit 保留。
- `OperationViewActionOffer` / `OperationScenePlan` 是只读/轻量值；UI-local SceneDraft 和 persisted staged batch 分开。`commitBeat` 与 `commitSceneActionBatch` 继续使用不同命令。
- Scene completion 和 Location/Route/EVENT outcome 分开；Scene completed 不自行转场。

## 正式文档入口

- Draft：[[docs/plan-work/archive/draft-0253-gameplay-b-atomic-scenes-phase-iii-foundation]]
- Task：[[docs/plan-work/archive/task-0263-pb-13-scene-identity-lifecycle]]、[[docs/plan-work/archive/task-0264-pb-14-scene-content-presentation]]、[[docs/plan-work/archive/task-0265-pb-15-action-offer-projection]]、[[docs/plan-work/archive/task-0266-pb-16-scene-plan-preview]]、[[docs/plan-work/archive/task-0267-pb-17-scene-atomic-resolution]]、[[docs/plan-work/archive/task-0268-pb-18-scene-completion-location-exit]]
