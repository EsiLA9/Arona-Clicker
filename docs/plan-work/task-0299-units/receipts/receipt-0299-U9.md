# Receipt 0299-U9

| 项 | 内容 |
| --- | --- |
| 状态 | 暂停：等待 Task 0291 U4 共享 Workspace / Runtime View 接口稳定 |
| 实际修改 | 新增 U9 Unit 与本 Receipt；未修改 Runtime View、Workspace、Controller、CSS 或 UI 测试。 |
| 未完成内容 | `noLegalTarget` 的 Workspace 投影、Skip 呈现、自动目标 UI 断言更新，以及 U8 正式样例的 UI 操作验收。 |
| 范围外变更 | 无。 |
| GALHCG 影响闭环 | 项目身份 acprogram 已核对；只读核验 Task 0291 状态与 U4 写集，没有编辑项目图或工作区共享 UI 文件。 |

## 停止原因

- `docs/plan-work/task-0291-gameplay-b-hp-enemy-ability-item.md` 当前仍标记 `approved / active`，并明确写明 U4 Workspace 施工中。
- Task 0291 U4 的写集包括 Query / Workspace View、Map Workspace、Controller、CSS 和定向 UI 测试；U9 必须修改 Runtime DTO / 投影和同一 Workspace / UI 测试，存在直接并行文件冲突。
- 用户要求仅在确有并行施工冲突时停止对应 Unit；本 Unit 命中该条件，因此保留 U9 领域接口说明，不抢写共享文件。

## 已有验证证据

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| UI 定向观察 | npx vitest run --silent tests/ui/gameplay-b-map-workspace.test.ts tests/ui/map-relation-interaction.test.ts tests/ui/map-relation-presentation.test.ts | 部分通过 | 关系交互 / 呈现 18 tests 通过；Workspace 21 tests 中 3 failed、18 passed。失败为完成按钮与 Commit 状态仍预期旧的手动目标门槛；当前自动目标合同使其自然可提交，需在 U9 与 U4 协调后更新。 |
| U8 正常 Map-only Runtime | tests/engine/gameplay-b-map-save-resume.test.ts 中自主战斗样例 | 通过 | 领域层已经完成首轮零干预 Commit、击败 A 后后手重选、次轮 Swap / 手动目标及 Save / Resume；UI 投影未验证完成。 |
| 文档 / 差异 | npm run check:docs；git diff --check | 通过 | 当前扫描 951 篇 Markdown；仅提示既有 CRLF 转换。 |

## 恢复条件

- Task 0291 U4 已完成并稳定其共享 DTO / Workspace / Controller 文件，或其负责人明确释放 U9 所需的重叠文件。
- 恢复时先只读复核文件差异与当前 Task 0291 Receipt，再按本 Unit Allowed Files 实施；不重复已完成的 P0–P4 或 U8 领域工作。
