# Unit task-0161-U03：用户图层继承与显式空覆盖

## Goal

把用户图层“继承有效回退”与“本地覆盖”分开表达，允许 global 覆盖持久为空并只保留系统颜色层。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/docs-828/05-conventions/architecture-discipline.md`、`testing.md` | UI / Service 边界与测试标准 |
| Task | `docs/plan-work/task-0161-theme-background-layer-lifecycle-pipeline.md` | 用户发现、业务边界、验收 |
| 源码 | `src/arona-clicker/services/user-theme-layer-service.ts`：`hasLocalTarget`、`materializeTargetLayers`、`clearTargetOverride` | 理解缺省与显式空数组的存储能力 |
| 源码 | `src/ui/controller-modals.ts`：resolved layers、删除/恢复继承 | UI 写入/Preview 行为 |
| 源码 | `src/ui/components/user-theme-layer-manager.ts`：列表与状态标签 | 将继承、空覆盖呈现给用户 |
| 测试 | `tests/engine/user-theme-layer-service.test.ts`、`tests/ui/user-theme-layer-editor-dialog.test.ts` | 验证状态留存与交互 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 12k–28k tokens |
| 文档 Read Set | 3 篇 |
| 历史文档 | 0 |
| 超预算处理 | 拆分或回到 Task owner 重新收敛 Read Set |

## Optional Read Set

- `src/arona-clicker/services/color-system.ts`：Preview 语义仅在 Runtime Unit 不足时补读。

## Do Not Read by Default

- `docs/plan-work/archive/**`；没有需要恢复的历史产品策略。
- `src/ui/css/**`；本 Unit 使用现有视觉结构。

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| `hasLocalTarget` 以 host/state 的字段是否存在区分继承；空 `layers: []` 已能表达本地覆盖。 | `user-theme-layer-service.ts` | 不需要新增 Datapack Schema 或存档字段。 |
| 删除最后一个图层时 Controller 随即调用 `clearTargetOverride`，因此空数组会被清掉。 | `controller-modals.ts` 删除事件 | 直接导致默认层重现。 |
| Preview 的背景源只按 ID 合并，旧 user 图层不因空列表消失。 | `color-system.ts:setUserThemePreview`、`theme-runtime.ts:resolve` | 依 U01 新增来源替换标记。 |

## Constraints

- 缺省 = 继承；显式空数组 = 本地空 global 覆盖；“恢复继承”必须是独立显式动作。
- 系统颜色层不可删除，其 ignore 开关不改变主题 token 或图层状态。
- UI 保持只读查询 + Controller 编排；持久保存经现有 UserThemeService / StateMutationService。

## Allowed Files

- `src/ui/controller-modals.ts`
- `src/ui/components/user-theme-layer-manager.ts`
- `tests/engine/user-theme-layer-service.test.ts`
- `tests/ui/user-theme-layer-editor-dialog.test.ts`

## Explicit Non-goals

- 不重做编辑器信息架构或颜色配置。
- 不改变非 global Host 的父级 / 状态 fallback 规则。

## Stop Conditions

按 `docs/ai/PROJECT-CONSTITUTION.md` §停止条件六项执行；若空覆盖要求变更存档 Schema，停止并要求 Task owner 裁定。

## Completion Criteria

- [x] 删除最后用户图层仍保存 `layers: []`。
- [x] Manager 将本地空 global 覆盖与继承回退清晰区分。
- [x] Preview 移除原应用 user 层但保留 scene 来源；保存/重开仍为空。
- [x] 只有“恢复继承”才清本地配置。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/user-theme-layer-service.test.ts tests/ui/user-theme-layer-editor-dialog.test.ts --silent` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |

## Pre-flight

- Goal：保留继承与空覆盖的差异。
- Allowed Files：以上四个文件。
- Explicit Non-goals：不重做 Editor IA，不改 Host 回退规则。
- Stop Conditions：遵守本 Unit 六项停止条件。

