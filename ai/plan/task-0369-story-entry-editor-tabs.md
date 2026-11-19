# Task：StoryEntry 中栏 Switch、Flag 奖励表与分型门控

状态：进行中

## 目标与交接

由 Luna 实施游戏内 Story 编辑器的 Entry 中栏。作者可以在同一 Entry 上切换「基本信息」「奖励信息」「详细门控」，用对应的表单完成配置，并沿既有链路保存、校验、应用和导出。用实际的 StoryEntry 契约划分字段，先消除重复编辑入口。

本 Task 的可交付范围包括三页 Switch、现有完结奖励的表格化和三类门控的专用表单。将 Choice 的本次局部标记接入完结奖励是独立的待决扩展，见后文。完成可交付范围无需等待该决定。执行者从 [[AGENTS]] 和本页的「复用入口」进入，核对当前工作树后实施。

## 中栏结构与切换

- 沿用现有 Entry 中栏及其标题、前进／后退、滚动容器。在中栏顶部加入共享 Switch，首次打开 Entry 默认「基本信息」。中间只有一个当前页内容区域，下方共用「保存草稿」「校验作者内容」「应用 Story 与关联内容」及反馈区。已在 Story 工具区提供的试播和保存到包继续可达。
- 同一 Entry 切页只更新 Switch 选中状态及中栏页内容。选中页、各页滚动位置属于编辑界面状态。普通切页保留草稿、当前 Entry、未完成输入和校验反馈，返回时恢复对应页的滚动位置。切页不写数据包、Registry 或玩家状态，也不生成一条 Story／Entry 导航历史。
- 稳定节点包括列外壳、顶部导航、Switch 和滚动宿主。继续用现有 `workspace.story-editor` 区域更新和 `patchEditorDOM` 协调内容。表单行使用已有稳定行键，切页后同一条输入仍属于原行。替换当前页时由现有 DOM 更新入口处理页内引用浮层，页外浮层、左右栏与各自滚动位置保留。沿用当前工作区恢复路径处理目标失效。
- 左栏继续负责选 Story／Entry 和搜索，右栏继续提供关系与 Flag 来源。只在对应页提供同一字段的编辑控件，其他位置可以显示只读摘要或跳转。不要再把已经有专用控件的字段完整递归渲染一遍。保留当前尚未专用化的作者字段入口，尤其是 `tags` 和 `extra`。

## 三页字段与行为

### 基本信息

| 内容 | 行为 |
| --- | --- |
| Entry ID、关联 Story | 保留当前身份与正文引用编辑能力，包括新建草稿手写 ID。引用选择复用 Story 目录并显示缺失引用。切换门控类型保持同一个 Entry ID。 |
| 开幕标题、可重读 | 标题为可选覆盖，清空表示使用 Story 名称。预览当前有效标题。可重读对应 `replayable`，随机 Entry 的正式重复触发在详细门控配置。 |
| 故事目录位置 | 复用 `catalog.category/part/chapter/order`，由内置层级、已载入 Entry 与当前草稿聚合现有分类／篇章／章节建议；输入仍是自由文本。玩家故事目录目前只取主动 Entry，对随机或好感 Entry 显示实际可见性。静态层级仍按产品模型投影。 |
| 门控类型、Area 兜底 | 类型固定为「主动接取」「随机抽取」「好感／角色阶段」。仅主动型显示「不兜底」「当前 Area」「指定 Area」及需要的 Area 引用。兜底投放待接取条目，玩家仍在目标 Area 确认开播。 |

类型修改复用 `reviewEntryActivation` 和 `changeEntryActivation`。确认时说明会替换哪些激活参数，以及切到主动型会清理哪些被动字段。随机 Entry 仍被抽取池引用时先解除关联。切到好感型必须选有效角色。取消、校验拒绝、过期确认或草稿存储失败时，保持原记录、选中目标、关联池及其他页输入。成功时保留 Entry ID 和公共字段，并按既有逻辑迁移分区及草稿删除记录。三类定义统一以 `activation.kind` 为准。

### 奖励信息

- 页面编辑的是**完结奖励**。表内保留「简单」「条件」两种策略。简单模式给出「首次」「重复」两行，每行可配置多条效果。首次／重复按引擎传给结算的最终 Story 身份判断。
- 条件模式每行包含「条件／Flag」和「效果列表」，支持新增、删除、调整顺序。首次／重复默认奖励始终提供；条件表逐项判定，所有命中项的效果按配置顺序附加提供。空表仍提供默认奖励。
- 现有可编辑条件包括存档 Flag、本次经过指定 Story（`visitedStoryInChain`）及已有普通条件组。Flag 候选可查来源，普通条件组保留嵌套 AND／OR、各自的条件键和比较语义。可以为常用条件给出快捷行，复杂旧条件依然可查、可编辑、可原样往返。
- 每行效果沿用现有 `Effect` 合同及 Registry 校验。结构编辑入口应能编辑已有的效果及其值／表达式。StoryNode Operation 的 UI 可作为交互参考，其 `amount/resourceId` 等字段与奖励 Effect 的 `value/target` 属于不同合同。
- 表格直接写入 `completionStrategy`、`completionReward.first/repeat`、`conditionalRewards`。编辑其他页、打开旧 Entry、切换奖励模式都保留已有两套字段。模式切换告知当前会生效的规则，删除规则由作者明确触发。兼容省略策略、空表、含复杂条件的行和同时含两套奖励数据的旧 Entry。效果、条件与行顺序一起保留，排序后未完成输入仍对应原行。
- 右栏 Flag 表仍用于查来源。存档 Flag 和局部标记在候选与显示中区分。首版奖励表只将实际可求值的 Flag 写进奖励条件。试播沿用隔离重读规则，界面应说明它可核对正文和分支，正式奖励与投放使用相应校验和测试。

### 详细门控

先显示通用启动资格，再显示类型专属字段。标签明确对应执行时机。

| 组 | 适用类型 | 字段与行为 |
| --- | --- | --- |
| 启动资格 | 全部 | `availableInits` 与 `triggerCondition`。空 Init 列表表示任意 Init。复用条件组编辑和现有引用选择。 |
| 主动接取 | `active` | 可选 `owner`，Area 兜底只显示可跳回基本信息的摘要。主动接取由玩家确认，保持现有正式准入规则。 |
| 随机抽取 | `random` | 可选 `owner`，基础权重、正式重复触发、Entry 冷却及关联抽取池。无池 Entry 仍可参加抽取。池按已有直接关联展示，优先显示本 Entry 的成员行及倍率，保留进入共享池配置、解除关联、编辑后返回的现有能力。共享池的条件、角色和冷却标明会影响其成员。 |
| 好感／角色阶段 | `affection` | 必选角色；在好感等级和前置 **Story** 完成间择一；Entry 冷却。复用已有激活分支切换和校验。已有尾段优先规则由 Runtime 决定。 |
| 播放期限制 | `random`、`affection` | `interruptible`、`leaveArea`、`blocksInteraction`。按现有规则解释可打断、允许离开区域和阻塞交互。 |
| 完结后的对话恢复 | `random`、`affection` | `block` 存在且有归属时会在完结后记录对话暂停。表单按「完结后暂停对话」和「恢复条件」表达，满足该条件时解除。 |
| 起始场景 | 全部 | 保留 `travelToStartContext`，正文起始场景用只读摘要显示。该选项决定启动时是否前往正文声明的场景。 |
| 目录揭示、重读分支、完结后触发 | 全部 | 用独立小组保留 `revealTriggers`、`branchGuards`、`reactions`、`followUps` 编辑能力。首版可在各组复用结构编辑器。区分启动条件、重读时检查已读 Talklet、完结后挂载反应以及下次到达 Area 的独立后续。后续目标是主动时提示「到场后待接取」，目标是被动时提示「到场时尝试开播」。 |

正文 `entryCard.continuation` 继续负责父子接续与回传标记，沿用正文编辑入口与旧 `kizuna` 的运行兼容。入场、抽取、好感、重读等机制的执行语义以现有 Service 为准。详情表单保留未知引用和现有作者值，校验失败指出字段位置；选择候选时避免默默替换为当前列表首项。

## 数据归属与待决扩展

| 对象 | 设计决定 |
| --- | --- |
| 类型与分区 | `activation.kind` 是作者配置的唯一类型来源。既有 active/passive 数据包分区、Entry ID、引用与发布校验继续使用。 |
| 奖励表 | 表格是现有字段的编辑视图。奖励策略和两套数据同时存在时按当前结算规则解释。若日后统一为互斥契约，应先决定混合旧数据如何迁移，再同步 Schema。 |
| 标题和目录位置 | Story 名称提供默认显示名，`openingTitle` 表示可选覆盖，`catalog` 表示目录位置，`replayable` 表示重读资格。不要为展示结果额外持久化名称或目录类型。 |
| 启动与揭示 | 两者分别消费各自的条件。可以共用条件控件和引用目录。内置 `run_chain_3` 有意使用不同前置 Story。 |
| 抽取池 | Entry 权重与池成员倍率可以同时生效。池级／Entry 级冷却分别有运行含义。池子项也声明了 `cooldownFrames`，当前抽取遍历未读取该子项值。保留已存数据，暂不提升为新表单的专用字段。 |

**待决扩展为使用 Choice／Operation 写入的本次局部标记决定完结奖励。** 草案推荐在条件奖励行增加可选的局部标记要求，例如沿用 `requiresFlag`，与已有普通条件同时满足时才命中。取完结时的本次局部表，用键存在判断，`false`、`0`、空字符串和 `null` 都表示存在。使用同一运行最终的表，父故事只看已按现有白名单回传的子故事标记。已有条件行和全局 Flag 语义继续按原路径求值。

当前 `StoryService.completeSession` 已捕获本次 `localFlags`，奖励条件尚未读取它。局部标记扩展应通过完结奖励的专用上下文进入结算，无需修改全局 ConditionSystem 或写入玩家 Flags。候选复用 Flag 目录，但须区分本次可用标记、其他 Entry 的私有标记和显式回传。决定纳入后，再核对源类型、作者校验、打包、生成 Schema、Flag 读取索引和引擎集成测试。仅实施本 Task 基线时记录此项待决。

另有两项运行差异作为依据记录。第一，`reactions.lifetime` 两个取值目前走同一挂载路径，专用表单不要承诺差异。第二，`applyStoryAuthoring` 写 Registry 并重建标签统计，抽取池条件索引和已挂载反应、后续监听有各自的重建时机。若观察到热应用差异，记录最小复现与受影响范围，供独立裁定。

## Roadmap

- [x] **一、固定基线。** 已核对项目身份、Entry 草稿与保存／发布入口，并扩展行为测试覆盖三页切换与草稿连续性；历史条件奖励仍需用旧包重载复核。
- [x] **二、接入 Switch 与基本信息。** 已接入稳定三页区域、身份／标题／重读／目录／激活与 Area 兜底配置；保留既有激活切换事务。
- [x] **三、完成详细门控。** 已接入通用启动资格、按激活类型的字段、被动限制、关系／Flag 来源与关联池编辑；沿 `$authoring` 草稿和现有校验链路。
- [x] **四、完成奖励表。** 已实现默认首／重奖励与有序条件 outcomes 编辑；运行时改为默认奖励始终结算，条件模式累计所有命中项。引擎回归用例覆盖多项命中、零命中、简单模式忽略条件和链内 Story 条件。
- [ ] **五、验收与交回。** 执行下列定向验证，做一次宽屏鼠标走查。更新本页状态、各里程碑、实际运行的验证和仍待裁定的问题。只在已实现行为改变了现行说明时，更新对应机制页或 UI 模式条目。按项目地图指引在可验收节点做一次合并范围的只读复核。

## 复用入口

| 用途 | 现有入口 |
| --- | --- |
| Switch、工作区和局部更新 | `src/ui/components/shared/tabs.ts` 的 `renderTabs`、`src/ui/story-editor/view.ts` 的 `createStoryEditorFrame`、`controller.ts` 的区域更新及 `dom.ts` 的 `patchEditorDOM`。 |
| Entry 页面和操作 | `src/ui/story-editor/authoring-view.ts` 的 `renderEntryConfiguration`、`renderStoryEntryFields`；`controller.ts` 的 `authoringClick`、`reviewEntryActivation` 与 `entry-activation.ts` 的 `changeEntryActivation`。 |
| 草稿及列表身份 | `src/ui/story-editor/authoring-model.ts` 的 `hydrateStoryAuthoring`、`structuredKey`、`editStructuredValue`、`writeStructuredValue`、`compileStoryAuthoring`；`persistence.ts` 的草稿存储和旧 Entry 激活格式迁移。 |
| 条件与引用 | `src/ui/story-editor/property-fields.ts` 的 `conditionEditor`、`property-options.ts`、`reference-navi.ts`、`flag-catalog.ts`、`flag-catalog-view.ts`。节点条件当前通过节点属性路径写入，Entry 使用 `$authoring`。复用渲染与候选目录时保留各自的写入路径。 |
| 数据合同与发布 | `src/data-services/contracts/story-entry.ts`、`contracts/passive-pool.ts`、`validation/story-entry.ts`、`authoring/story-authoring.ts`、`registry/registry.ts` 的 `saveStoryAuthoring`、`registry/registry-validate.ts`。继续由 GameCommands 调 Runtime 的校验、应用和保存入口。 |
| 运行时语义与样例 | `src/arona-clicker/services/story/story-service.ts`、`story-rewards.ts`、`story-entry-selection.ts`、`story-follow-up-mount.ts`、`story-entry-reaction-mount.ts`、`services/economy/passive-pool-system.ts`；`src/arona-clicker/content/story/story-active-entries.ts` 的 `millennium_game_crisis`、`run_chain_3`。 |

项目约定见 [[ai/guide/context-packs/ui-presentation]]、[[ai/guide/frontend-design-project-overlay]]、[[ui-style/patterns]] 和 [[ai/guide/conventions/testing]]。局部标记扩展若获确认，再按 [[ai/guide/conventions/architecture-discipline]] 与 [[ai/guide/conventions/schema-sync]] 核对跨层和 Schema 变更。

## 验收清单

| 场景 | 通过条件 |
| --- | --- |
| 中栏 Switch | 新开 Entry 默认基本信息。三页来回切换仍编辑同一草稿；未完成输入、错误及行归属可恢复。左右栏和中栏滚动宿主保持身份，页内浮层按既有规则处理。进入 Story 正文后的布局与编辑可照常使用。 |
| 类型与 Area | 三类均能创建并打开。取消或存储失败保留原激活与分区；成功转换保留 Entry ID、公共字段与其他页改动。被池引用的随机 Entry 转型被拒绝。固定 Area 引用可校验，主动兜底投递与到场确认行为保持。 |
| 奖励 | 首次／重复默认奖励始终提供；conditional 模式所有命中 outcome 按配置顺序累计，零命中或空表只结算默认奖励。切换策略保留两套数据，条件组与效果可编辑、重排。 |
| 详情与关系 | 每类只出现适用的专用字段。启用、清除及重载可选字段后语义一致。共享池提交仍以池 ID 为单位，多份草稿对同一池有冲突时沿用现有拒绝逻辑。缺失引用、无效数值、被引用删除等失败沿既有边界报告，不产生部分发布。 |
| 保存与应用 | 草稿可保留未完成输入；校验只读；应用与保存到编辑态包沿用现有命令和约束。包重载后有效字段、条件与顺序保持。正在播放的玩家会话、存档和重读奖励遵循既有边界。 |
| 局部标记扩展（仅确认纳入时） | 标记存在性、移除、值为 `false`／`0`／`null`、父子回传隔离、首次命中、读档到完结和重读跳过持久发奖均有行为覆盖。旧包和现有条件奖励保持可读取、可编辑及可执行。 |

定向测试通过 `npm test -- <测试文件...>` 运行。优先扩展 `tests/ui/story/story-editor-authoring.test.ts`，并使用同目录的 `story-editor-workspace.test.ts`、`story-editor-entry-activation.test.ts`、`story-editor-flag-catalog.test.ts` 复验相关行为。数据与运行时入口包括 `tests/data/story/story-entry-activation.test.ts`、`tests/engine/story/story-authoring.test.ts`、`story-rewards.test.ts`、`story-reward-receipts.test.ts`、`story-entry-fallback.test.ts` 和 `tests/engine/character/passive-pool.test.ts`。需要定位测试文件时从上述目录查找。完整输出及摘要由项目测试命令写入 `.test-artifacts/`。按变更执行类型检查、文档检查，或局部标记扩展所需的 Schema 同步检查。

## 当前进展

- 已完成：Entry 三页 Switch、基本信息与激活配置、默认／条件奖励分组、按类型的门控表单、缺省字段添加、被动池关联编辑；状态保持在 Story 编辑器草稿中，三页切换不新增导航记录。
- 正在进行：宽屏鼠标走查尚未验收；当前仓库没有同时含两套奖励字段的内置 Entry，已用显式混合数据覆盖编辑态包往返。
- 下一步：浏览器自动化工具恢复可激活目标窗口后完成宽屏走查，并走查内置千年剧情的复杂条件编辑。

## 结果与问题

- 实现验证：合并定向测试 6 个文件、81 项通过；其中 UI 3 个文件 59 项、奖励结算 2 个文件 8 项、包发布／导出／重载 1 个文件 14 项。覆盖三页切换与页滚动、未完成数值输入、outcome 行顺序身份、缺省门控字段、好感 Entry 角色归属、混合默认／条件奖励草稿及编辑态包往返，以及默认奖励和所有命中 outcome 的结算。
- 目录建议增量验证：`tests/ui/story/story-editor-authoring.test.ts` 当前 18 项通过，覆盖内置目录、已载入 Entry、当前草稿、按上级目录筛选及自由输入；`npm run check:docs` 扫描 95 篇 Markdown 且无错误。
- 运行时实现：`src/arona-clicker/services/story/story-rewards.ts` 现在将最终 Story 的默认首／重奖励与 conditional 下全部命中的效果合并结算；`tests/engine/story/story-rewards.test.ts` 更新并增加对应断言。UI 定向测试为 3 个文件、59 项通过。
- 类型检查：`npx tsc --noEmit` 有 6 个剩余诊断，均在测试／工具文件：TS5097 ×4、`test-output-summary.mjs` 缺少声明、旧 Story Editor input/textarea 比较 TS2367。没有报告本次 UI 源码类型错误。
- 未验收：宽屏鼠标浏览器走查、使用内置复杂历史条件 Entry 做人工表单往返。两次尝试激活 Edge 均返回 `failed to activate captured window`，按恢复约定停止 UI 操作；混合奖励字段的编辑态包发布／导出／重载由显式测试数据覆盖。本 Task 未修改 Schema。
- 待决：Choice／Operation 本次局部标记参与奖励条件，仍保持待决；当前表单只编辑可求值的存档 Flag 与普通条件组。
