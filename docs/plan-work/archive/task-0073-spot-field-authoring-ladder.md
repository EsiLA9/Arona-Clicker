# Task：Spot 字段编辑阶梯与可复用 Authoring 结构

状态：proposed — 2026-09-15 暂停推进，随活跃计划层清退移入冻结考古层

## 目标

以 **Spot 作为唯一测试对象**，把可写字段从当前的 9 个标量扩展到 Spot 的绝大多数参数；每个字段都必须有「Apply 前不可见 / Apply 后按消费者变化」的运行时验收；过程中沉淀**可被其他内容表直接移植的结构接口**，使「新增一张可编辑表」退化为「一行策略 + 每字段一行失效声明 + 字段级测试」。

## 与 task-0072 的关系

### 承接

- S0 的内容策略表与通用写通道（`applyAuthoringMutation` / `validateAuthoringInput` / `buildAuthoringDef` / `cloneAuthoringDef`）；
- S1-A 的编辑器骨架（策略驱动表单、内容浏览器、Draft ↔ Runtime 差异、显式 Apply、诊断定位）；
- 0072 的全部不变量：Draft 与 Runtime 分离、单实体 mutation 原子边界、失败不留半应用、默认 `Retain`、不做存档迁移。

### 取代

- 0072 的 S1-B「首批内容类型授权（`areas` → `tags` → `items` → `resourceDisplays`）」**推迟**：先在 Spot 上把字段能力打满，内容表扩展等本 Task 完成后再恢复；
- 0072 的 S1-B 中「Registry 按表泛化索引 / suspended / revision / rollback」一并推迟，理由相同（需要第二个真实样本才值得重写已验证的原子回滚）。

### 不动

0072 的「明确不做」全部继续有效：不建通用 DefinitionRepository / SourceStack / Materializer / LayerManager / 事务框架，不把 Registry 改成通用可写数据库，不做 Mod Rename、不做存档迁移。

## 一、字段分档（事实依据）

依据 Spot 字段消费者核查（`SpotDef` 全部字段 → 运行时读取点 → 是否动态读取 → 现有失效路径）：

| 分档 | 字段 | 改动生效方式 |
|---|---|---|
| **动态读取**（无需失效） | `name`、`description`、`baseCost`、`baseCostResource`、`baseCapacity`、`levelUpgrades`、`upgradeCostBase`、`upgradeCostGrowth`、`maxLevel`、`gachaPools`、`theme`、`colorGroupId` | UI / 服务每次调用读 Registry，无缓存 |
| **已有失效路径** | `areaId`（area 索引 + GameNum 换区重挂）、`baseYield` / `baseYieldResource` / `yieldPerLevel`（`spotDefinitionChanged` → GameNum 单 Spot 子树重建）、`tags`（`applySpotMutation` 内已重建 Tag 索引）、`revealTriggers`（Visibility 只读 `spotId` + `operation`，重新读 Registry） | 现有窄事件已覆盖 |
| **有缺口** | `functionalities`（AffectorEngine 不订阅 `spotDefinitionChanged`，热改 `linearYield` 类功能项不重挂 Affector、flows 节点不补）、`global`（仅在 `InitSavepoint` 迁移点重分区，无事件） | 需补消费者订阅或重分区 |
| **无消费者（死字段）** | `conditionText`、`extra` | 写了也观察不到效果 |

补充事实（影响设计判断）：

- `maxLevel`、`upgradeCostBase`、`upgradeCostGrowth` 由 `SpotService` 在**每次升级时读 Registry**（`getEffectiveMaxLevel` 还叠加 Affector 覆盖），因此只要写进 Registry 即生效；
- `baseCost` / `baseCostResource` **不进入 GameNum 数值图**，只参与解锁费用与展示；
- `yieldPerLevel` 是混合语义：**值变化**动态生效，但「有 ↔ 无」影响 GameNum `levelLinear` 节点的存在性 → 依赖 `replace` 的子树重建；
- `validateDatapack` 只校验 Spot 的 `areaId` 引用存在，**不校验** `colorGroupId` / `gachaPools` 的引用是否存在。

## 二、施工切片

### S1-B1：数值与标量字段（已完成 2026-09-15）

- 扩展 `WritableFieldKind`：新增 `int`（非负整数），并让数值类 kind 支持「可选」（空输入＝未设置，编码时整键省略）；
- 策略表新增可写字段：`maxLevel`、`upgradeCostBase`、`upgradeCostGrowth`、`yieldPerLevel`；
- 字段级失效台账落地并替换表级 `derived`（见第三节 3.2），台账契约测试同时生效；
- 验收检查点（逐条断言，风格与 `tests/engine/runtime-hot-content.test.ts` 一致）：
  1. 改 `maxLevel` → `game.spot.getEffectiveMaxLevel(id)` 变化，且升级到该上限被拦（`error: 'MaxLevel'`）；
  2. 改 `upgradeCostBase` / `upgradeCostGrowth` → 升级报价变化；
  3. 改 `yieldPerLevel` → `gameNumSystem.evaluateSpotYield(id, state)` 与资源产出增量变化；
  4. 未设置的可选字段不写入 Def；非法值（小数 `maxLevel`）被拒且运行时不改变。

**实施说明（与原计划的差异）**：本刀只落 `int` 与可选数值语义。`bool` 与 `tagList` 分别随 `global`（只读）与 `tags` 在 S1-B2 落地——先加 kind 而无字段使用会留下无消费者的死 kind。

**测试经验（供后续字段复用）**：`changeResource` 的**最终余额**不适合做断言——热提交与后台结算会让余额在调用后继续变化，即使扣费确实发生。字段级代价断言应改为二选一：
1. 用 `vi.spyOn(game.mutations, 'changeResource')` 断言实际扣费参数（如 `(credit, -10)` / `(credit, -45)`）；
2. 或用「资源刚好不足」的边界断言（`9 < 10` 失败、`5 ≤ 9` 成功）。
另：热提交可能重建 PlayerState 对象，断言必须每次通过 `game.state` 重新读取，不能缓存引用。

完成定义：kind 五处闭合（校验 / 控件 / 编码 / Diff / 初值）全部落实，且新增字段不需要改协调器。（已满足）

### S1-B2：标签与 `global` 边界

- `tags` 开放编辑（`tagList`，候选来自当前 Tag 命名空间）；验收：`registry.spotsWithTag` 命中变化、产出 zone 效果随之变化；
- `global` **只读展示 + Deferred**：显示当前值，标注「热改需 State Policy 裁定后开放」，不提供写入口。

完成定义：`tags` 走通 Draft → Apply → 可观察；`global` 在界面与策略表双层都明确为只读，不出现可写入口。

### S1-B3：引用字段

- `colorGroupId`（→ `colorGroups`）、`gachaPools`（→ `gachaPools` 表，需要 `refList`）；
- 引用存在性诊断必须由 authoring 层提供（`validateDatapack` 不覆盖这两个引用），不得依赖 Registry 报错；
- 验收：改色组 → Spot 卡片主题解析结果变化；新增卡池 → 招募入口出现（UI 渲染输出可断言）。

完成定义：`ref` / `refList` 的候选与存在性都走统一解析接口；候选为空时显示 Deferred 而不是伪造候选。

### S1-B4：`functionalities`（唯一的「需要新失效路径」样本）

- 先只读展示 + 诊断；
- 开放编辑前必须先补失效路径：AffectorEngine 订阅 `spotDefinitionChanged` 并按 Spot 重挂（`syncSpotFunctionalities`），GameNum 补齐 flows 节点；
- 验收：改 `functionalities` 中 `linearYield` 类功能项 → Affector 实例变化 + 产出变化。

完成定义：这是「一个字段的改动需要触发第二类消费者」的完成样本，其失效声明形态被写进策略表，可被后续表复用。

### S2（保留在 task-0072）

`revealTriggers`（递归条件组）、`theme`（ThemeDef DSL）、`levelUpgrades`（升级项数组）仍留在 0072 的 S2；本 Task 只负责把它们的接口形状预留出来（见第三节第 4 条），不实现。

## 三、预留的可复用结构接口（本 Task 的设计约束）

这一节是本 Task 的真正产出：**结构先定型，字段再逐个填**。以下接口必须在 S1-B1 一并落地，后续表只填数据。

### 3.1 kind 的「五处闭合」判据

一个 `WritableFieldKind` 只有同时具备以下五处实现才算支持，缺一不得登记进策略表：

```text
kind
  ├─ 校验：validateAuthoringFieldValue
  ├─ 控件：runtimeEditorFieldViews 的 control 选择
  ├─ 编码：encodeFieldValue（写入 Def 的表示法）
  ├─ Diff：displayValue / 编码值比较
  └─ 初值：runtimeEditorInitialValues
```

### 3.2 字段级失效台账（替换当前的表级 `derived`）

当前策略表只有表级 `derived: DerivedMaterialization[]`，无法表达「同表内哪些字段需要失效、由谁触发」。本 Task 引入字段级声明：

```text
字段失效声明
  ├─ field: 字段键
  ├─ consumers: 消费者标识（如 'ui-dynamic' | 'spot-service' | 'game-num' | 'visibility' | 'affector' | 'tag-index'）
  ├─ invalidate: 'none' | 'subtree' | 'index' | 'remount'
  └─ trigger: 触发方名称（invalidate 非 none 时必填）
```

约定：

- `invalidate: 'none'` 表示动态读取，允许热写；
- `invalidate` 非 `none` 但**指不出触发方**的字段，一律不得开放编辑——这正是 `functionalities` 与 `global` 被 Deferred 的判据；
- 契约测试强制：凡 `apply === 'local-mutation'` 的每个可写字段都必须有失效声明；`invalidate !== 'none'` 的声明必须带触发方名称。

### 3.3 统一的引用解析与存在性诊断

把 S1-A 里 UI 侧的候选解析下沉为可复用接口，供所有内容表共用：

```text
ContentReferenceResolver
  ├─ candidates(registry, refType) → { value, label }[]
  └─ exists(registry, refType, id) → boolean
```

约定：

- 未知或未接入的 `refType` 返回空候选 + Deferred 提示，不伪造候选表；
- 存在性诊断由 authoring 层产出，不依赖 `validateDatapack`（它只覆盖部分引用）；
- `refList` 复用同一解析器，仅增加「多选」的控件与编码形态。

### 3.4 表单递归渲染的接口形状（为 S2 与其他表预留）

S1-A 的渲染器只接受平铺字段数组。为支持 `revealTriggers` / `levelUpgrades` / `theme`，本 Task 只固定接口形状、不实现递归：

- 渲染入口接受**字段树**（字段可携带 `children` / `item` 描述），而不是平铺数组；
- 递归只复用同一套 `FieldDef + value → 标记` 渲染，不引入第二个表单系统；
- 复杂字段在未实现递归前，以「只读摘要 + Deferred」呈现。

### 3.5 死字段约定

无运行时消费者的字段在策略表中显式登记 `consumers: []` + `invalidate: 'none'`，UI 显示为只读并标注「当前无消费者」，不提供写入口。禁止出现「能改但没有任何效果」的字段。

## 四、本次裁定

1. **死字段**（`conditionText`、`extra`）：只读 + 标注无消费者，不开放编辑；
2. **`global`**：只读 + Deferred。开放条件：先裁定「改 `global` 是否需要迁移既有 `spotLevels` / `spotManagers`」，且必须经 `StateMutationService` 单一写入口；
3. **内容表扩展**（`areas` / `tags` / `items` / `resourceDisplays`）暂缓到本 Task 完成，避免在失效台账定型前先铺开多张表。

## 五、测试与验收

每刀必须带 vitest。字段级验收三件套：

1. Apply 前 Registry 与游戏行为不变；
2. Apply 后按该字段声明的消费者变化；
3. Apply 失败时保留 Draft、Runtime 仍用最近一次成功版本。

强制新增：**失效台账契约测试**（3.2 的两条约定），它保证「未验证可热改的字段无法获得写入口」。

切片完成后统一运行：

```text
npm test
npx tsc --noEmit
npm run check:architecture
npm run check:docs
```

## 当前核验（2026-09-15，S1-B1 完成后）

- `npm test`：通过（160 个测试文件 / 1490 个用例）；
- `npx tsc --noEmit`：通过；
- `npm run check:architecture`：通过；
- 本刀新增测试：`tests/data/content-policy.test.ts`（失效台账 + 可选语义 + Def 省略）、`tests/engine/runtime-spot-field-authoring.test.ts`（6 条运行时字段验收）。

## 六、明确不做

- 不实现通用 Materialization Planner 或独立失效求解服务；
- 不实现 `theme` DSL 与递归条件组编辑（属 task-0072 的 S2）；
- 不开放 `global` 的热改，不写 PlayerState 重分区；
- 不因本 Task 顺带开放其他内容表；
- 不做 `conditionText` / `extra` 的写入口；
- 不重写 Registry 已验证的原子回滚。

## 相关路由

- [[task-0072-runtime-mod-editor-authoring-spine]]
- [[task-0071-runtime-editor-p0-capability-baseline]]
- [[task-0061-runtime-hot-content-crud-spot]]
- [[runtime-editor-overlay-sol-review]]
- [[adr-0012-runtime-hot-content-crud]]
- [[docs/docs-828/00-INDEX]]
- [[docs/docs-828/01-architecture/state-layers]]
- [[docs/docs-828/05-conventions/testing]]

## 归档结果

- 准出结论：
  - **非完成归档（暂停搁置）**：2026-09-15 活跃计划层清退，本 Task 暂停推进并移入冻结考古层。
  - 已交付：S1-B1（`int` kind、可选数值语义、字段级失效台账与契约测试）。
  - 未完成：S1-B2（`tags` 与 `global` 边界）、S1-B3（引用字段）。
  - 已被取代：S1-B4（`functionalities` 失效路径）已由 [[task-0075-spot-runtime-affector-editor-demo]] 以受限形态实现（仅 `flow` / `linearYield`；`restartInit` / `hardResetInit` / `gacha` / `shop` 仍不可编辑）。
- 设计理由保留于：
  - 本文（字段级失效台账、`kind` 五处闭合判据、死字段约定、统一引用解析接口的接口形状）。
- 后续工作：
  - S1-B2 / S1-B3 与剩余 Affector kind 的下沉方向见 [[docs/plan-work/00-index]]「未决方向」。

- 更正（2026-09-15）：
  - 本文 S1-B1 中「策略表新增可写字段：……`yieldPerLevel`」及其验收检查点 3 已失效：`yieldPerLevel` 已由 [[task-0074-spot-affector-resource-convergence]] 从 Spot 合同移除，持续产出改由 Affector `flow` / `linearYield` 表达；当前 `SPOT_CONTENT_POLICY.fields` 为 `idName` / `areaId` / `name` / `description` / `baseCost` / `baseCostResource` / `baseCapacity` / `maxLevel` / `upgradeCostBase` / `upgradeCostGrowth`，持续产出经 `extensions.affectors` 编辑。
  - 本文 §3.3 声称「必须在 S1-B1 一并落地」的 `ContentReferenceResolver` 未落地：当前引用解析仍是 `src/ui/workspace/runtime-editor-form.ts` 内的 `refOptions`，仅识别 `refType === 'area'`，其余 refType 返回空候选。该接口应视为 S1-B3 的目标，而非既成约束。
  - 本文 §4.2 对 `global` 的「只读展示 + Deferred」未落地：策略表与表单均未登记 `global`，当前为完全缺席。以源码为准，不再改写本文历史正文。
