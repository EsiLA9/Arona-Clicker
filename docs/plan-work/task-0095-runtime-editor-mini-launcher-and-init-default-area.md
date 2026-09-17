# Task：Runtime Editor 迷你入口浮窗与 Init 默认 Area 协同创建

状态：proposed — 已完成任务拆解，待执行

## 目标

将当前 Runtime Editor 的“大面板即入口”收敛为一个真正的迷你可拖拽入口浮窗。迷你浮窗只负责提供稳定、可扩展的动作入口，不展示 Mod 表单、内容列表、诊断或编辑字段；用户点击入口后，再打开对应的完整编辑工作区。

同时修正新建 Init 的起步体验：新建 Init 时由编辑器协同创建一个属于该 Init 的 `defaultArea`，用户只需填写或修改 `defaultArea` 的 `idName`，不再需要先手工创建 Area 再处理互相引用。这个 Area 进入同一份 Draft，可在后续按普通 Area 继续编辑。

前置任务：[[task-0094-runtime-editor-floating-pane-launcher]]、[[task-0088-init-area-hot-crud-and-location-fallback]]。

## 设计边界

### 1. 迷你浮窗与完整编辑器分层

- 顶栏“编辑器”按钮只打开迷你入口浮窗，不直接展开完整 Runtime Editor。
- 迷你浮窗只包含：标题 / 拖拽把手、关闭按钮，以及入口按钮列表；不放状态摘要、Toast、表单、诊断、Draft / Applied 信息或内容列表。
- 入口固定为四项：
  - 编辑中 Mod 信息设置；
  - 新建 Init；
  - 新建 Area；
  - 新建 Spot。
- 点击入口后，关闭或保留迷你浮窗由统一策略决定；完整编辑工作区必须以明确的目标打开，例如 Mod 信息、Init 创建、Area 创建或 Spot 创建。
- 同一时间只允许存在一个迷你入口浮窗和一个完整编辑工作区宿主，避免多份表单状态与遮罩互相覆盖。
- 迷你浮窗的打开状态、位置和当前入口目标属于 UI 状态；Draft、Applied、Policy、诊断和运行时提交语义保持在现有 Runtime Editor 状态与命令门面中。

### 2. 入口扩展接口

入口不再通过 `runtime-init-create`、`runtime-area-create` 等散落的动作键硬编码。设计一个轻量、与具体 Definition 类型解耦的入口描述接口，至少表达：

| 字段 | 作用 |
| --- | --- |
| `id` | 稳定的入口身份，供绑定、测试和未来扩展使用 |
| `label` | 面向用户的操作名称，使用“编辑 Mod 信息”“新建 Init”等动词 |
| `order` | 单列按钮排序 |
| `isAvailable` | 根据编辑态、Mod 状态和当前运行环境决定是否可用 |
| `onSelect` | 将入口目标交给统一的 Runtime Editor launcher，不直接操作 DOM 或 Registry |

后续新增“大图鉴”“新建其他 Definition”“打开诊断”等入口，只注册新的描述对象，不修改迷你浮窗布局或核心绑定流程。接口不承担业务校验、不写 `PlayerState`、不直接调用 Registry。

### 3. 迷你浮窗视觉与交互方向

视觉主题继续沿用 Arona / Schale 控制台的深蓝层与青蓝信号线，但缩小为“工具继电器”而不是第二个工作区：

- 深墨蓝浮层：`#0d1423`；次级面板：`#16233a`；信号青：`#5ce1e6`；警示黄：`#ffc857`；主文字：`#e9f0ff`。
- 桌面端为紧凑单列卡片，默认靠近顶栏编辑器入口；宽度按内容固定，不随编辑表单扩张。
- 标题栏是唯一拖拽区，显示短标题和关闭键；按钮按单列多行排列，每行只承担一个动作。
- 拖拽必须限制在视口内，并在重新渲染、切换服务和页面翻面后保留位置；首次打开和窄屏越界时回到安全默认位置。
- 按钮保留可见键盘焦点、明确的 `aria-label` / `aria-expanded`；拖拽不是唯一定位方式，键盘用户仍可完整使用入口。
- 尊重 `prefers-reduced-motion`；不增加持续动画，不把 Toast 作为入口承载层。

迷你浮窗草图：

```text
┌────────────────────┐
│ 编辑器          ×  │  ← 可拖拽标题栏
├────────────────────┤
│ 编辑中 Mod 信息设置 │
│ 新建 Init           │
│ 新建 Area           │
│ 新建 Spot           │
└────────────────────┘
```

### 4. 新建 Init 与 defaultArea

- “新建 Init”进入一个明确的创建流程，而不是先打开空白 Init 表单再要求用户手动解决引用。
- 创建流程至少收集：Init `idName`、Init 基础必填字段、`defaultArea` `idName`；`defaultArea` 给出基于 Init `idName` 的可修改建议值。
- 用户修改 Init `idName` 后，若 `defaultArea` 仍是自动建议值，可以同步更新建议；用户已经手动修改过 `defaultArea` 时不得静默覆盖。
- Draft 层一次性加入 Init 与 Area：

  ```text
  new Init  ── defaultAreas[0] ──→ new defaultArea
     │                              │
     └──────────── initId ◄─────────┘
  ```

- 两个实体必须使用当前 Runtime Mod 的同一命名空间；Init 的 `defaultAreas` 指向 Area 的完整实体 ID，Area 的 `initId` 指向 Init 的完整实体 ID。
- `defaultArea` 不能成为孤立的临时表单：创建后应出现在 Area 列表中，并能通过普通 Area 编辑入口继续修改；Init 的默认区域关系也应能在后续编辑中被诊断和调整。
- 对 ID 格式、同 Mod 冲突、已有 Registry 冲突、Draft 冲突和 Init / Area 归属执行创建前校验；失败时不得只创建其中一个实体。
- Apply 使用 Runtime command facade / coordinator 的批量创建语义，对预期的互相引用进行一次 prospective graph 校验与原子提交；不在 UI 中绕过 Policy、Registry 或 `PlayerState`。
- 新建 Init 的默认 Area 只解决创建时的循环引用，不改变删除 Area、删除 Init、当前位置兜底和既有引用阻断规则。

## 施工切片

### P0：入口与创建流程契约

- [ ] 明确迷你入口浮窗、完整编辑工作区、Toast 三者的职责与关闭 / 返回关系。
- [ ] 定义统一入口描述接口、入口目标类型和注册位置；确定入口可用性、排序、禁用态和错误反馈。
- [ ] 定义 `createInitWithDefaultArea` 或等价批量创建契约，明确 Draft、Policy、Coordinator、Registry 的边界。
- [ ] 补充 Init / Area 双向引用、自动建议值与用户覆盖状态的状态模型。

### P1：迷你可拖拽入口浮窗

- [ ] 将当前 Runtime Editor 全面工作区从顶栏直开路径中拆出，顶栏只负责打开迷你浮窗。
- [ ] 实现单列多行入口布局，仅保留标题栏、关闭键和入口按钮。
- [ ] 增加标题栏拖拽、视口边界约束、默认位置、窄屏回位和位置状态保存；避免每次 `#app` 重建丢失位置。
- [ ] 通过统一 launcher 根据入口目标打开 Mod 信息、Init、Area、Spot 的完整编辑工作区。
- [ ] 移除入口按钮对 Toast action key 的依赖；Toast 只显示短暂的保存、Apply、删除或错误结果。

### P2：可复用入口注册机制

- [ ] 用入口描述集合替代散落的四类动作绑定，统一生成按钮、`aria` 状态、可用性和点击处理。
- [ ] 为未来“新建其他内容”“大图鉴”“诊断工作区”等入口保留注册扩展点，但本 Task 不实现这些未来入口。
- [ ] 确保入口注册层不依赖具体页面路由，不直接持有写引用，不让未来入口破坏 UI 只读边界。

### P3：新建 Init 协同创建 defaultArea

- [ ] 在 Init 创建流程加入 `defaultArea.idName` 输入和自动建议 / 手动覆盖状态。
- [ ] 在 Runtime Editor state 中构建 Init + Area 双实体 Draft，并保持选中目标、未保存状态和错误定位。
- [ ] 在 authoring Policy / contract 中补齐双实体的字段、命名空间和引用校验。
- [ ] 在 Runtime command facade / coordinator 中实现批量 prospective graph 校验、原子创建、回滚与失败恢复。
- [ ] Apply 成功后让新 Init 与 defaultArea 同时可见；Area 能从普通编辑入口继续修改。
- [ ] 不改变既有 Init / Area 删除阻断、当前位置兜底、Registry 索引和玩家状态保留规则。

### P4：测试与验收

- [ ] 测试 Init 选择页、游戏页、设置页和数据包页均可打开迷你浮窗。
- [ ] 测试迷你浮窗不渲染 Mod 表单、内容列表、诊断或大编辑器字段。
- [ ] 测试四个入口目标正确打开对应完整工作区，且不创建 Toast 入口动作。
- [ ] 测试拖拽位置、视口边界、窄屏回位、键盘焦点和关闭 / 重开行为。
- [ ] 测试未来入口注册对象可以被统一渲染和禁用，不需要修改核心布局。
- [ ] 测试新建 Init 自动生成 defaultArea、用户自定义 Area `idName`、Init / Area 双向引用和后续 Area 编辑。
- [ ] 测试 ID 冲突、引用非法、同一 Draft 重复创建和 Apply 中途失败时不会留下半个实体。
- [ ] 测试既有删除阻断、当前位置兜底和玩家状态不受影响。
- [ ] 完成类型检查、Runtime Editor 专项测试、引擎 / Coordinator 测试、架构检查、文档检查和浏览器视觉验收。

## 主要代码落点

| 层 | 预计责任 |
| --- | --- |
| `src/ui/components/header.ts` | 保留全局“编辑器”按钮，仅打开迷你入口浮窗 |
| `src/ui/runtime-editor/{launcher,view,actions}.ts` | 迷你浮窗渲染、入口注册、拖拽与目标分发；必要时新增 launcher 模块 |
| `src/ui/runtime-editor/state.ts` | 浮窗位置 / 入口目标 UI 状态、Init + defaultArea 创建 Draft |
| `src/ui/css/runtime-editor.css` | 迷你浮窗单列布局、拖拽标题栏、窄屏与焦点样式 |
| `src/data-services/authoring/content-policy*.ts` | Init / Area 双实体字段与引用校验、编码边界 |
| `src/arona-clicker/contracts/runtime-content.ts` | 批量创建输入、结果与诊断契约 |
| `src/arona-clicker/services/runtime-world-content-coordinator.ts` | prospective graph 校验、原子创建、回滚与 Runtime 协调 |
| `src/data-services/registry/` | 在现有受控 mutation 边界内完成 Init / Area 批量写入和索引维护 |
| `tests/ui/`、`tests/engine/`、`tests/data/` | 入口、Draft、Policy、批量 Apply、回滚和验收回归 |

## 非目标

- 不在迷你浮窗中复制或压缩完整编辑器表单。
- 不实现未来的大图鉴、其他 Definition 创建或通用工作区，只保留入口扩展接口。
- 不恢复 `tools/datapack-editor/`。
- 不改变 Init / Area 的引擎定义语义、命名规则、删除阻断、位置兜底或 PlayerState 结构。
- 不新增存档迁移，不把迷你浮窗位置或 Runtime Editor Draft 写入玩家存档。
- 不把批量创建实现为 UI 直接写 Registry；所有写入仍通过现有命令门面和协调层。

## 测试与验收命令

```text
npx tsc --noEmit
npx vitest run tests/ui/runtime-editor-definition.test.ts tests/ui/runtime-editor-form.test.ts tests/ui/topbar-settings-workspace.test.ts
npx vitest run tests/engine/runtime-world-hot-crud.test.ts tests/engine/runtime-content-coordinator.test.ts
npm run check:architecture
npm run check:docs
npm test -- --run
```

若本 Task 新增了 Registry / Runtime 批量 mutation，再按项目准出规则补充 `npm run build`；若构建会写入项目禁止修改的生成目录，应记录为环境限制而不是伪造通过。

## 当前核验（2026-09-18）

- 已阅读：[[docs/docs-828/00-INDEX]]、[[docs/docs-828/02-modules/runtime-editor]]、[[docs/docs-828/05-conventions/doc-maintenance]]。
- 已核对：[[task-0094-runtime-editor-floating-pane-launcher]]、[[task-0088-init-area-hot-crud-and-location-fallback]]、`src/ui/runtime-editor/{state,view,actions}.ts`、Runtime World Content Coordinator 与 Init / Area 引用校验入口。
- 当前结论：task0094 已提供全局 Body 级完整编辑工作区，但入口仍是“大面板直开”；新 Task 需要先收敛为迷你入口层，再把新建 Init 的 Init–defaultArea 创建提升为同一 Draft / Apply 单元。
- 当前未执行本 Task 代码变更；实现、自动化测试和浏览器验收均待施工阶段完成。

## 相关路由

[[docs/docs-828/00-INDEX]] · [[docs/docs-828/02-modules/runtime-editor]] · [[docs/docs-828/02-modules/ui]] · [[docs/docs-828/02-modules/world]] · [[docs/docs-828/02-modules/registry]] · [[docs/docs-828/05-conventions/architecture-discipline]] · [[docs/docs-828/05-conventions/testing]] · [[task-0088-init-area-hot-crud-and-location-fallback]] · [[task-0094-runtime-editor-floating-pane-launcher]]
