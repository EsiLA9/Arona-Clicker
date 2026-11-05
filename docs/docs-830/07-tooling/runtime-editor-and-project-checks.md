# docs-830/07-tooling/runtime-editor-and-project-checks — 游戏内编辑器与工程检查

本文回答：游戏内 Runtime Editor、独立 Editor、开发入口和项目检查分别承担什么职责。

## 编辑器职责

游戏内 Runtime Editor 位于 `src/ui/runtime-editor/`。它集成在当前游戏 Runtime 中，提供包目录、内容草稿、定义编辑、诊断与内容浏览等 UI；创建、替换或删除定义通过 Controller 命令交给 Runtime 内容协调器，由 Runtime 校验并写入对应编辑包。图鉴只读查询使用当前 Registry，不等于编辑草稿。

独立 Datapack Editor 位于 `tools/datapack-editor/`，以 Schema 驱动的本地模型为中心，导入/导出 JSON 或 ZIP；它不连接当前游戏 Runtime。两者共享内容契约和 Schema，但拥有不同的状态与提交边界，具体见 [[datapack-editor-and-schema]]。

### Story Editor E1

左栏顶部提供 Story、Entry 与发出方标签；标签只切换目录，不改变中右栏当前查看对象。Entry 目录合并 Registry 的 Active / Passive Entry 与已有作者草稿，草稿同 ID 内容优先，并排除草稿显式删除项，支持独立的名称 / ID 搜索。点击 Story 或 Entry 通过同一查看目标切换中右两栏；Entry 中栏复用原有结构化 Entry 表单，配置字段、故事目录、所属 Story 共用的 PassivePool 表单及新增 / 移除操作，以及草稿保存 / 校验 / 应用操作；右栏显示调用关系。Story 右栏的关联 Entry 区域仅保留链接与新增操作。Entry 页面编辑所属 Story 的既有作者草稿，未新增独立 Entry 存储；保存后重新打开可恢复所属 Story 并再次进入 Entry。前进 / 后退共用一份 Story / Entry 浏览历史；返回已访问的 Story 可恢复节点选择、插入位置、滚动与未发送文字。查看目标与历史属于编辑器 UI 会话，不写玩家状态；既有本地草稿信封保持不变。

Story 属性右栏提供直接「调用表」与「被调用表」；Entry 右栏提供递归展开并去重的「潜在调用集」与直接「被调用表」。`relations-model.ts` 复用已声明引用收集器，从 Registry 合并当前 Story / Entry 草稿，按一次调用位置保留来源，建立双向关系；不另存关系表。调用包括顶层及按钮 / 选项的 Story 转移、共享动作 / 结果动作 / Operation 的 Entry 请求与覆盖层卡片、Click 入口卡、Entry 起始 Story、独立后续、旧羁绊绑定及奖励 / 完结反应中的 triggerStory。已读条件、前置条件、分支门控与 Extra 文本不作为调用。潜在调用集包含条件分支并跨 Story / Entry 展开，循环按目标身份去重，不判断运行时条件或实际执行顺序。缺失目标保留 ID 并禁用跳转；关系项复用现有 Story / Entry 导航与浏览历史，不播放剧情。

中栏顶部提供故事浏览的后退 / 前进，左栏选故事、新建及 Transfer 目标跳转共用一份最多 50 步的会话内历史。返回恢复节点选择、插入空位和中 / 右栏滚动；未发送正文仍按草稿保留。后退后打开另一故事会截断前进记录，删除后已不存在的目标在回溯时跳过。切换前保存失败则留在当前故事。历史不进入草稿持久化、StoryDef 或玩家存档。顶层 Transfer、Button / Choice 结果中的 Transfer 及右栏转移属性显示 goto / insert、目标名称和 ID，点击只打开作者文档，优先使用本地草稿；缺失目标保留 ID 并禁用跳转。Click 的 StoryEntry 卡片导航见下文。入口为 `transfer-view.ts`、`controller.ts`，行为见 `tests/ui/story-editor-workspace.test.ts`。

游戏顶栏右侧的“Story 编辑器”打开独立 `story-editor` Workspace，大厅未进入 Init 时也可用。左栏查询当前 Registry 的 Story 定义与本地草稿，按名称/ID 搜索；中栏按 `nodes` 顺序呈现作者节点并在固定底部输入；右栏编辑当前节点，未选中时编辑 Story 名称。三个栏使用共享顶部、单一表面和独立滚动，入口不复用播放用途的 `story` 路由。

作者可以追加角色、老师或旁白正文，显式追加单按钮 Click，以及暂未配置的 Operation/Transfer。正文与旁白复用纯 `renderChatEntry`，不绑定游戏 `ChatStream`、发送 token 或剧情推进；老师是右侧 talklet。节点点击/右键均为选择，Click 在编辑器里不会执行剧情；entryCard 主体按钮只打开目标 Entry 编辑页，兼容 kizunaCard 在关联目标唯一时同样支持跳转。目标缺失或未配置时主体禁用，外围节点仍可选择；areaContinue 不跳转到其他 Entry。编辑器不提供播放、导出或包发布；显式写入当前 Registry 的原型入口见下文。

右栏属性面板顶部以 Switch 切换 Talklet、Click、Operation、Transfer、移动到 Area 与移动到 Chara，下面呈现当前分支基本项、可选能力、字段诊断与节点操作。节点 ID 只读，类型切换保留同一 node.id；切换类型或分支只改变启用状态，旧输入休眠在草稿，恢复时取该节点/该行最近一次输入。Talklet 与 Click 共用一个草稿“正文”：Talklet 对话/旁白使用 `content.text`，按钮和入口类 Click 使用对应文案字段。正文跨类型和子类型切换保留；切入空选项组时仅在首次创建时把正文作为第一项，已有选项保持不变。该共享缓存仅用于编辑，不进入 StoryDef。未启用可选能力时保留开关并收起子项；启用后立即渲染字段，首次进入不代填目标、空效果或首个目录项。不适用的分支不显示也不提交。旧 `stageId` / `stages` 作为兼容字段保存在内容中，不在属性栏编辑，也不决定播放顺序。

字段矩阵覆盖 Talklet 的 talk/narration、呈现与节奏；Click 的 button（press/result）、choice（有序选项、条件、结果与 sharedActions）、entryCard（固定 active/card、owner 全局 null 或角色游标）与 areaContinue。编辑器不提供 kizunaCard 作者模式；已有内容仍由兼容运行时处理。入口类按钮文案为空时沿用各自运行时默认描述。Operation 的 state/travel/entryRequest/overlay/presentation 及 localFlag；Transfer 的 goto/insert。呈现字段常显，在“呈现”标题下平铺气泡位置、文字对齐、头像显示与头像引用，各有标签和用途说明，不需要先启用整个对象；未填不代写默认值，下拉框可切回默认并移除对应字段。老师回应由作者追加为 Talklet；分支回应可让 Choice 结果写入局部标记，再由后续 Talklet 的 `requiresFlag` 控制。StoryAction 列表在同一编辑块内复用，行身份来自草稿稳定 rowId 而非数组索引，支持增删与上移下移。style 使用合同明确定义的字段（font/fontSize/color/background/backgroundColor），不写 CSS；theme 的 scope 是特殊切换，只休眠/恢复 area 或 student 的 entityKey，颜色组与 palette/tokens/nodes/background 覆盖保持；setEntityPresentation 先选 target，再选该实体的 optionId，缺目标时选项控件禁用并说明。

Choice 的每个选项预览左侧有局部标记绑定卡。将该 Choice 后的 StoryNode 拖入卡片，会成对写入 option 结果的 `localFlag set true` 与目标节点的 `requiresFlag`；标记名使用 Story、option ID 和递增序号组成的 `Story-choiceId-num` 风格。卡片能列出绑定节点、逐项解除并级联改名；自动生成 `node_<32位hex>` 的目标 ID 会收到可取消的易读 ID 更名提示。标记反查与创建受标记节点目前只提供模型接口，不增加 UI。该便利功能只维护标准 Story 字段，不增加运行时合同或 Schema。

引用目录来自当前 Registry 的完整内容表（含 `characterVariants` 与 `pics`），不按玩家解锁/拥有状态筛选；当前 Story 自身允许引用，其他未提交草稿不能成为有效引用。图片字段同时提供目录候选与自由输入，自由 speaker 是显示名而不是角色外键。缺失引用显示原值并报错，不跳回首项。

本轮编辑能力的明确边界：条件复用现有条件树渲染，复杂只读值（palette/tokens/nodes/background、数值表达式、嵌套 ExtraValue、过深条件树）只读保留并完整参与提交；可显式清理或改选已支持分支，不提供完整可视化设计器，也不生成 `{}` 冒充已配置值。

作者内容仍只有 `nodes` 一份有序列表；`stages`、extra 和所有未开放字段按兼容规则保留。中央流在每个节点前与列表末尾呈现可点击的插入空位，编辑器只在内存中以稳定节点 ID 锚定当前位置；composer 的正文、Click、Operation 和 Transfer 都插入当前位置，连续添加时空位留在新内容之后。空位不是 StoryNode，不进入草稿、StoryDef 或 Registry。每个节点可拖动到空位或节点上下半区换序；拖放只改变 `nodes` 顺序，保留节点 ID、兼容 stageId 和节点内容，过期或跨草稿的拖拽载荷会被忽略。Talklet 后紧邻可用 Click 时，文本送达后自动衔接到该输入；没有紧邻可用 Click 时，文本送达后等待用户自由点击。连续 Click 逐个呈现。阶段推进方式、阶段分组连续性与每阶段 Click 数量不再限制保存或播放。类型切到 Talklet/Click 时仍自动填充合同要求的兼容 stage 字段，不会自动补 Click。未配置 Operation/Transfer 仅在专用草稿类型中允许缺省载荷，正式 StoryDef 合同不变。

草稿通过 `StorageAdapter` 保存到独立 `acprogram_story_editor_drafts` key，版本信封与来源 ID 独立于 PlayerState、游戏存档和 Runtime Editor 的包草稿。`editorState` 只存草稿侧元数据：分支缓存、可选开关、稳定行身份、原始数值文本与字面量类型；它不进入 StoryDef、extra、PlayerState 或 Registry。插入空位是 `StoryEditorState` 的临时节点锚点，不属于草稿，也不会持久化。打开注册来源时深拷贝，单纯浏览不保存；修改后保存、切换 Story 或离开时统一写入本地。重命名只改副本，删草稿仍保留注册来源。旧草稿、Registry 来源或显式 Runtime 投影遗留的 Button / ChoiceOption `reply` 字段会在对应导入/提交边界丢弃。未发送文字在会话内按文档保留，不自动变成节点或进入持久化文档。

不完整草稿允许保存：草稿信封只校验已填字段的基本形状，缺省 text/options/card 等载荷仍是合法草稿。保存失败保留内存内容并阻止切换/离开，重试成功才标记已保存。加载发现损坏/不支持的版本时保留原存储，暂时只读浏览，避免覆盖作者资料。

`StoryEditorController` 持有独立 UI 会话，普通更新由既有 dispatcher 的 `workspace.story-editor` region 合并，按节点 key 协调 DOM；编辑输入、滚动容器和未改节点保留。主题背景与内容包装有不同身份，主题插入背景不应替换正在输入的内容。Frame 缺失时先恢复页面内容区域，shell 缺失才恢复当前页面。返回保留进入前的 Workspace 和导航，已失效的目标回到游戏。提交失败时先选中出错节点，再由同一次 refresh 在补丁完成的 DOM 中聚焦对应字段，不假设微任务时序。

源码入口：`src/ui/story-editor/model.ts`、`property-model.ts`、`property-fields.ts`、`property-options.ts`、`persistence.ts`、`view.ts`、`dom.ts`、`controller.ts`；接线位于 `src/ui/controller/controller.ts`、`controller-actions-topbar.ts` 和 `src/ui/workspace/workspace-renderer.ts`。行为、属性表单与 DOM 连续性见 `tests/ui/story-editor-model.test.ts`、`story-editor-workspace.test.ts`、`story-editor-properties.test.ts`、`story-editor-properties-model.test.ts`。按用户要求只做代码与自动化验证，未做浏览器验收。

### Story 作者事务、结构值与投放

Story 信息右栏提供文档身份、Extra、关联 Active / Passive Entry 链接与新增、校验、隔离试播与目标包保存；Entry 与 PassivePool 详情在 Entry 中栏编辑。`hydrateStoryAuthoring()` 从只读目录复制当前文档关联数据；`compileStoryAuthoring()` 只收集当前 Story 及草稿中的引用依赖，不让无关的未完成草稿阻塞提交。重复来源的冲突修改显式拒绝。另存为新身份复制正文，保留原 Story / 外部引用，新副本重新配置入口。

`structured-value.ts` 提供 JSON、全部 ValueExpression 运算及数值来源、Extra 各类型、条件 / 效果 / 反应 / 后续的构造模板。字段以平铺标题与控件编辑，可增删字段、增删换序列表；引用提供当前目录及未发布草稿候选。切换构造明确替换本项。theme 的 palette / tokens / nodes / background 和 Story Extra 不再仅供只读。`structuredInputs/structuredRows` 只随作者草稿保存，稳定行身份与原始错误输入不进入正式内容；无效数字即使保留了上一合法值，也会阻止提交。作者输入与渲染限 128 层 JSON（覆盖引擎 Extra 32 层）；超过时显式拒绝。

`GameCommands.validateStoryAuthoring/applyStoryAuthoring` 接受一组 `stories/activeStories/passiveStories/passivePools` 及显式 removed 列表。`Registry.saveStoryAuthoring()` 在候选表上完成作者形状、Story 正式投影、引用、单层子调用和池循环检查，全部通过后才更改正式表；删除被引用内容会拒绝。应用后重建 Entry 标签声明 / 收集索引，不写玩家进度。旧的单文档 `saveStoryDefinition` 入口仍保留，不能代替多内容事务。

编辑器不提供 Entry 的 kizuna 关联字段或 Click 的 kizunaCard 创建入口；已有 Entry.kizuna / kizunaCard 内容仍由底层兼容机制投影、校验与播放。新编写的跨 Entry 内容使用剧情入口卡选择目标 StoryEntry。`areaContinue` 仍编辑同一游标的续播地点。

目录信息保存于 Entry 的 `extra.v.storyCatalog`，其值为 dict，category / part / chapter 为 str；category 与 part 必填，chapter 可空。`withAuthoredStoryCatalog()` 从已应用 Entry 投影目录，不修改内置表；重定位条目避免重复，分类身份编码后不占用导航的分隔符。作者通过“配置故事目录”创建这组元数据，随 Entry 一起保存 / 导出。

`createStoryAuthoringPreview()` 使用已载入数据包、当前 Story 作者表、玩家快照与候选内容创建独立 GameInstance；使用原重读播放器验证输入、分支和父子串联，跳过持久效果 / 奖励，移动与演出仅影响隔离实例。除播放条目外，`getProjection()` 返回只读虚拟场景、解析后的主题 token / 背景与当前 Run 覆盖层快照；不向 UI 暴露 GameInstance、PlayerState 或可变 Map。Story 编辑器用正式聊天覆盖层 renderer 呈现这些数据，位置画布写回当前 Story 动作的 x / y 草稿字段。Controller 跟随子通道，并仅在播放投影变化时刷新；换 Story、离开或销毁编辑器时释放定时器与实例。它不等价于正式奖励 / 旅行验收。

`AronaClickerRuntime.saveStoryAuthoringToPack()` 只接受明确的编辑态包；新 ID 必须属于目标命名空间，删除必须针对该包已有记录。校验候选包后按身份合并四张作者表，保留图片与其它内容，经 PackManager 保存并沿用包管理导出 / 重载。包库同步保存失败恢复旧记录。此操作保存包，不隐式应用或旅行；“应用 Story 与关联内容”仍是独立操作。单文档草稿、当前运行生效与包保存是三个明确的动作。

入口：`src/data-services/authoring/story-authoring.ts`、`src/arona-clicker/contracts/runtime/story-authoring.ts`、`src/ui/story-editor/authoring-model.ts`、`authoring-view.ts`、`structured-value.ts`。行为证明：`tests/engine/story-authoring.test.ts` 与 `tests/ui/story-editor-authoring.test.ts`。

### StoryDef 保存到运行内容（原型接线）

右栏为所有节点提供单个可选“需要局部标记”名称；留空关闭，编辑态始终显示节点。Operation 的行为类型为“局部标记”时，写入/移除、名称和值都显示在同一行为属性组内；写入开放文字、数字、布尔、null 与可编辑的 JSON 对象 / 数组；Button result、Choice result 与 sharedActions 的局部标记也提供同路径的操作、名称和值字段。命名提示推荐 StoryName-flagid，不强制。原始数字输入与值类型仍保存在同一份草稿侧状态，不另存第二份作者状态。

普通 scalar 字段的其他行为由属性面板按分支呈现，不再降级为 E0 摘要；不在当前分支的字段休眠在草稿缓存中，切换回来可恢复。

局部标记数字的原始输入与最近一次值类型以草稿侧 localFlagInputs 持久化；未完成的 `-` 等可存草稿，但显式 Runtime 保存会阻止提交，不能发布之前的合法值。移除动作不提交 value；切回写入可恢复这份输入。该元数据不进入 StoryDef/Registry，删除节点时清理。正式 requiresFlag 与 localFlag 动作由结构验证及 Registry 保存边界校验；运行作用域见 [[story-and-effects]]。

中栏的“保存到运行内容”是显式命令，与“保存草稿”分开。它经 `GameCommands.saveStoryDefinition()` → `GameInstance.saveStoryDefinition()` → `Registry.saveStoryDefinition()`，按相同 Story ID 新建或覆盖当前定义。普通文本编辑、草稿保存、切换和退出仍只保存本地草稿，不自动改 Registry；删除草稿也不删除实际定义。

这条接线按用户要求暂不检查编辑态 Mod，也不写回包文件、包记录或玩家存档。Registry 是当前运行的有效表，重新装载内容后以数据包为准；界面成功提示明确标明“仅当前运行有效”。保存不会创建 StoryEntry 或启动剧情。已有播放 Session 和 Player 均持有文档副本，继续播放旧内容；下一次启动读取新的定义。

数据来源与编辑缓存分层：`GameInstance.init(datapacks)` 将本次合并后的 Story 定义保留为运行期来源快照；首次打开编辑器时，来源项从当前 Registry 深拷贝到编辑草稿。草稿及编辑器元数据独立写入 `acprogram_story_editor_drafts`，显式“保存到运行内容”才将投影写入当前 Registry。中栏“读取本地/系统数据”确认后删除当前 Story 的本地草稿，并将 Registry 中该 Story 恢复为本次 init 加载的版本；若本次加载中没有该 Story，则移除它的运行期新增定义。它不改玩家存档和其他草稿，也不重新读磁盘；加载快照之后已经启动的 Story Session 继续使用自己的文档副本，新启动的 Entry 才读取还原后的 Registry。

`storyDefinitionFromDraft()` 先做草稿侧检查（已启用但缺必填配置的可选项、局部标记未完成输入），再把草稿复制成候选并交给 `src/data-services/authoring/story-definition-projection.ts` 的 `projectStoryDefinition()`。该投影逐层重建 talklet/click/operation/transfer、content、interaction、action、command、result、value 与兼容 stage，只输出当前分支和已启用的可选字段；缓存、UI 标志与未解析输入不进入候选，合法的 extra/tokens 等字典按合同保留。状态效果与 Click 结果动作里的完全空白占位行会被省略；无动作的空 Operation / Transfer、空状态 Operation、空结果与空按击配置也不会写入运行时 Story。仅当节点有合法 id/type 且除空载荷外不含其他字段时才会丢弃；requiresFlag、未知字段或其他部分作者输入存在时仍按合同报错。空白 Click 不省略，因为它本身是输入节点。数值文本按字段类型转换（pacing、坐标、按击、amount、条件比较值，以及作者显式选择的字面量类型），无效文本原样进入校验并报错，不转成 0。

`Registry.saveStoryDefinition()` 在写入前用同一投影对深拷贝做递归合同与引用校验：未知结构键、混合分支、编辑器元数据、畸形值与缺失引用均被拒绝，失败不修改原定义，也不做部分替换。投影是纯函数，重复执行结果一致且不改输入。

拒绝策略不等于自动删字段：来源中的未知/非法字段留在草稿，界面按节点列出诊断路径并提供逐项“清理该字段”入口，由作者显式处理。包提交、编辑态 Mod 门控与发布流程仍未接入。

成功后关联来源 ID，避免新 Story 在左栏出现“注册来源”和“草稿”两项，并尝试保存本地草稿。若此时本地存储失败，已完成的 Registry 写入保留，界面分别提示运行内容成功和草稿失败，不声称整个操作回滚。验证见 `tests/engine/story-definition-save.test.ts` 和 `tests/ui/story-editor-workspace.test.ts`。

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

相关测试见 `tools/datapack-editor/schema/engine-schema.sync.test.ts` 与 `tests/ui/runtime-editor-definition.test.ts`、`runtime-editor-pack-export.test.ts`、`runtime-editor-codex-integration.test.ts`。游戏界面的读写入口见 [[read-model-and-ui]]。

## 选择正确的检查

修改源类型时，Schema 生成与同步测试检查编辑器字段契约；Registry 校验与领域测试检查内容能否装载及其行为。`check:architecture` 检查静态依赖边界，`check:docs` 检查文档机械规则，都不能证明运行时功能正确。独立编辑器字段的生成和覆盖过程见 [[editor-schema-to-form]]。
