# Unit 0288-U3：从 Registry 解析 Map 并提供最小样例

## Goal
将已登记的 Map 解析为 Runtime 所需内容，并在现有正常启用的 Gameplay B TypeScript Datapack 中加入 A→B→C、B 上的最简 Encounter，以及引用 Map ID 的普通 Spot `mapEntry`。

## Must Read / Read Set
| 类型 | 路径 / 符号 | 原因 |
|---|---|---|
| 文档 | `docs/plan-work/archive/task-0288-gameplay-b-map-node-vertical-slice.md` | 端到端验收边界 |
| 文档 | `docs/docs-829/04-mechanisms/data-services/pack-loading.md` | 正常包加载链 |
| 源码 | `src/arona-clicker/services/registry-operation-content-resolver.ts` | 现有 Registry Resolver 适配模式 |
| 源码 | `src/arona-clicker/content/operation-samples/gameplay-b-datapack.ts` | 正常启用的 gameplay-b bundle 与 Spot 内容 |
| 测试 | `tests/ui/gameplay-b-operation-entry-registry.test.ts` | 已启用包到正常入口的测试模式 |

## Context Budget
- 目标 8k–20k tokens；历史文档 0 篇。

## Confirmed Facts
| 事实 | 依据 |
|---|---|
| 正式 Operation 内容 Resolver 读取 Registry，不私自加载文件。 | `registry-operation-content-resolver.ts` |
| Gameplay B 样例由有类型的 Datapack 对象构成。 | `gameplay-b-datapack.ts` |

## Constraints
- Map 由 Registry 中已校验的定义解析；缺失时明确失败，不回退旧 Operation Event。
- Map 与 `mapEntry` Spot 增加在已正常加载的 gameplay-b bundle；不得另建 demo-only loader 或改包启用默认值来隐藏加载问题。
- 样例为正式 Datapack 内容；Map Entry Spot 与 Map 在同一包内正常声明，不得在 UI 或测试中硬编码样例 Map ID 作为内容来源。
- C1a Encounter 只用声明的 `completion: { kind: "manual", label }` 提供一个合法完成动作；不增加通用战斗或效果系统。

## Allowed Files
- New file: src/arona-clicker/contracts/map-content-resolver.ts
- New file: src/arona-clicker/services/registry-map-content-resolver.ts
- src/arona-clicker/content/operation-samples/gameplay-b-datapack.ts
- New file: tests/engine/gameplay-b-map-resolver.test.ts

## Explicit Non-goals
- MapRun / Save、Spot UI、Workspace UI、旧样例删除、Schema Editor。

## Stop Conditions
1. 需要新增未列文件或修改正常包注册清单之外的文件。
2. Resolver 必须暗中依赖 Operation Resolver / Event / Location。
3. 需要读取 Read Set 外超过 2 个文件，或预计超过 5 个文件 / 500 行。
4. 现有 gameplay-b bundle 无法从正常默认包加载路径进入 Registry；停止并报告包加载边界。
5. 定向测试或类型检查失败且不能解释。

## Completion Criteria
- [ ] Resolver 从 Registry 按 Map ID 返回已校验定义，并对未知 ID 返回可判定的失败。
- [ ] 已正常启用的 gameplay-b Datapack 含 Map A / B / C、A→B / B→C、声明手动完成动作的 B Encounter 与 mapEntry Spot。
- [ ] 样例测试验证 Resolver 读到包内真实定义；Map Entry 引用值来自该包的 Spot 内容。

## Verification
| 项 | 命令 | 期望 |
|---|---|---|
| 定向测试 | `npx vitest run tests/engine/gameplay-b-map-resolver.test.ts` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |
