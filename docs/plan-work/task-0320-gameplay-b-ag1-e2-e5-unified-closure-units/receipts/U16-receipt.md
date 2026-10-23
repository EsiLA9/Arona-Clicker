# Receipt 0320-U16

| 项 | 内容 |
| --- | --- |
| 状态 | complete; Stages A–D and E1–E3 implementation complete; final targeted and global validation passed |
| 实际修改 | A 完成闭合 `statusRemove` AST、作者语法与 Map-local Status 引用上下文；明确拒绝 `forTargets` 内的 `loopTarget`，仅允许 source/primary。B 由现有 Registry Context 校验闭环 Status 引用与目标可达性；Schema 生成后保持同步。C 在 detached Planner 内按 holder+Status ID 全清，记录删除实例、原列表位置与 no-op Trace，按语句顺序与既有稳定顺序执行。D 完成 AG-1 Status Receipt v2、Commit/Restore 重放与 RecentCommit 深冻结投影；E1/legacy Status Receipt v1 保持，scheduler 仍为 v5。E1 将正式示例转为 AG-1 `resumeVersion: 2`，并覆盖跨回合施加后清除及空匹配 no-op。E2 同步作者合同、样例与 Draft §7；E3 将 Action `agility` 作为合法元数据纳入 Effect Normalizer，避免 Workspace Relation 投影阻断 AG-1 地图移动。宽屏走查通过。
| 未完成内容 | 无（仅指 U16 精确 Status ID 清除首片）；U16 明确排除的 Shield、部分层数/类别清除、Revive、Modifier、Trigger、跨 Encounter Status 与独立 E1/legacy Validator 仍归 Task 0320 后续裁定。 |
| 范围外变更 | 部分层数消费、状态类别、Shield、Revive、Modifier、Trigger、跨 Encounter Status 与独立 E1/legacy Validator；依赖见 U16。 |
| 前置版本核对 | 已复核 U14 Receipt：scheduler v4、受影响测试 Map `resumeVersion` 5；U15 Receipt 与源码：scheduler v5、门控样例 Map `resumeVersion` 6。 |
| U16 版本裁定 | 保留 scheduler v5；AG-1 Status Receipt 提升为 v2（E1/legacy 继续使用 v1）；正式 Status 示例当前 `resumeVersion: 1`，U16-E1 将该示例切换为 AG-1 并升至2，不升级无关 Map。 |
| GALHCG 影响闭环 | 只读核对；未改图、未刷新或写 freshness。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 作者 AST/context | `npm exec vitest -- run tests/data/gameplay-b-effect-syntax.test.ts tests/data/gameplay-b-effect-normalization.test.ts` | 2 个文件、23/23 通过；`npx tsc --noEmit --pretty false` 与 A 白名单 `git diff --check` 通过 | 含 `loopTarget` 不可用于 `statusRemove` 的复核补强；Registry 待 B |
| Registry/Schema | `npm run gen:schema`；`npm exec vitest -- run tests/data/gameplay-b-effect-registry.test.ts tools/datapack-editor/schema/engine-schema.sync.test.ts`；B 白名单 `git diff --check` | Schema unchanged；2 个文件、36/36 通过；差异检查通过 | Registry Context 已覆盖 statusRemove，增加声明 ID、目标可达性、actorless source 边界用例 |
| Planner/Commit | `npm exec vitest -- run tests/engine/gameplay-b-effect-planner.test.ts tests/engine/gameplay-b-effect-program-commit.test.ts`；`npx tsc --noEmit --pretty false`；C 白名单 `git diff --check` | 2 个文件、42/42 通过；类型与差异检查通过 | 覆盖跨来源全清、空操作、Apply/Remove 顺序、Preview 无写入与失败无部分安装；B 测试 fixture 的 kind 类型已在 Task Owner 复核时收窄 |
| AG-1 Commit/Restore/Save/ReadModel | `npm exec vitest -- run tests/engine/gameplay-b-map-ag1-commit.test.ts tests/engine/gameplay-b-map-ag1-restore.test.ts tests/engine/gameplay-b-effect-save-resume.test.ts tests/ui/gameplay-b-effect-workspace.test.ts` | 4 个文件、87/87 通过；`npx tsc --noEmit --pretty false` 与 D1/D2 白名单差异检查通过 | 覆盖 AG-1 v2 重放与篡改拒绝、E1 v1 保存恢复、RecentCommit 深冻结投影 |
| 正式示例 | `npm exec vitest -- run tests/engine/gameplay-b-effect-example.test.ts tests/data/gameplay-b-map-registry.test.ts` | 2 个文件、181/181 通过；类型与 E1 白名单差异检查通过 | AG-1 `resumeVersion: 2`；实测 burn 清除与空匹配 no-op，Receipt v2 Trace 可观察 |
| 作者文档/AG-1 元数据投影 | Stage E2 文档核对；`npm exec vitest -- run tests/data/gameplay-b-effect-normalization.test.ts tests/engine/gameplay-b-map-relations.test.ts` | E2 三篇文档已同步；2 个文件、19/19 通过；E3 类型与白名单差异检查通过 | 修正 `agility` 被归一化误判；宽屏路线与 Encounter 移动随后通过 |
| 宽屏实机走查 | IAB `?devConsole=gameplay-b`，夏莱办公室 `startMap gameplay-b:map:status-example` | 通过 | 进入燃烧测试；施加后显示“燃烧 · 1层 · 剩余2轮”；下一轮清除后状态消失；空匹配再次提交，轮次继续且状态列表仍为空。无人工任务报告单待交付。 |
| 最终定向与全局核验 | 13 个定向文件：`npm exec vitest -- run --silent tests/data/gameplay-b-effect-syntax.test.ts tests/data/gameplay-b-effect-normalization.test.ts tests/data/gameplay-b-effect-registry.test.ts tools/datapack-editor/schema/engine-schema.sync.test.ts tests/engine/gameplay-b-effect-planner.test.ts tests/engine/gameplay-b-effect-program-commit.test.ts tests/engine/gameplay-b-map-ag1-commit.test.ts tests/engine/gameplay-b-map-ag1-restore.test.ts tests/engine/gameplay-b-effect-save-resume.test.ts tests/ui/gameplay-b-effect-workspace.test.ts tests/engine/gameplay-b-effect-example.test.ts tests/data/gameplay-b-map-registry.test.ts tests/engine/gameplay-b-map-relations.test.ts`；`npm run gen:schema`；类型、架构、文档与差异检查 | 13 文件、377/377 通过；`npx tsc --noEmit --pretty false`、`npm run check:architecture`、`npm run check:docs`（1256 Markdown，0 errors）、`git --no-pager diff --check` 均通过；Schema unchanged | 存档测试把正式 AG-1 示例派生为仅用于 E1/v1 兼容回归的 fixture，并保留一条 `apply-burn`；该文件定向复跑 7/7 通过。全局检查后又复跑该定向测试与类型检查，均通过 |

## 遇到问题

- Stage A 复核发现 `loopTarget` 在 `forTargets` 内可能绕过 `statusRemove` 目标限制，已收窄语法并增加回归断言。
- Stage B Registry 测试 fixture 曾将 Status `kind` 推宽为 `string`，Task Owner 已收窄其 GameplayMapDef 类型；全局类型检查通过。
- Stage D 发现 ReadModel 只读投影固定 v1，已将 D 拆为 Receipt/Restore 与 ReadModel 两片，并在 Unit 中更新白名单；没有修改 UI 玩法或扩大到 Live Owner。
- 宽屏走查首次尝试发现 `map-relation-projector` 对合法 AG-1 Action `agility` 报 unknown field，已补 E3 白名单、归一化与关系投影回归测试；修正后整段走查成功。

## 需上游确认项

- 无新增玩法待确认项；范围限于一个已解析单位上的精确 Status ID 全部实例，不含类别或部分层数。
- 若 U14/U15 最终 scheduler / resumeVersion 与本 Receipt 预期不同，应先由 Task Owner 更新 U16，不得在施工中自选版本号。

## 事实更新建议

- Task 0320、Draft 0312 §7、`docs/plan-work/00-index.md`、作者合同与 Status 示例已由 Task Owner 同步；后续 E4 能力继续按任务表逐项裁定，不能把 U16 扩写为 E4 整体完成。
- 仅记录精确 ID cleanse 已实现；其他 E4 能力继续按 U16 的依赖表延期或由后续 Task 承接。
