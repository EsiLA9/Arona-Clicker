# Task 0040：统一三栏工作区物理骨架与表现接线

状态：🟡 施工中（F0-F4 已完成；F5-F7 的 Contacts / Story 相关部分由 Task-0047 优先收口，其余通用 Router / 视觉 / Host 清理仍待后续）

> 本任务统一游戏主界面、服务工作区与 Spot 商店重复使用的三栏物理布局。统一范围是 WorkspaceFrame、WorkspaceColumn、布局 Token、滚动/响应式原语和表现接线；业务状态、业务语义和各工作区 Presenter 保持独立。
>
> 本文吸收 2026-09-10 SOL 复核意见。当前实现与机制边界以源码和 [[docs/docs-828/00-INDEX]] 为准；本任务不改变 PlayerState、Datapack 机制或商店交易边界。

## 一、背景与调查结论

当前系统有三种实际使用三栏布局的主体：

| 工作区 | 左栏 | 中栏 | 右栏 | 当前入口 |
| --- | --- | --- | --- | --- |
| 游戏主界面 | 区域 / 通讯录 / 故事 | 聊天 / 日志 | 设施 / 学生 / 强化 | `renderLeftPanel`、`renderCenterPanel`、`renderRightPanel` |
| 服务工作区 | 服务导航 | 服务主内容 | 检查器 | `renderServiceWorkspace` |
| Spot 商店 | 店内消息 | 商品目录 | 持有与结算 | `renderShopWorkspace` |

三者共享相同的空间位置，却分别实现了：

- `.workspace`、`.service-workspace`、`.shop-workspace` 三套外层布局；
- 不同的列宽、滚动和窄屏策略；
- 主界面和商店手写 `data-theme-*`、`renderBackground()`；
- 服务工作区使用 `renderUIHost()`；
- 不同的 panel、service-column、panel-body 内容结构；
- `state.service` 与 `state.workspace` 两套互斥工作区入口。

当前主要证据：

- `src/ui/components/app-shell.ts` 在 `game / service / shop` 路径间直接分流；
- `src/ui/css/layout.css` 分别定义 `.workspace`、`.service-workspace` 和 `.shop-workspace`；
- `src/ui/components/service-workspace.ts` 已通过 `renderUIHost()` 接入表现宿主；
- `src/ui/components/shop.ts` 仍保留独立 `panel()`，重复生成主题元数据和背景层；
- `UIHostRegistry` 尚未正式登记商店工作区 Host；
- 服务工作区当前把导航、主内容和检查器都置于 `centerPanel.*` 命名下，物理列语义不准确。

## 二、最终设计裁定

### 2.1 四层边界

```text
AppShell
└── WorkspaceRouter       决定当前显示 game / service / shop
    └── WorkspaceFrame    只负责三栏物理布局
        ├── WorkspaceColumn(left)
        ├── WorkspaceColumn(center)
        └── WorkspaceColumn(right)
```

业务依赖方向固定为：

```text
Game Presenter ─────┐
Service Presenter ──┼→ WorkspaceFrame → WorkspaceColumn → renderUIHost
Shop Presenter ────┘
```

`WorkspaceFrame` 不得理解商店、数据包、聊天、学生或检查器；`WorkspaceColumn` 不得理解购物车、资源、剧情或 PlayerState。

### 2.2 WorkspaceColumn 契约

列只表达物理位置和容器能力：

```ts
type WorkspaceSlot = 'left' | 'center' | 'right';

interface WorkspaceColumnSpec {
  slot: WorkspaceSlot;
  hostId: string;
  themeScope?: string;
  className?: string;
  visible?: boolean;
  scroll?: 'auto' | 'content' | 'none';
  header?: string;
  content: string;
}
```

`header` 只是可选结构插槽，不强制所有工作区使用 Tabs。游戏可以放 Tabs，服务可以放标题，商店可以放返回按钮或商店名。

### 2.3 WorkspaceFrame 契约

```ts
interface WorkspaceFrameSpec {
  id: string;
  left: WorkspaceColumnSpec;
  center: WorkspaceColumnSpec;
  right: WorkspaceColumnSpec;
  layout?: WorkspaceLayoutSpec;
}

interface WorkspaceLayoutSpec {
  preset?: 'default' | 'center-heavy';
}
```

`role: navigation | primary | inspector | feed | catalog` 不进入 Frame API。它们是业务语义，由业务 class、data attribute 或内部内容表达，Frame 不消费这些值。

`preset` 只对应几何 Token，不对应业务类型。不得扩展为 `shop`、`battle`、`editor` 等业务枚举。

### 2.4 统一渲染出口

业务 Renderer 构造三列内容，统一经过：

```text
renderWorkspaceFrame(ctx, spec)
  → renderWorkspaceColumn(ctx, column)
    → renderUIHost(ctx, options)
      → PresentationService
```

`renderWorkspaceColumn()` 负责：

- 统一宿主元数据；
- Host 背景和文字模式接线；
- `header / body` 结构；
- 列级 class 和 data attribute；
- overflow、visible/collapsed 和响应式所需的结构原语。

`renderUIHost()` 继续只负责表现层，不承载布局策略。

## 三、Host 命名与继承策略

### 3.1 保留物理列作为第一层命名空间

不采用新的 `workspace.*` 根命名空间。当前表现系统已有：

```text
leftPanel
centerPanel
rightPanel
```

`PresentationView` 已支持按父 Host 回退，因此物理列应继续作为稳定继承根。

新工作区 Host 采用“物理列 + 业务限定”：

```text
leftPanel.shop.feed
centerPanel.shop.catalog
rightPanel.shop.settlement

leftPanel.service.datapack.navigation
centerPanel.service.datapack.main
rightPanel.service.datapack.inspector
```

游戏现有 Host 保持：

```text
leftPanel.area
centerPanel.chat
rightPanel.spot
```

### 3.2 迁移原则

- 不立即重命名已有 `leftPanel.*`、`centerPanel.*`、`rightPanel.*`；
- 不用 `workspace.*` 替代现有 Host；
- 服务现有 `centerPanel.datapack.*` 等 ID 先作为兼容路径保留；
- 新增工作区目标不得把左侧导航、右侧检查器挂在错误的物理列下；
- Host Registry 的正式清理放在 Frame 迁移完成后；
- 旧 Host 删除前必须完成运行时、主题编辑器、预览和测试的联合核验。

## 四、状态边界

### 4.1 不新增 WorkspaceFrameState

本任务不引入通用的：

- `WorkspaceFrameState`；
- `activeColumn`；
- `navigationStack`；
- 包含所有业务字段的超级 `WorkspaceState`。

Frame 是渲染和布局契约，不是业务状态仓库。

### 4.2 后置统一 WorkspaceRoute

当前 `PanelState` 同时拥有 `service` 和 `workspace`，存在组合非法状态。待 Frame 完成并稳定后，再将路由收敛为判别联合：

```ts
type WorkspaceRoute =
  | { type: 'game' }
  | { type: 'service'; service: ServiceWorkspaceId }
  | { type: 'shop'; shopId: string; spotId: string };
```

该改造属于 Router 阶段，不与第一阶段的布局壳抽取同时进行。

### 4.3 Presenter 负责一次派生 View

各业务工作区维持独立状态和 ViewModel：

```text
业务 State
  ↓
buildXXXWorkspaceView()
  ↓
WorkspaceViewModel
  ↓
left / center / right render
```

尤其是 Shop，价格、库存、余额、购物车和结算状态必须在一次 View 派生中确定；这属于 `ShopWorkspacePresenter` 职责，不属于 Frame。

## 五、布局与响应式策略

### 5.1 桌面布局 Token

统一外层 CSS：

```css
.workspace-frame {
  display: grid;
  grid-template-columns:
    var(--workspace-left-width, 230px)
    var(--workspace-center-width, minmax(0, 1fr))
    var(--workspace-right-width, 300px);
  gap: var(--workspace-gap, 14px);
  min-height: 0;
  overflow: hidden;
}

.workspace-frame[data-layout='center-heavy'] {
  --workspace-left-width: minmax(170px, .8fr);
  --workspace-center-width: minmax(300px, 1.6fr);
  --workspace-right-width: minmax(220px, 1fr);
}
```

业务内部 CSS 继续保留，例如 `.shop-workspace__catalog`、`.service-main` 和聊天内容样式；本任务只清理外层三栏几何重复。

### 5.2 响应式规则

统一断点、slot placement、collapse 和 overlay 原语，但允许工作区选择不同 profile：

```text
service：导航抽屉 → 主内容 → 检查器详情
shop：商品目录 → 底部结算；店内消息可折叠
game：保留主要内容，左右栏按优先级折叠
```

不得要求所有工作区在移动端呈现完全相同的 UI。

## 六、施工阶段

### F0：契约与基线确认

- [x] 建立 `WorkspaceColumnSpec`、`WorkspaceFrameSpec` 和布局 Token 的最终类型；
- [x] 确认 `renderUIHost()` 当前行为不被改变；
- [ ] 为三种工作区绘制现有 DOM / Host / CSS 对照表；
- [ ] 确认当前工作树已有变更不被本任务覆盖；
- [x] 增加 Frame 级纯函数测试边界。

### F1：抽取 WorkspaceFrame / WorkspaceColumn

- [x] 新增统一 Frame Renderer；
- [x] 新增统一 Column Renderer；
- [x] Column 内部调用 `renderUIHost()`；
- [x] 支持可选 header、content、scroll、visible 和 layout preset；
- [x] 不接入业务状态，不修改 Router；
- [ ] 先保留旧 class 作为业务样式兼容入口。

### F2：迁移服务工作区

- [x] `renderServiceWorkspace()` 改为构造 `WorkspaceFrameSpec`；
- [x] 将 navigation / main / inspector 映射到 left / center / right；
- [ ] 保留服务内部 `service-main`、`service-card` 等业务 CSS；
- [ ] 删除 `.service-workspace` 的重复三列定义；
- [ ] 验证数据包草案、选择、检查器和主题刷新不回归。

### F3：迁移 Spot 商店

- [x] 删除 `src/ui/components/shop.ts` 的独立 `panel()`；
- [x] 商店三列统一经过 `renderWorkspaceColumn()`；
- [x] 为商店登记物理列 Host；
- [ ] 保持一次 `ShopWorkspaceView` 派生；
- [ ] 保持 checkout 成功、失败、撤销、离开和主题释放顺序；
- [ ] 保留商店专属 `center-heavy` 布局 Token。

### F4：迁移游戏主界面

- [x] `renderLeftPanel()`、`renderCenterPanel()`、`renderRightPanel()` 暂时保留内部业务逻辑；
- [x] 保留现有内部 header / body 内容；
- [x] 外层统一接入 Frame / Column；
- [ ] 保留游戏现有 Tabs Host、对话空间和局部刷新行为；
- [ ] 确认 `refreshPanels()` 不再依赖旧外层结构。

### F5：统一 Router 状态

Task-0047 已为 Contacts / Story 增加显式 Workspace 状态、带 route 的返回上下文和入口 / 退出闭环；本节关于全量 `service + workspace` 判别联合及 Shop 返回模型的通用收敛仍未完成。

- [ ] 将 `service` 与 `workspace` 收敛为 `WorkspaceRoute` 判别联合；
- [ ] 统一进入、离开、替换和重启路径；
- [ ] Shop 的返回逻辑改为 Route + 保留的 Game 状态，不再复制完整 UI Snapshot；
- [ ] 所有非法组合状态增加测试；
- [ ] 保持服务草案和 Shop Session 的业务状态独立。

### F6：响应式 Profile 与视觉清理

Task-0047 已完成 Contacts / Story 的 single-column 响应式契约和主要窄屏回归；普通 Game、Service、Shop 的统一断点与旧 class 清理仍按本任务后续阶段推进。

- [ ] 合并普通、服务和商店的外层布局 CSS；
- [ ] 抽出统一断点与布局变量；
- [ ] 分别实现 game / service / shop responsive profile；
- [ ] 验证键盘顺序、焦点可见性、滚动责任和窄屏详情路径；
- [ ] 清理已无调用点的旧外层 class 和重复边距规则。

### F7：Host Registry 收尾

Task-0047 已补齐 Contacts / Story 的物理列 Host、`workspaceOwner` 元数据和 Registry 所属校验；旧 Host alias 的整体清理及所有工作区联合回归仍未完成。

- [ ] 将商店 Host 纳入 Registry；
- [ ] 校正服务导航、主内容、检查器的物理列命名；
- [ ] 保留必要的旧 Host 回退或兼容映射；
- [ ] 主题编辑器、运行时、预览和测试统一读取 Registry；
- [ ] 删除旧 alias 前完成用户主题和表现继承回归。

## 七、验收标准

### 结构验收

- [ ] 三种工作区都通过同一个 `WorkspaceFrame` 输出三栏；
- [ ] 三种工作区都通过同一个 `WorkspaceColumn` 接入表现层；
- [ ] Frame 内没有业务分支；
- [ ] `WorkspaceColumn` 不包含业务状态判断；
- [ ] `service + workspace` 双入口最终消失。

### 表现验收

- [ ] 游戏、服务、商店都通过统一 `renderUIHost()` 链路；
- [ ] 背景、文字模式、Host state 和父级回退行为一致；
- [ ] 商店目标可以被 UI Host Registry 和主题编辑器发现；
- [ ] 新工作区 Host 以物理列为第一层命名；
- [ ] 不新增 `workspace.*` 根命名空间。

### 布局验收

- [ ] 普通与服务工作区不再重复声明三列几何；
- [ ] 商店宽列通过 layout Token 表达；
- [ ] 列级滚动只由 Column / body 结构负责；
- [ ] header 不强制为 Tabs；
- [ ] 桌面、平板、窄屏均有明确的 workspace-specific profile。

### 行为验收

- [ ] 游戏 Tab、聊天局部刷新和对话空间不回归；
- [ ] 数据包选择、草案、校验、应用和离开拦截不回归；
- [ ] Shop 价格、库存、余额和结算按钮同一帧一致；
- [ ] Shop 失败不清空购物车，撤销不释放工作区主题；
- [ ] 所有离开和替换路径正确释放临时主题与 Session。

## 八、测试与验证

每个阶段至少执行：

```text
npx tsc --noEmit
npm test
npm run check:architecture
```

新增专项测试方向：

- `WorkspaceFrameSpec` 三列顺序、缺列和隐藏列；
- layout preset 到 CSS data attribute / token 的映射；
- Column Host 元数据和 `renderUIHost()` 接线；
- Game / Service / Shop 的 Router 互斥状态；
- Shop Presenter 一次派生 View；
- Host Registry 父级、物理列归属和旧 alias 回退；
- 窄屏 profile 下的列顺序和详情入口。

浏览器验收至少覆盖：

- 游戏主界面切换三个左栏 Tab、两个中栏 Tab 和四个右栏 Tab；
- 数据包工作区选择包、查看检查器、保留草案并离开；
- Spot 商店选择商品、撤销、结算失败、结算成功和返回；
- 主题切换、用户主题编辑、背景层继承和 Host 目标发现；
- 900px、640px 附近断点及键盘操作。

## 九、非目标与风险

### 非目标

- 不修改 PlayerState 或 StateMutationService；
- 不重新设计商店交易机制；
- 不统一所有业务 Presenter 的内部 CSS；
- 不把 Tabs 变成 Column 的强制结构；
- 不把所有工作区强制成相同的移动端页面；
- 不在本任务中实现拖拽调栏宽度。

### 风险

| 风险 | 处理方式 |
| --- | --- |
| Frame 抽取影响局部刷新 | 先保留旧 panel class，F4 后再调整 `refreshPanels()` |
| Host 重命名造成主题回退变化 | 先不重命名，使用兼容 alias，F7 最后处理 |
| Shop 离开时主题未释放 | 所有出口继续集中到 `disposeShopWorkspace()` |
| 服务工作区误把业务语义写入 Frame | 通过 slot-only 类型和无业务分支验收阻止 |
| 移动端三栏过度统一 | 使用 workspace-specific responsive profile |
| 当前工作树存在并行修改 | 施工前按文件核对 diff，避免覆盖既有 Spot 与文档变更 |

## 十、关联文档与代码入口

- [[docs/docs-828/02-modules/ui]]
- [[docs/plan-work/active/roadmap-0011-ui-component-layer-backgrounds]]
- [[docs/plan-work/active/roadmap-0018-ui-host-registry]]
- [[docs/plan-work/active/roadmap-0020-service-workspaces]]
- [[docs/plan-work/active/task-0037-panel-tabs-region-structure]]
- [[docs/plan-work/active/task-0039-spot-shop-transaction-system]]
- [[docs/plan-work/active/task-0047-contacts-story-workspace-ownership]]：F5–F7 中与 Contacts / Story 路由、Host 和响应式契约相关的优先后续施工。
- `src/ui/components/app-shell.ts`
- `src/ui/components/service-workspace.ts`
- `src/ui/components/shop.ts`
- `src/ui/components/rail.ts`
- `src/ui/components/center-panel.ts`
- `src/ui/components/right-panels.ts`
- `src/ui/presentation-service.ts`
- `src/ui/ui-host-registry.ts`
- `src/ui/css/layout.css`
