# Task 0261 / PB-11：统一确认、返回与跳过操作

状态：completed — 常规单次确认及 Skip 语义保持完成（2026-10-08）。

> Owner 裁定以 draft-0256 为准：常规路径为编辑与实时预览后单次确认；不强制 stage / commit 两次确认。仅确有不可逆后果或复杂批次时使用现有暂存流程。

## 目标与边界

让 Operation 的编辑、即时预览和最终提交边界清楚，同时保持简单战斗一键提交。显式跳过空场景批次的行为继续与学生战术 Wait 区分。

## 实施结果

- 普通 Scene 流程保持“编辑草稿 → Runtime 实时 Preview → 一次点击提交”；确认按钮不会强制玩家先 stage 再二次 commit。
- 每次选择变化刷新纯 Runtime preview；提交前再验证一次，直接进行一个原子 commit。
- 显式 Skip 保持空 SceneAction batch 的 Runtime 语义；成功后按 Run 清理本地草稿，不生成 Action、费用或牌移动。战斗 Wait 仍是其已有计划语义。
- 只有既有显式 staged batch 的 Runtime 路径继续供特殊确认场景使用；没有把它设为常规操作门槛。

## 验收证据

- tests/ui/gameplay-b-operation-controller.test.ts 覆盖普通提交、跳过、草稿与确认路径。
- tests/engine/operation-scene-actions.test.ts 覆盖空批次 skip 和 SceneAction batch 原子结算。
- tests/engine/operation-runtime-service.test.ts 覆盖 Runtime commit / skip 规则。
- 2026-10-08 定向验证：六个 UI / Runtime 测试文件共 84 项通过；npx tsc --noEmit、npm run check:docs、git diff --check 通过。
- 未进行真实 Edge 的按钮焦点恢复与完整工作区交互人工检查。

## 后续边界

此 Task 不要求独立 Scene 确认页面。后续复杂、确有必要复核的批次可复用现有 stage / commit API。
