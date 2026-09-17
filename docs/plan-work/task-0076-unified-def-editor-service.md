# Task：前台统一编辑器服务（Def 编辑构建接口 / 分页 Switch / 子编辑弹窗）

状态：active — 🟡 P0–P2 主体已落地（含页隔离与集合原型）；余项见「剩余工作」

## 目标

把当前「只能编辑 Spot」的运行时编辑器升级为**前台统一编辑器服务**：它是各类 Datapack Def 的统一前台写入口，而不是单一 Spot 表单的堆叠。

三项必须交付的能力：

1. **类型无关的 Def 编辑构建接口**
   编辑器未来会承担较多内容复用工作（各类 Def 的 Browse / Inspect / Create / Edit / Remove）。必须提供可复用、可扩展的构建接口：新增一类 Def 的编辑能力 = 接入一份描述 + 一条受控写通道，而不是重写视图、表单、事件与命令四层。

2. **分页 Switch 聚合（Switch 位于左侧）**
   Def 自身字段很多。实体编辑区必须用**左侧 Switch** 聚合关键信息，把「概览 / 基础字段 / 结构化子内容 / 诊断与差异」分页承载，而不是把整张表平铺进一个长表单。Switch 是竖排的页切换控件，固定在内容区左侧，不占用顶部空间。

3. **子编辑弹窗**
   复合子内容（数组、嵌套记录）在父表单只显示**类型 + 简单注释名**的摘要行；必须进入**子编辑弹窗**才进行详尽编辑，避免平铺后表单体积失控。

**本轮唯一内容样例**：只对 `spots` 做尽量丰富的编辑内容，用它验证构建接口能否承载真实层级；其他 Content Key 一律不接入（授权仍以能力矩阵为准）。Spot 的楼层设计见「Spot 层级编辑服务设计」。

## 设计边界

- **不重做既有纪律**：Registry 受控 mutation、Definition Resolution 三态、事件驱动、`StateMutationService` 单一写入口都不变；本 Task 只做「授权内容 → 通用编辑器」的收敛。
- **字段授权仍由策略表决定**：可写字段、失效方式与触发方一律取自 `ContentAuthoringPolicy.materialization` 台账；未登记字段不得出现在导出的编辑器描述里。
- **两段式提交不变**：编辑器仍是 Draft → Apply；Apply 走 `applyAuthoringMutation` / Registry 受控通道，UI 不直写 Registry 或 PlayerState。
- **只读 UI**：编辑器只消费 `createUIContext()` 的只读面与 `ctrl.commands.*`，不持有写引用。
- **不做存档迁移**：结构可破坏性变更，旧存档失效即清档。
- **配色保持自包含**：编辑器是内部界面服务，使用 `src/ui/css/runtime-editor.css` 的局部变量，不接入 `--theme-node-*` / `--ac-*` 主题树渲染。
- **承载面取消最大宽度**：编辑器面板不再设 `max-width`，改为**尽量宽**——撑满可用区域，只保留外部间距（遮罩层 padding）。窄屏不再靠缩窄面板适配，而是让内容区自适应收敛。
- **Switch 固定在左侧**：分页切换是左侧竖排列，与内容区构成「左 Switch + 右内容」两栏；类型与条目选择上移到顶部条，不与左侧 Switch 争抢同一空间。
- **子编辑只处理已声明结构**：子内容编辑器只支持描述符声明的结构；未声明结构一律只读 + 提示，不做通用递归 DSL 表单。
- **递归必须有上限**：自递归结构（条件组、表达式树、Extra 树）设深度与条数上限；超限不渲染「继续嵌套」，并提示改在 Datapack 中编辑。编辑器不做无限递归 DSL IDE。
- **台账是能力天花板**：能否编辑由 `materialization` 台账（消费者 + 失效方式 + 触发方）决定，不由 UI 想做多少决定。指不出失效触发方的字段只能只读，哪怕数据结构上可写。
- **摘要行是父级唯一表达**：父级不得知道子内容的字段；父级只认「类型 + 注释名 + 操作」，详尽编辑一律在子弹窗内完成。
- **不扩大内容授权**：本 Task 不自行把 `P2+` / `RO` 内容提升为可写；授权值仍以能力矩阵（见 [[task-0071-runtime-editor-p0-capability-baseline]] P0-A）为准，扩权需单独裁定。

## 当前事实与代码落点

### 契约与数据层

- `ContentKey` 已定义为 Datapack 顶层内容键（排除 `name` / `version` / `modName`），键空间天然覆盖全部内容表：`src/data-services/authoring/content-policy-types.ts`。
- Datapack 顶层现有约 30 个内容表（`inits` / `areas` / `spots` / `items` / `traits` / `stories` / `characterVariants` / `colorGroups` / `gachaPools` / `shops` / `pics` 等），是「各类 Def」的全集：`src/data-services/contracts/datapack.ts`。
- 单表授权结构已成型：`ContentAuthoringPolicy` 含 `key` / `label` / `idType` / `inputPrefix` / `fields` / `extensions` / `defaults` / `apply` / `materialization` / `state` / `mutate`：`src/data-services/authoring/content-policy-types.ts`。
- **当前只有一张策略表**：`CONTENT_POLICIES = [SPOT_CONTENT_POLICY]`；字段校验、编码、Def 构建、整表校验已通用（`validateAuthoringInput` / `buildAuthoringDef` / `encodedAuthoringFieldValue` / `applyAuthoringMutation`）：`src/data-services/authoring/content-policies.ts`、`src/data-services/authoring/content-policy.ts`。
- **唯一受控写通道是 Spot**：`registry.applySpotMutation` + revision + Receipt + rollback；没有泛化的 `applyDefinitionMutation`：`src/data-services/registry/registry-spot-mutation.ts`、`src/data-services/registry/registry.ts`。
- Definition 层已按 `table: string` 通用（`DefinitionKey` / `DefinitionSourceLayer` / `DefinitionResolution` / Draft layer）：`src/data-services/definition/definition-types.ts`、`src/data-services/definition/definition-resolution.ts`。
- 能力矩阵已冻结 33 键的 Browse / Inspect / Create / Edit / Remove / Apply / State Policy / Editor 授权边界（`spots` = P1，其余 `P2+` / `RO` / `Deferred`）：[[task-0071-runtime-editor-p0-capability-baseline]] P0-A。

### Runtime 命令层

- `RuntimeDefinitionEditorCommands` 只暴露 Spot 五个方法（`createSpot` / `replaceSpot` / `deleteSpot` / `suspendSpot` / `resumeSpot`）：`src/arona-clicker/contracts/runtime-content.ts`。
- `RuntimeDefinitionEditor` 是命令便利层，校验 / 物化 / revision / 回滚仍归 Coordinator：`src/arona-clicker/services/spot-content-service.ts`、`src/arona-clicker/services/runtime-content-coordinator.ts`。

### UI 层（本 Task 的主要改造面）

集中在 `src/ui/runtime-editor/`（已从 controller 与 workspace 中拆出并集中）：

| 文件 | 当前职责 | 与本次诉求的差距 |
| --- | --- | --- |
| `src/ui/runtime-editor/state.ts` | 单表（spots）Draft 状态、Draft/Runtime 比较、Apply 快照 | 状态形状按 Spot 固定，无多表/多类型容器 |
| `src/ui/runtime-editor/form.ts` | 策略驱动字段投影 / 回读 / Diff / 诊断 | 只处理标量字段与一个 Affector 扩展，无分页与子内容模型 |
| `src/ui/runtime-editor/view.ts` | 渲染开关卡片、Mod 表单、内容浏览器、Spot 表单 | 全部字段平铺；无页签；子内容（Affector）内联展开 |
| `src/ui/runtime-editor/actions.ts` | 事件接线、Draft 保存、Apply、删除确认 | 事件与文案按 Spot 硬编码 |
| `src/ui/runtime-editor/config.ts` / `debug.ts` | 调试开关与默认编辑数据 | 与本次诉求无冲突，保持 |
| `src/ui/css/runtime-editor.css` | 自包含配色与编辑器样式 | 需要新增分页 / 子弹窗 / 摘要行样式 |

- 挂载点：数据包管理页的编辑态开关卡片：`src/ui/components/service-workspace.ts`。
- 编辑器外壳目前是固定宽度的模态弹窗（640 / 560），长内容靠内部滚动：`src/ui/runtime-editor/actions.ts`。
- 模态母版已具备改全宽所需的钩子与相反约束：`ModalOptions.width` 会渲染为面板上的**行内** `max-width`（行内优先级高于类），因此「取消最大宽」必须**不传 `width`**、改由 `panelClass` 的 CSS 控制面板宽高；面板基础样式为 `width: min(560px, 100%)` + `max-height: 82vh`，遮罩层已提供外部间距（默认 `24px`，窄屏 `12px`）：`src/ui/modal.ts`、`src/ui/css/modal.css`。
- 已有测试契约：`tests/ui/runtime-editor-form.test.ts`、`tests/ui/topbar-settings-workspace.test.ts`。

### Spot 结构事实（本轮唯一内容样例）

- `SpotDef` 的真实层级是 L1–L4：L1 标量与引用；L2 四个集合（`tags` / `functionalities` / `levelUpgrades` / `revealTriggers`）与两个复合（`theme` / `extra`）：`src/data-services/contracts/world.ts`。
- `SpotFunctionalityDef.kind` 6 种（`flow` / `linearYield` / `restartInit` / `hardResetInit` / `gacha` / `shop`），字段随 kind 分派：`src/data-services/contracts/world.ts`。
- `LevelUpgradeDef` = `{ level, cost?, condition?, effects: Effect[] }`，`effects` 再下一层：`src/data-services/contracts/world.ts`。
- `RevealTrigger` = `{ reveal: RevealTarget(5 种), condition?: Condition | ConditionGroup }`：`src/engine/contracts/reveal.ts`。
- `Condition`（`ConditionTarget` 16 种）/ `ConditionGroup`（`AND|OR`，可嵌套）、`Effect`（`EffectOp` 25+ 种、`value` 7 种承载）、`ValueExpression` 算术树：`src/engine/types/expression.ts`。
- `ExtraValue` 6 种节点（可嵌套 `list` / `dict`）：`src/engine/types/extra.ts`。
- 枚举总目录（条件目标 / 效果 op / 功能 kind / Extra 节点）见 [[docs/docs-828/03-data-structures/declarative-dsl]]。

### 设计来源（历史）

- Overlay 收敛与 Editor API 收紧的裁定：[[runtime-editor-overlay-sol-review]]
- 单 Mod 编辑器工作台与泛化收敛：[[task-0057-single-mod-editor-workbench]]、[[task-0072-runtime-mod-editor-authoring-spine]]
- 字段授权阶梯与扩展点：[[task-0073-spot-field-authoring-ladder]]
- 运行时热内容 CRUD 与命令门面：[[adr-0012-runtime-hot-content-crud]]、[[task-0063-runtime-editor-command-facade]]
- 运行时数据包创作总方向：[[16-runtime-datapack-authoring]]

## Spot 层级编辑服务设计

> 本节是「构建接口」在唯一内容样例上的落地设计：层级如何拆、每层用什么载体、以及哪些字段因台账未登记而只能只读。

### 1. 层级拆解（L1–L4）

```text
L1 SpotDef
├─ 标量（Scalar）：id / name / description / baseCost / baseCostResource / baseCapacity
│                   conditionText / upgradeCostBase / upgradeCostGrowth / maxLevel / global
├─ 引用（Ref）：areaId / baseCostResource / colorGroupId / gachaPools[]
├─ 集合（Collection）
│  ① tags: TagPath[]                        路径字符串
│  ② functionalities: SpotFunctionalityDef[] kind 6 种分派
│  ③ levelUpgrades: LevelUpgradeDef[]       含 effects
│  ④ revealTriggers: RevealTrigger[]        含 condition
├─ 复合（Composite）：theme / extra
└─ 子级（L3 / L4）
   ├─ ConditionGroup（自递归：组内放条件或组；ConditionTarget 16 种）
   ├─ Effect（op 25+ 种，value 7 种承载）
   │    └─ ValueExpression（算术树，自递归）
   └─ ExtraValue（6 种节点，自递归 list / dict）
```

关键判断：Spot 不是「字段多的表」，而是「3 层嵌套 + 3 处自递归」。自递归决定了必须有深度上限，也决定了必须分层承载。

### 2. 三种载体与回写协议

| 载体 | 适用 | 交互形态 |
| --- | --- | --- |
| Scalar | L1 标量与引用 | Switch 页内直接渲染输入控件 |
| Collection | L2 四个集合 | 页内**摘要行**列表（`[类型] 注释名` + 编辑 / 删除 / 排序）+「添加」 |
| Composite | `theme` / `extra` | 页内单行入口，点开子弹窗 |
| Recursive | `ConditionGroup` / `Effect.value` / `ExtraValue` | 子编辑器内递归渲染，带深度与条数上限 |

统一协议（复用的关键）——每个子编辑器只实现三个方法：

```text
ChildEditor<T> {
  render(ctx, value: T, path: string): string        // 生成 HTML
  read(scope: ParentNode): T                         // 从 DOM 读回结构化值
  summary?(value: T): { type: string; note: string } // 供父级摘要行复用
}
```

- 父级只做三件事：渲染摘要行 → 打开弹窗 → `read()` 后按 id / key **不可变替换** Draft。
- 父级不认识子内容的字段，因此新增一种子内容 = 注册一个 `ChildEditor`，外壳与页面零改动。
- 全程只改 Draft；子弹窗关闭不触发 Apply。

### 3. 描述符扩展

在 P0 的 `EditorDescriptor` 上，把页内容从「字段」升级为「字段 + 集合 + 复合」：

```text
EditorSection {
  id / label
  fields:      WritableFieldDef[]   ← 标量
  collections: CollectionSpec[]     ← 摘要行列表
  composites:  CompositeSpec[]
}
CollectionSpec {
  key          ← 'levelUpgrades'
  label        ← '等级升级'
  itemKind     ← 摘要行左侧类型徽标来源
  editor       ← 子编辑器 id
  capabilities ← canAdd / canRemove / canReorder
}
```

配套 **ChildEditorRegistry**（id → `ChildEditor`）：P0 只注册 `affectors`，Spot 样例按 P4 的批次扩表。

### 4. Switch 左栏页划分（8 页）

| 页 | 内容 | 载体 |
| --- | --- | --- |
| 概览 | 只读摘要：所属区域 / 等级上限 / 成本 / 功能数 / 标签数 | 只读 |
| 基础 | id、名称、描述、容量、成本与资源、升级基价与增长、等级上限、条件文本 | Scalar |
| 归属 | `areaId`、`global`、`colorGroupId`、`tags` | Scalar + Collection |
| 功能 | `functionalities` | Collection（6 kind 分派） |
| 升级 | `levelUpgrades` | Collection（含 effects） |
| 揭示 | `revealTriggers` | Collection（含 condition） |
| 扩展 | `extra`、`theme` | Composite |
| 诊断 | `problems` + Draft / Runtime 差异 | 只读 |

概览页的意义：点进一个 Spot 先回答「它是什么」，而不是先看到一列输入框。

### 5. 子编辑器清单与深度策略

| 子编辑器 | 弹窗内字段 | 再进一层 |
| --- | --- | --- |
| `functionality` | kind 选择（6 种）+ 按 kind 分派字段（`flow`→资源 / 数量；`linearYield`→资源 / 每级 / 起算等级；`shop`→shops 引用；`restartInit` / `hardResetInit` / `gacha`→无参数）+ 专属卡池 | condition → `condition-group` |
| `level-upgrade` | 等级、花费、效果列表 | effect → `effect`；condition |
| `reveal-trigger` | 揭示目标（5 种）+ 条件 | condition |
| `condition-group` | AND / OR + 子项列表（条件行 / 嵌套组） | 自递归 |
| `effect` | op 选择 + target 按 op 换控件 + value | value → `value-expression` |
| `value-expression` | 常量 / 资源引用 / 一层二元运算 | — |
| `extra-tree` | 键值行 | 先只读 |
| `affectors`（已有） | 资源 + 模式 + 数量 | — |

深度与条数上限（写死，不做无限递归）：

| 结构 | 上限 | 超限行为 |
| --- | --- | --- |
| 条件组嵌套 | 4 层 | 不渲染「继续嵌套」，提示改在 Datapack 中编辑 |
| 单条件组条数 | 8 条 | 同上 |
| 表达式运算层 | 2 层 | 同上 |
| 集合条目数 | 不设硬上限，列表内滚动 | — |

### 6. 摘要行规范

三段式：`[类型徽标] 注释名` + 右侧操作。

| 集合 | 摘要行示例 |
| --- | --- |
| `functionalities` | `[flow] 信用点 +2` / `[linearYield] 青辉石 每级 +3` / `[gacha] 专属卡池 2` / `[shop] 商店 1` |
| `levelUpgrades` | `[Lv.5] 花费 100 · 2 个效果` |
| `revealTriggers` | `[utility] 条件 3 项` |
| `tags` | `[tag] office/管理层` |

### 7. 台账天花板（决定「能编到多丰富」）

架构纪律要求「指不出失效触发方的字段不得开放编辑」。按现有 `FieldConsumer` 枚举盘点 Spot：

| 字段 / 集合 | 消费者落点 | 失效 | 可否开放 |
| --- | --- | --- | --- |
| `conditionText` | `ui-dynamic` | none | ✅ 可直接开放 |
| `tags` | `tag-index` / `spot-service` | index | ✅ 可直接开放 |
| `levelUpgrades` | `spot-service` | none | ✅ 可直接开放 |
| `gachaPools` | `spot-service` / `ui-dynamic` | none | ✅ 可直接开放 |
| `functionalities` 全 kind | `registry-record` / `affector` / `game-num` | remount | ✅ 与 `affectors` 同链，可直接开放 |
| `revealTriggers` | `visibility` | index / remount | ⚠️ 需先确认 visibility 索引刷新链 |
| `global` | 状态分层（跨世界线保留） | 单独裁定 | ❌ 先裁定 |
| `colorGroupId` / `theme` | 色彩系统 | 单独裁定 | ❌ 先裁定 |
| `extra` | `game-num` / Extra 合并视图 | 单独裁定 | ❌ 先裁定 |

结论：**「尽量丰富」的推进顺序由台账成熟度决定，而不是由 UI 能力决定**。后三项以只读 + 提示收尾，正好演示 fail-closed。

## 施工切片

> 下列新增文件均位于已存在的 `src/ui/runtime-editor/` 目录下，文件名为相对名。Unit 级 Task Read Set 与 Allowed Files 在开工时按切片展开（模板见 [[docs/ai/templates/patch-unit.md]]）。

### P0：类型无关的编辑器描述符与命令端口

**Goal**：把「编辑器长什么样」从 Spot 硬编码中抽出，变成由授权策略派生的**可复用描述符**；同时把 Runtime 命令端口从 Spot 专用泛化为按表操作。

**设计要点**

1. **编辑器描述符（Definition Editor Descriptor）**：新增 `descriptor.ts`，从 `ContentAuthoringPolicy` 派生 UI 直接可消费的视图模型，至少包含：

```text
EditorDescriptor
  ├─ key / label / idType / inputPrefix     ← 直接取自策略表
  ├─ apply                                   ← local-mutation / reload
  ├─ sections: EditorSection[]                ← Switch 页定义（P1 消费）
  │     ├─ id / label
  │     ├─ fields: WritableFieldDef[]         ← 该页承载的标量字段
  │     └─ children: string[]                 ← 该页承载的子内容 id
  ├─ children: EditorChildSpec[]              ← 子内容定义（P2 消费）
  │     ├─ id / label
  │     ├─ summary(row) → { type, note }      ← 摘要行：类型 + 注释名
  │     └─ mode: 'structured' | 'readonly'    ← 未声明结构 fail closed 为 readonly
  └─ capabilities: Browse / Inspect / Create / Edit / Remove   ← 对齐能力矩阵列
```

2. **描述符来源单一**：分页与子内容归属**不得在 UI 侧另写一份清单**；`sections` / `children` 由策略表的 `fields` / `extensions` 派生，必要时在策略表侧新增声明式元数据（如字段分组），而不是在视图里 if 分支。
3. **命令端口泛化**：在 `RuntimeDefinitionEditorCommands` 之上增加按表的操作入口（`create(table, input)` / `replace` / `delete` / `suspend` / `resume`），Spot 五个便捷方法保留为适配层以承接触发器与既有调用方。
4. **写通道不改纪律**：泛化端口内部仍委托 `applyAuthoringMutation` → `policy.mutate`；未授权表返回明确诊断而不是抛异常。

**完成判据**

- 描述符可从任意已授权策略派生；未授权 `ContentKey` 派生失败并给出可读诊断。
- `spots` 描述符与当前表单字段集合逐项一致（零行为漂移）。
- 命令端口有按表调用的契约测试；Spot 便捷方法回归不变。
- `materialization` 未登记的字段不出现在描述符任何分页里。

### P1：统一编辑器外壳、全宽承载与左侧 Switch

**Goal**：用「顶部条（类型 / 条目 / Draft 状态 / Apply）→ 左 Switch + 右内容」的外壳替换当前的平铺长表单，并让编辑区按 Switch 分页。

**承载与布局（本次预期已定）**

- **取消最大宽**：编辑器面板不设 `max-width`，改为尽量宽——撑满可用区域，只保留外部间距（遮罩层 padding）。
- **实现约束**：不得向 `ModalManager.open` 传 `width`——它会写成面板上的**行内** `max-width`，行内优先级高于 CSS 类，会让任何类级宽度覆盖失效；全宽必须由 `panelClass` 的 CSS 负责。
- **两栏**：左侧 Switch 竖排固定窄栏；右侧内容区占满剩余宽度。类型与条目选择上移顶部条，不与左侧 Switch 争抢空间。
- **高度**：面板与内容区改为撑满可用高度（放开 `max-height`），长内容由内容区自身滚动，不再用 `min(70vh, 620px)` 截断。

**设计要点**

1. 新增 `shell.ts`（或等价外壳模块），承载顶部条、左侧 Switch 栏、右侧内容区、底部 Apply 状态栏。
2. Switch 项由 `EditorDescriptor.sections` 驱动；默认页为「概览」，其余页只渲染本页声明的字段。
3. 字段渲染继续复用策略驱动的表单投影（`form.ts`），不新增第二套字段控件。
4. 子编辑弹窗（P2）仍用居中弹窗并保留适度宽度；「取消最大宽」只作用于编辑器主承载面。
5. 视觉继续使用自包含配色，样式追加在 `runtime-editor.css`，不引入主题变量。

**完成判据**

- 长表单不再平铺：任一页只出现本页声明字段。
- Switch 位于左侧且竖向排布；切换页不丢失未保存输入（Draft 值在页间共享）。
- 主承载面无 `max-width`，面板随视口变宽，仅保留外部间距；窄屏不产生横向溢出。
- 现有 Spot 编辑流程的 UI 测试语义不变（仅入口/结构断言按新结构更新）。

### P2：子编辑弹窗与摘要行

**Goal**：复合子内容在父表单只以「类型 + 注释名」出现，详尽编辑进入独立子弹窗。

**设计要点**

1. **摘要行**：父表单为每个子内容项渲染一行，展示类型徽标与简短注释名（如「持续资源 · 信用点 +2」），不内联展开全部字段。
2. **子编辑弹窗**：点「编辑」打开子弹窗，内部按该子内容的描述符渲染字段；保存只回写父级 Draft，不触碰 Runtime。
3. **最小栈深度**：父 → 子两层为默认；子内容再含子内容时按需打开下一层，不做无限递归渲染。
4. **fail closed**：描述符未声明结构的子内容只读展示并给出提示，不提供「原始 JSON」编辑入口。
5. Spot 的 `affectors` 是首个迁移对象：由当前内联列表改为「摘要行 + 子弹窗」，字段与校验规则保持不变。

**完成判据**

- 父表单中子内容只出现摘要行，字段数量与列表长度无关。
- 子弹窗增删改后关闭即回到父表单可见最新摘要。
- 未支持结构的子内容不被静默丢弃，也不被错误覆盖（保持既有 `unsupportedFunctionalityIds` 拦截语义）。

### P3：Spot 迁移验证与第二类 Def 接入

**Goal**：证明「一次接入即可编辑」成立——用同一构建接口接第二类 Def，而不改视图与事件层。

**设计要点**

1. 把现有 Spot 全流程（新建 / 编辑 / 删除 / Apply / 诊断）迁移到新外壳与描述符，行为对齐。
2. 接入第二类 Def（候选：`traits` / `items` / `areas`，均为纯标量 Entity），仅新增策略表行与描述符派生，不改 `view.ts` / `actions.ts` 的类型分支。
3. 第二类 Def 的 Apply 策略按能力矩阵裁定（多数为 `reload`）；若需要新的运行时通道，停止并另立 Task，不在本切片内硬塞。

**完成判据**

- 第二类 Def 可完成 Create / Edit / Remove / Browse，且 `view.ts` / `actions.ts` 无该类型的专用分支。
- Spot 既有测试全绿，无功能回退。
- 新表未授权字段、未支持子内容仍 fail closed。

### P4：Spot 样例内容阶梯（B1–B5）

**Goal**：把 Spot 的编辑内容做到「尽量丰富」，验证「楼层设计」在真实数据上成立；每批以台账可登记为前提，且不修改 P0–P2 的通用接口。

| 批次 | 内容 | 依赖 | 交付判据 |
| --- | --- | --- | --- |
| B1 标量与引用补全 | `conditionText`、`global`、`tags`、`gachaPools`、`colorGroupId`、`baseCost` 简化编辑 | 台账登记 | 字段出现在对应页；未登记项不出现 |
| B2 功能全 kind | `functionalities` 六种 kind 分派字段 + 专属卡池 | B1 + `functionality` 子编辑器 | 六种 kind 均可增删改，摘要行正确 |
| B3 升级与效果 | `levelUpgrades` + `effects`（先做状态层 op） | B2 + `level-upgrade` / `effect` 子编辑器 | 升级项与效果列表均可增删改 |
| B4 揭示与条件 | `revealTriggers` + `condition-group` 递归编辑器 | B3 + visibility 台账确认 | 条件组可嵌套至上限，超限给出提示 |
| B5 扩展（本期不做） | `extra` **明确不支持**；`theme`、`colorGroupId` 只读 | — | 不出现在可写 UI；不提供 JSON 编辑入口 |

**跨批约束**

- 每批只允许新增「策略表台账行 + 子编辑器注册 + 页归属声明」，不得在 `view.ts` / `actions.ts` 增加 Spot 专用分支。
- 每批必须先补齐 `materialization` 行（消费者 + 失效方式 + 触发方）；未补齐不进入下一批。
- B5 若裁定放开 `global` / `theme` / `extra` 写，需要新的失效链：停止并另立 Task，不在本切片内硬塞。
- B2–B4 的子编辑器必须各自带定向测试，不靠端到端测试覆盖。

**完成判据**

- Spot 的 8 页全部可用；未支持的页显示只读说明，而不是空表单。
- 四个集合均有摘要行与子弹窗；深度与条数上限生效。
- Spot 既有测试全绿，新增子编辑器各有定向测试。

## 测试与验收

### 契约与数据

- 描述符派生：字段 / 分页 / 子内容归属与策略表一致；未授权 Content Key 派生失败。
- 命令端口：按表操作与 Spot 便捷方法等价；未授权表返回诊断。
- 子内容摘要：未知结构标记为只读，不产生可写入口。

### 层级与深度

- 子编辑器协议：`render` / `read` 往返后值等价；父级不感知子字段。
- 深度上限：条件组超 4 层或单组超 8 条、表达式超 2 层时，不渲染「继续嵌套」并给出提示。
- 子编辑只改 Draft：任一层子弹窗保存后，Runtime 与 PlayerState 不变。
- 诊断路径：子级校验错误能定位到 `spot.<集合>[i].<字段>` 并高亮对应字段。

### UI

- 分页：Switch 只渲染本页字段；切换页不丢 Draft 值。
- 子弹窗：开 / 关 / 增 / 删 / 改后父表单摘要与 Draft 同步；关闭不自动 Apply。
- Spot 样例：8 页均可进入；四个集合有摘要行与子弹窗；未支持项显示只读说明而非空表单。
- 回归：现有 Spot 全流程（保存 → 差异 → Apply → 删除保留/清理）行为不变。
- 视觉：窄屏无横向溢出；配色不依赖主题变量。

### 必须执行的验证

```text
npx tsc --noEmit
npm run check:architecture
npm run check:docs
git --no-pager diff --check
npm test
```

### 文档与纪律

- 若改动 `src/engine/types/` 或会进入编辑器 Schema 的引擎字段：另执行 `npm run gen:schema` 与 Schema 定向测试（见 [[docs/docs-828/05-conventions/schema-sync]]）。
- 架构纪律与只读 UI 边界见 [[docs/docs-828/05-conventions/architecture-discipline]]；拆分纪律见 [[docs/docs-828/05-conventions/refactoring]]；测试要求见 [[docs/docs-828/05-conventions/testing]]。

## 当前核验（2026-09-15）

本轮为**策划**，已完成以下事实核对（未开工、未改代码）：

- 核定编辑器的当前分布：UI 集中在 `src/ui/runtime-editor/`（state / form / view / actions / config / debug），样式自包含在 `src/ui/css/runtime-editor.css`。
- 核定策略表结构与授权口径：`ContentAuthoringPolicy` 字段完备，`CONTENT_POLICIES` 当前仅 `SPOT_CONTENT_POLICY` 一行。
- 核定写通道唯一性：`registry-spot-mutation.ts` 是当前唯一的受控 Runtime mutation；Definition 层已按 `table: string` 通用。
- 核定命令层现状：`RuntimeDefinitionEditorCommands` 仅 Spot 五方法。
- 核定能力矩阵：`spots` 为 P1，其余内容键为 `P2+` / `RO` / `Deferred`，本 Task 不自行扩权。
- 已核对 `docs/docs-828/00-INDEX`、`05-conventions/*`、`02-modules/ui` 与 `docs/ai/templates/patch-unit.md` 的引用有效性。

### 预期补充（2026-09-15）

- 编辑器主承载面**取消最大宽度**，改为尽量宽、仅保留外部间距。
- **Switch 固定在左侧**（竖排页切换）；类型与条目选择上移顶部条。
- 已核实 `ModalOptions.width` 渲染为面板行内 `max-width`、遮罩层已提供外部间距（默认 `24px` / 窄屏 `12px`），因此全宽只需「不传 `width` + `panelClass` CSS」，不涉及弹窗母版改造。

### Spot 层级细化（2026-09-15）

- 已核定 `SpotDef` 的 L1–L4 真实层级与 3 处自递归（条件组 / 表达式树 / Extra 树）。
- 已按现有 `FieldConsumer` 枚举盘点 Spot 各字段的失效落点，得出「可直接开放 / 需先裁定」两档，并据此划分 B1–B5 批次。
- 已确认 `declarative-dsl` 枚举目录覆盖 ConditionTarget（16）/ EffectOp（25+）/ functionality kind（6）/ Extra 节点（6），可支撑子编辑器的类型分派与摘要行文案。
- 设计结论：Spot 的编辑丰富度上限由 `materialization` 台账决定，不由 UI 能力决定；`global` / `theme` / `colorGroupId` / `extra` 未裁定前只读。

**待验收（开工后补）**：全宽承载与左侧 Switch 的真实浏览器验收、分页与子弹窗验收、第二类 Def 的 Apply 通道裁定。

### 实现进度（2026-09-15）

已落地（数据 / 契约 / 投影 / 渲染全链路）：

- 策略表：`SPOT_CONTENT_POLICY` 新增 `conditionText` / `global` 字段与五个结构化扩展（`functionalities` / `levelUpgrades` / `revealTriggers` / `tags` / `gachaPools`），并补齐 `materialization` 台账（新增 `init-scope` 消费者）。
- 声明式校验：新增 `src/data-services/authoring/content-policy-dsl.ts`，统一校验 / 编码 / 反解析；条件组设 4 层与单组 8 条上限，未知键 fail closed。
- 契约：`RuntimeSpotInput` 与 `RuntimeModDraft.spots` 扩为 `RuntimeSpotDraftSnapshot`，键与策略表输入键对齐。
- 运行时投影：`runtime.ts` 的 `getRuntimeMod` 改用 `decodeSpotContent` 全量投影（不再只截取 `flow` / `linearYield`）。
- UI：新增 `src/ui/runtime-editor/collections.ts`，functionalities / levelUpgrades / revealTriggers / tags / gachaPools 可增删改；旧的 `affectors` 模型退役（`SpotResourceAffectorDraft` 已由 `SpotFunctionalityDraft` 取代）。
- 验证：`npx tsc --noEmit`、`npm test`（160 文件 / 1499 项）、`npm run check:architecture`、`npm run check:docs` 全部通过。

追加落地（同日第二轮）：

- 条件与效果编辑：新增 `src/ui/runtime-editor/dsl-editors.ts`（条件组递归编辑、效果列表编辑）与 `src/ui/runtime-editor/subdialog.ts`（独立于弹窗母版的二级弹窗宿主，挂载 body、z-index 高于 `#app`）。
- 入口：功能的「条件」、升级的「条件 / 效果」、揭示的「条件」；保存前用 `validateConditionGroup` / `validateEffectList` 校验，失败只在弹窗内提示、不写回。
- 结构化值以行内 hidden JSON 承载（`serialize` / `parseCondition` / `parseEffects`），子弹窗保存后写回并同步按钮计数文案。
- 条件组支持「添加条件 / 添加条件组」与逐项删除；达到 `MAX_CONDITION_DEPTH` 时不再渲染「添加条件组」，提示改在 Datapack 中编辑。
- 验证：`npm test` 160 文件 / 1501 项通过；`tsc` / `check:architecture` / `check:docs` 通过。

追加落地（同日第三轮 · P1 外壳）：

- 全宽承载：编辑器面板不再设 `max-width`，撑满遮罩层内可用区域；一律不向 `ModalManager.open` 传 `width`（其行内 `max-width` 会压过类级样式）。
- 左侧 Switch 分页：新增 `sections.ts`，从策略表的 `sections` + `fields.section` + `extensions.section` 派生页；外壳为「顶部条 + 左 Switch + 右页内容」。
- **换页不丢输入**：所有页始终在 DOM 中，切换只改 `hidden`（纯 DOM 操作、无重渲染）；页状态存于 `RuntimeDatapackEditorState.activeSection`。
- 新增概览页（只读摘要）与诊断页（problems + Draft/Runtime 差异）；差异面板由表单底部移入诊断页。
- 验证：`npm test` 160 文件 / 1502 项通过，**既有 UI 断言零改动**（说明分页对既有流程无回归）。

追加落地（同日第四轮 · 页隔离 + 集合原型）：

- **页互相隔离**：Switch 只渲染当前页（不再用 `hidden` 常驻）；新增 `RuntimeDatapackEditorState.formDraft`，切页前把当前页字段与集合并入暂存，保存时由暂存**汇总成一次提交**（页是展示维度，提交是汇总维度）。
- **集合原型注册表**：新增 `collection-prototypes.ts` —— 可变列表 = 一份原型（`createEmpty` / `summary` / `renderItem` / `readItem` / `validate`）；通用渲染器与条目子编辑弹窗按原型工作，新增一类可变列表无需改视图与事件层。
- **新建不再铺开一大串**：添加只产出一行「类型 + 注释名」摘要；类型相关字段、条件与效果都在条目弹窗内（弹窗内为展开式，避免嵌套弹窗）。
- **摘要行**：`[类型] 注释名` + 编辑 / 删除；标量集合（`tags` / `gachaPools`）保持行内单值编辑。
- 条目弹窗交互改为**事件委托**，替代逐按钮绑定（避免重复绑定累积）。
- 验证：`npm test` 160 文件 / 1504 项通过；`tsc` / `check:architecture` / `check:docs` 通过。

未落地（下一步）：

- 效果的复合取值（`ValueExpression` / `ThemeEffectValue` / `ChatTextEffectValue`）暂不支持编辑，仅支持数字与文本。
- 条目弹窗内的条件 / 效果为「展开式」而非独立层级；若需要「条目 → 条件 → 表达式」三层，需为 `subdialog` 引入栈式宿主。
- `theme` / `colorGroupId` / `extra` 不进入可写 UI；`global` 已可写（生效时机为下次世界线切换）。

## 剩余工作

- **外壳承载形态**：方向已定为「全宽浮层 + 左侧 Switch」；是否进一步升级为独立服务工作区页（接入 `workspace-frame`、服务导航与返回栈）留待后续裁定。
- **第二类 Def 选型裁定**：`traits` / `items` / `areas` 中择一作为首个「一次接入」样本。
- **Apply 通道范围**：`reload` 类内容是否需要独立的受控通道，或复用现有数据包启用集重载流程。
- **子内容范围**：已定为「集合型子内容 + 受上限约束的递归子编辑器」；`ConditionGroup` 4 层 / 单组 8 条、表达式 2 层为设计建议值，开工时确认。
- **B5 是否放开写**：`extra` 明确不做；`theme` / `colorGroupId` 涉及色彩失效链，需单独裁定后才能从只读升级为可写。
- **子编辑弹窗分层**：摘要行与条目弹窗已落地；若需要「条目 → 条件 → 效果」三层，需为 `subdialog` 引入栈式宿主（当前为展开式，单层弹窗）。
- **效果取值类型**：`value` 目前只支持数字与文本；`ValueExpression`、`ThemeEffectValue`、`ChatTextEffectValue` 需要各自的子编辑器，另行立项。
- **Unit 展开**：按 P0–P4 写出 Patch Unit（Allowed Files / Read Set / Completion Criteria），见 [[docs/ai/templates/patch-unit.md]]。
- 完成后按文档规则移入 `docs/plan-work/archive/` 并改状态为 `done`。

## 相关路由

- 能力与授权基线：[[task-0071-runtime-editor-p0-capability-baseline]]
- 前序编辑器工作：[[task-0055-runtime-datapack-editor-mvp]]、[[task-0056-workspace-datapack-boundary-convergence]]、[[task-0057-single-mod-editor-workbench]]
- 授权与命令通道：[[task-0061-runtime-hot-content-crud-spot]]、[[task-0063-runtime-editor-command-facade]]、[[task-0072-runtime-mod-editor-authoring-spine]]、[[task-0073-spot-field-authoring-ladder]]、[[task-0075-spot-runtime-affector-editor-demo]]
- 设计来源：[[adr-0012-runtime-hot-content-crud]]、[[runtime-editor-overlay-sol-review]]、[[16-runtime-datapack-authoring]]
- 规范：[[docs/docs-828/05-conventions/architecture-discipline]]、[[docs/docs-828/05-conventions/refactoring]]、[[docs/docs-828/05-conventions/testing]]、[[docs/docs-828/05-conventions/schema-sync]]
- 模块与架构：[[docs/docs-828/02-modules/ui]]、[[docs/docs-828/02-modules/registry]]、[[docs/docs-828/01-architecture/design-constraints]]
- 施工协议：[[docs/ai/PROJECT-CONSTITUTION]]、[[docs/ai/templates/patch-unit.md]]
- 索引：[[docs/plan-work/00-index]]、[[docs/docs-828/00-INDEX]]
