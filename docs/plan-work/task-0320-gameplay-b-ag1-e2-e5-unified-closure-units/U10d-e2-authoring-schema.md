# Unit 0320-U10d：E2 Effect 作者 Schema 同步

## Goal

把 U10a/U09a 已冻结并通过源码 Registry 的 E2 Effect AST 与 MapRun Facts 字段同步到独立 Datapack Editor 使用的生成 Schema；更新 Schema 同步测试，证明递归循环、随机 TargetSet、资源余额与 MapRun Fact 读写节点均可见。只同步作者结构，不改语义或编辑器交互。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 入口 | `AGENTS.md` → datapack-schema context pack、`docs/ai/PROJECT-CONSTITUTION.md` | Datapack Schema 路由与 Patch Unit 纪律 |
| Schema 规范 | `docs/docs-829/05-conventions/schema-sync.md` | 生成顺序与不得手工改生成协议的边界 |
| 作者合同 | `src/data-services/contracts/gameplay-map-effects.ts`：Effect Value/Condition/Statement/Loop 类型；`src/data-services/contracts/gameplay-map.ts`：MapRun Facts 声明 | 新 Schema 的权威 TypeScript 输入 |
| 生成器 | `scripts/gen-engine-schema.mjs`：类型解析与 `--write` | 确认可表示递归闭合结构；仅检查，不改生成器 |
| 同步测试 | `tools/datapack-editor/schema/engine-schema.sync.test.ts`：Gameplay Map Effect 断言 | 更新陈旧的 AST Variant 清单并加关键字段证据 |
| 当前生成结果 | `tools/datapack-editor/schema/engine-defs.gen.json` | 对比新输出；只能由生成器写入 |
| 项目地图 | `graph_project(acprogram)` 与定向 schema 路径搜索 | 施工前核对项目身份和直接关系；不改图、不刷新 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k tokens；仅限作者 AST、Schema generator 与同步测试 |
| 文档 Read Set | 4 篇/节 |
| 历史文档 | 0 篇；U08/U09a/U10a 是当前合同 |
| 超预算处理 | 需要改 Schema generator、Editor runtime、作者契约或非白名单路径时停止并请求上游拆分 |

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| Schema generator 由 TypeScript 合同导出结构生成 JSON，约定通过 `npm run gen:schema` 更新 | `scripts/gen-engine-schema.mjs`；`docs/docs-829/05-conventions/schema-sync.md` | 禁止手改 generated file |
| 同步测试当前仍断言旧 Effect AST variant 与 Condition variant 列表 | `engine-schema.sync.test.ts`：Gameplay Map Effect 结构用例 | 必须随 U10a AST 增量更新 |
| E2 AST 增加随机 order/limit、resourceBalance/resourceAtLeast、MapRun Counter/Flag 读写和递归 forTargets/body | `gameplay-map-effects.ts`；U08/U10a | Schema 必须保留联合 tag、字段必需性和递归指向 |
| Schema 不承载 `order: random` 时 limit 的条件必需关系 | 严格 Syntax 校验器；U10a | Schema 保持作者类型的可选性；行为约束由 Registry Syntax 报错 |

## Constraints

- 生成 JSON 必须由 `npm run gen:schema` 产出；不得手改 `engine-defs.gen.json`。
- 同步测试覆盖新增 AST tag/字段与关键递归指向；保持旧 E1/E2 类型和 Task 0316–0319 作者合同不回退。
- 不把 Loop 专属 `loopTarget` 结构误扩成顶层通用输入；JSON Schema 应如实反映现有闭合联合和递归类型。
- `order: 'random'` 的语法依赖 `limit: 1..32`；Schema 仅展示字段与范围提示，不自行模拟条件必需性。
- Schema 同步通过不表示 Datapack Editor 的交互提示或 Planner/Runtime 已接线。

## Allowed Files

### 施工实现白名单（Agent）

- `tools/datapack-editor/schema/engine-defs.gen.json`（只通过 `npm run gen:schema` 更新）
- `tools/datapack-editor/schema/engine-schema.sync.test.ts`

### Task Owner 维护的施工记录

- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U10d-e2-authoring-schema.md`
- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U10d-receipt.md`
- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure.md`
- `docs/plan-work/00-index.md`

控制为两个实现文件及约 300–500 行净改动；Schema JSON 只经生成器改。实现代理不得改 Unit、Receipt、Task 或索引。

## Explicit Non-goals

- 不改 `src/data-services/contracts/`、Registry、Context、Syntax 或 Normalizer。
- 不改 `scripts/gen-engine-schema.mjs`、Editor UI/Schema merge、作者示例或生成输出之外的 Schema 文件。
- 不实现 Planner、RNG Owner/scheduler v3、MapRun Facts 运行、摘要显示、Save/Resume、additionalTarget 或资源写账户扩展。
- 不触碰 Task 0316–0319 已完成切片，不操作 GALHCG 图、不刷新或写 freshness。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件六项。若生成器无法表示新的递归闭合类型、需要修改生成器/Editor UI 或白名单外合同文件、生成结果要求人工加工，停止并交上游评估；不得手工修补生成 JSON。

## Completion Criteria

- [x] 生成 Schema 的 Action Effect AST 包含随机 TargetSet、资源余额读取、MapRun Counter/Flag 读写及 `forTargets.body` 递归结构。
- [x] 同步测试证明新增联合 tag、关键字段及递归引用，并继续排除已删除的旧 Action effects/hpEffects/cardEffects。
- [x] `npm run gen:schema`、Schema 同步定向测试、`npx tsc --noEmit`、`npm run check:docs` 与 `git --no-pager diff --check` 均通过并写入 Receipt。
- [x] 没有手工修改生成 JSON，也没有宣称 Editor UI 或 Runtime 已可执行新结构。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| Schema generation | `npm run gen:schema` | JSON 由当前合同生成，无生成器错误 |
| Schema sync | `npx vitest run --silent tools/datapack-editor/schema/engine-schema.sync.test.ts` | 新 AST 结构与作者 Schema 对齐 |
| 类型检查 | `npx tsc --noEmit` | 退出码 0 |
| 文档链接/结构 | `npm run check:docs` | 新 Unit/Receipt 路由无错误 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |
