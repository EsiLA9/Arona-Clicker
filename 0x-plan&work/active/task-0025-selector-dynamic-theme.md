# Task-0025：Init / GlobalEnh 选择页动态主题

状态：✅ 首版已实施并验证，体验项另列

## 目标

将 Init / GlobalEnh 选择界面从静态轮盘升级为动态选择场景：轮盘转动时，聚焦条目的视觉身份驱动背景、详情区和局部控件平滑变化；玩家从 Init 内退出回到选择页时，背景能够反映该 Init 当前的离散进度状态。

本任务的主题表现只改变选择页的视觉反馈，不改变数值、解锁、Tick、Init 生命周期或 GlobalEnh 实际效果。

## 设计边界

- 顶部主题按钮继续负责玩家全局 UI 主题。
- 当前聚焦 Init / GlobalEnh 负责选择页局部场景主题；条目自身也必须具有可区分的局部表现。
- 当前活动 Init 的状态主题只作用于选择页返回场景，不压入 `player`、`area` 或 `student` 运行时主题层。
- 主题状态使用离散阶段，不随每个 Tick 频繁换色。
- 无主题声明的数据包必须有稳定、确定性的默认回退，不使用随机颜色。
- 主题只读投影来自 `GameReadModel` / `UIContext`，不让组件持有 PlayerState 写引用。

## 当前事实与代码落点

- `src/ui/selector-theme.ts` 已提供选择页只读主题投影：聚焦实体、Init 快照/离散进度、GlobalEnh 状态、确定性回退和 `transitionKey` 均在此收敛。
- `src/ui/components/selector-page.ts` 与 `src/ui/components/init-select.ts` 只消费投影结果；背景由 shell 专用超级背景 `.selector-super-background` 内的 current/next 双层容器切换，巨型圆盘 `.init-orb-disc.selector-disc` 只承担装饰与轮盘定位参照，选择页视口只承载两张详情面，主题树通过局部 CSS 变量注入详情、条目和按钮。
- `src/ui/background-service.ts` 负责低到高的背景层绘制顺序，`src/ui/presentation-service.ts` 负责局部表现目标；`src/ui/ui-host-registry.ts` 已注册选择页 Host。
- `InitDef.theme`、`EnhancementDef.theme`、Builder API 和编辑器 Schema 同步链已接入；默认 Init 已提供场景与状态变体示例。
- 选择页投影不写回 Runtime，不启动 Tick，也不改变 Init 生命周期或 GlobalEnh 效果。

## 背景模型

选择页超级背景采用“场景 + 状态变体 + 层叠合成”，背景挂在 shell 首个子节点的专用超级背景宿主上；选择页视口、圆盘装饰和轮盘保持独立：

```text
console-shell init-select-shell selector-shell init-mode
  ├─ selector-super-background                 ← 整页超级背景 / current-next 场景层
  ├─ init-orb-disc selector-disc              ← 巨型圆盘装饰与轮盘定位参照
  ├─ selector-viewport                         ← 仅 Init / GlobalEnh 详情面
  └─ init-wheel wheel-init / wheel-enh          ← 独立轮盘层，z-index 更高
```

超级背景的视觉层仍按系统默认 → 玩家全局主题 → 当前场景 → 聚焦条目 → 状态变体合成；轮盘不放入背景容器，也不由背景容器裁剪。

### 场景来源

- Init 面：`init:<id>` 的主题作为场景基础。
- GlobalEnh 面：`enhancement:<id>` 的主题作为场景基础。
- 从 Init 返回选择页：active Init 主题 + current Area 修饰 + Init 进度状态。
- 没有声明主题时，使用声明的 `colorGroupId` 或确定性的系统回退。

### 状态变体

同一场景允许对应多个背景变体，第一阶段只使用引擎规定的离散状态：

```text
new / active / advanced / completed / warning
```

GlobalEnh 至少支持：

```text
locked / available / active
```

状态变体由选择页只读投影选择，不让渲染器直接解析任意 PlayerState 条件，也不因为单个资源数值变化而频繁换背景。

## 目标体验

### 轮盘聚焦

- 每个 Init / GlobalEnh 条目具有可区分的局部颜色、边框、状态表现和可选背景层。
- 轮盘转动后，选择页背景和详情区平滑过渡到新的聚焦条目。
- Init 面与 GlobalEnh 面各自维护主题，不互相污染。
- 聚焦条目、详情区和主操作按钮保持同一主题语义。

### 从 Init 返回选择页

背景至少能反映：

- 当前 active Init。
- 当前 Area（如果存在）。
- Init 当前进度阶段：`new` / `active` / `advanced` / `completed`。
- 关键解锁或剧情状态的离散修饰。
- 必要时当前已激活 GlobalEnh 的轻量修饰。

不允许因为单个资源数值或每帧生产结算导致背景频繁变化。

返回选择页时，背景应成为当前世界线的状态回廊：初次进入保持未展开的基础氛围，推进设施、区域、剧情或关键解锁后，再次返回可以切换到新的离散背景变体。

## 预期数据结构

### Datapack 声明

为 `InitDef` 与 `EnhancementDef` 增加可选 `theme?: ThemeDef`，并为对应 Builder 增加主题声明入口。完成后按 Schema 同步协议生成编辑器 Schema。

`ThemeDef.background` 表示默认背景；同一场景的不同背景通过变体表达：

```ts
interface ThemeBackgroundVariant {
  id: string;
  layers: BackgroundLayerDef[];
}

interface ThemeDef {
  background?: BackgroundLayerDef[];
  backgroundVariants?: ThemeBackgroundVariant[];
}
```

变体 ID 只接受稳定的语义状态，不在 Datapack 中硬编码 UI 内部实现细节。

### 实体主题键

扩展现有实体主题键：

```text
area:<id>
variant:<id>
init:<id>
enhancement:<id>
```

继续复用 `ColorSystem` 的主题来源与状态槽：声明默认、主题设计、装备/外部来源、自定义主题和恢复默认。

### 选择页主题投影

新增只读投影概念，建议包含：

- 当前选择面。
- 当前聚焦实体 ID。
- active Init / current Area。
- Init 离散进度阶段。
- 当前有效的关键强化状态。
- 用于背景过渡去重的 `transitionKey`。

建议形成如下只读上下文：

```ts
interface SelectorBackgroundContext {
  sceneId: string;
  variantId: string;
  face: 'init' | 'global-enh';
  focusedEntityId: string | null;
  activeInitId: string | null;
  currentAreaId: string | null;
}
```

`variantId` 由 `new / active / advanced / completed / warning` 或 `locked / available / active` 等受控状态生成。

## 背景渲染策略

- 条目自身使用局部 CSS 变量或局部主题树，影响名称、状态徽标、边框和聚焦表现。
- 条目成为焦点时，使用同一主题驱动选择页背景、详情区和主操作按钮。
- 不使用单条目背景覆盖整页全局 Header 背景或另一侧选择面；但选择页顶栏普通操作按钮可消费当前聚焦主题声明的 `header.button` 宿主，按钮本身不改变运行时主题。
- 背景切换不进行完整 DOM 重建。
- 渐变和颜色使用 CSS 变量过渡；图片或多层背景使用 current / next 双层交叉淡化。
- 新背景资源应先准备完成再进入淡入阶段，避免空白闪烁。

建议的选择页 Host：

```text
selector
selector.init
selector.init.detail
selector.init.row
selector.enh
selector.enh.detail
selector.enh.row
```

`ThemeDef.background` 负责 `.selector-super-background` 的整页场景层，`PresentationDef.hosts` 负责条目、详情和控件局部表现，二者不混为同一层；`selector-viewport` 与 `.selector-disc` 均不挂载 current/next 场景背景。

## 施工切片

### P0：投影与现状确认

- [x] 确认全局主题按钮在 Init / GlobalEnh 两面均可用且翻面后保持。
- [x] 设计并实现选择页主题上下文的只读投影。
- [x] 明确 Init 状态阶段的判定来源与回退规则。
- [x] 明确背景优先级：全局主题 → 选择页场景 → 聚焦条目 → 状态变体 → 过渡层。

### P1：条目主题与聚焦背景

- [x] 增加 Init / Enhancement 的 `ThemeDef` 声明与 Builder API。
- [x] 扩展主题实体键和 `ColorSystem` 查询入口。
- [x] 为条目生成局部主题变量。
- [x] 让当前聚焦条目驱动选择页背景、详情、主操作按钮与选择页顶栏普通操作按钮。
- [x] 使用 CSS 变量过渡或 current / next 双层背景完成轮盘转动时的平滑切换。

### P2：返回场景状态

- [x] 为 active Init 生成 `new / active / advanced / completed` 状态主题。
- [x] 接入 current Area 和关键剧情/解锁状态的离散修饰。
- [x] 从 Init 返回选择页时恢复对应状态背景。
- [x] GlobalEnh 面增加 locked / available / active 状态表现。

### P3：Datapack 表现能力与体验设置

- [x] 将选择页 Host 注册进 UI Host Registry。
- [x] 允许 Datapack 为选择页 Host 声明背景层、状态层和控件表现。
- [x] 接入 `prefers-reduced-motion` 的低动态分支；用户可配置的动态背景开关仍待单独设置项落点。
- [ ] 检查背景层资源和动效的性能边界，并补专用预览/多设备视觉回归。

## 更新策略

### 轻量更新

轮盘转动时只更新：

- 聚焦实体 ID。
- 选择页背景层。
- 详情主题。
- Header 状态色。
- 聚焦条目状态。
- current / next 背景层的交叉淡化状态。

### 完整重渲染

仅在以下情况重建选择页结构：

- 解锁/购买状态改变。
- Init 进度阶段改变。
- 读档或数据包重载。
- 主题配置结构变化。

Init 状态跨阶段时允许轻量背景切换；只有条目数量、解锁结构或 Datapack 主题结构改变时才重建选择页结构。

## 测试与验收

- Init / GlobalEnh 条目视觉上可区分。
- 轮盘聚焦变化能触发平滑背景切换。
- 同一 Init 在 `new / active / advanced / completed` 等阶段可以显示不同背景。
- 从 Init 退出后，active Init、current Area 和离散进度共同决定返回背景。
- 每个条目的局部表现与其聚焦后的场景背景保持同一主题语义。
- 两个选择面主题互不污染。
- 主题表现不启动 Tick、不触发 Init 生命周期、不改变实际效果。
- 无主题 Datapack 使用稳定回退样式。
- 读档、翻面、重渲染和服务切换后主题状态正确。
- 支持 `prefers-reduced-motion` 的低动态分支；用户可配置的动态背景开关列入剩余体验项。
- 补充 Vitest、UI DOM 测试和浏览器验收。

## 当前核验（2026-09-07）

- `npx tsc --noEmit`：通过。
- `npm run check:architecture`：通过。
- `npm test -- --reporter=dot`：124 个测试文件、1166 个测试全部通过。
- `npm run build`：通过；仅保留既有的大 chunk 体积提示。
- Edge `http://localhost:5173/src/ui/index.html`：已观察 Init 聚焦切换时整页超级背景的 current/next 背景交叉淡化、GlobalEnh 选择与翻回 Init 后主题恢复；背景宿主覆盖 shell 全部视口，轮盘保持更高层级可交互，详情文字可读，无横向或纵向溢出，控制台无 error/warn。
- 低层背景绘制顺序与主题树内联 CSS 变量序列化已补回归测试，避免声明场景被底层遮挡或局部主题变量未生效。
- 背景宿主位置补正后，隔离 Edge 已确认 `.selector-scene-background-stack` 是 `.selector-super-background` 的直接子节点，而不是 `.selector-viewport` 或 `.selector-disc` 的子节点；轮盘仍是 shell 的独立兄弟层。

## 剩余工作

- 补充选择页背景资源的专用预览、动态背景设置项及更完整的多设备视觉回归。
- 将本任务从 `active/` 归档；归档只整理文档位置，不改变已验证实现。

## 相关路由

- `docs-828/02-modules/ui.md`
- `docs-828/02-modules/color.md`
- `docs-828/04-mechanisms/color-derivation.md`
- `src/ui/components/selector-page.ts`
- `src/ui/components/init-select.ts`
- `src/ui/components/global-enhancement-select.ts`
- `src/arona-clicker/services/color-system.ts`
