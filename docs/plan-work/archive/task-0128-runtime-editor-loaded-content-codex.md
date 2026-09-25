# Task：RuntimeEditor 已加载内容超级图鉴

状态：done — 🟢 只读超级图鉴已接入 RuntimeEditor，完成集成、规则覆盖与自动化验收；AOCI 漂移按仓库终态治理处理

## 1. 任务定位

本 Task 为 RuntimeEditor 的内容浏览器增加“超级图鉴”模式，提供当前 Runtime 已加载内容的统一只读浏览、搜索、详情、引用跳转与原始数据检查。

它是 **R0 Browse + R1 Inspect** 任务，不是 Datapack 编辑器扩展，也不是包库浏览器：超级图鉴只能访问已经加载给引擎、并进入当前有效 Registry / Runtime Content 的内容。

本 Task 与 `task-0120-def-editor-design-masterplan` 的关系是：先建立 Def 的统一只读观察面，供后续编辑器、诊断和引用影响设计复用；本 Task 不提前开放 D1 Draft 或 A1 Apply。

## 2. 目标

1. 在 RuntimeEditor 内提供独立的“超级图鉴”只读页面。
2. 浏览当前 Runtime 已加载的任意 Mod、任意有效 Def / Entry / singleton 配置。
3. 按 Mod、类型、名称、完整 ID、字段内容搜索和筛选。
4. 在详情面板中展示语义摘要、完整字段树、引用关系和原始数据。
5. 对跨 Def 引用提供可追踪跳转，并明确标记缺失或未解析引用。
6. 复用现有 tooltip、condition、effect、codex 和主题表现能力，但不复制第二套运行时规则。
7. 在整个浏览过程中不加载新包、不修改启用集、不 Apply、不写 Registry、不写 PlayerState。

## 3. 设计边界

### 3.1 数据访问范围

超级图鉴的唯一数据范围是当前 Runtime 的有效内容：

- 当前启用集经过加载 / Apply 后进入 Registry 的内容；
- 当前有效的 Mod 集合与其合并结果；
- 当前 Runtime 已注册的 Pic、图片、颜色和表现资源；
- 当前引擎能够通过只读 Query Port 暴露的 Def / Entry / singleton。

以下内容禁止由超级图鉴直接访问：

- 包库中存在但未加载的普通态数据包；
- 包库中存在但未加载的编辑态数据包；
- 未导入包库的磁盘文件或 ZIP 内容；
- 被当前有效层覆盖、且不属于最终有效 Registry 视图的旧版本定义；
- 任何需要为了查看而触发的加载、启用、重载或 Runtime Apply。

若用户需要查看未加载 Mod，必须先通过数据包管理工作区将它加载进 Runtime；超级图鉴只在下一次 Runtime 内容刷新后显示它。

### 3.2 有效内容与来源

- 主身份使用 `{ definitionKind, fullId }`；不能使用 `packRecordId` 把未加载的包库记录带入图鉴。
- 如果 Registry / Runtime Query 能提供来源 Mod、来源版本或覆盖关系，详情中展示这些事实。
- 如果当前只拥有完整 ID 而没有可靠来源 Provenance，不得凭路径、命名或猜测补写来源。
- 普通态与编辑态若经过 Runtime 选择后只产生一份有效定义，图鉴只显示有效定义；不并列展示未生效副本。
- 当前生效 Def 与玩家运行状态严格分离：拥有、等级、故事游标、库存、AffectorInstance、主题预览等不属于 Def 详情正文。

### 3.3 能力等级

| 等级 | 本 Task 行为 | 写入能力 |
| --- | --- | --- |
| R0 | 列出已加载 Mod、类型和 Def | 无 |
| R1 | 查看字段、来源、引用、缺失项、运行时投影 | 无 |
| D1 | 编辑态 Draft | 不属于本 Task |
| A1 | Runtime Apply / 导出 | 不属于本 Task |

“在编辑器中打开”只能作为后续联动入口：目标必须是当前已加载且属于编辑态的内容，并且仍遵守现有 RuntimeEditor 的 Policy / Command Facade；超级图鉴本身不获得写权限。

## 4. 当前事实与代码落点

### 4.1 已确认事实

- 当前 RuntimeEditor 浏览器由 `src/ui/runtime-editor/view.ts` 渲染，现有列表面向当前编辑态 Draft，内容类型集中在 Init、Area、Spot、Enhancement。
- `src/ui/runtime-editor/state.ts` 持有 Draft、Applied、Suspended、筛选、当前选中条目和表单暂存；该状态模型不应直接成为超级图鉴的数据源。
- `src/ui/runtime-editor/actions.ts` 负责浮窗、页面切换、表单暂存和编辑命令接线；超级图鉴需要独立的只读动作与选择状态。
- `PackCatalogReadModel` 可以读取包库目录和包记录，但超级图鉴不得通过该入口绕过“只访问已加载内容”的边界。
- `ContentCatalogQueryPort` 已提供部分合并后的只读内容 Map，但尚未覆盖 `Datapack` 的全部表和 singleton 配置。
- Registry 是当前加载内容的只读编译态；当前图鉴应优先以 Registry / Runtime Content 的有效视图为事实，而不是读取原始包文件。
- 现有 `tooltip-detail-*`、`collection.ts`、`collection-modal.ts`、condition presentation 和 effect 文本能力可作为详情语义渲染的复用入口。

### 4.2 内容覆盖台账

超级图鉴必须覆盖当前 Registry / Datapack 实际暴露的全部内容族；类型元数据必须从现有内容键 / Registry 表派生，不再维护与 `Datapack` 平行的手写全集枚举。

| 分组 | 内容族 |
| --- | --- |
| 世界 | Init、Area、Spot、Enhancement |
| 剧情 | Story、ActiveStoryEntry、PassiveStoryEntry、PassivePool |
| 物品与经济 | Item、DropTable、Shop、ResourceDisplay |
| 角色与成长 | Character、CharacterVariant、CharaProfile、CultivateCurve、GachaPool、Gear、GearConfig、FavoriteItem、UniqueWeapon、Trait |
| 视觉与资产 | ColorGroup、ColorEquipment、ThemeDesign、Pic、Tag |
| 引擎规则 | AffectorPack、TriggerDef、FuncletDef、Effect / Condition / ValueExpression 嵌套结构 |
| 全局配置 | AffectionConfig、CharacterPersistConfig、Extras 以及其他当前 Registry singleton |

某一类型尚无语义渲染器时，必须仍以安全的通用字段树展示，不得隐藏该类型或静默丢弃未知字段。

## 5. 信息架构

### 5.1 页面结构

RuntimeEditor 浮窗保留当前编辑工作流，同时增加只读模式：

```text
Runtime Editor
├─ 编辑中 Mod
├─ 编辑态内容       ← 现有 Draft / Apply 浏览器
└─ 超级图鉴         ← 本 Task，当前 Runtime 有效内容

超级图鉴
┌────────────────┬──────────────────┬──────────────────────────┐
│ Mod / 内容来源  │ 类型 / Def 列表    │ Def 详情检查器             │
│ 已加载 Mod       │ 搜索 / 筛选        │ 概览 / 关系 / 原始数据      │
│ Runtime 状态     │ 条目数量 / 状态    │ 来源 / 生效 / 缺失引用      │
└────────────────┴──────────────────┴──────────────────────────┘
```

### 5.2 左栏：已加载 Mod

- 只列当前 Runtime 有效 Mod。
- 显示 Mod 名、版本（若 Query Port 可可靠提供）、Def 总数和资源状态。
- 标记 `当前 Runtime`、`已加载`、`存在覆盖` 等事实状态。
- 不显示未加载包库记录，不提供“为了查看而加载”的按钮。

### 5.3 中栏：类型与条目

- 类型按世界、剧情、经济、角色、表现、规则、配置分组。
- 支持名称、完整 ID、描述、Tag 和字段路径搜索。
- 列表行显示：显示名、完整 ID、类型、来源 Mod、诊断徽标。
- 支持收藏 / 最近查看属于后续体验增强，不进入首版持久化状态。

### 5.4 右栏：Def Inspector

详情至少包含三个页签：

1. **概览**：名称、完整 ID、类型、来源、生效状态、简介和重要字段摘要。
2. **关系**：向外引用、可解析目标、缺失目标；反向引用在索引具备时展示。
3. **原始数据**：可折叠字段树，包含字段路径、值类型、值内容和复制入口。

语义渲染优先复用已有能力：Condition 树、Effect / Trigger 摘要、ValueExpression 表达式、Payment / Cost、Reveal、Tag、颜色和图片预览。

## 6. 只读数据契约建议

新增 `RuntimeContentBrowser` 只读查询面，职责是从当前有效 Runtime 内容生成浏览器 View，不把 Registry 写引用暴露给 UI。

建议最小形状：

```text
RuntimeContentBrowserView
├─ loadedMods[]
├─ kinds[]
├─ entries[] / getEntries(kind, mod)
├─ getDetail({ definitionKind, fullId })
├─ getReferences(ref)
└─ getAssetPreview(ref)
```

实现约束：

- 查询只能基于当前有效 Registry / Runtime Content。
- UI 只消费只读快照 / Query Port，不直接读取包库、Datapack 原对象或 PlayerState。
- 类型描述符负责 label、分组、ID 规则、数组 / Map / singleton 形状、语义渲染入口和引用解析入口。
- 引用索引必须能表达 `resolved`、`missing`、`ambiguous`，不能把缺失引用降级成普通字符串。
- 通用字段树必须递归安全处理数组、对象、表达式、Extra 和未知字段，并统一 HTML escaping。
- 资产预览只能使用当前 Runtime 已注册的图片 / Pic 资源；无法解析时显示资源 ID 或路径和明确的缺失状态。
- 不为图鉴新增 PlayerState 字段，不新增存档迁移，不新增 Runtime 写入口。

## 7. 多 Agent 协作方案

本 Task 采用“共享契约先冻结，独立文件并行，入口集成串行”的协作模型。所有 coding agent 默认使用独立 worktree / 分支，禁止多个 agent 在同一工作树同时修改共享入口。

### 7.1 Agent 角色与写集

| Agent | 责任 | 独占写集 / 产物 | 明确不得修改 |
| --- | --- | --- | --- |
| `lead-contract` | Baseline、Query Port、DefinitionRef、Kind Descriptor、诊断状态冻结 | 新增 Runtime Content Browser 契约文件（位置限定在 `src/data-services/contracts/`，具体文件名由 K0 冻结）、对应数据测试、Task 内契约章节 | `src/ui/runtime-editor/view.ts`、`actions.ts`、其他 Agent 的详情组件 |
| `runtime-catalog` | 从有效 Registry 构建全量内容目录、Mod 统计、引用索引、singleton 读取 | Runtime Content Browser 查询实现（位置限定在 `src/data-services/registry/`，具体文件名由 K0 冻结）、对应数据测试、必要的新 registry 只读辅助文件 | 包库读取、UI DOM、PlayerState、PackManager 写路径 |
| `codex-shell` | 超级图鉴三栏骨架、搜索筛选、选择状态、响应式折叠 | 新增 `src/ui/runtime-editor/codex/`、新增独立 UI 测试文件和 CSS 文件 | 现有 `view.ts` / `actions.ts` / `state.ts` 共享入口；只提交可被集成的组件接口 |
| `codex-inspector` | 概览、关系、原始字段树、Condition / Effect / Value / Asset 语义展示 | 新增 `src/ui/runtime-editor/codex-details/`、新增独立 UI 测试文件 | Query Port、共享入口、Registry、Runtime 状态写入 |
| `integration-qa` | 将图鉴接入 Launcher / Panel、处理共享状态、跨域合并、浏览器验收 | `src/ui/runtime-editor/view.ts`、`actions.ts`、`state.ts`、`launcher.ts`、必要的 `runtime.ts` / contracts barrel、集成测试与 CSS 接线 | 在契约或 Agent Packet 未通过前扩展新能力；不得替域线重写设计 |
| `review-qa` | 只读复核、回归、性能、可访问性和范围审计 | 测试日志、验收报告、必要的 Task Receipt；默认不改业务代码 | 所有功能实现文件 |

共享写集必须集中到 `lead-contract` 或 `integration-qa`：

- `src/ui/runtime-editor/view.ts`
- `src/ui/runtime-editor/actions.ts`
- `src/ui/runtime-editor/state.ts`
- `src/ui/runtime-editor/launcher.ts`
- `src/arona-clicker/contracts/runtime.ts`
- `src/arona-clicker/contracts/index.ts`
- `docs/plan-work/00-index.md`
- 共享测试夹具与任何生成产物

### 7.2 波次与门禁

| 波次 | 串行阻塞项 | 可并行工作 | 退出条件 |
| --- | --- | --- | --- |
| P0 Baseline | 核对当前 Runtime、Registry、Workspace 和脏工作树 | `runtime-catalog` / `codex-shell` / `codex-inspector` 只读盘点 | 形成 Baseline Receipt，不把包库记录当成 Runtime 内容 |
| K0 Contract | `lead-contract` 冻结 Query Port、Ref、Kind、诊断和加载边界 | 各 Agent 提交字段台账、UI wireframe、测试矩阵 | Contract v1；不存在第二份内容全集枚举 |
| P1 并行实现 | K0 必须通过 | `runtime-catalog`、`codex-shell`、`codex-inspector` 独立施工 | 各自 Agent Packet 通过最小测试和写集检查 |
| P2 集成 | `integration-qa` 串行合并共享入口 | 其他 Agent 只修复自己写集内问题 | Launcher、Panel、刷新和只读边界接通 |
| P3 交叉验收 | 全部实现已合并 | `review-qa` 可并行读取结果，不新增功能 | 全量测试、浏览器、范围审计、AOCI 收尾 |

### 7.3 Agent Packet 要求

每个 Agent 启动前必须收到以下字段：

```text
agentId / packageId / baselineRevision / contractRevision
Goal
Required Read Set
Allowed Files
Forbidden Files
Explicit Non-goals
Stop Conditions
Done When
```

每个 Agent 结束时必须提交：

```text
status: passed | blocked | partial
touchedPaths / untouchedSharedPaths
confirmedFacts[]
changeSummary
testResults[]
openIssues[]
integrationRequests[]
```

发现需要修改写集外文件时必须停止并提交 `shared-change-request`，不得顺手修改。契约、加载范围、DefinitionRef 或引用语义发生变化时，必须回到 `lead-contract` 串行裁定。

## 8. 测试与验收

### 8.1 数据与契约

- 当前启用且已加载的 Mod 可列出并可查询。
- 未启用 / 未加载 Mod 不出现在图鉴，也不能通过 ID 查询到。
- 普通态与编辑态经过 Runtime 选择后只展示有效定义。
- 世界、剧情、经济、角色、视觉、规则和 singleton 内容均有条目或通用字段树。
- 未知字段、嵌套数组、Extra、表达式和空值不丢失。
- 引用正确区分 resolved / missing / ambiguous。
- 查询过程不改变 Registry、PlayerState、启用集、Runtime Revision 或当前玩家位置。

### 8.2 UI 与交互

- 无编辑态目标时仍可打开超级图鉴。
- 从编辑态内容返回超级图鉴不会丢失选中状态。
- 搜索 Mod、类型、ID 和字段摘要结果正确。
- 详情切换、引用跳转、返回、复制数据和空状态可用。
- 窄面板下三栏折叠顺序为 Mod → 类型 / 条目 → 详情。
- 键盘焦点、ARIA label、滚动容器和 Escape / 返回行为通过人工验收。

### 8.3 运行命令

```text
npx tsc --noEmit
npx vitest run tests/data/runtime-content-browser.test.ts tests/ui/runtime-editor-codex-shell.test.ts tests/ui/runtime-editor-codex-details.test.ts
npm run check:architecture
npm run check:docs
npm run build
npm test
```

浏览器验收至少覆盖：一个核心包、一个已加载扩展包、一个未加载包；确认第三者不会在未加载包的情况下出现在超级图鉴。

## 9. 明确不做

- 不读取包库中未加载的普通态 / 编辑态数据包。
- 不自动加载、启用、Apply、重载或切换 Runtime 数据包。
- 不将超级图鉴变成 JSON 编辑器、Datapack 导出器或通用编辑器。
- 不修改 `PlayerState`、Registry 原对象、存档结构或 Runtime 写入口。
- 不进入 `tools/datapack-editor/`。
- 不把未可靠证明的来源、版本、覆盖关系或引用目标写成事实。
- 不为缺少语义渲染器的 Def 删除字段；使用通用字段树兜底。
- 不在本 Task 内开放新的 Def 字段编辑、Apply 事务或删除迁移。

## 10. 当前核验（2026-09-19）

- 已读取：`docs/docs-828/00-INDEX.md`、`docs/docs-828/02-modules/runtime-editor.md`、`docs/docs-828/02-modules/ui.md`、`docs/docs-828/03-data-structures/registry.md`、`docs/docs-828/03-data-structures/declarative-dsl.md`、`docs/docs-828/05-conventions/architecture-discipline.md`、`docs/docs-828/05-conventions/doc-maintenance.md`、`docs/ai/PROJECT-CONSTITUTION.md`、`docs/ai/task-read-set-routing.md`。
- 已核对：`src/ui/runtime-editor/` 当前浏览器、`PackCatalogReadModel`、`ContentCatalogQueryPort`、Registry 内容表和既有 tooltip / codex 组件。
- 已完成：`RuntimeContentBrowserQueryPort`、Registry 有效内容目录、AffectorPack / TriggerDef 规则目录、Def 安全快照、引用诊断、Codex 三栏壳、Inspector 三页签、RuntimeEditor Launcher / Panel / UI 状态接线。
- 已确认：超级图鉴无 `packRecordId` 也可打开；只读取当前 Runtime/Registry/规则引擎有效内容，不读取 PackCatalog / PackManager / 编辑态 Draft，不提供加载、启用、Apply 或状态写入入口。
- 自动化核验：`npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs`、`npm run build`、`npm test` 均通过；最终全量测试为 187 个文件、1695 个测试。
- 新增专项覆盖：Registry loaded-only / 有效覆盖 / singleton / rules / missing / ambiguous / 安全克隆 / 查询缓存；Codex 壳筛选与响应式状态；Inspector 详情、关系跳转、原始字段树、复制 JSON；RuntimeEditor 无编辑态入口与交互集成。
- 来源没有可靠 owner 时明确归入“Runtime 有效配置 / 来源未知”，不把 namespace 猜作 Mod 来源；引用跳转只在当前 Query 视图可解析时提供目标。
- AOCI Maintain 已在最终稳定状态调用一次，但因仓库既有大量 missing / stale / unbaselined Code drift（包括其他并行 Task 与本 Task 文档）返回 `stopped / blocked`；未手工修改 AOCI 资产。
- 当前工作树存在大量既有并行修改；本 Task 未清理、回滚或覆盖这些修改。

## 11. 剩余工作

- [x] `lead-contract` 产出 Contract v1 和 Registry 查询测试。
- [x] `runtime-catalog` 完成有效 Registry 全量内容台账与查询实现。
- [x] `codex-shell` 完成三栏只读壳与局部状态模型。
- [x] `codex-inspector` 完成通用字段树、关系和语义详情组件。
- [x] `integration-qa` 完成 RuntimeEditor 入口、刷新边界和集成测试。
- [x] `review-qa` 完成最终只读边界、无副作用与可访问性静态复核；复核提出的规则覆盖、来源未知态、引用跳转、ARIA 与查询缓存缺口已修复。
- [x] 最终执行 AOCI Maintain；结果为受既有仓库漂移阻断，未写入 AOCI 语义资产；其余 docs/build/test/check 命令已完成。

## 相关路由

[[docs/docs-828/00-INDEX]] · [[docs/docs-828/01-architecture/data-flow]] · [[docs/docs-828/02-modules/runtime-editor]] · [[docs/docs-828/02-modules/registry]] · [[docs/docs-828/02-modules/ui]] · [[docs/docs-828/03-data-structures/registry]] · [[docs/docs-828/03-data-structures/declarative-dsl]] · [[docs/docs-828/05-conventions/architecture-discipline]] · [[docs/docs-828/05-conventions/testing]] · [[docs/docs-828/05-conventions/doc-maintenance]] · [[docs/ai/PROJECT-CONSTITUTION]] · [[docs/ai/task-read-set-routing]] · [[task-0098-runtime-editor-workspace-decoupling-and-light-theme]] · [[task-0120-def-editor-design-masterplan]]
