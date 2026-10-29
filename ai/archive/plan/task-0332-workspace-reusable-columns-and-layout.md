# Task 0332：Workspace 栏复用、装配导航与自由列宽

状态：已归档 — 栏与布局改造及自动化回归已完成；浏览器访问未获批准，视觉验收仍待补。

后续内容迁移见 [[ai/plan/task-0333-semantic-columns-and-workspace-composition]]：经典 Game 仍调用位置面板分发器，部分元素/聊天/日志刷新仍带位置依赖；0333 专门收敛这些内容与调用方，不将本 Task 已有共享基础等同于旧概念全部清理完成。

## 目标与范围

将 Workspace 从固定的 `left / center / right` 内容组合，扩展为可按需调用的有序栏组合。栏的内容、状态绑定、交互和表现不再由物理位置决定，现有页面尽量保持原有效果。

用户要求：

1. 栏本身可复用到其他 Workspace、其他顺序或其他内容容器中。
2. Workspace 可以调用已有栏；返回等导航结果由具体 Workspace 与栏的装配定义，按实际页面逐个设计。
3. Workspace 可定义任意正整数栏数，以及每栏的固定宽度、比例或约束宽度。

本 Task 交付共享能力、现有 Workspace 装配迁移和代表性复用验证。下文保留原设计和验收条件，当前实施结果单列记录；自动化通过不替代未执行的浏览器视觉验收。

明确边界：

- 采用 TypeScript 显式导入的栏工厂与装配配置，不建设插件注册市场、可序列化布局 DSL、可视化编排器或玩家拖拽布局功能。
- “任意位置”包括 Workspace 内换序、跨 Workspace 调用、嵌入普通容器；不是要求任意大小下都与原截图逐像素一致，也不保证不相关业务栏无需提供依赖即可工作。
- 任意栏数首先指同一行的有序列，不在本次建设任意二维网格、无限嵌套分屏或可拖拽分隔线。零栏应输出明确空态，不产生无效 grid。
- 本次不实现聊天编辑器、草稿播放 Runtime 或新的剧情推进机制；用容器级测试证明嵌入能力，为后续编辑器提供接入点。
- 桌面宽屏、鼠标操作；沿用现有主题、字体、控件、面板与间距体系，不引入新视觉方向。
- 不新增 PlayerState / 存档布局字段，不改业务状态归属，不绕过 GameCommands；不为 UI 组合预先扩展 Datapack / Theme Schema。

## 已核实事实

| 事实 | 当前依据 | 对方案的影响 |
| --- | --- | --- |
| 游戏 Frame 必须传入 left、center、right，slot 也是三个固定字面量 | `src/ui/components/shared/workspace-frame.ts`：`WorkspaceFrameSpec`、`WorkspaceColumnSpec` | 新装配入口需要有序数组，不能只增加几个 preset |
| 纯布局入口已接收预渲染数组；内容工具已实际复用 | 同文件 `renderWorkspaceLayout()`；`src/ui/runtime-editor/codex/workspace.ts`：`renderContentWorkspace()` | 保留纯布局与带游戏主题栏两种入口，不向内容工具强加游戏外框 |
| composition 仅保留指定宿主，合并后的内容由调用方手动放入 | `renderWorkspaceFrame()`；`tests/ui/workspace-frame.test.ts` | 旧组合须显式转换成栏列表，不能宣称自动合并内容 |
| 栏正文已有跨页复用，但完整栏仍在具体页面现场拼接 | `src/ui/components/story/story-workspace.ts`、`src/ui/components/character/contacts-workspace.ts`、`character-workspace.ts` | 抽出可调用的栏定义，避免只复用内部 HTML |
| 标题与主题宿主大量按物理列命名 | `src/ui/components/shared/workspace-titlebar.ts`、`tabs.ts`；`src/ui/runtime/ui-host-registry.ts` | 主题样式身份和挂载实例身份分离；保留旧主题映射 |
| 页面更新按 Workspace 类型、left/center/right 与固定 hostId 分派 | `src/ui/controller/controller.ts`：`refreshChatPanel()`、`refreshPanels()` 及各 Workspace region 方法 | 新栏必须以实例为更新目标，旧刷新入口仅作为迁移适配 |
| ChatStream 有分流状态，但活跃流操作仍从 PanelState 取当前 owner；发送事件也如此 | `src/ui/presentation/chat-stream.ts`；`src/ui/controller/controller-actions-story.ts`：`bindStoryActions()` | 聊天栏须显式绑定 owner、流数据和动作，不能借移位改变剧情目标 |
| 聊天滚动包装只找首个 chat-stream，并使用统一 chat key；Workspace 滚动按槽位保存 | `src/ui/interaction/scroll.ts`；底层 `src/ui/flow/flow-scroll.ts` 已支持按 key 保存 | 复用底层滚动能力，改为显示实例隔离；不新增第二套滚动系统 |
| 返回有单层 returnTo；角色选择和退出在 Controller 中有业务专用处理 | `src/ui/workspace/workspace-router.ts`；Controller 的 `disposeWorkspace()`；`controller-actions-contacts.ts` | 保留现有导航执行和清理流程，将结果选择移动到装配绑定，不新建 history stack |

机制入口：[[workspace-navigation-and-rendering]]、[[workspace-route-lifecycle]]、[[ui-refresh-focus-scroll]]、[[update-dispatch-and-surface]]、[[story-chat-and-theme-presentation]]。

## 设计决定

### 1. 栏定义、栏实例与物理位置分开

使用轻量的栏工厂：接收只读数据/查询绑定、动作回调和表现选项，产生可渲染、可绑定和可清理的栏实例。直接导入调用即可，不强制全局 registry 或继承体系。最终类型名由施工确定，但以下语义必须存在：

| 概念 | 职责 |
| --- | --- |
| 栏定义 / definitionId | 可复用内容，例如通讯录、聊天、角色检查；不代表所在左中右 |
| 栏实例 / instanceId | 本次装配中的稳定显示身份；作用于 DOM、事件、刷新、滚动与释放 |
| 业务绑定 / owner、runId、streamKey 等 | 指向实际业务对象；由调用方显式给出，不由数组下标推断 |
| 主题映射 / themeHost、themeScope 等 | 决定该栏沿用哪些既有外观与继承关系；与 DOM 实例 key 分开 |
| 装配项 / width、显隐与导航覆盖 | 当前 Workspace 对该实例的布局和行为选择 |

同一栏定义可以创建多个实例；实例 key 在所属挂载范围内唯一。更新身份应包含挂载范围，避免两个 Workspace 恰好使用相同短名而冲突。同一业务对象可有两份显示，滚动、焦点和 UI 选择独立；共享权威业务状态仍由原 Runtime 持有。

基础栏只消费 UIContext / 只读视图与动作接口，不直接持有整个 UIController 或调用 Runtime 写入口。动作回调在 Controller 侧绑定，仍经 GameCommands 执行。跨栏联动由具体 Workspace / Controller 装配层协调，不让栏查找兄弟栏或用全局当前选中项代替自己的 owner。

### 2. Workspace 用有序数组装配栏与宽度

新入口以 `columns: [...]` 为正式表达：数组顺序就是显示顺序；每项有稳定实例 key 和一个 CSS Grid track 宽度。使用项目内部可信代码声明标准 CSS track，例如 `260px`、`25%`、`1fr`、`minmax(320px, 2fr)`；无需自创尺寸表达式语言。

以下仅说明装配能力，函数名不是现有 API：

```ts
columns: [
  { key: 'chat', column: chatColumn(chatBinding), width: 'minmax(320px, 2fr)' },
  { key: 'contacts', column: contactsColumn(contactsBinding), width: '260px' },
  { key: 'inspector', column: characterColumn(characterBinding), width: 'minmax(240px, 1fr)' },
  { key: 'extra', column: detailColumn(detailBinding), width: '220px' },
]
```

- 每项只声明一个 track，显隐过滤与宽度列表同时生成，不残留空占位。默认宽度可为 `minmax(0, 1fr)`。
- 原三栏默认宽度、center-heavy 和已合并布局改为具名配置/转换函数；保持现有页面的顺序、宽度、间距及内容归属。
- 正式布局不能继续由 left/center/right class、`:nth-child` 或三列专用 grid-column 规则决定。旧 class 可以作为外观兼容标记，不得成为业务身份或刷新身份。
- 当调用方声明的最小总宽超过宿主时，明确由 Workspace 横向滚动，不静默隐藏末栏或压坏内容；正常适配桌面宽度的原页面保持现有表现。
- 独立栏能直接挂到一个有尺寸约束的普通容器中，无需伪造三栏 Frame。容器提供尺寸，栏明确内部滚动 owner。

### 3. 导航结果由装配显式绑定

优先使用少量具名回调，例如 `onBack`、`onOpenEntry`，不引入通用导航规则语言。栏定义可提供自己的局部返回默认行为；Workspace 在调用该栏时可显式覆盖。回调的执行由 Controller 适配层完成，不把 GameCommands 写入组件。

返回规则固定为：**该装配项的显式覆盖 → 栏自身已有的局部返回 → Workspace 声明的默认返回；均未提供则不显示返回入口。** 不隐式猜测“原来在左栏，所以返回游戏”。每次只执行一个返回结果，不再冒泡触发第二个全局返回处理器。

分别处理：

- Workspace 级返回：离开页面，恢复已有 returnTo；继续走原清理流程。
- 栏内返回：例如故事分类退一级、关闭本栏当前详情，只刷新实际消费者，不离开整个 Workspace。
- 同一栏被另一 Workspace 调用：可以绑定到调用方的局部返回或目标页面，不携带原 Workspace 的固定退出动作。

本次不扩展无限历史。保留 enter / replace / 单层 returnTo 语义及 Map、Area Map、Shop 等会话/主题释放职责。复用一个栏不等于进入其原 Workspace，也不自动启动、清理或取消其业务 Run。

### 4. 表现兼容以内容身份为默认，宿主覆盖必须显式

换序默认保留该栏原有背景、字体、surface、圆角、装饰、顶栏高度、控件状态及内边距；只改变占据的位置和可用宽度。原中栏移动到首位，不应仅因新下标变成左栏配色。

旧主题 hostId 可继续作为样式查询标识，但 DOM 更新和事件定位用栏实例标识，不能再“查找到第一个同主题宿主”。换序时内部标题、Tabs、气泡和浮层的主题也要保持，不能只给外层复用旧 hostId。需要继承新宿主外观的地方，由装配显式指定，并记录差异。

优先在 UI 渲染/主题适配层实现映射；如实际必须改变 Schema，先按 [[ai/guide/conventions/schema-sync]] 单独核对影响，不手工编辑生成文件。

### 5. 更新与释放沿用现有机制

建议 DOM 责任边界：

```text
Workspace frame（只拥有布局与 Workspace 级浮层）
  Column root [实例 key]（现有列根承载身份，优先不增加 wrapper）
    Presentation surface（复用现有背景和内容层）
      Header / Tabs（栏自己的导航与动作）
      Body（明确的滚动 owner、业务内容及局部浮层）
```

- 栏新增时只需栏定义/绑定与装配，不要求向 `refreshPanels()` 继续增加 Workspace kind 分支。旧入口可转换到实例目标，须列出剩余兼容调用方。
- 使用已有 behavior / element / region / structure 调度；按实例限定 region 与子目标，并正确参与批次合并、父子覆盖与过期更新丢弃，不另造 scheduler。
- 普通值变化补属性/文本；选择变化只更新消费者；栏内部结构变化替换栏内范围。换序和仅改宽度保留同 key 根节点，移动原节点或修改 track，不重新启动实例。
- 原有页面身份发生切换、栏集合增删或业务绑定变化时才执行必要的挂载/释放；同栏绑定换成另一 owner 时，旧异步回调不能再写入新 owner。
- 事件绑定必须有实例范围并避免重复；卸载清理监听、订阅、观察器和实例专属计时器。共享业务流的计时器不能因某份显示卸载而被误取消，也不能被两个显示各推进一次。
- 滚动快照按栏显示实例保存；聊天业务 streamKey 与滚动实例 key 分开。更新一栏保持兄弟栏的输入、焦点、滚动和浮层；替换范围内的 popover 仍走现有生命周期。
- 目标缺失先恢复所属栏，所属栏缺失再恢复当前 Workspace；全 App 重建仅沿用实际启动/页面切换等必要条件，不作为普通 click 的默认回退。

## 实施步骤与迁移范围

在同一 Task 内按下列可验收节点推进，不额外建立管理层级：

1. **布局与实例基础**：先补单/双/四栏、换序、宽度和身份测试，再实现有序栏入口、单栏挂载、旧布局转换和按实例定位的更新/滚动基础。
2. **真实内容复用**：抽出聊天、通讯录列表、角色检查/成长栏。使 Game、Contacts、Character、Story 的实际装配使用可调用栏；在测试宿主中交换位置、跨页调用和同页显示两实例，验证 owner、命令与门控隔离。编辑器真实页面留待后续设计。
3. **导航装配**：将首批栏的返回/打开/选择动作接到具名回调，覆盖 Workspace 返回与栏内返回；保留原 Controller 导航和业务清理。测试同一栏不同装配得到不同返回结果。
4. **现有页面迁移与兼容收敛**：将当前所有 Frame 调用方改为有序装配，抽出可单独调用的具名栏工厂，提供各自所需的业务绑定；逐页保持原布局、动作及刷新边界。Map/Operation 的跨栏关系由原 Workspace 编排，不把共享 Run 复制进栏。内容工具继续只复用纯布局。移除迁移后失去作用的固定槽位逻辑；有必要保留的兼容入口注明调用方，不长期维护两套装配模型。
5. **视觉与行为收尾**：按下表验证，更新当前机制页及受影响的 `ui-style/` 条目；记录允许的宽度换行差异和其余差异原因，集中完成地图只读复核。

第 4 步的页面清单：Game、Service（含 Datapack / Saves / Records）、Settings、Inventory、Shop、Character、Contacts、Story、Area、Area Map、Map Entry、Map、Operation；纯布局调用方为 Runtime Editor 内容工具。清单以施工时当前调用搜索为准。

不把“共享接口已实现”视为“所有现有栏已可复用”：若某页尚需固定物理位置或旧 Controller 当前 owner 才能工作，须保留为未完成项。

## 验收标准

| 场景 | 必须可观察的结果 |
| --- | --- |
| 栏数与宽度 | 1、2、3、4 栏均可装配；固定、比例、minmax 混合有效；隐藏无空 track；宽度只改配置即可，无需新增 preset/Workspace 特判 |
| 换序 | 同一真实栏从第二位换到第一/末位，原节点、输入、滚动和选择保持，动作目标不变；无重复订阅或全 App 重建 |
| 跨 Workspace 复用 | 同一聊天或角色栏定义被两个 Workspace 装配调用，无复制正文、主题外壳和事件实现；复用不自动进入原页面 |
| 嵌入普通容器 | 一个真实栏可在非 Workspace 三栏外壳中渲染、交互、滚动和释放；无需伪造 left/center/right |
| 多实例 | 同页至少两个不同 owner 的聊天/角色实例：操作 A 不改 B 的业务目标，两个滚动互不覆盖；同 owner 双显示不重复送达/自动推进 |
| 导航 | 同一栏在不同 Workspace 的返回结果可不同；栏内返回不退出 Workspace；无回调时不出现无效返回键；一次点击只执行一个结果 |
| 原导航兼容 | enter / replace / returnTo 及现有选中恢复不回归；Map UI 流、Area Map 会话、Shop 主题/会话正确释放，复用栏不误结束业务 Run |
| 更新定位 | 相同主题标识的两个实例仍准确更新；宽度与换序不改变业务身份；旧挂载/旧 owner 的排队更新及异步回调被丢弃 |
| 交互连续性 | 更新栏 A 时 B 根节点、输入/光标、滚动和范围外浮层保持；范围内浮层在替换前清理；无重复事件监听 |
| 外观兼容 | 原默认装配的背景/主题/圆角/顶栏/间距/滚动保持；换序默认跟随原栏外观，显式覆盖能采用宿主外观；不出现双层 panel、双滚动条或覆盖按钮 |
| 迁移完整性 | 页面清单中的栏可单独调用；基础布局与刷新不再要求固定三槽位，新栏不必新增通用 Controller 的 Workspace 分支 |
| 工具兼容 | 内容工具继续不注入游戏主题宿主或额外 surface，现有工具结构和专属样式保持 |

## 相关文件与资料

以下是调查与施工入口，不是修改白名单；具体已修改与仅复用的文件见实施结果。

| 路径 / 范围 | 用途与预计变更 |
| --- | --- |
| `src/ui/components/shared/workspace-frame.ts`、`src/ui/css/layout.css` | 正式有序装配、自由 track、旧布局兼容、单栏外壳 |
| `src/ui/workspace/workspace-renderer.ts`、`workspace-router.ts` | 页面装配；保持页面身份、导航与返回语义 |
| `src/ui/components/shared/workspace-titlebar.ts`、`tabs.ts` | 标题导航解耦、主题标识与物理位置分开 |
| `src/ui/components/shared/center-panel.ts`、`src/ui/components/character/contacts.ts` | 首批聊天、通讯录与角色内容抽取，显式业务绑定 |
| `src/ui/components/character/`、`story/`、`inventory/`、`settings/`、`world/`、`map/`、`operation/` 及 `src/ui/components/shared/service-workspace.ts` | 逐页栏工厂、装配迁移及原交互保留 |
| `src/ui/controller/controller.ts`、`controller-actions-story.ts`、`controller-actions-contacts.ts` 及命中页面动作文件 | 按实例绑定事件、导航执行、更新和旧入口转换 |
| `src/ui/update/`、`src/ui/interaction/scroll.ts`、`focus.ts`、`src/ui/flow/flow-scroll.ts` | 实例目标、过期保护、滚动/焦点和范围生命周期 |
| `src/ui/presentation/chat-stream.ts`、`presentation-service.ts`、`src/ui/runtime/context.ts`、`ui-host-registry.ts`、`service-definitions.ts` | 分流与动作目标、主题映射和只读依赖边界 |
| `src/ui/runtime-editor/codex/workspace.ts` | 保持内容工具纯布局特例 |
| `tests/ui/workspace-frame.test.ts`、`workspace-router.test.ts`、`workspace-lifecycle.test.ts`、`contacts-story-workspace.test.ts`、`scroll.test.ts`、`ui-update-dispatcher.test.ts` | 新行为测试和既有兼容回归入口 |
| `tests/ui/story-node-input.test.ts`、`story-node-delivery.test.ts`、`chat-typing.test.ts`、`gameplay-b-map-workspace.test.ts`、`operation-workspace.test.ts`、`area-map-controller.test.ts` | 聊天推进、门控、多实例及复杂页面回归入口 |
| [[workspace-navigation-and-rendering]]、[[workspace-route-lifecycle]]、[[ui-refresh-focus-scroll]]、[[update-dispatch-and-surface]]、[[story-chat-and-theme-presentation]]、[[ai/guide/frontend-design-project-overlay]]、[[ui-style/patterns]]、[[ui-style/foundations]] | 已核对现行机制与样式；方案落地后按实际变更更新 |

## 当前进度

- [x] 调查 Frame、栏内容复用、主题、导航、刷新和滚动的限制。
- [x] 明确轻量方案、兼容边界、现有迁移范围和可观察验收。
- [x] 先补关键行为测试，再实现有序装配、实例生命周期、真实内容栏和现有 Frame 调用方迁移。
- [x] 完成自动化行为/回归检查，复现并隔离既有失败，更新机制与样式说明。
- [ ] 完成桌面浏览器原页面/换序/嵌入/多实例视觉验收。
- 正在进行：实现、收尾检查与集中地图只读复核均已记录；等待浏览器视觉验收条件。
- 下一步：在本机浏览器访问获准后补视觉验收；不通过其他浏览器或原始调试协议绕过拒绝。

## 实施结果（2026-10-28）

- `workspace-frame.ts` 新增有序 columns、单 track width、独立 Frame instanceId、稳定栏 key、业务 bindingKey、重复 key/宽度校验和空态；旧三栏仅保留一个兼容转换边界。所有现有游戏 Frame 调用方均改为有序数组，导出相应 `create*WorkspaceFrame()`；Map Entry 外层 Run/入口元数据保持原有包装。
- 新增 `workspace-columns.ts` 管理 mount/adopt/mountColumn/update/dispose；换序和改宽保持节点及未变化的 overlay，挂载代数保护旧更新，栏变化执行清理并限定替换范围。新增 `column-actions.ts` 为宿主回调提供实例范围事件绑定。
- 新增 `content-columns.ts` 的聊天、通讯录、角色栏工厂，接入 Contacts、Character、Story；原 Game 中栏保留日志/聊天 Tabs 外观。其他业务栏可从已导出的 Frame 定义提取，并由新宿主提供具体 bind/动作依赖；没有替复杂 Map/Operation 新建另一套业务 Runtime。
- Controller 删除 Character/Contacts/Story/Settings/Inventory 七个专用 region 替换方法，统一经实例更新。旧 refreshPanels 只转换语义别名；Datapack 的合并 center 通过 panelAliases 指向实际栏。Shop、Map、Map Entry、Area Map、Operation 明确保留 external 专用 keyed 更新协调器。
- 发送/选项从实际窗格 owner 取目标，角色装备从角色栏 owner 取目标；培养补丁更新同角色的全部显示。修复全局自动推进的 absorbed 回执误随当前角色选择投递的问题。共享 ChatStream 不因多份显示重复送达或自动推进。
- ScrollManager 的面板、工作区和聊天显示快照按实例保存；复用既有 FlowScroll 和 focus/popover 生命周期。Map / Map Entry 的 Surface 身份补入 runId / mapId。
- 三份 CSS 为来源栏增加 origin 选择器，使跨宿主时保留来源规则；没有新增字体、主题系统或生成 Schema。内容工具的纯布局接入点未改为游戏 Host。
- 新增 `workspace-columns.test.ts`、`content-columns.test.ts`，扩充 `story-node-delivery.test.ts`；复用其他既有 UI 回归测试。未修改地图测试夹具、Registry 校验或失效路径测试来消除本 Task 之外的失败。
- 当前机制新增 [[workspace-columns-and-layout]]，并同步 Workspace 总览、刷新、Surface 与聊天表现页及 ui-style 两份相关记录。`workspace-router.ts`、`flow-scroll.ts`、`focus.ts`、`ui-host-registry.ts`、`service-definitions.ts`、Runtime Editor 内容工具入口仅复用，未修改。

## 验证与实际结果

| 检查 | 实际结果 / 执行边界 |
| --- | --- |
| 前一轮 workspace 调查的定向测试 | 9 个文件、98 项通过；覆盖 Frame、路由、生命周期、Contacts/Story、滚动、Flow、更新调度、Story 输入/送达。这是旧行为基线，不证明本 Task 新能力已实现；本轮未重复运行 |
| 本轮完整 UI 检查 | 99 个文件：96 个通过，3 个失败；855 项通过，26 项失败。日志 `.test-artifacts/workspace-ui-full.log`。后续新增三项覆盖命名空间、缺失栏恢复及同流回执，不把此轮早期计数作为最终计数 |
| 既有失败对照 | 通过临时 Vitest transform 为本次改动的 UI 模块载入 `git show HEAD:<path>` 源码，无工作区回退或覆盖；仅复跑失败的三个文件，仍为 26 项失败、35 项通过，失败用例名称逐项一致。日志 `.test-artifacts/workspace-baseline.log` |
| 失败范围 | gameplay-b-map-workspace：20 项；gameplay-b-map-vertical-slice：2 项；presentation-text-color-css：4 项。包含默认地图条件/候选变化、缺失 verify-clue Action、空 Enemy roster 等夹具约束，以及旧组件路径 ENOENT；均已在改造前 UI 复现 |
| 排除已确认基线失败后的 UI 回归 | `npm test -- --run tests/ui --exclude tests/ui/gameplay-b-map-workspace.test.ts --exclude tests/ui/gameplay-b-map-vertical-slice.test.ts --exclude tests/ui/presentation-text-color-css.test.ts --maxWorkers=4 --minWorkers=1 --silent --reporter=dot`：96 个文件、823 项通过；日志 `.test-artifacts/workspace-ui-verified.log` |
| 最终定向回归 | 13 个文件、117 项通过，包含新的换序、命名空间、双实例、单栏嵌入、导航覆盖、缺失恢复、真实内部滚动容器、动作回调更新、Surface 身份与送达测试；完整输出 `.test-artifacts/latest.log` |
| TypeScript / 架构 | `npx tsc --noEmit` 通过；`npm run check:architecture` 通过。早期施工中的语法/类型和 region 统计口径问题已修复并经回归覆盖 |
| 产物构建 | `npm run build -- --outDir .test-artifacts/task-0332-build-final` 通过，输出限定在已核对的 Task 产物目录，未写 dist / web-dist / src/ui/dist；日志 `.test-artifacts/workspace-build-final.log` |
| 文档静态与差异空白 | `npm run check:docs` 通过，101 份现行 Markdown、0 错误；定向 git diff --check 无报错，46 个直接影响文件另检尾随空白均通过，覆盖新增未跟踪文件 |
| 地图只读复核 | 46 个直接路径：29 个已有依据内容变化，owner 分页完整；17 个无直接 Evidence / maps_to，不能视为已映射。摘要 `.test-artifacts/workspace-map-health.json`。未改图、刷新清单或写 freshness |
| 浏览器视觉验收 | 未执行。Edge 浏览器安全审批拒绝访问 `http://127.0.0.1:5181`，工具明确禁止切换浏览器、原始 CDP 或其他绕行。待访问获准后对比原页面、换序、四栏与嵌入的桌面效果；DOM/样式来源检查不替代截图与真实 Layout/Paint 验收 |

## 剩余工作与交接

- 实现与自动化行为验证已完成，视觉验收仍缺失，因此保留活动 Task，不归档或标记全部验收通过。
- 复杂 Map/Operation 的新宿主业务适配仍按未来具体页面逐个设计，本次保留其既有协调器；共享布局和真实聊天/通讯录/角色栏可直接装配。没有实现聊天编辑器或玩家布局编辑器。
- 工作区有其他任务的文档与源码改动；只编辑本 Task 直接相关部分，不覆盖既有改动。原有 26 项测试失败没有借本次施工扩大修复范围。
- 地图复核仅记录当前依据变化与未关联路径，不扩大地图维护授权。
