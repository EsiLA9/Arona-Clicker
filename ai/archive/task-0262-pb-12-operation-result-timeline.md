# Task 0262 / PB-12：统一操作结果时间流

状态：completed — 可证明的跨地点时间线、checkpoint 合同与自动化验收完成（2026-10-08）。

> Owner 裁定以 draft-0256 为准：先复用既有历史记录，顺序无法证明时才加最小序号。现有 Resolution、Route 与 Entry Cost 记录无法在回环和重访中可靠恢复统一全序，因此添加 EventRun 内序号；不做存档迁移。

## 目标与边界

以只读 OperationView 汇总原子 Resolution、路线转场和地点入场费用，显示可证明的旅程时间线。Resolution 作为原子结算块展示，不能声称内部 Effect 有未存储的微观播放顺序；历史仍有界。

## 实施结果

- 为 EventRun、OperationResolution、route transition 和 location entry cost 增加共同的 timelineSequence。Runtime 在每次成功的 Beat / SceneBatch Resolution、路线转场和入场费用记录时分配单调递增序号。
- EventRun checkpoint 校验序号范围、唯一性、记录顺序及最大计数；G02 最终收尾再补全历史数目约束：Route 数必须等于总 Location visits−1；存在 entry-cost rule 时 entry history 必须覆盖所有 Location visits，否则不许多余记录；Resolution 保留窗口长度必须精确对应 `min(resolutionSequence, 32)`，序号连续覆盖最近窗口；总 `timelineSequence` 必须等于累计 Resolution、Route、Entry Cost 记录数之和。缺失历史记录和编号孔洞均拒绝恢复且不安装 Run。未满足合同的 checkpoint 由现有 resumeVersion 规则拒绝。
- OperationView 投影序号；工作区将 Resolution、Route 与 Entry Cost 合并并按序展示，保留 Resolution 历史截断提示，不猜测缺序号记录的精确位置。
- 引入共同时间序号时，正式 Event `resumeVersion` 从 Carousel 1→2、Strategy Park 2→3；G03 随后因 `OperationResolution.sceneId` 又递增到当前 Carousel 3、Strategy Park 4。无迁移层，依项目清档策略处理不兼容旧 checkpoint；当前值以正式 Event 内容为准。
- 主要实现位于 src/arona-clicker/contracts/operation.ts、operation-resolution.ts、operation-view.ts、src/arona-clicker/services/operation-runtime-service.ts 与 src/ui/components/operation-workspace.ts。

## 验收证据

- tests/engine/operation-runtime-service.test.ts 覆盖 timelineSequence 单调性、路线回环、记录唯一性与历史截断边界。
- tests/engine/operation-scene-actions.test.ts 覆盖原子 Resolution 的时间线字段。
- tests/engine/gameplay-b-save-resume.test.ts 与 tests/engine/gameplay-b-authoring-workflow.test.ts 覆盖 checkpoint / 正式 Event resumeVersion。
- tests/ui/operation-workspace-view.test.ts 覆盖 Resolution、Route 与 Entry Cost 的统一排序展示。
- 2026-10-08 定向复核：G02 PB-12 / Controller 修订涉及的四个测试文件共 81 项通过；`npx tsc --noEmit` 与 `git diff --check` 通过。
- 新增损坏 checkpoint 覆盖：删除旧 Route / Entry / Resolution 记录及打出 Resolution 序号孔洞，均拒绝恢复且不安装 Run；有效含路线和入场费用的存档、33 次结算后的最近 32 条窗口仍能恢复。
- 未进行真实 Operation 工作区的展开折叠、键盘可达性、滚动和 Edge 视口人工检查。

## 后续边界

本 Task 完成 G02 操作结果的可读时间流；独立 Scene 身份、进度以及内容迁移属于 G03+。
