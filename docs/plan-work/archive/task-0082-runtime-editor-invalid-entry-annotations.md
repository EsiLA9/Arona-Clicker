# Task：Runtime Editor Spot 非法条目与 Switch 注记

状态：done — ✅ 已完成（2026-09-16）

前置任务：[[task-0081-spot-payment-default-removal]]
关联事实文档：[[docs/docs-828/02-modules/runtime-editor]]

## 目标

为 Runtime Editor 的 Spot 草稿提供“问题属于哪一个条目、条目位于哪个 Switch”的轻量注记显示。

当一个 Spot 中的某个价格组、价格系列、功能项、升级项或其他集合条目不合法时，用户应能在不展开追踪链、不离开当前编辑上下文的情况下看到：

- 出问题的集合条目；
- 该条目所在的 Switch / 编辑页；
- 简短的问题摘要。

本 Task 不负责自动追踪调用链、跨页面诊断、运行时错误回溯或复杂错误定位器。

## 本轮边界

本 Task 已实现注记显示，并保留以下运行时编辑行为修正：

- Spot 保存 / Apply 失败时继续留在 Spot 编辑弹窗；
- 不因 Spot 校验失败跳回调试数据包页；
- 不因失败清除父级 Runtime Editor 草稿、当前 Spot、Switch 页或子弹窗上下文。

已实现的注记范围：

- 字段诊断按 Policy section 标记所属 Switch；
- 集合诊断按 `field[index]` 路径标记具体集合条目；
- 条目显示错误边框与首条错误摘要，多条错误显示额外数量；
- 无法定位的诊断仍保留在通用 Diagnostics 区，不进行字符串猜测跳转。

## 当前事实与问题

| 现状 | 代码落点 | 后续问题 |
| --- | --- | --- |
| Runtime Editor 以 `RuntimeEditorProblem[]` 保存诊断 | `src/ui/runtime-editor/state.ts` | 诊断主要只有 `code`、`path`、`message`，缺少集合条目标识与 Switch 归属 |
| Spot 表单按 Policy sections 渲染 | `src/ui/runtime-editor/sections.ts`、`src/ui/runtime-editor/view.ts` | Switch 可知道自身 section，但问题不能稳定反向归属到 section |
| 价格组 → 价格系列使用嵌套子弹窗 | `src/ui/runtime-editor/collection-prototypes.ts`、`src/ui/runtime-editor/subdialog.ts` | 父条目与子条目的错误注记必须返回到正确的集合行 |
| `validateAuthoringInput` 与 Runtime Command Facade 都可能产生诊断 | `src/data-services/authoring/content-policy.ts`、`src/arona-clicker/services/spot-content-service.ts` | 需要统一最小定位元数据，避免 UI 猜测字符串路径 |
| 当前失败回退可按 Spot / Datapack 两种上下文重开 | `src/ui/runtime-editor/actions.ts` | Spot 上下文必须是显式路由，不依赖 DOM class 推断 |

## 设计原则

1. **只显示注记，不自动追踪**：不新增调用链、来源链、跨服务跳转或复杂诊断面板。
2. **条目优先**：集合错误显示在对应行；子集合错误显示在父条目行及必要的子条目摘要处。
3. **Switch 可见**：存在问题的 section tab 显示注记或数量；当前页之外的问题不要求用户逐页寻找。
4. **诊断数据带定位，不让 View 猜路径**：由校验 / 编码边界生成结构化定位信息，View 只负责渲染。
5. **不改变提交语义**：注记是表现层派生，不改变校验严格度、Draft 数据、Apply 原子性或 Runtime 回滚。
6. **保持弹窗栈**：从价格系列子弹窗保存失败时，父级价格组弹窗和 Spot 编辑弹窗都保持，注记回写到正确层级。

## 建议的数据定位形态

后续实现可在现有 `RuntimeEditorProblem` 上增加可选定位字段，不破坏无法定位的旧诊断：

```text
RuntimeEditorProblem
├─ code / message
├─ path                       // 机器可读字段路径
├─ sectionId                  // 所在 Switch，例如 payments / upgrades
├─ collectionId               // 所属集合，例如 payment-options
├─ itemIndex 或 itemId        // 集合条目标识，优先稳定 itemId
└─ parentItemId / childPath   // 价格组 → 价格系列等嵌套定位
```

具体字段名应在开工时结合现有 Policy / collection prototype 合同裁定。若集合条目没有稳定 ID，才使用索引；渲染与校验必须共享同一条目顺序。

## 建议的显示规则

### Switch 注记

- 有一条或多条问题归属到该 Switch 时，Switch 显示统一的错误标记；
- 可显示问题数量，但不在 Tab 标题中塞入完整错误文本；
- Switch 注记只反映当前 Spot 的问题，不混入 Mod 元信息或其他 Spot 的问题；
- 当前没有问题时移除注记，避免旧错误残留。

### 集合条目注记

- 价格组、价格系列、功能项、升级项等集合行显示错误状态；
- 条目注记显示一行短摘要，完整 message 仍可在该条目附近或诊断页查看；
- 价格组错误不能只标记整个“支付”页而不指出具体价格组；
- 价格系列错误应同时能识别父价格组与子成本条目。

### 无法定位的诊断

- 保留 Spot 级 / Diagnostics 页的通用错误展示；
- 不伪造条目位置，不通过 `path` 字符串模糊匹配出错行；
- 这类诊断不应导致编辑器跳页或关闭当前弹窗。

## 施工切片

### P0：诊断定位合同

- [x] 盘点现有 Spot 诊断来源并保持兼容。
- [x] 增加可选 section、collection、item、nested child 定位字段。
- [x] 保持未知 / 无法定位诊断的兼容表示。
- [x] 为价格组 → 价格系列路径提供集合条目定位样例。

### P1：校验与草稿边界

- [x] Runtime Editor 诊断合同支持结构化定位信息，旧的 path/message 仍可直接消费。
- [x] hydrate、clone、stash、apply 与失败回写保留诊断兼容性。
- [x] Coordinator / Command Facade 诊断能够按 path 映射到当前 Spot。
- [x] 未改变校验规则、支付语义和失败回滚行为。

### P2：View 注记

- [x] Switch 根据归属问题显示错误注记 / 数量。
- [x] 集合行根据条目定位显示错误状态与短摘要。
- [x] 嵌套价格系列错误至少显示父价格组的最小必要注记。
- [x] 当前页面切换、重新渲染和错误清除后不残留旧注记。

### P3：弹窗与回归

- [x] 价格组弹窗保存失败时父级 Spot 编辑上下文不丢失。
- [x] 价格系列子弹窗保存失败时不关闭父级弹窗、不跳到 Datapack 页。
- [x] Spot Apply 失败继续留在 Spot 编辑态；Datapack 级 Apply 失败才回到 Datapack 编辑态。
- [x] 诊断页、Switch 注记、集合行注记使用同一组问题数据。

## 验收标准

- [x] 一个 Spot 有多个问题时，能够看到每个问题所在的 Switch 与集合条目。
- [x] 价格组与价格系列错误不会只显示为“支付页有错误”。
- [x] 无法定位的问题仍可在 Spot 级 / Diagnostics 区看到，不会被吞掉。
- [x] 保存失败、Apply 失败、取消、Esc、遮罩关闭均不破坏当前弹窗上下文。
- [x] 错误清除或条目修复后，对应条目与 Switch 注记同步消失。
- [x] 未新增自动追踪调用链、跨页面跳转或错误恢复副作用。

## 测试计划

至少覆盖：

- Policy 字段错误 → 对应基础字段与 Switch 注记；
- 价格组错误 → 对应价格组行与 `payments` Switch 注记；
- 价格系列 / 成本条目错误 → 对应父价格组、子条目与 `payments` Switch 注记；
- 升级条目错误 → 对应升级行与 `upgrades` Switch 注记；
- 多个 Switch 同时有错 → 各自独立显示，不互相覆盖；
- 修复后清除注记；
- Spot 弹窗失败回退不跳 Datapack 页，父级弹窗与草稿保持；
- 无法定位诊断仍保留在 Diagnostics 展示。

## 当前核验（2026-09-16）

- `npx tsc --noEmit`：通过。
- Runtime Editor 表单 / 支付 / Spot Apply 定向测试：26 项通过。
- `npm run check:docs`：通过，扫描 211 篇 Markdown。
- Switch 与集合条目注记测试覆盖字段、支付价格组、所属页和问题摘要。

## 实施结果

- `RuntimeEditorProblem` 增加可选定位字段，兼容现有 `path` / `message` 诊断。
- `problemSectionId` 根据 Policy 和路径推导 Switch 归属。
- 通用集合渲染器根据集合字段与索引标记具体问题条目。
- Spot 编辑器 Switch 显示问题数量，集合行显示问题边框与摘要。
- Spot 失败回退使用显式 Spot 表单标记，不再错误打开 Datapack 调试页。

## 相关路由

[[task-0076-unified-def-editor-service]]
[[task-0077-runtime-editor-condition-tree]]
[[task-0078-runtime-editor-condition-target-editors]]
[[task-0080-spot-cost-and-payment-extensibility]]
[[task-0081-spot-payment-default-removal]]
[[docs/docs-828/02-modules/runtime-editor]]
[[docs/docs-828/05-conventions/testing]]
