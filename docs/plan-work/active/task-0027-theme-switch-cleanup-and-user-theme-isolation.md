# 任务 0027：主题切换清理与用户自定义主题独立化

> 状态：✅ 已实施（2026-09-07）  
> 范围：游戏内 UI 主题切换、运行时主题层、CSS 注入清理、用户自定义主题编辑器与主题选择入口。

## 1. 背景与问题

当前主题切换已经具备运行时层、CSS 变量、背景图层和表现宿主的多条刷新路径，但它们没有由同一个“当前主题来源”驱动，导致切换后可能看到前主题遗留内容：

- 根节点 CSS 变量清理在遍历并删除 `CSSStyleDeclaration` 的同时向前移动索引，连续的旧变量可能被跳过；
- 用户自定义主题虽然已经独立保存在 `customThemes`，但运行时仍根据 `userTheme.enabled` 无条件把它叠加到当前 ColorGroup 上；
- “系统默认 / 色彩组 / 用户自定义”没有统一的全局单选状态，用户无法从主题浮窗明确选择或取消用户自定义主题；
- 编辑器保存、预览、取消与主题浮窗刷新依赖不同事件路径，容易出现按钮 active 标记、背景和实际运行时来源不一致。

这些问题的共同原因是：主题内容存储、主题应用关系和当前选中来源没有明确分层，旧 UI 又分别读取了已废弃的 `activeGroupId` 与用户主题启用状态。

## 2. 目标效果

### 2.1 主题切换

1. 每次切换全局主题前，先清理上一轮引擎注入的根 CSS 变量，再注入新主题变量；连续变量、语义变量、背景变量均不得残留。
2. 运行时主题层、背景节点、表现宿主状态和主题浮窗 active 标记都从同一个当前来源刷新。
3. 切换到内置主题时，只解除用户自定义主题的全局应用，不删除用户自定义主题记录，也不影响实体主题挂靠。
4. 切换到系统默认时，界面明确显示“系统默认”，不把“没有 ColorGroup”误解为用户主题仍在使用。
5. 预览取消、编辑器关闭和保存后，最终显示都与当前来源一致；重复刷新不产生重复背景节点或重复临时层。

### 2.2 用户自定义主题

1. 用户自定义主题是独立的主题记录，真实内容只从 `PlayerState.customThemes[customThemeId]` 读取，不再从 `userTheme.applied` 复制一份运行时内容。
2. 全局主题使用一个单选来源：系统默认、已拥有 ColorGroup、已保存的用户自定义主题三者只能有一个处于应用态。
3. 主题浮窗和通讯录主题区都提供“用户自定义”选择按钮；没有已保存主题时显示编辑入口，有已保存主题时显示名称、色板和 active 状态。
4. 点击内置主题只改变当前应用来源，不删除自定义记录；点击“用户自定义”才应用该记录。
5. 编辑器的“保存并应用”保存独立记录并将其设为当前来源；“取消”只撤销预览，不改变已保存主题和当前来源。
6. 用户关闭自定义主题时，主题记录保留，界面回到系统默认，并提示“已停用，主题内容仍保留”。
7. 主题编辑器与普通切换入口使用同一套应用命令和事件，不要求用户理解旧的 `activeGroupId`、attachment 或运行时层等内部术语。

### 2.3 按钮状态表现基线

1. 没有额外表现宿主配置时，按钮的 inactive / disabled 状态仍显示当前色彩组提供的基本底色，不因缺少宿主图层而透明。
2. 可用按钮的 hover 使用与 active 相同的表现解析来源；状态层由数据服务生成，CSS 只负责在 base 与 hover 层之间切换可见性。
3. active 不再通过 `border-color` 生成按钮外围的简单彩色边框；按钮形状与装饰线均属于按钮内部表现节点。

## 3. 数据结构与机制变更

### 3.1 当前全局主题来源

在 `PlayerState` 中增加唯一的全局主题来源：

```ts
type ActiveThemeSelection =
  | { kind: 'system' }
  | { kind: 'color-group'; id: ColorGroupId }
  | { kind: 'custom'; id: string };

interface PlayerState {
  activeTheme?: ActiveThemeSelection;
}
```

`activeTheme` 是运行时与 UI 的唯一选择依据。系统默认使用 `kind: 'system'`，不再用空的 `activeGroupId` 表达多个不同语义。`groupsOwned` 仍只表达收集状态，不表达当前应用状态。

### 3.2 用户自定义主题存储

- `customThemes` 是用户自定义主题内容的唯一事实源；
- `userTheme` 只保留编辑权限相关的元数据、当前自定义主题 ID、revision 和启停状态，不再保存 `applied` 内容副本；
- `themeAttachments` 只用于 Area / 学生等实体主题挂靠；全局 base 的应用完全由 `activeTheme` 表达，不能再用隐式的 `userTheme.enabled` 或 `themeAttachments.base` 覆盖任意 ColorGroup；
- `StoredCustomTheme.baseThemeRef` 只用于补齐自定义主题未声明的字段，不改变当前全局来源选择。

### 3.3 运行时解析

```text
activeTheme = system       → 不设置 player 色彩组层
activeTheme = color-group → 设置 player 层为该 ColorGroup
activeTheme = custom       → 清空 player 色彩组层，只设置独立 user 层
scene layers               → 按既有 player/init/area/student 顺序合并
preview                    → 只在编辑会话期间覆盖已应用结果
ephemeral                  → 始终作为最高层
```

用户自定义层的 `scope` 使用独立的 `user` 语义，不伪装成 `player`。全局自定义主题未选中时不得进入最终解析结果；实体自定义主题仍按实体主题解析机制工作。

### 3.4 写入口与事件

- `activateTheme(groupId)`：选择系统默认或已拥有 ColorGroup；
- 新增 `activateCustomTheme(customThemeId)`：仅允许选择已保存的用户主题；
- `setUserTheme`：写入 `customThemes`，更新 metadata，并在启用时切换到该自定义主题来源；
- `setUserThemeEnabled(false)`：解除全局应用但保留记录；
- `themeChanged` 携带新的来源，`userThemeChanged` 继续表达保存/启停，UI 两者均触发统一渲染；
- 预览仍使用 RuntimeThemeManager 的 preview 槽，关闭编辑器必须显式清空。

## 4. UI 易用性要求

- 主题选项名称使用“系统默认”“色彩组名称”“用户自定义 · 主题名称”，避免只显示内部 ID；
- active 只允许出现一个，并在按钮上提供 `aria-pressed`；
- 用户自定义未保存时只显示“打开主题编辑器”；已保存但未应用时显示“应用用户自定义”；
- 切换成功提示区分“主题已切换”“已恢复系统默认”“已应用用户自定义”；
- 失效的自定义主题 ID 不静默套用旧主题，显示不可用状态并回退系统默认；
- 编辑器关闭后预览立即撤销；保存后不要求重新打开主题浮窗才能看到 active 状态；
- 用户可以通过同一主题区完成创建、编辑、应用、停用，不需要去不同页面寻找第二套入口。
- 表现宿主的默认底色、hover 层和 active 层都从同一份 `backgroundForHost` 解析结果生成；无宿主按钮也能获得色彩组基本底色。
- active / hover 不再设置主题色外围边框，用户自定义的形状与装饰线仍由表现数据包控制。

## 5. 实施切片

1. 写入本任务文档并更新工作索引。
2. 修复根 CSS 注入变量的稳定清理，并加入连续变量回归测试。
3. 引入 `ActiveThemeSelection`，收敛状态写入、运行时同步和最终 token 查询。
4. 使自定义主题使用独立 `user` 层，仅在被选择时参与解析，删除 `userTheme.applied` 的运行时依赖。
5. 在 Header、通讯录和主题编辑器入口统一渲染自定义主题选择与状态。
6. 补充状态切换、预览撤销、来源单选、CSS 清理和 UI active 标记测试。
7. 运行类型检查、专项测试、架构检查和全量测试，记录结果。

## 6. 验收标准

- 从任意已应用主题切换到另一个主题后，旧主题的根 CSS 变量、背景节点和表现宿主状态不残留；
- 连续两个或更多注入变量都能被清理；
- `customThemes` 中的记录在切换内置主题后仍存在且内容不变；
- 内置主题与用户自定义主题不能同时作为全局应用来源；
- 用户主题保存、应用、停用和编辑器取消后的运行时结果与 UI active 标记一致；
- Header 与通讯录的主题入口展示一致，并可完成相同的选择操作；
- `npm test`、`npx tsc --noEmit` 与 `npm run check:architecture` 结果已记录，新增专项测试通过。

## 7. 实施记录

- 已在 `PlayerState` 中使用 `activeTheme` 作为唯一全局主题来源，删除运行时对 `userTheme.applied` 的依赖；
- 已让用户主题使用独立 `user` 运行时层，仅在被选中且记录有效时参与合并；
- 已在 Header 与通讯录主题区加入自定义主题选择、active 标记和可访问性属性；
- 已修复 CSSStyleDeclaration 前向删除跳过相邻变量的问题，并加入回归测试；
- 已将主题来源事件接入 UI 统一刷新，并让运行时 reset 恢复默认层级顺序；
- 已为无宿主按钮增加色彩组基本底色回退，并让 inactive 按钮同时渲染 active 来源的 hover 层；主题刷新路径复用同一渲染入口，避免 hover 层被刷新丢失；
- 已移除顶部表现按钮 active / hover 的主题色 `border-color`，保留透明外围与内部装饰线机制；
- 已修复用户主题系统颜色层引用不存在的 `--bgAlt` 变量问题，统一使用主题兼容层实际注入的 `--bg-alt`，保证控件形状变化后系统背景仍可渲染；
- `npx tsc --noEmit`：通过；
- `npm run check:architecture`：通过；
- 表现层专项测试：4 个文件、22 个测试通过；
- `npm test -- --reporter=dot --silent`：122 个测试文件通过、1 个失败；1150 个测试通过、1 个失败。失败仍是既有 Schema 同步断言：`inits.theme` 引用了编辑器不存在的 `colorGroups` 表，未触及本次按钮表现代码。
- Edge 实测：inactive 默认背景层为色彩组派生底色；鼠标停留时 base 层透明、active 来源层显示；主题按钮 active 时外围 `border-color` 为透明且底色保留。
