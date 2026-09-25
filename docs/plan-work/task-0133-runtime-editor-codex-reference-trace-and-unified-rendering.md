# Runtime Editor 超级图鉴关系追踪与统一渲染

状态：active — 2026-09-20 开始执行

## 当前进展

- 已完成概览关系按目标聚合；同一目标的多条引用路径仍可展开查看。
- 已保留向外 / 反向、已声明 / 推断、路径和状态的机器可读属性。
- 已复用现有统一检查器、关系跳转和查看栈，没有增加 Init 或 `addition-test` 专属渲染分支。
- 已补充聚合与路径保留测试；详情、Runtime Query、Codex Shell 和集成测试通过。
- 已使用真实 `addition-test` 数据包完成端到端观测断言；关系跳转的 DOM 身份保持由现有集成测试覆盖。

## 目标

在既有 Runtime Editor 超级图鉴与 Def 检查器基础上，收敛“相关组分”的引用呈现：

- 让 Agent 和人都能判断一条关系来自哪个字段路径、是正向还是反向、是显式声明还是推断；
- 对相同目标进行概览级聚合，但保留所有真实引用路径；
- 让 Init、Area、Spot、Story、Resource、Enhancement 及其他可浏览 Def 使用同一套关系数据、渲染器和跳转逻辑；
- 保留紧凑布局、查看栈和局部 DOM 刷新边界，不引入大段说明、关系图或统计面板。

## 观测样本与当前事实

固定使用 `addition-test:init:observatory` 作为跨包引用验收样本。它用于验证外部数据包追加世界线、区域和跨包引用，不是生产内容特例。

| 观测字段 | 期望内容 |
| --- | --- |
| 类型 | Init / `inits` |
| 完整 ID | `addition-test:init:observatory` |
| 来源 | `addition-test` |
| ID 命名空间 | `addition-test` |
| 容器形态 | `map` |
| 起始剧情 | `addition-test:story:welcome` |
| 默认 Area | `addition-test:area:observatory` |
| 揭示条件 | `base:resource:pyroxene >= 1` |

当前关系扫描会产生以下类型的查询：

| 来源路径 | 方向 | 目标 | 关系性质 |
| --- | --- | --- | --- |
| `$.defaultAreas[0]` | Init → Area | `addition-test:area:observatory` | 已声明 |
| `$.startStoryId` | Init → Story | `addition-test:story:welcome` | 已声明 |
| `$.purchaseCost[0].resourceId` | Init → Resource | `base:resource:pyroxene` | 已声明 |
| `$.revealTriggers[0].condition.conditions[0].key` | Init → Resource | `base:resource:pyroxene` | 推断 |
| Area 的 `$.initId` | Area → Init | `addition-test:init:observatory` | 反向引用 |
| ActiveStory / PassiveStory 的 `$.availableInits[0]` | Story → Init | `addition-test:init:observatory` | 反向引用 |
| Enhancement attachment 的 `$.initId` | Enhancement → Init | `addition-test:init:observatory` | 反向引用 |

因此，同一资源出现两次表示两个真实字段路径；同一 Init 出现多次表示多个 Def 反向引用。概览目前直接拼接正向和反向引用，隐藏了路径，造成了“重复内容”的观感。

## 现有实现边界

- [runtime-content-browser.ts](../../src/data-services/registry/runtime-content-browser.ts) 发现 Registry / Runtime 来源，建立全量 Def 快照、正向诊断和反向索引。
- [view.ts](../../src/ui/runtime-editor/view.ts) 将运行时详情适配为检查器 ViewModel。
- [render.ts](../../src/ui/runtime-editor/codex-details/render.ts) 在概览区合并 `references` 与 `reverseReferences`，当前最多显示 8 项，未按目标聚合。
- `CodexShellState` 已有 `backStack` 与 `forwardStack`；本 Task 复用它，不重新设计导航状态。

## 方案

### 1. 统一关系模型

在 UI 适配层固定一套关系项语义，至少保留：

- `sourceEntryKey` / `targetEntryKey`；
- `direction`：`outbound` 或 `inbound`；
- `path`：原始 Def 内的 JSON 路径；
- `relation`：字段语义标签；
- `status`：`resolved`、`missing`、`ambiguous`；
- `confidence`：`declared` 或 `inferred`。

Runtime Query 继续负责事实发现和索引，UI 不自行重新扫描原始对象，也不针对 Init 编写特殊查询分支。

### 2. 概览聚合，关系页保留完整路径

概览区将相同目标聚合为一个紧凑单元：

```text
青辉石（测试包） · resourceDisplays
2 条引用路径
```

展开后列出：

```text
$.purchaseCost[0].resourceId · 已声明
$.revealTriggers[0].condition.conditions[0].key · 推断
```

关系页继续按“向外引用 / 反向引用”显示完整列表，不丢弃不同来源路径，也不以字符串去重替代关系身份。

### 3. 统一快捷入口与查看栈

- 任何 `resolved` 关系项均使用统一的 Codex entry key 跳转。
- `missing` / `ambiguous` 关系保留只读诊断，不伪造可点击目标。
- 点击关系目标进入详情时复用现有 `open-entry`、后退和前进逻辑。
- Init、Area、Spot、Story、Resource、Enhancement 等类型不拥有各自的跳转实现。

### 4. 统一前端渲染与内容逻辑

所有可浏览 Def 统一使用：

- 同一个 `DefinitionInspectorViewModel` 适配边界；
- 同一个概览、关系、原始数据页签渲染器；
- 同一个引用目标按钮、状态标签和查看栈行为；
- 同一个名称、ID、来源、命名空间和关系路径显示规则；
- 同一套 escaping、缺失 / 歧义状态和可访问性属性。

不得为 `addition-test`、Init 或某个关系类型增加专属 HTML 模板。样本只用于验收跨包行为。

## DOM 刷新边界

任务实现必须明确并测试以下刷新范围：

| 行为 | 允许刷新范围 | 禁止刷新范围 |
| --- | --- | --- |
| 搜索 Def | 条目列表、类型筛选结果及其计数 | Mod 列、详情内容、整个 Codex 壳层 |
| 切换 Mod / 类型 | 条目列表与必要筛选状态 | 已加载 Mod 列、详情页签结构 |
| 选择条目 | 详情标题、详情导航、`[data-codex-detail-slot]` | Mod 列、条目列表 |
| 点击相关组分 | 当前详情标题、查看栈按钮、`[data-codex-detail-slot]` | 三栏外壳、其他列表 |
| 展开引用路径 | 当前相关组分聚合项内部 | 整个详情页、条目列表 |
| 后退 / 前进 | 当前详情标题和详情内容 | Mod 列、条目列表、筛选状态 |
| Runtime 有效内容重建 | 允许重建 Codex 快照及受影响区域 | 不得波及其他 Workspace |

不得通过重新设置整个 Codex 容器的 `innerHTML` 来完成关系跳转、查看栈或聚合展开。若现有刷新入口尚未支持上述边界，应先补充局部详情刷新入口，再接入关系功能。

## 内容与视觉约束

- 不增加长篇“关系解释”、教程型描述或重复字段说明；路径、方向、关系标签和状态是主要信息。
- 不增加独立统计卡片、关系数量仪表盘或额外统计服务；“2 条引用路径”只作为当前聚合项的必要提示。
- 不制作全屏关系图、超宽表格、巨大 JSON 预览或固定大高度面板。
- 聚合项使用轻量展开，不默认展开所有路径。
- 保持关系项可点击、键盘可达、状态语义清晰，并复用现有尺寸和样式变量。

## 实施阶段

### P0：关系事实与样本测试

- 确认 Runtime Query 输出路径、方向、状态和置信度完整可用。
- 为 `addition-test:init:observatory` 固定正向与反向引用断言。
- 增加同目标多路径样本，验证资源两条路径不会被错误合并为一条事实。

### P1：统一 ViewModel 与概览聚合

- 在适配层形成统一关系项和聚合项。
- 概览按目标聚合，展开后显示全部路径。
- 关系页继续显示未聚合的完整方向列表。
- 为每个关系节点输出稳定的 `data-*` 诊断属性。

### P2：局部导航与刷新收敛

- 让关系点击、前进、后退只刷新详情区域。
- 保留现有查看栈语义，清理失效 entry 时同步裁剪栈。
- 增加 DOM 刷新范围测试或可观测标记，证明 Mod / 条目列表不会随详情跳转重建。

### P3：统一验收

- 使用基础包、`addition-test` 和至少一个缺失引用 / 歧义引用样本验收。
- 检查所有 Def 类型是否使用同一渲染入口。
- 检查窄屏、键盘导航、路径展开和查看栈。
- 运行针对性的 UI / Runtime Query 测试，以及必要的 `npm run check:docs`。

## 验收标准

- `addition-test:init:observatory` 能显示来源、命名空间、默认 Area、起始剧情和揭示条件。
- `base:resource:pyroxene` 在概览中按一个目标聚合，同时保留购买成本和揭示条件两条路径。
- `addition-test:init:observatory` 的 Area、Story、Enhancement 反向引用均可追溯到来源路径。
- 所有已解析关系均可进入目标详情，后退 / 前进可恢复原查看顺序。
- 缺失和歧义关系不可误点入不存在的 Def。
- 详情跳转不刷新 Mod 列和条目列表；搜索筛选不刷新详情主体。
- 不新增专属 Init / addition-test 渲染器，不新增不必要的描述文本、统计服务或大型前端元素。
- 相关测试覆盖数据事实、ViewModel 聚合、统一渲染、导航和 DOM 刷新边界。

## 不在本 Task 范围内

- 修改 Registry 的业务关系语义或引用校验规则。
- 消除 `name` / `description` 与 `presentation.default` 的数据字段兼容重复。
- 引入新的图数据库、统计服务、全局搜索后端或关系图可视化。
- 修改 Init / Area / Spot 的编辑能力、Apply 流程或数据包写入协议。
- 修改跨包引用的运行时行为；本 Task 只改善观察、诊断和导航。
