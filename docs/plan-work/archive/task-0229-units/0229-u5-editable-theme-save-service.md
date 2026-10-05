# Unit 0229-U5：编辑态一般主题读取、预览与保存服务

## Goal
为一般编辑态 Datapack 中的 ThemeDesign / ColorGroup 及实体持有的 ThemeDef 提供 source-aware 草稿、共享 Runtime Preview、冲突检测和保存回原 editing Pack 的产品服务/API。

## Must Read / Read Set
| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/ai/PROJECT-CONSTITUTION.md`、`docs/docs-829/05-conventions/architecture-discipline.md`、`docs/docs-829/03-data-structures/datapack-contracts.md` | 服务边界、读写 owner |
| 源码 | `src/arona-clicker/runtime.ts`：`packManager`、`persistPackManagerSnapshot()` | 产品组合与持久化 |
| 源码 | `src/data-services/datapack/pack-manager.ts`：`getPack()`、`savePack()`、`packEditingMode()`、`storedPackContentDigest()` | 编辑态检查和版本冲突 |
| 源码 | `src/arona-clicker/services/color-system.ts`：theme resolve / preview APIs | 复用统一预览合成 |
| 源码 | `src/data-services/contracts/datapack.ts` 与 world / enhancement / shop / variant 契约 | 定位直接 ThemeDef 和实体表现主题的编辑保存 owner |
| 测试 | `tests/data/pack-editing-state.test.ts`、新增产品服务测试 | 编辑态保护、服务读写 |

## Context Budget
约 15k–30k token；只读上述 Pack 写入路径与主题内容表。超过 3–5 文件或需要 UI 时停并拆分。

## Optional Read Set
- `src/ui/runtime-editor/actions.ts`：只借鉴 source/dirty 状态，不扩展该 UI。

## Do Not Read by Default
- 玩家存档与迁移路径
- 整个 Runtime Editor UI
- 独立 Datapack Editor UI 页面

## Confirmed Facts
| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| PackManager 暴露 getPack/savePack，savePack 可持久化同身份 StoredPack；Pack 编辑态由 packEditingMode 判定。 | `src/data-services/datapack/pack-manager.ts` | 产品服务应验证 editing mode。 |
| Runtime 已通过 `persistPackManagerSnapshot()` 保存 PackManager snapshot；Runtime Editor 已有 editing pack 写回方式。 | `src/arona-clicker/runtime.ts` | 新主题服务复用 snapshot persistence。 |
| Datapack 内多个表持有 ThemeDef；Init / Area / Spot / Enhancement / Variant 等实体的 EntityPresentation 默认项与附加项也可持有 ThemeDef。 | `src/data-services/contracts/datapack.ts` 与 `src/data-services/contracts/{world,enhancement,character-variant,entity-presentation}.ts` | 编辑目标需要用 owner 表、稳定实体 ID 与字段路径精确定位，不能只支持独立主题表。 |

## Constraints
- 仅能修改明确指定的 editing Pack；builtin/bundle/normal 均拒绝写入。
- 编辑 session 绑定 packRecordId、目标 kind/id 和开始时 content digest；保存时 digest 不匹配要返回冲突且不覆盖。
- ThemeDesign 兼容保存整个内容定义；`theme-def` 目标可通过 owner 表、实体 ID 与 `field` / `presentation-default` / `presentation-addition` 路径编辑单个 ThemeDef；ColorGroup 保存 `theme`/slots 等一般 ColorGroupDef 草稿，不改变实体 ID。
- Preview 调 U1 共享 theme resolver，以 `sourceId` 替换同一运行时来源；清除时撤掉 preview，不写状态。
- 保存成功更新 PackManager 和 snapshot；不自动启用/Apply Datapack，不影响运行时 Registry，直到既有 Apply 流程。
- 暴露稳定 service/API 给未来 UI；本 Unit 不实现 UI 或存档字段。

## Allowed Files
- `src/arona-clicker/services/theme-content-editor-service.ts`
- `src/arona-clicker/runtime.ts`
- `src/arona-clicker/contracts/runtime.ts`
- `src/arona-clicker/runtime-commands.ts`
- `tests/engine/theme-content-editor-service.test.ts`

## Explicit Non-goals
- 不改变 UserTheme 保存 owner。
- 不构建 UI，不生成或启用主题设计数据。
- 不保存回普通态/bundle；不写存档迁移或多设备合并。

## Stop Conditions
遵守 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件全部 6 条；若 Runtime API/contract 涉及额外写入面，则先停并拆新 Unit。

## Completion Criteria
- [x] 只读读取 editing Pack 中 ThemeDesign、ColorGroup、实体字段 ThemeDef 与 EntityPresentation 默认/附加项 ThemeDef 的可编辑对象和 source metadata。
- [x] 开始编辑后 Preview 可实时使用 U1 通用合成机制，按来源替换或置于顶层；保存/取消后清理。
- [x] 保存校验 editing owner 与 content digest，成功按 owner 路径写回原数据包；冲突/无权限/缺对象均不产生部分写入。
- [x] 定向服务测试、类型检查与架构检查通过。

## Verification
| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/theme-content-editor-service.test.ts tests/data/pack-editing-state.test.ts` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |
| 架构 | `npm run check:architecture` | 通过 |
