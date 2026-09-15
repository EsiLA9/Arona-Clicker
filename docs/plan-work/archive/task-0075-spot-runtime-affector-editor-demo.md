# Task：Spot Runtime Editor Affector 列表与持续资源 Demo

状态：implemented — P0–P3 与全量验证完成，待按文档维护规范归档

## 目标

在现有多 Spot Runtime Editor 上，为每个 Spot 增加一个可变长度的 Affector 编辑列表：用户可以添加、删除和修改 Affector 的资源与数值，保存到 Draft 后再一次性 Apply 到 Runtime。

本 Task 首期只开放「持续获得资源」这一类 Affector，用于验证完整链路：

```text
Spot Editor Affector row
        ↓  authoring adapter
SpotFunctionalityDef.flow / linearYield
        ↓  AffectorEngine
Spot-mounted derived Affector（mountEntityId = spotId）
        ↓  GameNum
持续资源产出
```

同时预留其他 Affector 通道的类型目录、数据模型扩展点和 UI 分区边界，但不在 Demo 中显示或编辑未实现的字段。

## 前置与关系

- 前置：[[task-0074-spot-affector-resource-convergence]] 已将 Spot 持续产出统一收敛至 Affector，并移除 Spot 旧直接产出字段。
- 承接：[[task-0073-spot-field-authoring-ladder]] 的字段级 authoring 策略、失效台账与表单扩展方向。
- 承接：[[task-0072-runtime-mod-editor-authoring-spine]]、[[task-0061-runtime-hot-content-crud-spot]] 的 Draft / Runtime 分离、单 Spot mutation、revision、原子回滚与 Runtime Editor 工作区。
- 不取代：本 Task 不重做多 Spot 工作区、不改变 Definition Resolution 三态、不开放其他 Content Key。

## 设计边界

- 编辑对象是**用户可理解的 Affector 描述**，不是 `AffectorInstance`、Active 状态、运行时 pack 或底层 GameNum 节点；UI 不直接写 Registry、PlayerState 或 AffectorEngine。
- Spot 产出 Affector 仍由现有 `SpotFunctionalityDef` 转译为派生 Affector；不为 Runtime Editor 另造一套持续产出结算机制。
- MVP 仅支持 `resource-flow`：固定每 tick 数量，或按 Spot 等级线性增长；分别物化为现有 `flow` / `linearYield`。
- MVP 不编辑条件、一次性 `effects`、`perTickEffects`、`zoneModifiers`、`capabilities`、`extra`、Shop/Gacha/重启功能或原始 JSON。
- 空列表是合法状态，表示该 Spot 没有由 Runtime Editor 声明的持续资源产出。
- Affector 行的顺序不参与数值语义；MVP 支持增删改，不提供排序控件。列表顺序只用于稳定 Draft、Diff 和测试结果。
- 资源候选来自当前 Registry 的 `resourceDisplays`；不在候选中的资源不允许通过自由文本注入。
- MVP 中数值必须是有限正数；固定模式使用 `amount`，等级模式使用 `amountPerLevel`，默认从 Lv.1 计入，不在 UI 暴露 `startLevel`。
- 不加入存档迁移代码。对旧 Runtime Spot 中无法由本编辑器 round-trip 的复杂功能，必须阻止替换并显示诊断，不能静默丢弃。

## 当前事实与代码落点

- `SpotDef.functionalities` 已支持 `flow`、`linearYield`、`restartInit`、`hardResetInit`、`gacha`、`shop`；当前只有前两者属于本 Task 的持续资源 Affector 适配范围：`src/data-services/contracts/world.ts`。
- `AffectorEngine` 会把 Spot 的 `flow` / `linearYield` 转译为以 `spotId` 为 `mountEntityId` 的派生 Affector，并在 `spotDefinitionChanged` 后同步：`src/engine/effect/affector-engine.ts`。
- GameNum 已按资源建立 Spot 子树，并提供 `evaluateSpotYields(spotId, state)`；因此多行、多资源和不同数值应复用现有求值路径：`src/engine/expression/`。
- Runtime Editor 当前 `RuntimeSpotInput`、`RuntimeModDraft.spots`、`RuntimeEditorSpotDraft` 只有基础 Spot 字段，没有 Affector 列表：`src/arona-clicker/contracts/runtime-content.ts`、`src/arona-clicker/contracts/runtime.ts`、`src/ui/workspace/runtime-datapack-editor-state.ts`。
- `SPOT_CONTENT_POLICY` 目前只登记平铺标量字段；`buildAuthoringDef` 与 `runtime-editor-form.ts` 也按标量字段工作：`src/data-services/authoring/content-policies.ts`、`src/data-services/authoring/content-policy.ts`、`src/ui/workspace/runtime-editor-form.ts`。
- Runtime Editor 已有 Spot 列表、单 Spot 表单、Draft / Runtime Diff、显式 Apply 与 controller 事件绑定：`src/ui/components/runtime-datapack-editor.ts`、`src/ui/controller-actions-topbar.ts`。
- Affector 的底层可编辑通道已经分为 `effects`、`perTickEffects`、`flows`、`zoneModifiers`，并有 Pack-level `capabilities`：`src/engine/contracts/affector.ts`。这些是未来类型目录的设计依据，不应全部直接出现在 MVP 表单。

## 目标数据模型

### 1. Runtime Editor 草稿模型

UI 与 Runtime command 使用专门的、带判别字段的编辑模型；不把 `AffectorPackDef` 原样暴露给表单：

```ts
type RuntimeSpotAffectorDraft = {
  id: string;                    // 编辑器生成的稳定局部键，用户不填写
  type: 'resource-flow';         // MVP 可用类型
  mode: 'fixed' | 'per-level';   // UI 术语，不泄漏 flow / linearYield
  resource: string;
  amount: number;                // fixed 数量或 per-level 每级数量
};

interface RuntimeSpotInput {
  // 既有基础字段……
  affectors?: readonly RuntimeSpotAffectorDraft[];
}
```

约定：

- 编辑器内部始终使用数组；command 边界缺省 `affectors` 归一化为空数组，避免旧调用者因缺省字段无法读取 Runtime 内容。
- `id` 在新增行时生成并在行编辑、删除、Draft hydrate、Diff 期间保持不变；它不显示为普通表单字段，仅在诊断中用于定位。
- 同一 Spot 内 `id` 必须唯一。UI 不让用户手写底层功能 ID，materializer 负责生成稳定的 `SpotFunctionalityDef.id`。
- `resource-flow + fixed` 编码为 `{ kind: 'flow', resource, amount }`；`resource-flow + per-level` 编码为 `{ kind: 'linearYield', resource, amountPerLevel }`，省略 `startLevel` 以表达从 Lv.1 计入。
- `affectors: []` 时不生成空 functionality 项；读取/写回只管理 Runtime Editor 自己声明的 Spot 持续资源区域。

### 2. Authoring 扩展点

不要把 `affectors` 硬塞成普通 `WritableFieldKind`，也不要让通用标量表单递归理解全部 Affector DSL。`ContentAuthoringPolicy` 增加可复用的 specialized authoring extension 入口，建议具备：

```text
AuthoringExtension
  ├─ inputKey: 'affectors'
  ├─ definitionKey: 'functionalities'
  ├─ validate(value, registry) → path-aware diagnostics
  ├─ normalize(value) → stable draft list
  ├─ encode(value) → SpotFunctionalityDef[]
  └─ diff / summary metadata
```

本 Task 只实现 `SpotResourceFlowAuthoringExtension`。未来 `zoneModifier`、`activationEffect` 等扩展复用同一接口，但未实现扩展不得通过未知字段绕过策略表。

### 3. Affector 类型目录

建立中立的 `RuntimeAffectorTypeDescriptor` / type registry，供 authoring 与 UI 共同读取，但把“可用”和“预留”分开：

| 类型目录项 | 对应引擎通道 | MVP | UI 策略 |
| --- | --- | --- | --- |
| `resource-flow` | `flows`，物化为 Spot `flow` / `linearYield` | 支持 | 默认显示；固定 / 按等级由同一行内选择 |
| `activation-effect` | `effects`，激活沿一次性执行 | 预留 | 不出现在添加菜单 |
| `tick-effect` | `perTickEffects`，Active 期间逐 tick 执行 | 预留 | 不出现在添加菜单 |
| `zone-modifier` | `zoneModifiers`，进入 flat/mul/custom/bound 区表 | 预留 | 不出现在添加菜单 |
| `service-capability` | Pack `capabilities` | 预留 | 不出现在添加菜单 |
| `condition` | entry 条件，横切字段而非独立 Affector | 预留 | 未来按类型需要时显示 |

类型目录必须提供 `id`、面向用户的 `label`、所属通道、`availability`、字段摘要、校验/物化适配器和列表摘要函数。MVP 的正常 UI 只消费 `availability='demo'` 的项；预留项存在于设计与代码接口中，但不渲染“不可用的空表单”。

Spot 的 `restartInit`、`hardResetInit`、`gacha`、`shop` 继续属于 Spot 功能入口，不归入 Affector 添加菜单；这能避免用户把“功能入口”和“持续效果”混为一谈。

## UI 交互方案

### Spot 表单布局

```text
基础属性
  ├─ Spot ID、Area、名称、描述、成本、容量、升级参数
持续资源
  ├─ [添加持续资源]
  ├─ [资源：信用点] [方式：固定]     [数量：5]       [删除]
  ├─ [资源：青辉石] [方式：按等级]   [每级数量：2]   [删除]
  └─ 空状态：尚未声明持续资源产出
```

规则：

- 区块标题使用“持续资源”，不显示 `functionalities`、`AffectorPackDef`、`entry`、`flows` 等实现术语。
- 添加菜单 MVP 只有“持续获得资源”；不显示未来类型、灰色占位卡片或原始 DSL JSON。
- 固定模式只显示“资源 + 数量”；按等级模式只显示“资源 + 每级数量”。`startLevel`、condition、pack ID、entry ID 等与当前 Demo 无关的信息隐藏。
- 每行独立显示校验错误；资源选择器使用 `resourceDisplays` 的名称，数值输入使用数字控件并显示当前 Spot 等级下的结果预览（新建 Spot 未应用时标为“应用后计算”）。
- 变更只写 Draft；Apply 前 Runtime 产出不变化。Diff 以“新增/删除/资源变更/数量变更/成长方式变更”展示，不展示底层编码差异。
- 删除行需要一次点击确认即可从 Draft 移除；因为持续 flow 是加算项，不提供排序和“启用/停用”两个重复概念。
- 若 Spot 含有未被本编辑器支持的已有功能，表单显示只读提示并禁用会覆盖该 Spot 的 Apply，直到未来适配器支持 round-trip。

## Runtime 应用与失效口径

1. 用户编辑任意数量的 Affector 行，只改变 `RuntimeEditorSpotDraft.affectors`。
2. 保存 Spot 草稿时，策略层完成列表归一化、资源存在性、数值范围、稳定 ID 与重复 ID 校验。
3. Apply 一个 Spot 时，整组 Affector 列表随同一个 `RuntimeSpotMutation` 提交；禁止按行分别调用 Runtime mutation。
4. `RuntimeContentCoordinator` 将草稿通过 authoring extension 物化为 `SpotDef.functionalities`，沿用现有 Registry 原子提交与 revision 检查。
5. `spotDefinitionChanged` 触发 `AffectorEngine.syncSpotFunctionalities(spotId)`；列表增删改通过 pack 重建与 mount 对账生效。
6. GameNum 接收 Affector 生命周期变化，补齐对应资源树节点并刷新 `evaluateSpotYields` / 全局资源产出；同一 Spot 的其他资源不受影响。
7. 任一行校验、Registry 提交或派生更新失败，保留旧 Runtime、Draft 与 PlayerState；不能留下部分行已应用的状态。

字段级失效台账建议：

| 编辑区域 | 消费者 | 失效方式 | 触发路径 |
| --- | --- | --- | --- |
| `affectors` | `registry-record`、`affector`、`game-num`、`ui-dynamic` | `remount` + `subtree` | `registry.applySpotMutation + spotDefinitionChanged + Affector runtime changed` |

## 施工切片

### P0：Affector authoring 合约与类型目录

**Goal**：建立不泄漏底层 Pack 的编辑模型、列表校验/编码扩展点与类型目录；只接入 `resource-flow`。

**Allowed Files**：

- `src/arona-clicker/contracts/runtime-content.ts`
- `src/arona-clicker/contracts/runtime.ts`
- `src/data-services/authoring/content-policy-types.ts`
- `src/data-services/authoring/content-policy.ts`
- `src/data-services/authoring/content-policies.ts`

**Read Set**：`docs/docs-828/05-conventions/architecture-discipline`、`docs/docs-828/02-modules/affector`、`docs/docs-828/04-mechanisms/production`、`src/data-services/contracts/world.ts`、`src/engine/contracts/affector.ts`、`src/data-services/authoring/content-policies.ts`。

**Non-goals**：不改 UI、不改 AffectorEngine、不开放其他类型、不改 `SpotDef` 引擎枚举。

**Completion Criteria**：`RuntimeSpotAffectorDraft`、列表 extension、`resource-flow` descriptor、空列表语义、稳定 ID 与 path-aware diagnostics 有契约测试；未知/预留类型 fail closed。

**P0 Verification Unit**：`tests/data/content-policy.test.ts`（策略扩展、编码与 fail-closed 回归）。

### P1：Spot Draft 列表状态与专用行编辑器

**Goal**：在现有 Spot 表单中增加可变列表，做到“只显示必要字段、按类型显示字段”。

**Allowed Files**：

- `src/ui/workspace/runtime-datapack-editor-state.ts`
- `src/ui/workspace/runtime-editor-form.ts`
- `src/ui/components/runtime-datapack-editor.ts`
- `tests/ui/runtime-editor-form.test.ts`

**Read Set**：`task-0073-spot-field-authoring-ladder`、`src/ui/workspace/runtime-datapack-editor-state.ts`、`src/ui/workspace/runtime-editor-form.ts`、`src/ui/components/runtime-datapack-editor.ts`、`src/ui/context.ts`、`src/arona-clicker/contracts/content-catalog.ts`。

**Non-goals**：不提交 Runtime、不显示预留类型、不实现递归通用 DSL 表单、不允许用户编辑内部 Affector ID。

**Completion Criteria**：可以新增/删除/修改多行；固定/按等级模式切换时只出现对应字段；资源候选来自 Registry；Draft hydrate、clear、Diff 与 Draft 状态比较保留列表；UI 测试确认未出现 `effects`、`zoneModifiers`、pack/entry 等无关信息。

### P2：Authoring 物化与单 Spot 热应用

**Goal**：让一组 Affector 行作为一个 Spot mutation 原子进入 Registry，并经现有 Affector/GameNum 热路径生效。

**Allowed Files**：

- `src/data-services/authoring/content-policies.ts`
- `src/arona-clicker/services/runtime-content-coordinator.ts`
- `src/arona-clicker/runtime.ts`
- `tests/engine/runtime-hot-content.test.ts`
- `tests/engine/spot-functionality.test.ts`

**Read Set**：P0 产物、`src/data-services/registry/registry-spot-mutation.ts`、`src/engine/effect/affector-engine.ts`、`src/engine/expression/game-num-build.ts`、`src/engine/expression/game-num.ts`、`task-0074-spot-affector-resource-convergence`。

**Non-goals**：不实现每行独立提交、不实现通用 Affector Pack 编辑、不改存档层、不加入迁移。

**Completion Criteria**：Apply 后固定资源与按等级资源均可通过 `evaluateSpotYields` 观察；同一 Spot 多资源互不覆盖；增删改不重复挂载；失败时旧 Runtime 与 PlayerState 保持；未支持复杂功能的 Spot 不被静默覆盖。

**P2 Verification Unit**：`tests/engine/runtime-content-coordinator.test.ts`（旧非资源 functionality 保留回归）。

### P3：交互接线、视觉与 Demo 验收

**Goal**：完成 controller 事件、列表样式、Spot Demo 场景和端到端 UI 验收。

**Allowed Files**：

- `src/ui/controller-actions-topbar.ts`
- `src/ui/components/runtime-datapack-editor.ts`
- `src/ui/css/modal.css`
- `tests/ui/topbar-settings-workspace.test.ts`
- `docs/docs-828/02-modules/affector.md` 或本 Task 的执行回执

**Read Set**：P1/P2 产物、`src/ui/controller-actions-topbar.ts`、`src/ui/css/modal.css`、相关 UI 测试、`docs/docs-828/05-conventions/testing`。

**Non-goals**：不做 Edge 之外的新交互框架、不把预留类型做成灰色可点击入口、不扩展 Spot 之外的内容编辑。

**Completion Criteria**：用户可在一个 Spot 中完成至少两种资源、不同数值、固定与按等级两种持续产出 Demo；Draft 未 Apply 前运行时不变；Apply 后 UI/产出同步；Diff 与错误定位可用；窄屏布局不产生横向溢出。

## 测试与验收

### 合约与数据

- `resource-flow` 固定模式编码为 `flow`，按等级模式编码为 `linearYield`；资源、数值和稳定 ID 校验拒绝非法输入。
- 同一 Spot 允许多条资源效果，资源可不同、数量可不同；列表为空不生成虚假功能。
- 未知 `type`、预留 type、未知资源、重复 ID、非有限/非正数、错误 mode 均 fail closed。
- 预留 type 不进入 MVP 的添加菜单，也不产生无消费者的 UI 字段。

### 运行时

- Apply 前 `Registry`、`AffectorEngine`、`GameNum` 与资源余额不变。
- Apply 后新建 Spot 可持续获得资源；修改一个行只影响对应资源/数值；删除一行不删除其他行。
- Spot 升级后按等级型效果线性变化；多个线性行可使用不同资源与不同额。
- Runtime hot replace 不重复挂载 Affector，不残留旧资源流；Spot 等级归零时不继续产出。
- Apply、Registry、Affector 派生链任一环失败时，旧 Runtime、Draft 与 PlayerState 保持一致。
- 含未支持复杂功能的现有 Spot 被明确阻止覆盖，或由实现证明完整保留；二者择一但不得静默丢失。

### UI

- 正常列表只显示“持续获得资源”可用类型；不显示 `effects`、`perTickEffects`、`zoneModifiers`、`capabilities`、condition、entry、pack 等不必要信息。
- 固定/按等级切换会同步切换字段 label、预览和 Diff 文案；无关字段从 DOM 中消失，而不是仅禁用。
- 资源显示名来自 Registry，诊断能定位到 `spot.affectors[n].resource/amount/mode`。
- 一个 Spot 至少两行 Affector 时，列表、hydrate、Draft 比较、Apply 与结果展示保持顺序和数量一致。

### 必须执行的验证

```text
npx tsc --noEmit
npm run check:architecture
npm run check:docs
git --no-pager diff --check
npm test
```

若修改 `src/engine/types/` 或会进入编辑器 Schema 的引擎字段，另执行 `npm run gen:schema` 与 Schema 定向测试；本 MVP 预期只复用现有 `flow` / `linearYield`，不应无故改动 Schema。

## 风险与停止条件

- 如果发现 `RuntimeContentCoordinator` 无法在不丢失未知功能的前提下重建 SpotDef，停止 P2，先裁定“编辑器拥有全部 functionalities”还是“只拥有带 owner 标记的 Affector 子集”；不得用覆盖整个数组的隐式方案上线。
- 如果为了支持预留类型必须新增 `SpotDef` 枚举、Pack 结构或 PlayerState 字段，停止当前 MVP，另立 ADR/Task；不把架构级变更混入 Demo。
- 如果 UI 需要让用户编辑条件表达式、zone modifier 乘区或一次性效果，停止扩展当前行组件，按类型单独立项。
- 如果同一 Affector 同时进入 Spot functionality 与显式 Affector Pack，必须先裁定去重/双倍语义；MVP 不接受双来源编辑。

## 当前核验（2026-09-15）

- 已核对 `docs/docs-828/00-INDEX.md`、Affector / GameNum / Production / DSL 当前文档与 0072/0073/0061/0074 路由。
- 已核对当前 Runtime Editor 的 Spot 列表、标量表单、Draft/Runtime Diff、controller Apply、authoring policy 与 Registry hot mutation 代码路径。
- 已确认现有引擎已具备 `flow` / `linearYield` → Spot-mounted Affector → GameNum 的 Demo 所需机制。
- 已完成 P0–P3：authoring extension、Spot Draft 列表、Runtime 单 Spot 原子 Apply、Affector/GameNum 热路径接入、列表样式与 UI 端到端回归均已落地。
- 旧 Spot 的非资源 functionality 在 Runtime replace 时保留；无法由 MVP round-trip 的资源功能会进入隐藏诊断并阻止 Apply，避免静默覆盖。
- 浏览器自动化探测因 Computer Use 浏览器连接连续失败未完成；happy-dom UI 与 Runtime UI controller 测试已覆盖新增/删除/保存/Apply/Diff 交互。

## 执行回执（2026-09-15）

- P0：增加 `AuthoringExtension` 与 `SpotResourceAffectorDraft`；`affectors` 只允许 `resource-flow`，编码为 `flow/linearYield`，资源来自 `resourceDisplays`。
- P1：Spot Runtime 表单增加可变列表，隐藏内部行 ID 与底层 Pack 字段；Draft、hydrate、Diff 保留列表。
- P2：一组列表行随一个 Spot mutation 原子进入 Registry；热更新后由现有 Affector/GameNum 机制生效，旧非资源功能保留。
- P3：完成添加/删除/模式切换/保存/Apply 接线、窄屏样式与真实 Runtime UI 测试。
- 已执行：`npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs`、`git --no-pager diff --check`、定向测试与全量 `npm test` 均通过；全量结果为 160 个测试文件、1497 个测试通过。
- 未修改 `src/engine/types/` 或引擎枚举，因此按范围约束不运行 `npm run gen:schema`。
- 浏览器自动化因 Computer Use 浏览器连接不可用而跳过；对应 UI controller 与 happy-dom 回归已通过。

## 相关路由

- [[docs/docs-828/00-INDEX]]
- [[docs/docs-828/02-modules/affector]]
- [[docs/docs-828/02-modules/game-num]]
- [[docs/docs-828/03-data-structures/declarative-dsl]]
- [[docs/docs-828/04-mechanisms/production]]
- [[docs/docs-828/04-mechanisms/trigger-effect]]
- [[docs/docs-828/05-conventions/architecture-discipline]]
- [[docs/docs-828/05-conventions/doc-maintenance]]
- [[docs/docs-828/05-conventions/testing]]
- [[task-0074-spot-affector-resource-convergence]]
- [[task-0073-spot-field-authoring-ladder]]
- [[task-0072-runtime-mod-editor-authoring-spine]]
- [[task-0061-runtime-hot-content-crud-spot]]
