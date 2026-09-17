# Task：Init 编辑器设计与实施规划

状态：proposed — 🟡 已完成首版策划，待裁定与开工

## 目标

完成游戏内 Runtime Editor 的 Init 编辑器设计，使 Init 不再只是一个普通 Definition 表单，而是一个可理解、可校验、可安全提交的世界线入口编辑器。首版设计复用现有统一编辑器外壳、Draft、Policy、Init / Area 热 CRUD 与位置兜底，不改造 `tools/datapack-editor/`。

本 Task 只做设计与实施边界，不修改业务源码。开工后应另按切片实现并补齐测试。

## 设计基线

- 当前唯一入口是 `src/ui/runtime-editor/`；外壳已经支持内容类型切换、左侧 Switch、Draft / Applied 对比、诊断和 Apply。
- `INIT_CONTENT_POLICY` 已开放 `idName`、`name`、`description`、`startStoryId`、`worldTilt`、`worldTiltAlias`，以及 `defaultAreas`、`purchaseCost`、`tags`、`revealTriggers` 扩展。
- `enterEffects`、`triggers`、`theme`、`extra` 当前未开放编辑；不能在回写时静默丢弃这些字段。
- `RuntimeInitInput` 与 `RuntimeWorldDraft` 已有 Init 输入和 Init / Area 批量提交边界；当前 Apply 走 Registry 的受控局部 mutation，并由 Runtime 协调位置兜底。
- 当前 Init / Area 共用编辑器框架，已有表单、状态和热 CRUD 测试；本 Task 重点是 Init 语义、交互和准出，而不是复制 Area 设计。

## 设计裁定

### 1. Init 的产品定位

Init 是一条世界线的入口定义，编辑器必须同时回答四件事：

1. 这条世界线是谁（ID、名称、描述、标签与展示倾斜值）；
2. 玩家从哪里进入（起始剧情、默认区域顺序）；
3. 玩家如何解锁或看到它（购买费用、揭示条件）；
4. 当前修改会影响什么（区域归属、当前玩家位置、未支持字段与运行时依赖）。

因此 Init 页面不能只平铺字段，也不能把运行时当前区域反写成 `defaultAreas`。`defaultAreas` 是声明式、可排序的默认入口集合；当前玩家位置是运行时状态，两者始终分离。

### 2. 页面结构

Init 使用统一编辑器外壳，页面固定为五个 Switch：

| Switch | 承载内容 | 设计重点 |
| --- | --- | --- |
| 概览 | ID、名称、来源、编辑状态、区域数量、关键警告 | 先让用户知道“正在改哪条世界线”以及是否可安全 Apply |
| 基础 | 名称、描述、起始剧情、世界倾斜值、倾斜展示别名、购买费用、标签 | 标量字段直接编辑；ID 仅新建时可编辑 |
| 区域 | `defaultAreas` 有序列表 | 搜索、添加、排序、移除；显示 Area 名称、完整 ID 和归属状态 |
| 揭示 | `revealTriggers` | 复用现有 Reveal / Condition 子编辑器，不在 Init 页面重新实现条件 DSL |
| 诊断 | 不可回写字段、引用错误、来源权限、删除影响、Apply 差异 | 诊断必须保留在 Editor state，不能只写 Toast |

切换 Switch、切换条目、关闭弹窗和 Apply 前都必须先暂存当前页；Apply 读取完整 Init Draft，不读取当前 DOM 的局部页面。

### 3. 字段授权矩阵

| 字段 | 新建 | 编辑自有 Runtime Init | 外部 / 基础 Init | 处理方式 |
| --- | --- | --- | --- | --- |
| `idName` | 可写 | 只读 | 只读 | ID 稳定；需要换 ID 时删除后新建 |
| `name` / `description` | 可写 | 可写 | 只读 | 直接字段校验 |
| `startStoryId` | 可写 | 可写 | 只读 | 可选完整 Story 引用，候选显示名称与 ID |
| `worldTilt` / `worldTiltAlias` | 可写 | 可写 | 只读 | 保持字符串语义，不在 UI 猜测数值格式 |
| `purchaseCost` | 可写 | 可写 | 只读 | 资源候选 + 非负金额；显式空数组表示无购买费用 |
| `tags` | 可写 | 可写 | 只读 | 复用标签列表编辑器 |
| `defaultAreas` | 可写 | 可写 | 只读 | 有序 Area 引用列表，必须通过归属校验 |
| `revealTriggers` | 可写 | 可写 | 只读 | 复用现有揭示 / 条件编辑器 |
| `enterEffects` / `triggers` | 不开放 | 只读并提示 | 只读并提示 | 不做静默丢弃；存在时阻断替换或保留不透明载荷 |
| `theme` / `extra` | 不开放 | 只读并提示 | 只读并提示 | 另立 DSL / 表现层回写任务 |

首版优先采用“存在未支持字段则阻断替换”的安全策略；若后续确认需要编辑已有复杂 Init，再另立不透明字段保留 / 合并方案，不能把字段默默变成默认值或空数组。

### 4. `defaultAreas` 交互与关系规则

`defaultAreas` 是 Init 最关键的专属编辑区域，使用有序摘要行，不使用自由文本 ID 输入：

- 每行显示 Area 名称、完整 Area ID、所属 Init、当前状态和移除操作。
- 添加时从 Registry 与当前 Draft 的 Area 候选中搜索；新建但尚未 Apply 的 Area 必须标记为“待提交”。
- 同一 Area 不得重复添加；拖拽或上移 / 下移改变入口顺序。
- 目标 Area 必须存在，且 `Area.initId` 与当前 Init ID 一致；不一致时立即在行内标红，Apply 仍必须 fail closed。
- 显式空数组保持合法输入语义，但概览和诊断显示“没有默认区域”；该 Init 不能提供有效进入位置，运行时按既有兜底回到 Init 选择界面。
- 删除或替换 Area 时，Init 页面显示受影响的 `defaultAreas` 引用；不自动级联删除 Area 或 Spot。

排序不是纯 UI 偏好：当前区域丢失时，Runtime 协调层按 `defaultAreas` 顺序选择第一个仍存在且归属正确的 Area。因此排序变更必须进入 Draft 差异和 Apply 影响预览。

### 5. 来源、权限与编辑状态

- 只有当前 Runtime Mod 自己拥有的 Init 才显示编辑、删除和 Apply 能力。
- 基础包或其他 Mod 的 Init 可浏览、检查和复制为新 ID，但不允许通过当前 Mod 伪装成同 ID 覆盖。
- 列表状态至少区分：只读来源、新建、已修改、待删除、存在错误、存在未支持字段。
- 删除按钮只在 Draft 中标记待删除；确认 Apply 前不改变 Registry、当前 Init 或玩家状态。
- Init 删除的影响预览必须列出其 Area、被引用位置、当前 `activeInit`、当前 `currentAreaId` 和快照关联；不把“删除 Init”隐式解释为级联删除子内容。

### 6. Apply 与运行时语义

Init Apply 继续使用现有 `RuntimeWorldDraft` 批量提交：

```text
Init Draft
  → 暂存当前页面
  → Policy 字段 / 扩展校验
  → Init / Area 引用与归属预检
  → RuntimeWorldContentCoordinator
  → Registry 受控 mutation
  → InitService 轻量 reconciliation
  → 更新 Applied 快照与只读 UI
```

必须保持以下语义：

- 只修改 Init 定义时不重置 PlayerState，不清空资源、Spot 进度或 per-Init 快照。
- 当前 Init 仍存在但当前 Area 失效时，切换到新 `defaultAreas` 中第一个有效 Area。
- 当前 Init 被删除时，清理悬空位置并回到 Init 选择界面；不留下无效 `activeInit` / `currentAreaId`。
- Init 替换不重复播放一次性进入效果；UI 不能自行模拟一次进入。
- 批量 Init / Area 变更按依赖顺序校验，任何失败都不能留下半提交 Registry、索引、位置或 Applied 快照。
- 跨 Init 搬迁 Area 不是 Init 编辑器的普通字段修改，继续另立任务处理。

### 7. 诊断与差异

诊断页分为四组，避免把所有问题混成一条“保存失败”：

1. **字段问题**：缺少名称、格式不合法、金额非法；
2. **关系问题**：默认 Area 不存在、重复、归属不一致、起始剧情不存在；
3. **能力问题**：当前来源只读，或已有 Init 含 `enterEffects` / `triggers` / `theme` / `extra` 等不可回写字段；
4. **运行时影响**：当前 Init / Area 将变化、位置需要兜底、删除会被 Area / Spot / 快照阻断。

每个问题应绑定 `sectionId`、字段或集合路径；点击诊断可以切换到对应 Switch 或摘要行。失败后保留原 Draft 和 Applied 基线，允许修正后重试。

### 8. 不做的内容

- 不在本 Task 开放 Init 的 `enterEffects`、`triggers`、`theme`、`extra` 深层编辑。
- 不实现 Enhancement 编辑器，不改变 Area / Spot 的既有设计。
- 不恢复 `tools/datapack-editor/` 为当前入口。
- 不增加存档迁移、版本兼容或旧字段自动回填。
- 不把运行时当前区域、可见区域或地图拓扑反写为 `defaultAreas`。

## 实施切片

### D0：设计与裁定（本 Task）

- [x] 确认 Init 当前 Policy、Runtime 输入、统一编辑器外壳和热 CRUD 基线。
- [x] 固定页面分区、来源权限、`defaultAreas` 交互和未支持字段安全策略。
- [x] 明确 Apply、删除和位置兜底的运行时语义。

### D1：Init 专属交互落地

- [ ] 将 Init 概览、基础、区域、揭示、诊断按本设计收敛。
- [ ] 把 `defaultAreas` 从自由引用输入收敛为有序候选列表，并支持当前 Draft Area。
- [ ] 在列表和表单中区分来源、Draft 状态、未支持字段和引用错误。

### D2：安全回写与影响预览

- [ ] 为已有复杂字段建立阻断或不透明载荷保留的明确实现，不允许静默丢字段。
- [ ] 补齐 Init 删除、当前 Init / Area 失效和批量 Init / Area 引用影响诊断。
- [ ] 确认 Apply 失败时 Draft、Applied、Registry 和运行时位置的回滚边界。

### D3：验证与浏览器验收

- [ ] 增加 Policy、Draft round-trip、`defaultAreas` 排序 / 引用和诊断测试。
- [ ] 增加 Init / Area 热 CRUD、删除阻断、位置兜底和状态保留回归测试。
- [ ] 完成类型、专项测试、架构、文档、构建与浏览器验收。

## 验收口径

### 设计验收

- 用户能在一个页面理解 Init 的世界线身份、入口区域、解锁 / 揭示方式和当前影响。
- `defaultAreas` 的顺序、归属和有效性在 Apply 前可见且可修正。
- 只读来源和不可回写字段不会被伪装成可编辑或静默丢弃。
- 删除、替换和当前玩家位置变化有明确的影响说明和 fail-closed 行为。

### 实现验收命令

```text
npx tsc --noEmit
npm test -- --run tests/ui/runtime-editor-definition.test.ts tests/engine/runtime-world-hot-crud.test.ts
npm run check:architecture
npm run check:docs
npm run build
```

若 D1 引入新的 Init 专属测试文件，应在本 Task 的实现阶段把它加入专项命令；只有涉及跨机制改动时才补跑 `npm test` 全量。

## 需要人工裁定的事项

1. **复杂字段策略**：首版是否始终对含 `enterEffects` / `triggers` / `theme` / `extra` 的已有 Init 阻断替换，还是立即设计不透明载荷保留？默认建议先阻断，避免回写损失。
2. **空默认区域**：是否允许 Apply 一个 `defaultAreas: []` 的 Init？当前运行时已支持无有效默认区域时回到 Init 选择界面；默认建议保留为空合法、在 UI 显示警告。
3. **默认区域排序控件**：是否需要拖拽，还是上移 / 下移按钮即可？默认建议先用按钮，减少窄屏和键盘焦点复杂度。
4. **Init 删除确认**：当前 Init 被删除时是否直接回到 Init 选择界面？既有 Runtime 设计已定义该兜底；默认建议继续允许，但有 Area / Spot / 快照引用时先显示影响并阻断不完整批次。

## 相关路由

[[docs/docs-828/00-INDEX]] · [[docs/docs-828/02-modules/runtime-editor]] · [[docs/docs-828/05-conventions/architecture-discipline]] · [[docs/docs-828/05-conventions/testing]] · [[task-0088-init-area-hot-crud-and-location-fallback]] · [[task-0087-init-area-enhancement-editor-crud]] · [[task-0076-unified-def-editor-service]]
