# Task 0258 / PB-08：统一目标选择与数量校验

状态：completed — 已按 Owner 默认规则实现并通过自动化验收（2026-10-08）。

> Owner 裁定以 draft-0256 为准：Individual 多候选目标显式单选；Global 与支持多目标的场景牌可显式多选；候选集合不是已选集合，空数组不代表全体。

## 目标与边界

使 UI 命令只记录玩家实际选择的目标。多候选 Individual 行动必须明确选择一个目标；支持多目标的场景行动只结算明确勾选的集合。空目标、非法目标或失效目标不能静默扩大为全体候选。

## 实施结果

- 修复 UI SceneAction 命令构造：Individual SceneAction 只有一个合法候选时可以明确默认该唯一目标；有多个合法候选但没有选择时给出可读错误，不再把 legalTargets 全部写入 targetActorIds。
- Runtime 的目标与费用校验仍通过纯 preview / 原子 commit planner；失败不产生部分费用、效果或弃牌。
- 实现位于 src/ui/controller-actions-operation.ts；Runtime 合同与回归位于 src/arona-clicker/services/operation-runtime-service.ts 和对应测试。

## 验收证据

- tests/engine/operation-scene-actions.test.ts 覆盖 Individual 空目标拒绝、显式单目标预览不写 Run，以及非法批次原子拒绝。
- tests/ui/gameplay-b-operation-controller.test.ts 覆盖 UI 命令构造对多候选 Individual 目标的拒绝。
- tests/ui/operation-workspace-view.test.ts 覆盖目标选择后的只读展示；Global 显式多目标仍沿用现有 Runtime 计划。
- 2026-10-08 定向验证：六个 UI / Runtime 测试文件共 84 项通过；npx tsc --noEmit、npm run check:docs、git diff --check 通过。

## 后续边界

位置筛选、群体筛选及新的目标 Filter 合同属于 PB-23 等后续阶段，不在本 Task 中。
