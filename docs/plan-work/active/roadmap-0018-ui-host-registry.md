# roadmap-0018 — UI Host Registry 与服务面板自动表现接入

> 本路线解决一个具体问题：当游戏 UI 新增数据包服务、存档服务或其他工作区时，现有用户主题编辑器能否自动发现并编辑这些 UI，而不需要为每个新面板重复手写主题编辑器转接代码。
>
> 本文是 UI 表现接入路线，不改变主题解析算法、用户主题存档版本或数据包/存档机制。表现模型的统一方向仍以 [[roadmap-0014-theme-editor-convergence]]、[[adr-0006-ui-background-layering]] 为准。

## 1. 结论与目标

当前系统可以让新面板继承 `leftPanel` / `centerPanel` / `rightPanel` 的样式，但独立目标必须手动加入 `PRESENTATION_TARGETS`、手动添加 DOM 属性，并在主题编辑器中确认可见。

目标是把 UI 宿主定义从主题编辑器内部常量提升为共享注册信息：

```text
UI Service / UI Component Definition
              ↓ 注册
          UIHostRegistry
       ↙        ↓        ↘
运行时渲染   主题编辑器   预览 / 测试
```

新增服务只需声明自己的宿主目标，系统自动获得稳定 ID、父级关系、展示名称、宿主类型、可用状态、主题编辑器目标选择、运行时父级回退以及预览和测试元数据。

## 2. 当前问题

`src/ui/presentation-targets.ts` 同时承担目标树、中文名称、父级关系和编辑器候选列表；运行时可以通过 `data-theme-host-id` 使用任意宿主 ID，但主题编辑器只能从固定的 `PRESENTATION_TARGETS` 中发现目标。

因此会出现：

```text
运行时可以渲染 centerPanel.datapack
主题编辑器却不知道 centerPanel.datapack 存在
```

新服务如果有 `default / active / inactive / disabled` 状态，还需要分别手写 HTML 属性、状态编辑器标签、预览状态和局部刷新目标。

## 3. 目标架构

### 3.1 UIHostDefinition

新增共享宿主定义：

```ts
export interface UIHostDefinition {
  readonly id: string;
  readonly label: string;
  readonly level: 'global' | 'cluster' | 'region' | 'control';
  readonly kind: 'background' | 'container' | 'button' | 'tab' | 'card' | 'bubble';
  readonly parent?: string;
  readonly states?: readonly PresentationHostState[];
  readonly serviceId?: string;
  readonly legacyRegion?: string;
  readonly editable?: boolean;
}
```

宿主定义只描述 UI 目标，不保存用户主题值，也不负责修改 Runtime 或 DOM。

### 3.2 UIHostRegistry

新增只读注册服务：

```ts
export interface UIHostRegistry {
  all(): readonly UIHostDefinition[];
  get(id: string): UIHostDefinition | undefined;
  childrenOf(parentId: string): readonly UIHostDefinition[];
  descendantsOf(parentId: string): readonly UIHostDefinition[];
  resolveParent(id: string): readonly UIHostDefinition[];
  forService(serviceId: string): readonly UIHostDefinition[];
  validate(): readonly UIHostRegistryIssue[];
}
```

基础宿主由核心 UI 提供，服务宿主由服务定义提供。二者合并成一个注册表，供运行时渲染、用户主题编辑器、预览画布和测试使用。

### 3.3 UIServiceDefinition

服务定义同时声明自己的表现宿主：

```ts
export interface UIServiceDefinition {
  readonly id: string;
  readonly label: string;
  readonly hosts: readonly UIHostDefinition[];
}

const datapackService: UIServiceDefinition = {
  id: 'datapack',
  label: '数据包服务',
  hosts: [{
    id: 'centerPanel.datapack',
    label: '数据包服务主面板',
    level: 'region',
    parent: 'centerPanel',
    kind: 'container',
  }],
};
```

服务定义只声明有哪些宿主；表现值仍由用户主题或数据包主题数据提供。

## 4. 运行时改造

### 4.1 统一宿主渲染入口

新增服务面板不再手写一组分散的主题属性，而应通过统一辅助函数生成：

```ts
renderUIHost({
  hostId: 'centerPanel.datapack',
  state: 'default',
  className: 'service-panel',
  content,
  ctx,
})
```

辅助函数负责写入 `data-theme-host-id`、`data-theme-state`，注入宿主背景层、文字颜色模式、统一表现内容容器和无障碍属性。

### 4.2 刷新逻辑注册表驱动

`refreshPresentationHostElements` 保留局部刷新能力，但宿主合法性、父级和状态信息来自 `UIHostRegistry`：

- 只刷新实际存在的 DOM 宿主；
- 未配置专属主题时向父级回退；
- 未登记宿主在开发环境报告警告；
- 运行时、主题编辑器和预览使用同一 Host ID。

### 4.3 动态面板边界

稳定且需要独立编辑的服务面板应注册为正式 Host；仅用于内部回退或临时状态的 DOM 节点不暴露给编辑器。自动发现不等于扫描并暴露所有 DOM 节点。

## 5. 用户主题编辑器改造

### 5.1 目标选择器读取注册表

`PRESENTATION_TARGETS` 不再作为唯一手工目录，编辑器改为读取：

```ts
uiHostRegistry.all().filter(host => host.editable !== false)
```

自动取得目标标签、层级、父级、服务归属、宿主类型和支持状态。

### 5.2 默认显示策略

自动发现不等于全部展开：

- 默认显示已配置宿主；
- 显示当前服务的推荐宿主；
- 未配置宿主放入“添加表现目标”；
- `editable: false` 宿主不显示；
- 按服务和层级筛选；
- 显示“继承父级 / 未设置 / 已覆盖”。

### 5.3 状态编辑器自动生成

宿主声明支持哪些状态后，编辑器自动生成对应状态 Tab；不再让所有目标默认出现没有意义的四态表单。

通用编辑器负责宿主选择、图层增删排序、颜色/渐变/图片、透明度、状态表现和父级继承。主题色来源链、预览画布和特殊布局参数仍可保留专用编辑能力。

## 6. 校验与安全边界

注册表初始化时校验：

- ID 唯一；
- 父级存在；
- 不允许父级循环；
- 层级关系合理；
- `serviceId` 指向已注册服务；
- 状态值合法；
- 旧 `legacyRegion` 映射不重复。

主题数据校验仍负责颜色、图片、图层数量、图层 ID 和宿主状态结构安全。Host Registry 不开放任意 CSS 或任意 DOM 注入。

## 7. 迁移切片

### H0：抽取基础定义

- 将现有 `PRESENTATION_TARGETS` 转换为基础 `UIHostDefinition[]`；
- 新增 `UIHostRegistry`；
- 保留旧导出作为兼容别名；
- 增加 ID、父级和循环校验。

### H1：运行时接入

- 新增 `renderUIHost`；
- 统一宿主背景与文字模式接入；
- 将新服务接入稳定 Host ID；
- 添加未登记宿主开发警告。

### H2：主题编辑器接入

- 目标选择器改读 Registry；
- 目标标签、层级和父级移除重复映射；
- 状态 Tab 按 Host 声明生成；
- 按服务筛选目标；
- 保持现有用户主题保存流程。

### H3：数据包与存档服务接入

- 数据包工作区声明自己的 Host；
- 存档工作区声明自己的 Host；
- 服务切换时只挂载对应工作区宿主；
- 用户主题编辑器自动显示已配置或可添加的服务目标。

### H4：清理与验收

- 删除重复的目标标签映射；
- 删除无法再到达的旧手写接线；
- 更新 UI 模块文档和服务工作区计划；
- 完成运行时、编辑器和主题数据的联合测试。

## 8. 数据包与存档服务的目标示例

```text
centerPanel.datapack
├─ centerPanel.datapack.navigation
├─ centerPanel.datapack.main
└─ centerPanel.datapack.inspector

centerPanel.saves
├─ centerPanel.saves.list
├─ centerPanel.saves.main
└─ centerPanel.saves.inspector
```

第一阶段只注册服务工作区容器、导航区、主工作区、右侧检查区以及具有特殊交互状态的主要按钮或 Tab，不把每个内部 DOM 节点暴露给用户。

## 9. 验收标准

- 新增一个带宿主声明的服务后，主题编辑器能自动发现其可编辑目标；
- 不再需要手动修改 `PRESENTATION_TARGETS` 才能显示新服务目标；
- 新宿主未配置专属主题时正确继承父宿主表现；
- 宿主状态由定义自动生成；
- 运行时、主题编辑器、预览和测试使用同一 Host ID；
- 未登记 DOM 宿主在开发环境可被报告；
- 现有 header、三栏、卡片、按钮、Tab 和气泡表现不回归；
- 数据包服务和存档服务只需声明 Host，不需新增专用主题转接服务；
- `npm test`、`npx tsc --noEmit` 与 `npm run check:architecture` 通过。

## 10. 非目标

- 不扫描任意 DOM 节点并全部暴露给用户；
- 不允许数据包直接注入任意 Host 定义或任意 CSS 属性；
- 不把主题编辑器改造成通用页面构建器；
- 不取消主题编辑器的专用预览和高级表现逻辑；
- 不修改现有存档迁移策略。

## 状态

- 设计：✅ 已完成
- H0：✅ 已完成（核心宿主已迁移至共享 Registry，并保留兼容导出）
- H1：✅ 已完成首版（服务宿主声明、统一 `renderUIHost` 入口与动态目标读取已接入）
- H2：✅ 已完成首版（用户主题编辑器与控制器改读 Registry）
- H3：🟡 部分完成（数据包 / 存档 / 通讯录 / 档案 / 记录 Host 与主要服务工作区已声明，完整服务内容仍在施工）
- H4：🟡 部分完成（重复目标映射已收敛，联合测试已接入；服务工作区完整落地、调试视图与浏览器视觉回归待补）

Contacts / Story 的 Host、父级关系和运行时发现由 [[docs/plan-work/active/task-0047-contacts-story-workspace-ownership]] 作为 WS-P0 优先施工项承接；本路线仍保留 Host Registry 的通用设计与服务侧验收。
