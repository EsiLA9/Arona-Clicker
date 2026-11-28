# P2：在一处查看、编辑并追查整个数据包

R4 首个待评审宿主为现有游戏内 Advanced Workbench。读写、实例与复杂字段接线见[工作台构造](16-workbench-session-and-structured-editing.md)，各表怎么编辑见[全部实体的编辑能力](17-entity-editing-coverage.md)。

## 第一次编辑，从地图找到设施

假设作者正在核对夏莱导航图。他打开文件目录中的 Base 项目，或在“实体”目录按名称找到 `base:area-map:schale_office`，点击打开。实例条加入地图标签。地图中选择 `schale_main` 节点，检查器显示坐标、节点动作和目标 Area。该图的导航节点指向 Area；要访问设施，应先打开 `base:area:schale_main`，再沿 Area 的设施列表打开 `base:spot:credit_printer`。这些是连续但不同的引用。若从另一处打开同一个 Area 或 Spot，两个标签读取同一份正在编辑的数据；一个标签的滚动、地图缩放或选中项归它自己。

作者把设施名称改成临时测试名称。输入框保留焦点；当前 Inspector、实例标签和引用卡片上可见的名称刷新。目录若搜索的是旧名称，需要按现有搜索规则重新过滤，但不改搜索词、来源或展开策略。正使用该 Spot 的游戏和磁盘文件在保存前都未改变。作者只改 name，关系所指的目标仍是原 ID，不能把所有引用当成改名操作。

点击“保存”时，界面显示文件路径、此次变动和未解决的诊断。P1 根据实体归属只改原文件的这条定义。外部文件已经变化时保留两个标签共同使用的草稿，展示原来读到的内容、磁盘新内容和作者拟保存内容，由作者选择重新对齐或取消。保存成功允许项目仍有待补引用，单独显示“正式构建有错误”。只读依赖允许打开详情和复制 ID，改动须发生在实际有权限的源。工作台显示来源为游戏当前包时只提供对应宿主确实有能力执行的操作。

## 现有部件去哪里

首轮验收要走现有使用者。先从下表指定入口找到一次真实事件绑定和一次保存/提交，再变更接线，避免外壳共用了、业务仍各做一遍。

| 现有路径与作用 | 实际迁移的切入点与验收 |
| --- | --- |
| 游戏内 `src/ui/workspace/editor-workbench.ts:EditorWorkbench.project`，BrowseInstanceManager 和 `editor-explorer-service.ts:EditorExplorerService` | 现有 Workbench 负责外壳和会话，Manager 管打开、激活、复用与关闭。Explorer 独立持有查询、来源、折叠和滚动。World 的 `world-browser-provider.ts` 投影实际节点，`resolveWorldResourceRequest` 接打开请求。新增作者来源作为真实调用方，把查询与打开目标接上既有入口，不在新地图 Provider 建第二套搜索与实例条 |
| `tools/datapack-editor/model/editor-model.ts:EditorModel` 的读取/修改、Undo 与 `ui/components/field-editor.ts:renderType/renderField` | 先把普通数值、引用选择的输入输出提出来，保留现有对象/联合类型/数组映射的可用行为；字段组件交出“哪个对象的什么字段改为哪个值”。原调用方和 World 的至少一个真实字段都用这个动作。逐条替换旧的独立表/行位置写入口后才能退役。旧下标继续用来显示次序，长期编辑身份用来源+实际键 |
| Runtime Editor `dsl-editors.ts`、`actions.ts`、`subdialog.ts` | 当前 render/read 条件和 Effect、单条条件子弹窗、限制与写回已经有生产路径。提取对条件值、候选查询和字段验证的可复用部分，具体用 `renderAtomicConditionEditor`、`readAtomicConditionEditor`、`replaceConditionAtPath` 校对同一条件改动。Spot/World 调用共同编辑能力。保留 Runtime 写入适配至通过两处真实路径的行为对照 |
| Story Editor `condition-tree-dialog.ts:openConditionTreeDialog`、`condition-tree-model.ts`、`reference-navi.ts`、`structured-value.ts` | 沿现有左右栏条件树、属性页、选择器、错误定位和关闭恢复迁移。将打开弹窗所需的领域候选及确认回调分离，使 Story 触发条件和 World 普通条件实用同一编辑方式；Entry 根模式用自己的适配。正文节点、选项、Flag、演出继续用 Story 专用编辑和试播，不压平成通用表字段 |
| `src/data-services/registry/runtime-content-browser.ts:createRuntimeContentBrowser` 及其 getReferences/getEntityRelations | 现有 Codex 能查当前运行定义。先核实 `runtime-content-reference-rules.ts` 等已覆盖的字段，再复用可脱离 Registry 的提取规则，输入切换为带作者位置的定义。新关系查询交给实际引用卡、条件选择器、作者反向引用与 P6 CLI。运行 Codex 可保持运行定义的数据源 |
| `src/arona-clicker/runtime/runtime.ts:saveStoryAuthoringToPack` 与 `GameInstance.previewStoryWithContent` | 现有前者写编辑态包、后者用临时游戏。以同一 Story 草稿与目标入口做保存和试播对照。新增项目源归属时按 P1 保存，继续用实际预览宿主。让旧按钮转给新的作者命令；明确仅本次 Runtime 生效的调试路径，不会因点击“保存文件”而调用 |

“共用”的验收是两处或更多现有业务入口实际消费相同值转换、引用查询或修改命令。可以先让两个宿主有轻微外观组件差别，逐步退出重复行为。不要用一个独立演示页替代迁移证据。浏览器独立工具已有文件选择/import 与 download；能否直接写目录取决于宿主授权或本地服务。没有已授权目录时显示导入副本/导出，不承诺找到本地路径就能写。R4 在游戏内 Workbench 试点，通过明确的宿主写权限或终端适配核对实际文件回写。游戏内浏览和隔离试播继续作为实际消费者。

## 条件详细弹窗，交给作者怎样操作

进入条件可能包含任一组、全部组、数值和实际实体引用。检查器上只显示可理解的摘要，如“全部满足（2 项）”，留出“详细编辑”入口。以已确认的试点字段 `Area.enterCondition` 的实验副本，以及 StoryEntry 的 `triggerCondition` 作为两种消费者。真实世界条件以字段允许的方式预置，空值与恒真仍按本字段本来的语义解释。

1. **打开。** 记住来源实体、字段、原版本和入口控件。准备条件的副本，左侧显示嵌套树，右侧显示选中行的参数，顶部名称与底部取消/确认固定。选中现有坏字段时先定位原节点，不能把它换成默认空值。Story 现有树以 `openStoryEditorDialog` 复用 ModalManager，两栏分别滚动；Runtime 另有 `openSubDialog`。保留两个宿主的关闭规则，复用同一条件结构与组件行为。
2. **修改。** 在选中组下添加“待填写”的原子条件或子组，从菜单选择真实 supported target，填写键、比较符、数值。组内的 AND 和 OR 是 `ConditionGroup` 的实际枚举。没有通用 NOT 组。StoryEntry 界面里的“恒为 True”是现有根模式，会保留其子树；切回条件组后恢复参与判断。普通条件沿现有 `plainRoot` 模式的思路展示本字段支持的根形状。拖动前显示将插在谁前或谁的组尾，禁止拖进后代。移除一个组时告知将移除多少项。换判断对象前先给出会丢弃的不同类参数。
3. **选择引用。** 比如修改 Area 或 Story 目标，使用已有 `condition-reference-picker.ts` 的列表、过滤和详情。显示名称、准确 ID、归属与可编辑状态；“查看来源”与“选择此项”分开。搜索结果侧只回填当前那一条条件，返回原属性行与其焦点。允许的手输 ID 显示缺失或歧义。手输的错误不会悄悄清空。取消这次引用选择保留开启前的值。
4. **确认。** 按本字段所用的组规则和支持范围检查结构。首个未填的操作符、值或格式非法的参数，使左树展开到该节点，右侧显示错误并保持已输入内容。一个结构完整但项目暂时缺少引用的值，可作为待检查的源内容保存；下游构建仍阻断。确认一次只替换所打开的条件字段，产生一条可撤销的草稿操作。若字段已被另一标签更改，暂存弹窗副本并提醒重新打开或比较。取消、点关闭均不会改任何草稿。
5. **返回。** 保留 Inspector 项、滚动和原字段 DOM，局部更新摘要、错误标记和受影响关系。模拟当前 Runtime Editor 的限制：`content-policy-dsl.ts` 的有限入口为四层、每组八项；`dsl-editors.ts` 对超出区有保留原值的路径。它们是现有特定编辑能力的边界。共同弹窗不得据此全项目截断旧数据；超界显示不可改部分与源码入口，扩大能力另做试验。

验收既检查值也检查节点。打开弹窗后修改三项再取消，应无历史项；再修改相同三项确认，撤销一次还原全树。确认不应导致地图重建或另一条 Explorer 滚动丢失。旧条件含超深子树，修改同层另一项后对照其原始字节或语义完整性。具体自动 test 从 `tests/ui/runtime-editor/runtime-editor-dsl-safety.test.ts`、`tests/ui/story/story-editor-authoring.test.ts` 与 `tests/ui/story/story-editor-reference-navi.test.ts` 找真实入口。

## 引用、普通字段和复杂字段各怎样处理

普通名称/数值/枚举在原位编辑，只有已有字段类型允许时才转换数字、布尔、空值。对于多行描述保留换行。对象、并列列表和有序集合用相应控件，增删和移动携带本组稳定元素位置。普通字段与可独立编辑的对象同样走选中实体的草稿写入。验证结果给出字段路径和相邻说明。

关系从已识别合同的引用字段生成。例如 `AreaMap.nodes[].action.areaId` 在动作类型为 attemptAreaTravel 时指向 Area；打开地图节点到 Area 是正向，Area 找包含该动作的地图节点是反向，两边由同一条记录产生。 `areaMapId + nodeId` 才能区分不同地图内的同名节点。Area 中的 defaultSpots 另指 Spot。 `StoryEntry.storyId`、Entry card 请求和条件目标也按类型取路径，不从所有字符串猜目标。作者输入一个目标时，选择器给出限制类型、当前值、来源及查看按钮，同一结果也供终端。无法解析的文件可能藏着额外引用，应显示“检查不完整”并限制自动重命名或删除。动态表达式显示为可能引用，必要时打开原字段人工核对。

Effect 和操作编辑先选真实 `op` 或 Story 节点动作种类，再按当前合同显示目标及参数；同样提供取消、一次确认与整体撤销。一项动作的数据即使能被普通表单编辑，也应指明会改资源、写局部标记或触发事件。新增联合分支时保留旧分支草稿直到确认切换。地图和 Story 节点分别保有专用表示，地图首轮共享通用字段及关系，能力充分后才添加图形编辑。任何未知字段均可查未处理原文，避免编辑 name 后将不认识的字段丢弃。

## 让全量覆盖有一个查法

以 `src/data-services/contracts/datapack.ts:Datapack`、`fragment-parser.ts:DATAPACK_LIST_FIELDS/DATAPACK_SINGLETON_FIELDS`、实际生成 Schema 对照。每项标记可查看、创建、编辑、删除、正反向跳转、有专用组件或仅源文，以及是否有真实使用者测试。以下是迁移分组，分到某组说明需要覆盖，并非当前实现全部支持。

| 分组 | 实际数据表或对象 |
| --- | --- |
| 世界与导航 | inits、areas、spots、areaMaps（内含 nodes、edges），导航与世界揭示字段 |
| Story | stories、activeStories、passiveStories、passivePools、storyDirectories；节点、入口条件、目录及奖励分别编辑 |
| 物品、商店、成长 | items、dropTables、shops、enhancements、resourceDisplays、gachaPools、gears、gearConfig、cultivateCurves、favoriteItems、uniqueWeapons、traits |
| 角色与表现 | characters、characterVariants、charaProfiles、characterPersistConfig、affectionConfig、pics、colorGroups、colorEquipments、themeDesigns |
| 触发与资料 | affectorPacks、triggerDefs、milestones、milestoneListeners、achievements、funcletDefs、tags、extras |
| 其他已有合同 | maps、operationEvents、operationLocations、operationActions、studentOperationProfiles、operationStrategyProfiles、operationCardPools；首轮检查普通编辑和保真，玩法 B 专用产品设计暂缓 |

Manifest 和表级单例在项目视图单独打开。对没有 ID 的记录按其领域身份或受限文件路径处理，不伪造统一 ID。领域新表通过已有 Schema 和关系声明获得普通目录及编辑能力。只有结构/交互确实不同才添加专用工具。

## 宽屏操作与实际接线顺序

页面继承 `ui-style/visual-languages/authoring/patterns` 的工具带、实例条、Explorer、Inspector、条件树及引用选择。布局从左至右为可独立浏览的来源目录、内容、属性，底部可折叠诊断。入门操作按钮靠近对象，跨项目检查/构建放现有工具带。三个栏位和输入元素按现有刷新分级保留。切换来源不强制切活动实例；激活实例不清默认查询。点击关系后需要定位目录时用明确定位命令。诊断只更新自身容器，确需换内容类型时只替换当前资源区域，处理其锚点内浮层，其他栏位保留 DOM 和滚动。

第一步让 World 查看来自文件的 Area/AreaMap/Node/Spot，并支持真实保存名称和一个引用。第二步让 StoryEntry 与 World 字段共用条件组件，继承现有 Story 根模式与 Runtime 局部限制的差别。第三步将引用查询接到实际选择/跳转、检查面板与 CLI。第四步接专用 Story 和地图，再按清单扩覆盖。每步用至少一个旧入口和一个新使用者回归，并列要退的旧函数或调用链。

首批人工操作应该能做完：打开夏莱地图 → 定位主厅 → 找打印机 → 修改名称 → 看到另一个标签同步 → 编辑有 AND/OR 的测试条件 → 保存到正确文件 → 用诊断跳回字段 → 试播或回到原实例。另验同名不同 ID、标签关闭后仍可编辑、源外部移动和文件冲突、只读依赖、取消条件和旧诊断失效。现状验证限制、宿主取舍见[决定 D05](10-decision-register.md)和[现状审计 A04/A06–A10](11-current-implementation-audit.md)。
