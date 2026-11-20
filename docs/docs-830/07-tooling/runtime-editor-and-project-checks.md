# docs-830/07-tooling/runtime-editor-and-project-checks — 游戏内编辑器与工程检查

本文回答：游戏内 Runtime Editor、独立 Editor、开发入口和项目检查分别承担什么职责。

## 编辑器职责

游戏内 Runtime Editor 位于 `src/ui/runtime-editor/`。它集成在当前游戏 Runtime 中，提供包目录、内容草稿、定义编辑、诊断与内容浏览等 UI；创建、替换或删除定义通过 Controller 命令交给 Runtime 内容协调器，由 Runtime 校验并写入对应编辑包。图鉴只读查询使用当前 Registry，不等于编辑草稿。

### AreaMap 与世界信息

游戏内 Runtime Editor 可编辑 AreaMap 的名称、描述与收录方式，并以 JSON 集合维护节点、连线、`openCondition` 和 `reveal`；Area 也可编辑 `enterCondition`、`onVisitReveal` 与四面信息规则。每次应用仍经过内容策略、地图形状 / 引用校验与 Registry 热提交；相互引用的地图批量提交，失败会回滚。编辑地图只是作者操作，不会收录玩家地图或观察其隐藏信息。Schema 的复杂 AreaMap 与 Story 节点字段保留 JSON 编辑能力，完整约束仍由源契约和 Registry 校验。

独立 Datapack Editor 位于 `tools/datapack-editor/`，以 Schema 驱动的本地模型为中心，导入/导出 JSON 或 ZIP；它不连接当前游戏 Runtime。两者共享内容契约和 Schema，但拥有不同的状态与提交边界，具体见 [[datapack-editor-and-schema]]。

### Story Editor E1

Story 新建必须在 ModalManager 中选择并确认一个仍存在的编辑态 Mod；取消或没有编辑态包均不创建草稿。完整 ID 为 `mod:story:story_number`，按同 Mod 的已知包、Registry 和草稿中最大编号继续分配，内部 draftId 独立保持稳定。每份草稿的 targetPackId 持久化绑定具体编辑记录，切换 Story 恢复该目标；不能通过保存目标下拉隐式跨 Mod 迁移。概述的“更改 ID”仅接受同 Mod 的名称段，预览合同声明的引用；未发布内容只改草稿，包内内容经 renameStoryInPack 一次保存新身份、受影响引用与旧身份删除，不热改 Registry。正文、Extra、Flag、Node / Entry ID 不替换；真实休眠 Transfer 缓存、浏览历史、Flag 信息获取键与属性页记忆同步身份。重名、过期目标、不可同包提交的引用或未保存新增 / 删除项会阻止提交，包写失败沿用 savePack 回滚；草稿改名先验证本地保存，失败保留原身份。已完成包内改名的来源身份以 renamedFromId 保留至重新载入，避免把新内容再次应用到旧运行环境。另存为新身份仍是独立复制，删除草稿仍不删除包内容。入口 `story-editor/identity.ts`、`data-services/authoring/story-identity.ts` 与 `runtime.ts`；验证见 `tests/data/story/story-identity.test.ts`、`tests/ui/story/story-editor-identity.test.ts` 和 `tests/engine/story/story-authoring.test.ts`。

StoryDef 右侧属性提供概述 / 关系 / Flag表 / 其他工具包 Switch。概述含名称、ID、来源与起始空间；关系含调用 / 被调用及关联 Entry 管理；工具包含 Extra、复制身份、校验应用、试播与目标包保存。四页按稳定 key 常驻，以 hidden 切换，字段值仍由唯一草稿持有；切换页签和从节点属性返回时恢复相应页的滚动。在 Flag 页切换 Story 或前后浏览时继续显示 Flag 表，恢复目标 Story 的该页滚动；点击表内来源仍选中并定位节点，但不切到节点属性。完整 Flag 表不再出现在 StoryNode 属性，局部条件与 Navi 仍保留。Flag 页的关系组按 Story Transfer 双向连通，关联起始 Entry 分别作为局部作用域根；跨 Entry 的潜在调用继续经草稿的获取确认，其他 Entry 的局部名称仅展示，不视为当前可用。Flag 表项默认仅显示沿用 Choice 标记配色的名称色块，点击原生 summary 展开 / 收起提供方（写入 / 回传声明）、需求方（读取），移除操作单独列出；作用域与绑定提示位于展开内容中。展开状态属于已挂载项，局部协调保留 open，不写入草稿或触发刷新。Flag 表行收起时也接收当前 Story 的节点拖放：有合法写入 / 回传声明的局部名称绑定到 requiresFlag，冲突条件拒绝覆盖，同条件重复投放不改草稿；全局名称、私有名称、过期 / 跨草稿载荷及禁写状态拒绝绑定。投放不改变节点顺序，不推进 Runtime，不离开 Flag 页。来源按钮仍独立导航。实现入口 `flag-catalog.ts`、`flag-table-binding.ts`、`view.ts`、`controller.ts`；行为验证见 `tests/ui/story/story-editor-inspector-tabs.test.ts` 与 Flag / workspace 定向用例。

新建节点默认采用类型加三位序号：Talklet 为 `talk-001`，Click 为 `click-001`，其余为 `operation-001`、`transfer-001`、`move-area-001`、`move-chara-001`。每个 Story 按类型寻找未占用的正整数，超过 999 后自然扩展位数，并避开已有节点及编辑缓存身份。正文编辑、换序和类型切换保留现有节点 ID；已有内容不批量重命名，复制继续使用 `-copy-<编号>` 后缀。分配器与粘贴共享 `storyNodeIdsInUse()`；行为验证见 `tests/ui/story/story-editor-model.test.ts`。

StoryNode 支持右键复制，节点间与末尾插入横线支持右键粘贴。剪贴板由 StoryEditorController 持有，保存节点及其独立编辑缓存快照，可在同一编辑会话内跨 Story 使用；不写系统剪贴板或游戏状态。粘贴分配未占用的 `<基础名>-copy-<正整数>`，去除已有副本后缀并为后缀预留 64 字符上限；同时避让目标草稿内的节点与缓存身份。内部编辑行身份重建，未完成数字输入、隐藏分支与可选字段缓存独立复制；Choice 局部选项 ID、flag 名称、覆盖层 ID、stageId 和其他内容引用保持原义，跨 Story 缺失的引用由现有校验报告。空剪贴板 / 禁写状态禁用粘贴，失效插入点不退回末尾。菜单锚点受 DOM mutation 生命周期管理，粘贴经原草稿插入与区域协调更新，不启动或推进 Story。入口 `node-clipboard.ts` / `node-context-menu.ts`，验证见 `tests/ui/story/story-editor-node-clipboard.test.ts`。

内容引用提供与局部标记同类的搜索 Navi：覆盖 Story / Entry、起始场景、角色 / 差分、资源 / 设施 / 强化 / 物品、图片、色彩组、Funclet、全局标记与覆盖层 ID，以及 Entry 结构值中的引用和 availableInits 列表项。原字段目录是候选来源；Story / Entry 同时读取注册内容与当前草稿。搜索只过滤已挂载行，选择沿原 input / change 入口回填；查看 Story / Entry 来源才导航。固定枚举保持原控件。装配前后以字段稳定 key 协调，恢复焦点并保留滚动；切换文档 / 离开关闭选择窗，过期或禁写字段拒绝回填。入口 `story-editor/reference-navi.ts`，验证见 `tests/ui/story/story-editor-reference-navi.test.ts`。

Talklet 的发出方选择写入 `content.characterId`，默认名称与头像由角色数据解析；双击编辑流 `.chat-name` 或修改右栏自由显示名，均写入独立的 `content.displayName`，不改角色引用或旧 `speaker`。姓名单行编辑，Enter / 外部点击结束、Esc 恢复，清空临时名回到角色默认名或旧内容名称。“头像引用”从图片目录选择并写入 `presentation.avatar`，覆盖角色默认头像；清空恢复角色头像，隐藏头像仍由 avatarMode 控制。姓名会话复用正文原位编辑，不写入游戏状态。验证见 `tests/ui/story/story-speaker.test.ts`；按本次要求不做浏览器验收。

Talklet / Click 正文支持在编辑流中双击原位编辑。对话与旁白写入 content.text，Click 按钮、入口卡标题 / 按钮与接续按钮各写原字段；Choice 按选项的稳定属性 key 独立写入，不套用共用正文赋值。输入实时更新作者草稿，正文类字段复用 `editStoryNodeBody()`，属性表单随既有区域刷新同步；编辑文本子树由浏览器持有，避免刷新移动光标或打断组合输入。点击外部、保存与离开结束编辑，Esc 仅恢复本次目标字段及对应正文缓存，粘贴只写纯文本。切换目标、节点 / 分支失效或存储只读时不继续回填；活动会话不进入本地持久化、Story 定义或游戏状态。入口为 `story-editor/inline-text.ts`，回归为 `tests/ui/story/story-editor-inline-text.test.ts`。

从外部星图进入时，编辑器通过 `SelectorPage.currentTheme()` 读取当前聚焦主题的完整投影，保留背景状态变体、节点颜色和表现配置，不读取与星图分离的游戏运行主题。每次进入更新“打开时主题”的来源，已手动选择的编辑器主题继续保留；未指定背景和正文 token 时使用共享主题树的浅色基础角色。完整投影保留背景定义中的图片引用，由既有背景服务解析，不从已渲染样式反推作者定义。

「需要局部标记」输入在 focus / click 时展开就地自定义下拉，保留独立 Navi 作为来源浏览入口，不触发原生 datalist。候选由 `required-flag-dropdown.ts` 沿反向 Story Transfer 查找调用上下文，再汇总同一 Entry / Story 转移链中实际写入或声明回传的名称；不列出全局标记、只读 / 仅移除名称或其他 Entry 的私有标记，循环去重。首次打开字段为空或已有文本时均视为全满足；继续输入后按名称不区分大小写筛选，满足项保持实色，未满足项稍浅且仍可选择，不隐藏或禁用。下拉行按名称 key 保留，筛选只改变样式；选择前重新核对候选，点击外部、失焦至范围外、切换文档或离开编辑器关闭。该清单仍是潜在调用范围，不保证某次运行已写入对应键。验证见 `tests/ui/story/story-editor-required-flag-dropdown.test.ts`。

局部标记字段旁提供独立 Navi 选择入口，覆盖 requiresFlag、Operation / Button / Choice 的局部标记名称，以及结构化 localFlag.name / returnFlags 项。`local-flag-navi.ts` 复用 ModalManager，按名称、来源 ID、节点 ID 与用途搜索；搜索只隐藏 / 显示已挂载候选，选择只填回原字段，查看来源单独进入既有 Story / Entry 导航。非回传字段禁止选择其他 Entry 内部标记，returnFlags 允许从已获取信息中挑选内部名称。取消恢复原字段焦点，字段失效时拒绝回填；切换故事或离开编辑器清理 Navi。选择写入动作的名称仅赋值，不触发手写名称时的级联重命名。名称分配、可绑定提供方与级联改名只访问合同中的局部标记字段及精确的休眠分支缓存；普通 localFlag.value / Extra JSON 不参与，Overlay EntryCard 的显式 returnFlags 则按真实回传声明处理。参考独立 Editor Navi 的候选 / 来源分离职责，不依赖其 EditorModel、表索引或事件总线。行为见 `tests/ui/story/story-editor-flag-navi.test.ts`。

Story 编辑器具有独立的界面主题会话 `uiTheme`：顶部主题浮窗提供全部 Registry 色组与无解锁条件的编辑器自定义主题，色组切换和自定义预览均由本地 `StoryEditorTheme` / `RuntimeThemeManager` 解析，经既有主题变量、背景与表现宿主刷新接线显示；不调用玩家主题激活或用户主题存档命令。双击移动到 Area、移动到通讯录或顶部起始场景卡片，会应用目标内容定义的完整主题；单击仍只查看相应属性，缺失目标不切换。自定义表单复用原有颜色 / 图层 / 宿主 / 组件编辑器及校验，支持实时预览、取消和「应用到编辑器」。主题只在当前 UIController 会话内保留，关闭后游戏仍使用自己的主题，重新打开编辑器可继续该会话主题；刷新应用后不保留这份界面主题，也不写 Story 草稿、定义或玩家状态。原有主题内容编辑预览另行保留，退出成功后清理对应预览。源码为 `story-editor/theme.ts`、`scene-view.ts`、`controller-theme.ts`、`controller-actions-theme.ts` 与 `controller-modals.ts`；行为见 `tests/ui/story/story-editor-theme.test.ts`。

StoryDef 的 Flag 页与 Entry 信息栏提供派生的 Flag 表，区分 Entry 局部标记与持久全局标记，逐项列出读 / 写 / 移除 / 回传声明、所属作用域与来源路径；Story 来源可定位作者节点。Story 自动沿 goto / insert 和结果转移收集所有潜在分支；跨 Entry 的信息需通过「获取 Entry flag 信息」确认，可拒绝或重新选择。确认以调用位置、目标 Entry 及稳定节点 / 动作行身份保存在草稿侧 `flagImports`，换序与重载保留，不进入 StoryDef / Registry。Entry 清单完整遍历潜在调用集，不受某个 Story 的获取选择影响。内部子 Entry 局部名称单列，不作为父 Story 的局部候选；父侧只提供本链名称与明确的 returnFlags 声明。局部 / 全局输入提供自由输入的名称候选，修改不改变运行时作用域或白名单。Extra 值与休眠编辑分支不参与收集，循环去重、缺失目标显式提示；清单不保证到达节点时标记已存在。实现为 `flag-catalog.ts` / `flag-catalog-view.ts`，测试见 `tests/ui/story/story-editor-flag-catalog.test.ts` 与 workspace 用例。

中栏的 `moveToArea` 与 `moveToCharaspace` 以 AreaHero 风格显示「前往……」卡片：Area 从目标定义的 theme 构建局部渐变，通讯录从角色对话主题或默认色组解析主色并绘制单色卡片；名称取 Registry 目标定义，预览不切换当前区域、对话或全局主题。节点点击仍只选择并编辑其属性。Story 流顶部从 `startContext` 绘制「起始于……」占位，点击进入 Story 属性配置起始场景；未配置 / 缺失引用保留提示。占位只存在于编辑器 DOM，位于首个插入点前，不增加 StoryNode 或额外持久化数据。入口为 `scene-view.ts`、`view.ts`，行为见 `tests/ui/story/story-editor-scene.test.ts` 与 workspace 用例。

左栏顶部提供 Story、Entry 与发出方标签；标签只切换目录，不改变中右栏当前查看对象。Entry 目录合并 Registry 的 Active / Passive Entry 与已有作者草稿，草稿同 ID 内容优先，并排除草稿显式删除项，支持独立的名称 / ID 搜索。点击 Story 或 Entry 通过同一查看目标切换中右两栏；Entry 中栏复用原有结构化 Entry 表单，配置字段、故事目录、所属 Story 共用的 PassivePool 表单及新增 / 移除操作，以及草稿保存 / 校验 / 应用操作；右栏显示调用关系。Story 右栏的关联 Entry 区域仅保留链接与新增操作。Entry 页面编辑所属 Story 的既有作者草稿，未新增独立 Entry 存储；保存后重新打开可恢复所属 Story 并再次进入 Entry。前进 / 后退共用一份 Story / Entry 浏览历史；返回已访问的 Story 可恢复节点选择、插入位置、滚动与未发送文字。查看目标与历史属于编辑器 UI 会话，不写玩家状态；既有本地草稿信封保持不变。

Story 属性右栏提供直接「调用表」与「被调用表」；Entry 右栏提供递归展开并去重的「潜在调用集」与直接「被调用表」。`relations-model.ts` 复用已声明引用收集器，从 Registry 合并当前 Story / Entry 草稿，按一次调用位置保留来源，建立双向关系；不另存关系表。调用包括独立 Transfer 的 Story 转移、Operation 的 Entry 请求与覆盖层卡片、Click 入口卡、Entry 起始 Story、独立后续、旧羁绊绑定及奖励 / 完结反应中的 triggerStory。已读条件、前置条件、分支门控与 Extra 文本不作为调用。潜在调用集包含条件分支并跨 Story / Entry 展开，循环按目标身份去重，不判断运行时条件或实际执行顺序。缺失目标保留 ID 并禁用跳转；关系项复用现有 Story / Entry 导航与浏览历史，不播放剧情。

中栏顶部提供故事浏览的后退 / 前进，左栏选故事、新建及 Transfer 目标跳转共用一份最多 50 步的会话内历史。返回恢复节点选择、插入空位和中 / 右栏滚动；未发送正文仍按草稿保留。后退后打开另一故事会截断前进记录，删除后已不存在的目标在回溯时跳过。切换前保存失败则留在当前故事。历史不进入草稿持久化、StoryDef 或玩家存档。独立 Transfer 及右栏转移属性显示 goto / insert、目标名称和 ID；节点流中的转移主体只选择 StoryNode 并查看属性，只有右侧独立目标小卡片打开作者文档，优先使用本地草稿。缺失目标保留 ID 并禁用跳转，目标小卡片与 Entry 导航共用稳定深色样式。Click 的 StoryEntry 卡片导航见下文。入口为 `transfer-view.ts`、`controller.ts`，行为见 `tests/ui/story/story-editor-workspace.test.ts`。

游戏顶栏右侧的“Story 编辑器”打开独立 `story-editor` Workspace，大厅未进入 Init 时也可用。左栏查询当前 Registry 的 Story 定义与本地草稿，按名称/ID 搜索；中栏按 `nodes` 顺序呈现作者节点并在固定底部输入；右栏编辑当前节点，未选中时编辑 Story 名称。三个栏使用共享顶部、单一表面和独立滚动，入口不复用播放用途的 `story` 路由。

作者可以追加角色、老师或旁白正文，显式追加单按钮 Click，以及暂未配置的 Operation/Transfer。正文与旁白复用纯 `renderChatEntry`，不绑定游戏 `ChatStream`、发送 token 或剧情推进；老师是右侧 talklet。节点点击/右键均为选择，Click 在编辑器里不会执行剧情；entryCard 右侧独立目标小卡片显示 Entry 名称与 ID，点击只打开目标 Entry 编辑页，主体预览只选择节点。兼容 kizunaCard 在关联目标唯一时同样支持右侧目标跳转。目标缺失或未配置时保留提示并禁用小卡片，外围节点仍可选择；areaContinue 不跳转到其他 Entry。编辑器不提供播放、导出或包发布；显式写入当前 Registry 的原型入口见下文。

右栏属性面板顶部以 Switch 切换 Talklet、Click、Operation、Transfer、移动到 Area 与移动到 Chara，下面呈现当前分支基本项、可选能力、字段诊断与节点操作。节点 ID 只读，类型切换保留同一 node.id；切换类型或分支只改变启用状态，旧输入休眠在草稿，恢复时取该节点/该行最近一次输入。Talklet 与 Click 共用一个草稿“正文”：Talklet 对话/旁白使用 `content.text`，按钮和入口类 Click 使用对应文案字段。正文跨类型和子类型切换保留；切入空选项组时仅在首次创建时把正文作为第一项，已有选项保持不变。该共享缓存仅用于编辑，不进入 StoryDef。未启用可选能力时保留开关并收起子项；启用后立即渲染字段，首次进入不代填目标、空效果或首个目录项。不适用的分支不显示也不提交。旧 `stageId` / `stages` 作为兼容字段保存在内容中，不在属性栏编辑，也不决定播放顺序。

字段矩阵覆盖 Talklet 的 talk/narration、呈现与节奏；Click 的 button（文案与 press）、choice（有序选项、出现条件、选择标记及后续关联）、entryCard（固定 active/card、owner 全局 null 或角色游标）与 areaContinue。编辑器不提供 kizunaCard 作者模式；已有内容仍由兼容运行时处理。入口类按钮文案为空时沿用各自运行时默认描述。Operation 的 state/travel/entryRequest/overlay/presentation 及 localFlag；Transfer 的 goto/insert。呈现字段常显，在“呈现”标题下平铺气泡位置、文字对齐、头像显示与头像引用，各有标签和用途说明，不需要先启用整个对象；未填不代写默认值，下拉框可切回默认并移除对应字段。老师回应由作者追加为 Talklet；分支回应可让 Choice 的 marks 声明选择标记，再由后续 Talklet 的 `requiresFlag` 控制。StoryAction 列表在同一编辑块内复用，行身份来自草稿稳定 rowId 而非数组索引，支持增删与上移下移。style 使用合同明确定义的字段（font/fontSize/color/background/backgroundColor），不写 CSS；theme 的 scope 是特殊切换，只休眠/恢复 area 或 student 的 entityKey，颜色组与 palette/tokens/nodes/background 覆盖保持；setEntityPresentation 先选 target，再选该实体的 optionId，缺目标时选项控件禁用并说明。

Talklet / Click 的基础设计区域由 `renderStoryNodeBasicProperties()` 独立挂载，仍读取同一节点草稿；右栏以常驻“内容｜外观｜演出”页签显隐同一节点的表单，不启停能力或复制正文。按钮基础次数和随机增量平铺显示，无启用 / 配置步骤；全部清空恢复单次按钮，只填随机增量而缺基础次数时保留草稿并拒绝发布。非右侧对话的输入 / 思考秒数在演出页直接编辑，0 明确关闭、空白采用默认；旁白和右侧下休眠，切回左侧或默认位置恢复最近输入。临时显示名不随角色选择清除，“不指定角色”移除角色 / 旧 speaker，图片、头像和入口标题清空后省略字段。Choice 出现条件与入口卡续接用一个创建 / 恢复操作，关闭后保留缓存，恢复时不覆盖旧条件、赴约地点或回传标记。无效数值仍以原文字保存，发布校验与字段定位保持原有入口。

演出页编辑节点的 `performance`：`layout` 使用随流或定位两种分支，定位基准与偏移由中栏浮层工具、拖拽和右栏输入共用。演出页另有 Talklet 的 `performance.pacing`。外观页编辑 `appearance`，Talklet 可选择正文模板和气泡 / 头像，Talklet / Click 均可覆写字型、字号、文字色和背景。样式仅接受有限声明，字号带 px / em / rem / %，颜色复用引擎解析；无效值保留在草稿、拒绝正式投影，也不作为任意 CSS 预览。外观和演出分别恢复默认。两组配置随节点 ID 保留，换型只替换基本数据；本地草稿保留休眠字段，发布和隔离预演只投影当前类型适用的配置。旧草稿导入时提升旧外观及节奏字段，冲突优先保留当前分支。定位展示的生命周期见 [[story-and-effects]]。Operation 的“清除节点展示”提供 Story / 节点候选和查看目标入口，改名与副本同步维护清理引用；旧 overlay.show 的作者入口仍由后续迁出任务处理。

定位节点仍在作者流中正常渲染。节点上的迷你“演出”按钮开启该 Node 的演出编辑态，同时选中它并显示演出属性页；旧 Operation 显示原属性页。再次点击“结束演出”只关闭该预览；多个 Node 可独立开启，不随当前属性选择改变。开启内容复用正式定位 renderer，在中栏正文视口的非滚动层持续展示。只为当前选中且开启演出的定位节点浮出一组工具。`layout.anchor` 的横纵组合对齐窗格与内容的同名点。X 向右、Y 向上为正，默认是按窗格宽高计算的 −1–1 比例，`layout.unit: px` 使用有符号 CSS 像素。切换单位按当前视口换算同一组 X/Y。没有 anchor 的旧节点仍以左下为原点。首次选择基准将所选轴的偏移置零，另一轴保留原位置。已有基准的节点切换基准时保留两轴偏移。宽度由自然尺寸、70% 上限和锚点实际可用空间共同决定，拖拽保留抓取偏移，释放时写回所属节点坐标，取消时恢复；不会改写另一个选中节点的属性输入。旧 overlay.show 使用同一入口，预览不绑定游戏推进或 Entry 启动。开关按草稿 / 节点记录在 UI 会话，不进入 StoryDef 或本地草稿存储。原有顶部小画布已移除；共享视口包装层保留原 body 滚动身份，见 [[workspace-columns-and-layout]]。


Choice 的每个选项预览左侧有局部标记绑定卡。将该 Choice 后的 StoryNode 拖入卡片，会成对维护 option 的 `marks` 名称与目标节点的 `requiresFlag`；标记名使用 Story、option ID 和递增序号组成的 `Story-choiceId-num` 风格。卡片能列出绑定节点、逐项解除并级联改名；解除只去掉目标节点条件，保留选项的选择标记声明，避免误删其他 Story 或回传仍在使用的名称；不再需要的标记通过属性栏显式移除。自动生成的类型序号 ID（及旧 `node_<32位hex>`）会收到可取消的易读 ID 更名提示。标记反查与创建受标记节点目前只提供模型接口，不增加 UI。绑定使用 Choice 专用声明字段，不生成通用动作或作者清理列表。

Choice 属性只围绕选项文案、出现条件、选择标记与后续节点关联组织；选项身份和稳定行 key 保留，不显示共同局部动作、通用结果、任意标记值或内嵌 transfer。出现条件使用 `showWhen`（持久条件组）及独立的 `requiresFlag`（Entry 局部存在条件），运行态隐藏未满足项；选择记录使用 `marks` 名称列表，成功接纳选择后由 Runtime 替换本组记录，作者不维护 remove。业务效果由后续受 requiresFlag 控制的 Operation 承担，goto / insert 使用独立 Transfer。旧草稿中的 sharedActions、option condition/result 显示原始值诊断，显式处理前拒绝正式投影；不会加载后静默删字段保存。Button 不再提供 result 编辑与执行；旧草稿中的 result 保留原值并显示显式移除入口，处理前拒绝发布。内置按钮效果已按顺序拆到后续独立节点；旧播放等待点不作存档迁移。条件与零候选推进规则见 [[story-and-effects]]。

引用目录来自当前 Registry 的完整内容表（含 `characterVariants` 与 `pics`），不按玩家解锁/拥有状态筛选；当前 Story 自身允许引用，其他未提交草稿不能成为有效引用。图片字段同时提供目录候选与自由输入，自由 speaker 是显示名而不是角色外键。缺失引用显示原值并报错，不跳回首项。

本轮编辑能力的明确边界：条件复用现有条件树渲染，复杂只读值（palette/tokens/nodes/background、数值表达式、嵌套 ExtraValue、过深条件树）只读保留并完整参与提交；可显式清理或改选已支持分支，不提供完整可视化设计器，也不生成 `{}` 冒充已配置值。

作者内容仍只有 `nodes` 一份有序列表；`stages`、extra 和所有未开放字段按兼容规则保留。中央流在每个节点前与列表末尾呈现可点击的插入空位，编辑器只在内存中以稳定节点 ID 锚定当前位置；composer 的正文、Click、Operation 和 Transfer 都插入当前位置，连续添加时空位留在新内容之后。空位不是 StoryNode，不进入草稿、StoryDef 或 Registry。每个节点可拖动到空位或节点上下半区换序；拖放只改变 `nodes` 顺序，保留节点 ID、兼容 stageId 和节点内容，过期或跨草稿的拖拽载荷会被忽略。Talklet 后紧邻可用 Click 时，文本送达后自动衔接到该输入；没有紧邻可用 Click 时，文本送达后等待用户自由点击。连续 Click 逐个呈现。阶段推进方式、阶段分组连续性与每阶段 Click 数量不再限制保存或播放。类型切到 Talklet/Click 时仍自动填充合同要求的兼容 stage 字段，不会自动补 Click。未配置 Operation/Transfer 仅在专用草稿类型中允许缺省载荷，正式 StoryDef 合同不变。

草稿通过 `StorageAdapter` 保存到独立 `acprogram_story_editor_drafts` key，版本信封与来源 ID 独立于 PlayerState、游戏存档和 Runtime Editor 的包草稿。`editorState` 只存草稿侧元数据：分支缓存、可选开关、稳定行身份、原始数值文本与字面量类型；它不进入 StoryDef、extra、PlayerState 或 Registry。插入空位是 `StoryEditorState` 的临时节点锚点，不属于草稿，也不会持久化。打开注册来源时深拷贝，单纯浏览不保存；修改后保存、切换 Story 或离开时统一写入本地。重命名只改副本，删草稿仍保留注册来源。旧草稿、Registry 来源或显式 Runtime 投影遗留的 Button / ChoiceOption `reply` 字段会在对应导入/提交边界丢弃。未发送文字在会话内按文档保留，不自动变成节点或进入持久化文档。

不完整草稿允许保存：草稿信封只校验已填字段的基本形状，缺省 text/options/card 等载荷仍是合法草稿。保存失败保留内存内容并阻止切换/离开，重试成功才标记已保存。加载发现损坏/不支持的版本时保留原存储，暂时只读浏览，避免覆盖作者资料。

`StoryEditorController` 持有独立 UI 会话，普通更新由既有 dispatcher 的 `workspace.story-editor` region 合并，按节点 key 协调 DOM；编辑输入、滚动容器和未改节点保留。主题背景与内容包装有不同身份，主题插入背景不应替换正在输入的内容。Frame 缺失时先恢复页面内容区域，shell 缺失才恢复当前页面。返回保留进入前的 Workspace 和导航，已失效的目标回到游戏。提交失败时先选中出错节点，再由同一次 refresh 在补丁完成的 DOM 中聚焦对应字段，不假设微任务时序。

源码入口：`src/ui/story-editor/model.ts`、`property-model.ts`、`property-fields.ts`、`property-options.ts`、`persistence.ts`、`view.ts`、`dom.ts`、`controller.ts`；接线位于 `src/ui/controller/controller.ts`、`controller-actions-topbar.ts` 和 `src/ui/workspace/workspace-renderer.ts`。行为、属性表单与 DOM 连续性见 `tests/ui/story/story-editor-model.test.ts`、`story-editor-workspace.test.ts`、`story-editor-properties.test.ts`、`story-editor-properties-model.test.ts`。按用户要求只做代码与自动化验证，未做浏览器验收。

### Story 作者事务、结构值与投放

Story 信息右栏提供文档身份、Extra、关联 Active / Passive Entry 链接与新增、校验、隔离试播与目标包保存；Entry 与 PassivePool 详情在 Entry 中栏编辑。`hydrateStoryAuthoring()` 从只读目录复制当前文档关联数据；`compileStoryAuthoring()` 只收集当前 Story 及草稿中的引用依赖，不让无关的未完成草稿阻塞提交。重复来源的冲突修改显式拒绝。「另存为副本」复制正文，保留原 Story / 外部引用，新副本重新配置入口。

StoryEntry 的「详细门控」从摘要打开触发条件树。新建 Entry 的触发条件是空 OR，恒不成立。既有空 AND 显示为「恒为 True」，非空 AND 放在 OR 下作为完整子组，未改动时确认保留原值。添加条件或子组只在弹窗中插入待填写节点，选中后再配置；两种模式均可编辑整棵树，确认时定位首个未完成或非法的节点。True 无子项时仍保存为空 AND，有子项时用 OR 的首个恒真条件短路求值并保留子树。重新打开时首项由编辑器识别为 True 模式，切回 OR 后移除该首项。树的节点身份、展开与选中状态属于弹窗会话。入口为 `src/ui/story-editor/condition-tree-dialog.ts`，行为见 `tests/ui/story/story-editor-authoring.test.ts`。

单条条件按判断对象选择表单。默认数值表单用业务字段标题，当前区域的 `== 1` 和 `== 0` 分别显示为「位于」和「不在」，其他比较沿用区域状态值表单。实体引用使用同一份目录提供手输候选与搜索视图。候选优先匹配 Entry 的允许 Init，缺省时参考当前 Init，其次列出 Global，再列出其他 Init 和未标明归属的实体。确认选择只回填当前条件节点，整棵树仍由弹窗底部确认写入草稿。入口为 `src/ui/story-editor/condition-reference-navi.ts`。

被动 Entry 的解除阻塞条件、每条条件奖励、揭示规则和完结反应共用上述条件树。规则的揭示目标、事件和效果保留在原行。未设置的揭示或反应条件以恒真打开，取消保留缺省；可选条件可显式移除。旧单条条件未改动时保留原结构。每次确认按规则的稳定身份写回当前行；判断对象「链路经过 Story」可在有独立剧情链上下文的条件奖励中选用。

`structured-value.ts` 提供 JSON、全部 ValueExpression 运算及数值来源、Extra 各类型、条件 / 效果 / 反应 / 后续的构造模板。字段以平铺标题与控件编辑，可增删字段、增删换序列表；引用提供当前目录及未发布草稿候选。切换构造明确替换本项。theme 的 palette / tokens / nodes / background 和 Story Extra 不再仅供只读。`structuredInputs/structuredRows` 只随作者草稿保存，稳定行身份与原始错误输入不进入正式内容；无效数字即使保留了上一合法值，也会阻止提交。作者输入与渲染限 128 层 JSON（覆盖引擎 Extra 32 层）；超过时显式拒绝。

`GameCommands.validateStoryAuthoring/applyStoryAuthoring` 接受一组 `stories/activeStories/passiveStories/passivePools` 及显式 removed 列表。`Registry.saveStoryAuthoring()` 在候选表上完成作者形状、Story 正式投影、引用、单层子调用和池循环检查，全部通过后才更改正式表；删除被引用内容会拒绝。应用后重建 Entry 标签声明 / 收集索引，不写玩家进度。旧的单文档 `saveStoryDefinition` 入口仍保留，不能代替多内容事务。

编辑器不提供 Entry 的 kizuna 关联字段或 Click 的 kizunaCard 创建入口；已有 Entry.kizuna / kizunaCard 内容仍由底层兼容机制投影、校验与播放。新编写的跨 Entry 内容使用剧情入口卡选择目标 StoryEntry。`areaContinue` 仍编辑同一游标的续播地点。

StoryEntry 的目录位置当前保存在顶层 `catalog`，包含 `category`、`part`、可选 `chapter` 与可选数字 `order`；分类和篇章为自由文本，不要求预注册，目录投影按现有 ID 或名称匹配，未匹配时创建作者目录项。Story Editor 汇总内置层级、已载入 Entry 与当前草稿，为分类 / 篇章 / 章节提供建议，同时允许输入新名称。旧 `extra.v.storyCatalog` 只作为导入迁移格式，会转为 `catalog`；当前 Entry 校验不接受旧字段。`withAuthoredStoryCatalog()` 从内置层级和 Entry 元数据投影导航目录，不修改内置表。

`createStoryAuthoringPreview()` 用已载入的数据包、当前作者定义、玩家快照与候选内容创建隔离 GameInstance。Story 正文栏提供「试播」，工具包可按 Story 选择并记住入口。没有关联 Entry 或选择「直接试播正文」时，隔离实例使用临时入口。StoryEntry 页直接以当前入口开播。试播沿用内容校验，本地存储不可写时同样可读当前有效草稿。独立三栏显示实际路线、聊天与演出、条件记录。「从头试播」重新从原目标启动并清除本轮决定。Controller 消费隔离场景、主题、覆盖层及条件的只读投影，跟随子通道并保留已播的随流内容。起始场景用隔离场景投影呈现，因此从大厅也可以试播带起始 Area 的 Entry。关闭后恢复原编辑目标、页签、滚动与入口焦点，释放浮层、订阅、定时器与隔离运行。

试播在根／子 Entry 资格、Choice 候选筛选与重读转移守卫处等待作者确认。单个局部标记存在性由播放器直接判断。同一个 Choice 的复杂条件按候选合并显示，全部真实不可用时也能在跳过前暂停。Hover 显示暂停时的真实条件树，条件记录同时保留采用结果。作者的决定绑定本次等待点，继续从原游标执行，并在 Choice 显示与输入校验间共享已确定的候选。配置的 Choice marks 仍由实际选项输入写入。试播沿现有重读规则处理持久效果与奖励，待决状态和覆盖值只存在于隔离实例。实现入口为 `story-preview-conditions.ts`、`story-node-player.ts`、`story-service.ts` 与 `preview-view.ts`。

`AronaClickerRuntime.saveStoryAuthoringToPack()` 只接受明确的编辑态包；新 ID 必须属于目标命名空间，删除必须针对该包已有记录。校验候选包后按身份合并四张作者表，保留图片与其它内容，经 PackManager 保存并沿用包管理导出 / 重载。包库同步保存失败恢复旧记录。此操作保存包，不隐式应用或旅行；“应用 Story 与关联内容”仍是独立操作。单文档草稿、当前运行生效与包保存是三个明确的动作。

入口：`src/data-services/authoring/story-authoring.ts`、`src/arona-clicker/contracts/runtime/story-authoring.ts`、`src/ui/story-editor/authoring-model.ts`、`authoring-view.ts`、`structured-value.ts`。行为证明：`tests/engine/story/story-authoring.test.ts` 与 `tests/ui/story/story-editor-authoring.test.ts`。

### StoryDef 保存到运行内容（原型接线）

右栏为所有节点提供单个可选“需要局部标记”名称；留空关闭，编辑态始终显示节点。Operation 的行为类型为“局部标记”时，写入/移除、名称和值都显示在同一行为属性组内；写入开放文字、数字、布尔、null 与可编辑的 JSON 对象 / 数组；Button result 的局部标记仍提供操作、名称和值字段；Choice 仅编辑选择标记名称，不提供局部动作或任意值。命名提示推荐 StoryName-flagid，不强制。原始数字输入与值类型仍保存在同一份草稿侧状态，不另存第二份作者状态。

普通 scalar 字段的其他行为由属性面板按分支呈现，不再降级为 E0 摘要；不在当前分支的字段休眠在草稿缓存中，切换回来可恢复。

局部标记数字的原始输入与最近一次值类型以草稿侧 localFlagInputs 持久化；未完成的 `-` 等可存草稿，但显式 Runtime 保存会阻止提交，不能发布之前的合法值。移除动作不提交 value；切回写入可恢复这份输入。该元数据不进入 StoryDef/Registry，删除节点时清理。正式 requiresFlag 与 localFlag 动作由结构验证及 Registry 保存边界校验；运行作用域见 [[story-and-effects]]。

中栏的“保存到运行内容”是显式命令，与“保存草稿”分开。它经 `GameCommands.saveStoryDefinition()` → `GameInstance.saveStoryDefinition()` → `Registry.saveStoryDefinition()`，按相同 Story ID 新建或覆盖当前定义。普通文本编辑、草稿保存、切换和退出仍只保存本地草稿，不自动改 Registry；删除草稿也不删除实际定义。

这条接线按用户要求暂不检查编辑态 Mod，也不写回包文件、包记录或玩家存档。Registry 是当前运行的有效表，重新装载内容后以数据包为准；界面成功提示明确标明“仅当前运行有效”。保存不会创建 StoryEntry 或启动剧情。已有播放 Session 和 Player 均持有文档副本，继续播放旧内容；下一次启动读取新的定义。

数据来源与编辑缓存分层：`GameInstance.init(datapacks)` 将本次合并后的 Story 定义保留为运行期来源快照；首次打开编辑器时，来源项从当前 Registry 深拷贝到编辑草稿。草稿及编辑器元数据独立写入 `acprogram_story_editor_drafts`，显式“保存到运行内容”才将投影写入当前 Registry。中栏「还原来源版本」确认后删除当前 Story 的本地草稿，并将 Registry 中该 Story 恢复为本次 init 加载的版本；若本次加载中没有该 Story，则移除它的运行期新增定义。它不改玩家存档和其他草稿，也不重新读磁盘；加载快照之后已经启动的 Story Session 继续使用自己的文档副本，新启动的 Entry 才读取还原后的 Registry。

`storyDefinitionFromDraft()` 先做草稿侧检查（已启用但缺必填配置的可选项、局部标记未完成输入），再把草稿复制成候选并交给 `src/data-services/authoring/story-definition-projection.ts` 的 `projectStoryDefinition()`。该投影逐层重建 talklet/click/operation/transfer、content、interaction、action、command、result、value 与兼容 stage，只输出当前分支和已启用的可选字段；缓存、UI 标志与未解析输入不进入候选，合法的 extra/tokens 等字典按合同保留。状态效果与 Click 结果动作里的完全空白占位行会被省略；无动作的空 Operation / Transfer、空状态 Operation、空结果与空按击配置也不会写入运行时 Story。仅当节点有合法 id/type 且除空载荷外不含其他字段时才会丢弃；requiresFlag、未知字段或其他部分作者输入存在时仍按合同报错。空白 Click 不省略，因为它本身是输入节点。数值文本按字段类型转换（pacing、坐标、按击、amount、条件比较值，以及作者显式选择的字面量类型），无效文本原样进入校验并报错，不转成 0。

`Registry.saveStoryDefinition()` 在写入前用同一投影对深拷贝做递归合同与引用校验：未知结构键、混合分支、编辑器元数据、畸形值与缺失引用均被拒绝，失败不修改原定义，也不做部分替换。投影是纯函数，重复执行结果一致且不改输入。

拒绝策略不等于自动删字段：来源中的未知/非法字段留在草稿，界面按节点列出诊断路径并提供逐项“清理该字段”入口，由作者显式处理。包提交、编辑态 Mod 门控与发布流程仍未接入。

成功后关联来源 ID，避免新 Story 在左栏出现“注册来源”和“草稿”两项，并尝试保存本地草稿。若此时本地存储失败，已完成的 Registry 写入保留，界面分别提示运行内容成功和草稿失败，不声称整个操作回滚。验证见 `tests/engine/story/story-definition-save.test.ts` 和 `tests/ui/story/story-editor-workspace.test.ts`。

## 应用入口与工程检查

Vite 配置把 `/game` 与 `/editor` 分别路由到游戏 UI 和独立 Editor HTML，并以多页入口构建 portal、game、editor。项目脚本承担生成、诊断与测试：

| 命令 | 用途 |
| --- | --- |
| `npm run gen:schema` | 从 Engine 与 Datapack 契约生成 Editor Schema |
| `npm run check:architecture` | 检查 Engine / Data Services 依赖边界 |
| `npm run check:docs` | 检查 Markdown、WikiLink 与文档结构 |
| `npm test` | 运行 Vitest；详细输出保存到 `.test-artifacts/latest.log` |
| `npm run ui:callgraph` | 分析 UI 调用链，按参数输出局部摘要或结构数据 |
| `npm run datapack:export-base` | 将默认 TypeScript 内容导出成标准 Base Datapack 目录 |

`gen-engine-schema.mjs` 的 `--write` 会更新 `tools/datapack-editor/schema/engine-defs.gen.json`；该文件是生成产物，应从契约和生成器修正。Vite 路由、Schema 生成、静态边界检查与测试分别验证不同层面，不能相互替代。

源码入口：`vite.config.ts`、`index.html`、`src/ui/main.ts`、`tools/datapack-editor/ui/main.ts`、`scripts/gen-engine-schema.mjs`、`scripts/check-architecture-boundaries.mjs`、`scripts/check-docs.mjs`、`vitest.config.ts`。

相关测试见 `tools/datapack-editor/schema/engine-schema.sync.test.ts` 与 `tests/ui/runtime-editor/runtime-editor-definition.test.ts`、`runtime-editor-pack-export.test.ts`、`runtime-editor-codex-integration.test.ts`。游戏界面的读写入口见 [[read-model-and-ui]]。

## 选择正确的检查

修改源类型时，Schema 生成与同步测试检查编辑器字段契约；Registry 校验与领域测试检查内容能否装载及其行为。`check:architecture` 检查静态依赖边界，`check:docs` 检查文档机械规则，都不能证明运行时功能正确。独立编辑器字段的生成和覆盖过程见 [[editor-schema-to-form]]。

## StoryEntry 基础分类

Entry 中栏分别编辑激活方式、故事目录位置与普通公共字段。激活方式明确选择主动接取、随机抽取或好感／角色阶段；地区兜底、权重／重复／冷却、等级／前置 Story 只在适用分支出现。好感入口新建时要求选择有效角色。切换配置先展示当前与目标含义，取消或候选草稿保存失败保留原分支；池仍关联该 Entry、错误输入尚未修正或配置在确认期间变化时拒绝切换。身份和 ModId 不随分类变更。

故事目录位置在「基本信息」显示路径摘要，通过目录弹窗编辑。来源聚合内置层级、已载入 Entry 与当前草稿；左侧树和全目录搜索支持定位，右侧显示同级条目、可用 Init 和顺序。Init 筛选包含所选 Init 与全 Init 条目，只影响浏览。弹窗可新建分类、篇章或章节。仅编辑态 Mod 所属条目可改位置或顺序，其他条目为只读参照。顺序留空时按原始同级次序每隔 100 生成自动值，可用有限数字覆写。无 Init 筛选时可拖动插入，按相邻顺序值给被移动条目计算新值，其他条目保留原值。确认后将改动写入各自的 Story 草稿，按所属 Mod 分别发布；更改位置或排序均不改 `availableInits`。重开优先显示当前路径，未设置位置时可恢复本次编辑器会话最近一次确认的路径；取消不保存临时目录。抽取池以当前 Entry 的反查关系展示，点开才编辑唯一 children；本次列出的关联池解除关联后仍留到离开 Entry，避免编辑中途丢失控件。常用内容引用沿用 Navi，关系与 Flag 导航保留。旧顶层 type／权重／好感字段在 Story 本地草稿恢复、数据包分片读取及包库快照恢复时，通过 story-entry-migration.ts 转成 activation；旧 Extra.storyCatalog 转成 catalog。新旧字段混用、等级与前置 Story 同时配置或旧配置无效时，保留原文并明确报错，不推测或清空。草稿迁移在完整验证后，先将原始字符串备份到 acprogram_story_editor_drafts_before_entry_activation，再写入迁移结果；备份／写入失败保持原草稿并禁写。包库 JSON／IndexedDB 恢复也先保存带 _before_entry_activation 后缀的原始字符串备份，原键直到正常保存才更新；IndexedDB 写入等待事务提交。备份只创建一次，不覆盖已有备份。未完成的权重／冷却等输入路径随字段迁移，不能确定对应关系的旧输入拒绝迁移。运行时 Registry 与发布校验继续只接受新结构。入口为 story-editor/entry-activation.ts、authoring-view.ts、controller.ts；回归见 tests/ui/story/story-editor-entry-activation.test.ts 和 story-editor-authoring.test.ts。
