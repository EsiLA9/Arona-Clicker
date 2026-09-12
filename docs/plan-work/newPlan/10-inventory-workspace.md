# 方案草案：背包三栏 Workspace 与物品整理服务

状态：🟡 首版已实施，待体验评审

> 本文回答：背包如何从当前右栏轻量列表演进为可筛选、可排序、可查看详情的三栏 Workspace；筛选、排序与自定义顺序如何与游戏状态隔离。

## 立项基线

- 当前背包位于普通游戏 Workspace 的 `rightTab = other`，由 `src/ui/components/right-panels.ts` 渲染。
- 物品数量来自只读 `GameView.inventory`；物品定义来自 `GameReadModel.registry.items`，当前已有 `type`、`rarity`、`maxStack`、`useEffects`、`sellPrice` 等字段。
- 使用物品已有 `GameCommands.useItem(itemId)` → `ItemService.useItem()` → `StateMutationService` 的写入链路。
- `PlayerState.inventory` 属于当前 Init 数据，并随 Init 快照保存；筛选、排序、选中项属于 UI 偏好，不应写入 `PlayerState`。
- Task-0043 已提供顶栏背包入口与游戏右栏 `other` 紧凑投影。本方案补充独立的完整背包服务，不改写该任务的已完成记录。

## 目标

1. 提供稳定的三栏背包 Workspace：左栏筛选，中栏整理与浏览，右栏详情与操作。
2. 支持按物品种类筛选，并为稀有度、可用性和关键词提供可组合筛选。
3. 支持预设排序与真正的自定义排序；自定义顺序可通过拖动和键盘操作调整。
4. 保留现有使用物品能力，不新增 UI 直接写状态的路径。
5. 物品定义、数量变化、效果描述与 UI 排序逻辑分层，避免把展示逻辑塞进 `PlayerState` 或 `ItemService`。

## 设计结论

### 推荐路由

背包分为两种表现：

| 表现 | 用途 | 路由 |
| --- | --- | --- |
| 紧凑投影 | 游戏中快速查看、使用物品和效果追踪 | `game` Workspace + `rightTab = other`；保留“打开完整背包”入口 |
| 完整服务 | 筛选、排序、自定义顺序、详情管理 | 独立 `inventory` Workspace；顶栏背包直接进入，紧凑投影也可进入 |

两者并行保留：顶栏背包负责直达完整管理界面，游戏右栏继续提供不打断当前游玩的紧凑投影；紧凑投影可通过“打开完整背包”进入完整服务。

### 三栏职责

| 栏位 | 稳定 Host ID | 主要职责 | 不承担的职责 |
| --- | --- | --- | --- |
| 左栏 navigation | `leftPanel.service.inventory.navigation` | 种类、稀有度、可用性、关键词筛选；数量统计；清除筛选 | 不改变物品数量，不执行使用/出售 |
| 中栏 primary | `centerPanel.service.inventory.main` | 当前结果列表、排序工具条、自定义拖动排序、空状态 | 不渲染长篇详情，不直接调用领域写入口 |
| 右栏 inspector | `rightPanel.service.inventory.inspector` | 选中物品详情、持有量、效果、使用条件、操作按钮、效果追踪 | 不维护第二份物品定义或第二套排序状态 |

三栏均由既有 `renderWorkspaceFrame()` 产出，并通过 `renderUIHost()` 接入主题表现；不新建背包专用页面骨架。

## 筛选服务

### 第一版筛选维度

筛选采用 AND 组合；同一维度内部为单选，种类和稀有度的“全部”表示不限制该维度。

| 维度 | 值 | 说明 |
| --- | --- | --- |
| 种类 | 全部 / 消耗品 / 材料 / 关键道具 | 直接复用 `ItemDef.type`，不新增枚举 |
| 稀有度 | 全部 / 普通 / 稀有 / 史诗 / 传说 | 直接复用 `ItemDef.rarity` |
| 使用状态 | 全部 / 可使用 / 当前不可使用 | 消耗品、持有数量和 `useCondition` 的只读评估结果共同决定 |
| 持有状态 | 仅已持有 / 显示未持有 | 默认仅显示 `view.inventory` 中数量大于 0 的物品；“显示未持有”作为后续开关 |
| 关键词 | 名称 / ID 模糊搜索 | 以 `ItemDef.name` 为主，ID 作为辅助匹配；不做网络搜索 |

第一版不加入“来源”“最近获得”“套装”等筛选，因为当前 `ItemDef` 和 `PlayerState` 没有稳定的获取来源或时间事实。需要这些维度时，先补领域契约和事件事实，再扩展 UI。

左栏应展示各类当前数量，数量口径固定为“符合持有状态的物品种类数”，避免用户把物品种类数误解为总件数；中栏另显示总件数与当前结果件数。

## 排序服务

### 预设排序

中栏工具条提供以下排序方式：

| 排序 | 默认方向 | 口径 |
| --- | --- | --- |
| 自定义 | 用户最近一次方向 | 使用 `customOrder`，未排序物品按稳定兜底规则追加 |
| 名称 | 升序 | 中文名称比较；同名按完整 Item ID |
| 种类 | 类型定义顺序 | 消耗品 → 材料 → 关键道具；同类再按名称 |
| 稀有度 | 降序 | 传说 → 史诗 → 稀有 → 普通；同稀有度再按名称 |
| 持有数量 | 降序 | 数量相同再按名称 |
| 堆叠占用 | 降序 | `count / maxStack`；无穷堆叠按 0 处理 |

所有预设排序都必须有确定性的最终 tie-breaker：名称 → Item ID。过滤、重渲染、数量刷新不能导致同一排序模式下的条目随机跳动。

### 自定义排序

- `customOrder` 只保存 Item ID 顺序，不复制 ItemDef 或数量。
- 中栏每个条目提供拖动手柄；同时提供“上移 / 下移”键盘操作，保证不依赖拖动才能完成排序。
- 自定义排序作用于完整物品集合；筛选后只显示其中匹配的条目，不能因为筛选而重排未显示条目。
- 新获得的物品若不在 `customOrder`，追加到末尾；首次切换到自定义排序时按当前稳定默认顺序初始化。
- 物品定义被移除、不可见或数量变为 0 时不删除用户顺序；重新出现时恢复原位置，避免 UI 偏好丢失。
- “恢复默认排序”只清空 UI 自定义顺序，不触碰物品数量和存档。

### 状态归属

第一版将以下字段放在临时 `PanelState` 的 `inventoryWorkspace` 中：

```ts
interface InventoryWorkspaceState {
  type: 'inventory';
  typeFilter: 'all' | ItemDef['type'];
  rarityFilter: 'all' | ItemDef['rarity'];
  usabilityFilter: 'all' | 'usable' | 'unusable';
  ownedOnly: boolean;
  query: string;
  sortMode: 'custom' | 'name' | 'type' | 'rarity' | 'count' | 'stack';
  sortDirection: 'asc' | 'desc';
  customOrder: string[];
  selectedItemId: string | null;
}
```

这组字段不进入 `PlayerState`、InitSnapshot 或存档。若未来需要跨浏览器会话保存，只新增独立的 UI preference store，不把排序偏好混入游戏存档，也不为此编写存档迁移。

## 三栏内容草图

```text
┌────────────────┬──────────────────────────────┬──────────────────┐
│ 背包 / 筛选     │ 物品列表                      │ 物品详情          │
│                │ 搜索  排序 方向  自定义排序    │                  │
│ [全部]         │ ┌ 物品卡 ────────────────┐    │ 物品名 / 稀有度   │
│ [消耗品]       │ │ 图标 名称 类型 数量 使用 │    │ 描述              │
│ [材料]         │ └───────────────────────┘    │ 类型 / 持有 / 堆叠│
│ [关键道具]     │ …                             │ 使用效果 / 条件   │
│ 稀有度         │ 空状态 / 无匹配提示            │ [使用]            │
│ 使用状态       │                               │ 效果追踪          │
│ 清除筛选       │                               │                  │
└────────────────┴──────────────────────────────┴──────────────────┘
```

### 左栏：筛选与导航

- 顶部显示“背包”和当前结果概览。
- 种类筛选是第一组、最醒目的入口；每项显示物品种类数。
- 稀有度和使用状态使用折叠分组，避免小屏高度被筛选项占满。
- 关键词输入和“清除全部筛选”固定在左栏顶部或底部，不随结果滚动消失。
- 如果启用“显示未持有”，左栏必须显式显示该状态，避免用户误以为获得了 0 件物品。

### 中栏：整理与浏览

- 工具条显示当前筛选摘要、匹配种类数/总件数、排序模式和方向。
- 默认使用列表布局，优先保证名称、类型、稀有度、数量和操作可扫描；网格布局列为后续体验项。
- 选中条目使用 `aria-selected` 和稳定 `data-inventory-item` 标识；点击条目只改变选中项，不执行使用。
- 消耗品显示“使用”按钮；材料和关键道具不显示伪造的使用按钮。
- 数量更新后保留当前筛选、排序和选中项；选中物品归零时转选当前结果第一项，并在右栏提示已耗尽。

### 右栏：详情与操作

- 复用现有 `renderItemDetail()` 的事实口径：名称、描述、类型、稀有度、持有量、最大堆叠、售价和使用效果。
- 第一版只提供已有领域命令支持的“使用”；`sellPrice` 只展示，不凭 UI 推断出售功能。
- 不可使用的物品显示不可用原因：类型不支持、未持有或条件未满足；原因文案与 `UseItemResult` 对齐。
- 保留现有“效果追踪”信息，但明确它是全局运行时追踪，不是某个物品的持有数量。
- 无选中项时显示引导；筛选后无结果时显示“调整筛选”而不是空白面板。

## 交互与边界

### 只读与写入边界

| 操作 | 处理层 | 是否改变游戏状态 |
| --- | --- | --- |
| 切换种类/稀有度/可用性 | controller 更新 `PanelState` | 否 |
| 搜索、排序、拖动顺序 | controller 更新 `PanelState` | 否 |
| 查看详情 | 组件读取 `GameView` / Registry | 否 |
| 使用物品 | controller 调 `commands.useItem()` | 是，经 `StateMutationService` |
| 出售/丢弃 | 本方案暂不提供 | 不新增写入口 |

### 数量与定义异常

- `view.inventory` 中存在但 Registry 没有定义的 ID 时，仍显示“未知物品”条目和原始 ID；该条目不可使用，并在详情中提示定义缺失。
- 数量小于等于 0 的条目不显示在默认“仅已持有”列表中，但其 `customOrder` 位置保留。
- `maxStack` 为 0 或异常值时，详情显示原始值并避免计算堆叠占用百分比；不在 UI 层修正领域数据。
- 过滤条件指向当前已不可见的实体时，按“无匹配”处理，不绕过 Reveal 规则自行展示秘密信息。

## 施工切片

### P0：查询模型与状态边界

- 新增纯函数模块，将 `view.inventory` 与 Registry ItemDef 合成为排序/过滤所需的 `InventoryRow`。
- 明确过滤、排序、tie-breaker、未知物品和 0 数量口径。
- 在 `PanelState` 增加临时 `inventoryWorkspace`，不改 `PlayerState`、InitSnapshot 或存档结构。

### P1：三栏 Workspace 骨架

- 新增 `src/ui/components/inventory-workspace.ts`。
- 通过 `renderWorkspaceFrame()` 输出三栏，并注册 settings 同等级的 inventory Host。
- `renderAppShell()` 增加 inventory Workspace 路由，但保留当前 `rightTab = other` 紧凑投影。

### P2：筛选与排序 UI

- 左栏接入种类、稀有度、可用性、持有状态和关键词筛选。
- 中栏接入预设排序、方向切换、结果统计和稳定选中态。
- 补齐无结果、未知物品和数量归零的状态文案。

### P3：自定义排序与操作

- 实现拖动排序和键盘上移/下移；更新仅写 `PanelState.inventoryWorkspace.customOrder`。
- 右栏接入详情、使用按钮和条件失败反馈；复用现有 Item tooltip/错误文案。
- 在紧凑 `other` 面板增加“打开完整背包”入口，并确保返回后筛选/排序上下文按产品决定保留或重置。

### P4：路由与视觉收敛

- 验证普通游戏、Lobby、服务页、角色 Workspace、商店 Workspace 之间切换时不泄露背包临时状态。
- 接入统一 Workspace Host、主题继承与响应式三栏规则。
- 顶栏背包已按体验要求改为直达完整 `inventory` Workspace；普通游戏右栏仍保留紧凑投影。

## 测试与验收

### 自动化测试

- `inventory-view` 纯函数测试：种类/稀有度/可用性/关键词组合筛选、预设排序、方向、tie-breaker、未知 ID 和 0 数量。
- Workspace 渲染测试：`data-workspace-frame="inventory"`、三栏 role、三个稳定 Host、中心结果和右栏空状态。
- 交互测试：筛选不改 `PlayerState`；排序和拖动只改 `PanelState`；使用物品仍走 `commands.useItem()`。
- 回归测试：现有 `rightPanel.other` 紧凑背包、顶栏背包路由、角色/商店 Workspace 不回归。
- 类型检查、架构检查、全量 vitest 与构建按项目规范执行。

### 人工验收

1. 桌面宽度下三栏职责清晰，左筛选、中整理、右详情；主题 Host 表现一致。
2. 选择“消耗品”后只显示消耗品，再叠加稀有度和关键词时结果正确。
3. 切换名称/数量/稀有度排序后，重复刷新和数量变化不会随机改变顺序。
4. 自定义拖动与键盘上移/下移都能改变顺序；切换筛选不会破坏未显示条目的顺序。
5. 使用消耗品后数量、详情和效果追踪同步更新；失败原因可见且不会扣除物品。
6. 空背包、无匹配、未知物品、不可使用物品和小屏布局均有明确状态。
7. 从紧凑背包进入完整 Workspace，再返回游戏时不改变游戏领域状态。

## 当前核验（2026-09-11）

- 已完成 P0–P3：查询模型、临时 UI 状态、三栏 Workspace、种类/稀有度/可用性/关键词筛选、预设排序、自定义顺序、键盘上移/下移、物品详情与使用操作。
- 顶部三块 Tab 使用与 Shop 相同的 `panel-tabs-region` / `--panel-tabs-control-height` 齐平规则；已完成真实页面视觉冒烟验收。
- `npx vitest run tests/ui/inventory-view.test.ts tests/ui/inventory-workspace.test.ts tests/ui/topbar-settings-workspace.test.ts tests/ui/service-workspace.test.ts tests/ui/workspace-frame.test.ts --reporter=dot`：5 个文件、22 个测试通过。
- `npx tsc --noEmit`：通过。
- `npm run check:architecture`：通过。
- `npm test -- --reporter=dot`：137 个测试文件、1264 个测试通过。
- `npx vite build --outDir <临时目录>`：通过；未写入受保护的 `web-dist/`。

## 首版剩余工作

- 跨浏览器会话保存自定义顺序、出售/丢弃、获取来源与标签筛选暂不实现，分别等待 UI preference、交易边界和内容契约裁定。

## 待评审问题

1. 是否接受“顶栏直达完整背包、游戏右栏保留紧凑投影”的双入口路由？当前实现按此方案执行。
2. 自定义顺序是否需要跨浏览器会话保存？建议第一版只保留在 `PanelState`，后续若需要再设计独立 UI preference store。
3. 是否显示未持有但已揭示的物品？建议第一版默认隐藏，仅在筛选区提供后续开关。
4. 是否现在加入出售/丢弃？建议暂缓；虽然 `ItemDef.sellPrice` 已存在，但当前没有出售命令和交易原子性边界。
5. 是否需要标签筛选？建议先使用现有三种 `ItemDef.type`，待内容规模证明类型不足后再设计 `tags` 字段及 Schema 同步。

## 相关路由

- [[docs/docs-828/02-modules/ui]]
- [[docs/docs-828/01-architecture/state-layers]]
- [[docs/docs-828/05-conventions/architecture-discipline]]
- [[docs/plan-work/active/task-0043-topbar-settings-workspace]]
- [[docs/plan-work/active/task-0040-unified-workspace-frame]]
- `src/ui/components/right-panels.ts`
- `src/data-services/contracts/item.ts`
