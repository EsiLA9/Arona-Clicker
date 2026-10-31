# Task 0343：StoryNode 与游戏流内容的完整编辑入口

状态：**待审阅，未施工**。2026-10-29 已完成静态调查与入口—含义清单；本 Task 是后续施工提案，不表示字段已补齐或方案已经批准。

## 1. 目标与交付边界

把当前 StoryNode 和游戏剧情流中已经存在的作者能力，变成能够发现、理解、新建、修改、关闭、保存和验证的编辑入口。作者不应为了编辑一个合法表达式、复合值或主题覆盖而回到源码，也不应误以为“显示摘要 / 原值保留”就等于支持编辑。

最终交付分两层，均纳入覆盖清单，审阅时可以裁定分批施工：

- **核心内容编辑**：StoryDef、四类 StoryNode、三类 Click、所有 StoryAction 出现位置、状态动作、表达式、条件、局部 JSON、Extra、覆盖层、主题与转移。
- **游戏投放闭环**：StoryEntry、被动池、剧情目录、引用关系、运行试播、写入目标包及重新载入后的内容。单独保存 StoryDef 不等于已经有一个可触发的游戏入口。

本次只创建 Task 与更新索引。后续施工默认指游戏内 `src/ui/`，不改成独立 `tools/datapack-editor/` 项目。Gameplay B 的新叙事调度仍是 [[ai/plan/report-gameplay-b-narrative-flow-2026-10-29]] 的建议，不计入“引擎已有但编辑器漏提供”的缺口。

### 覆盖标准

每项作者能力都必须回答六个问题：在哪里编辑、表示什么、允许哪些值、如何新增与删除 / 恢复默认、保存到哪里、如何在游戏中验证。对合法但未开放的复杂值，保留原值是最低保护，不能作为本 Task 完成条件。

不要求把引擎内部状态做成表单。输入 token、游标、随机状态、Flow 实例键、兼容 stage 元数据等按第 10 节处理。不得为追求“字段都能改”恢复已删除的 reply 或重建旧阶段控制。

## 2. 当前进度与下一步

- [x] 核对当前 StoryNode / Action / Expression / Extra / Theme 契约。
- [x] 对照 Story Editor 的字段渲染、Controller 回读、草稿分支缓存、正式投影与 Registry 保存。
- [x] 核对 StoryEntry、被动池、目录与通用 Runtime Editor 的实际边界。
- [x] 形成下列完整入口清单、缺口定位、施工分组与验收方案。
- [ ] 审阅范围与第 12 节产品选择。
- [ ] 施工并补行为 / 回归测试。
- [ ] 游戏内交互、试播、保存重载与文档验收。

正在进行：无代码施工。下一步：审阅本清单及默认建议；施工时先重核 0336、0340、0341、0342 的在飞结果，再完成 P0 接线与默认值问题。

## 3. 调查口径与主要发现

本次读取当前工作区源码、测试断言和现行 Wiki；没有运行游戏、浏览器或自动化游戏测试。以下“已有编辑”表示静态链路可定位，**不表示已做交互验收**。当前工作区有其他任务的修改，不能用旧 Task 中的起草矩阵替代现状。

状态符号：**E** 已有表单及对应编辑链；**P** 部分支持 / 尚未形成完整操作闭环；**R** 只读保留 / 摘要；**N** 当前工作区没有专用作者入口；**K** 有意由系统维护；**V** 声明与运行消费需要额外核实。P0 先修直接阻断 / 错写风险，P1 补完整节点表达能力，P2 补投放与持久闭环。优先级不是删除低优先级范围的授权。

### 关键证据与缺口

| 编号 | 当前事实 | 缺口或处理要求 | 证据 |
| --- | --- | --- | --- |
| F1 | `numericValueEditor()` 对对象只输出“表达式（保持原值）” | 不能创建或修改 ValueExpression；多个数值动作共享此缺口 | `property-fields.ts` 的同名函数；Expression 契约 |
| F2 | `literalValueEditor()` 只开放 string / number / boolean；对象走 `readonlyComplex()` | setFlag 表达式、setExtra 的六类 Extra 树都未完整开放 | 同文件；`story-node-actions.ts`；`contracts/extra.ts` |
| F3 | `localFlagFields()` 读取整个 Operation 的根 action；`actionEditor()` 仅在所选 node 为 Operation 时调用它；回读是 `data-editor-field`，没有嵌套 action path | Click 的结果 / 共同动作里虽能选 localFlag，却没有对应路径的完整表单；不能直接把根节点专用回读拿来处理嵌套动作，须优先复现并修复 | `property-fields.ts::actionEditor/localFlagFields`；`controller.ts` 的 local-flag 分支；`flag-fields.ts` |
| F4 | LocalFlag 输入缓存以 node.id 为键，复合 JSON 只读；Choice 拖放能自动写标准标记 | 便利绑定没有代替各个 localFlag 行的手工编辑；需要按稳定行路径隔离输入 | `flag-fields.ts::LocalFlagInputs/localFlagInput`；`model.ts::bindStoryNodeToChoiceOption` |
| F5 | `choices()` 仅在当前没有值时输出空选项；Controller 虽支持空选项删除字段，但设值后通常没有“沿用默认”可选 | 可选枚举无法正常回到省略态；可选文本也多为清空成空串，缺少逐字段移除入口 | `property-fields.ts::choices/presentationEditor/styleEditor`；`controller.ts::editStoryProperty` |
| F6 | Story 条件编辑器自行递归显示 AND / OR 和全部 17 个 target，叶子是通用 key / comparator / 数值输入 | 并非条件类型全集缺失；缺少各 target 的语义提示、候选、结构操作与可控复杂度。不能说它已复用了 Runtime Editor 专用叶子控件 | `property-fields.ts::conditionEditor`；`runtime-editor/condition-target-editors.ts` |
| F7 | theme 已开放 scope / entityKey / colorGroupId；palette / tokens / nodes / background 只在存在时只读显示 | 无法新建覆盖，已有覆盖只能保留 / 移除 | `property-fields.ts::presentationActionEditor/readonlyComplex` |
| F8 | Story 文档属性仅有 name 表单，id 与来源只读；extra 无入口；节点 ID 只有特定绑定过程中的随机 ID 更名提示 | 缺文档扩展数据、可发现的身份管理；不能把“重命名”误解为改 Story ID | `view.ts::inspector`；`model.ts::newStory/renameStory/renameStoryNodeId`；Controller 的提示弹窗 |
| F9 | 保存经过草稿投影 → GameCommands → GameInstance → Registry，只改当前运行表；不会创建 StoryEntry，也不写回包 | 作者可以保存一个在游戏中没有入口且重载会消失的 Story | `controller.ts::saveToRuntime`；`registry.ts::saveStoryDefinition`；现行 Runtime Editor Wiki |
| F10 | 通用 `CONTENT_POLICIES` 当前只有 Init、Area、Spot、Enhancement | 图鉴能看见 Story / Entry 不代表它们已有通用可编辑表单；Story 专用编辑也未包含 Entry / pool | `content-policies.ts::CONTENT_POLICIES`；Story Editor 全部入口 |
| F11 | `StoryNode` 的 stage 字段已被 0342 明确为兼容元数据；节点顺序决定播放 | 不恢复阶段分组 / advance 控件，不把旧文档残留描述当当前缺口 | `story-node.ts`、`story-node-structure.ts`；[[ai/plan/task-0342-free-story-flow]] |
| F12 | Runtime Editor 的 Effect 编辑器也把动态 / 结构化值保留为原值，不是现成的完整表达式设计器 | 不可简单“复用旧编辑器”便宣布填完缺口；可复用基础选项 / 解析能力，仍需完整实现 | `runtime-editor/dsl-editors.ts::renderEffectEditor`、表达式边界检查 |

现行 Wiki 关于“条件复用现有渲染 / 过深条件只读”的表述与当前 Story 专用 `conditionEditor()` 不完全一致；该函数未见 Runtime Editor 的深度 / 数量门槛接线。施工时修正文档并给出实际边界，不盲目把另一编辑器的限制硬套到 Story 合同。

## 4. 编辑入口地图

下列是建议的逻辑分区，具体布局待按项目视觉约定设计，不要求新增多层弹窗。

| 入口代号 | 作者入口 | 内容含义与职责 | 当前情况 |
| --- | --- | --- | --- |
| A 文档 | 顶栏“Story 编辑器” → 选 Story → 文档属性 | 名称、身份、扩展数据、来源和保存目标 | 当前只有名称可改，其他部分见后表 |
| B 流程 | 中栏节点流 → 插入空位 / 选节点 / 拖放 | `nodes` 的唯一执行顺序；四种节点的创建与换序 | E；沿用 0340 / 0342，不重建阶段层 |
| C 节点 | 右栏节点属性 → Talklet / Click / Operation / Transfer | 正文、交互、动作和跳转；共用门控与身份 | 已有大部分基础表单，复杂值和嵌套路径缺口见下表 |
| D 值与条件 | C 内的数值 / 条件 / 复合值展开区 | 结构化表达式、条件树、JSON、Extra 与主题数据 | 当前多为标量或只读，需要补全 |
| E 投放 | Story 关联的“游戏入口”编辑区 | StoryEntry、主动 / 被动、条件、奖励、后续和所属范围 | N；不混入某个节点的 action |
| F 组织 | “被动池 / 剧情目录 / 引用关系”编辑区 | 内容如何被抽选、归类、发现和反查 | N；现有目录主要由产品内容定义 |
| G 验证 | 检查 / 沙盒试播 / 诊断 | 验证顺序、输入、动作与资源引用，展示真实错误路径 | 静态提交诊断已有；执行试播 N |
| H 保存 | 保存草稿 / 应用本次运行 / 保存到目标包 | 区分作者资料、临时生效和可重载内容 | 前两项 E，包写回 N |

新入口不能改变已有“编辑节点只选中、不执行”的语义。E–H 的名称是施工建议，不表示当前 UI 已有这些按钮。

## 5. 核心内容：入口—字段—含义—现状

### 5.1 文档、节点与显示

| ID | 入口 / 字段 | 含义与合法边界 | 现状 → 施工要求 |
| --- | --- | --- | --- |
| D01 | A：`StoryDef.name` | 作者可读名称 | E，保留正常编辑与草稿隔离 |
| D02 | A：`StoryDef.id` | 文档外部引用身份；不是显示名 | P：新建随机 local ID、现有只读。新增“另存为新身份”；已发布身份默认锁定，真正改 ID 须显示引用影响，不能偷偷级联改其他包 |
| D03 | A：`StoryDef.extra` | `ExtraCompound`，根必须 dict | N：接 Extra 树编辑；省略与空 dict 区分 |
| D04 | B：`nodes` 与 type | Talklet / Click / Operation / Transfer；顺序就是执行顺序 | E：保留插入、换序、切型与稳定身份；各分支缓存不丢 |
| D05 | C：`node.id`、`option.id` | 各自局部唯一稳定身份；不是数组索引 | P：常态只读，随机 node ID 仅绑定流程可提示更名；补可发现的显式更名与冲突检查。同步本地草稿缓存，不宣称已有会话快照会自动适配 |
| D06 | C：`requiresFlag` | 单个 Entry 局部键的存在门控，false / 0 / null 仍算存在 | E；补名称候选、写入者 / 读取者反查与未写入提示；允许外部 initialFlags 提供，不能一律报错 |
| D07 | C → Talklet：`content.kind/text` | 对话 / 旁白正文 | E；保留空串等合同语义，旁白不写 speaker/image |
| D08 | Talklet：`speaker/image` | speaker 是自由显示名；image 是图片引用 / 合法直接资源 | E 基本可编辑；补字段“移除”与预览 / 失效反馈，不能强制 speaker 成角色外键 |
| D09 | Talklet：`presentation.side/align/avatarMode/avatar` | 左右侧、对齐、头像策略、头像来源，可分别省略 | P：可填写，但逐字段回默认 / 清除不足；补省略态与头像候选 / 原值支持，avatar+hide 不判错 |
| D10 | Talklet：`pacing.typing/thinking` | 秒；非负有限数；0 显式关闭；不是继续方式 | P：两输入已有，补独立启用 / 关闭 / 省略。右侧 talk 与旁白的休眠遵循现有投影，不造 auto-continue 作者字段 |
| D11 | B / C：`stageId/stages.*.advance` | 当前仅旧定义兼容信息 | K：隐藏并由既有生成 / 保留逻辑维护；诊断可查看，不作为新增编辑能力 |

### 5.2 Click、结果与控制转移

| ID | 入口 / 字段 | 含义 | 现状 → 施工要求 |
| --- | --- | --- | --- |
| I01 | C → Click → button：`text` | 按钮显示文案 | E |
| I02 | button：`press.base/rand` | 基础按击次数与随机增量范围；base 正安全整数，rand 非负安全整数，防溢出 | E 表单；纳入开关、非法原始输入与恢复验证 |
| I03 | button：`result.actions/transfer` | 动作按顺序执行后可转移，两者可共存 | P：容器 / 顺序已有，动作子项复杂能力未全；每个 result 都接同一完整编辑块 |
| I04 | Click → choice：`options[].id/text` | 有序互斥选项 | E 基础；ID 管理按 D05；新增 / 删除 / 重排不串缓存 |
| I05 | choice：`sharedActions` | 已选分支执行前的共同动作 | P：所有 StoryAction 必须在此完整可编，不仅保留自动生成的局部标记清除 |
| I06 | option：`condition` | 是否可选的 ConditionGroup，AND / OR；比较值始终是 number | P：当前能编辑基本树，补第 7 节语义与结构操作；不增加字符串比较或 NOT 节点冒充现有合同 |
| I07 | option：`result.actions/transfer` | 该选项自己的动作及后续转移 | P：同 I03，需逐选项独立路径 |
| I08 | Click → entryCard：`request.entryId/entryType/intent/owner` | 固定 active/card；owner 明确 null 或字符串游标 | P：Entry 候选与全局 / 角色选择已有；合同允许的自定义 owner 字符串可保留却无法自由新建，需补高级输入并解释产品 owner 约定 |
| I09 | entryCard：`title/buttonText/align` | 可选显示覆盖；align 仅 left/right | P：标量已开放，补独立移除 / 回默认 |
| I10 | C → Transfer，或 result.transfer：`mode/storyId` | goto 不新增返回点，insert 完成后返回调用处后继 | E：两个位置已有；补跳入 / 返回关系、目标草稿保存顺序和缺失引用提示。不能暗示跨 Story 的未提交草稿已经能引用 |

StoryAction 的**四个编辑位置**必须同等覆盖：`Operation.action`、`button.result.actions[]`、`choice.sharedActions[]`、`option.result.actions[]`。只完成 Operation 的属性栏不能验收为“动作全覆盖”。

### 5.3 全部 StoryAction 与状态动作

| ID | 动作 / 字段 | 含义 | 当前与施工要求 |
| --- | --- | --- | --- |
| A01 | `localFlag.set/remove`：name、value | 本次 Entry 的 JSON Map；remove 无 value；允许 string/number/bool/null/list/object | P0：修 F3 / F4；四个位置均可编辑，每行独立缓存。补 JSON 树，已有复合值不再只能保留 |
| A02 | `state.effects[]` | 持久状态动作的有序批次，非旧 Effect 通用壳 | P：14 种 op 有列表入口，数值与复合值子项不全；保留每行稳定身份 |
| A03 | `travel.areaId/notice` | 剧情发起的 Area 移动，可选择通知 | E 基本；notice 明确省略 / false / true，不混同 MapRun 节点移动 |
| A04 | `entryRequest.request` | 启动另一个 Entry 的意图，不等于当前来源链自动结束 | P：active/passive、ordinary/system/card 已显示；owner 按 I08；passive 不能 card；类型切换不可遗留错分支 |
| A05 | `overlay.command` | 定位内容的显示与清除 | P：四类命令已有，字段闭环见 5.4 |
| A06 | `presentation.command` | 主题、实体表现与开幕标题 | P：四命令已有，复杂主题见 5.5 |
| S01 | `setResource/addResource(resourceId, amount)` | 设置 / 增加资源；amount 为数值或表达式 | P：字面数字 E，表达式 R → 补第 6 节 |
| S02 | `setSpotLevel/addSpotLevel(spotId, amount)` | 设置 / 增加设施等级 | 同 S01；范围按 op 合同，不统一限制正数 |
| S03 | `setManager(spotId, managerId)` | 指定原型 Character 为设施经理 | E 基本；managerId 不改成 VariantId。V：ActionHost 接受 `none`，正式投影却按 Character 引用校验，表单也无“撤下经理”；先核实并裁定这条能力，不能直接加选项声称可保存 |
| S04 | `addEnhancement(enhancementId)` | 获得强化 | E 基本 |
| S05 | `addItem(itemId, amount)` | 获得物品及数量 | P：表达式 R → 补完整数值编辑 |
| S06 | `unlockInit(initId)` | 解锁世界线 | E 基本 |
| S07 | `setFlag(flagId, value)` | 写 PlayerState.flags，值为字面量或数值表达式 | P：字面量 E、表达式 R；下拉“写局部标记”与字段“全局标记”命名混乱，P0 统一为“玩家持久标记”，再说明实际 Init 归属；不与 localFlag 混用 |
| S08 | `setExtra(path, value)` | 写 Extra 全局层；值可为合法字面量、ExtraValue 或表达式 | P：path 自由填、字面量 E，树与表达式 R；补路径构建 / 预览及不同值类型切换 |
| S09 | `addExtra(path, amount)` | 累加数值 Extra | P：表达式 R；说明只对数值节点有效，缺失行为由引擎决定 |
| S10 | `removeExtra(path)` | 删除 Extra 层节点 | E 自由路径；补解析反馈与“未找到”语义，不误删作者缓存 |
| S11 | `grantCharacter(variantId)` | 获得角色差分，重复获取按角色域处理 | E 基本 |
| S12 | `addAffectionExp(variantId, amount)` | 增加指定差分的好感经验 | P：表达式 R；动态执行资格不因目录选择而绕过 |

14 种状态 op 全集为 S01 两种、S02 两种、S03–S12 各一种。新增编辑时继续输出具名字段，不把 loot、setSpotMaxLevel、旧 triggerStory 等 Engine Effect op 硬加到 StoryStateAction。

### 5.4 覆盖层与显示内容

| ID | 入口 | 字段 / 含义 | 现状 → 施工要求 |
| --- | --- | --- | --- |
| O01 | A05 → show | id；可选 x/y∈[0,1]，左下原点；align left/center/right | E 基本；补缺省与显式 0 的往返，以及 ID 与清除动作反查 |
| O02 | show → text | text；template default/title/badge/note；style | E 基本；template 默认恢复按 F5；不添加 kizuna text 模板 |
| O03 | show → message | `content.kind/text/speaker/image`，可选 presentation/style | P：支持手填但图片没有与 Talklet 相同的目录提示；复用正文 / 呈现编辑，支持逐字段省略 |
| O04 | show → entryCard | active/card request 及 title/buttonText/align | P：同 I08/I09，不递归嵌套节点 / 动作 |
| O05 | text / message → style | font 五类；fontSize、color、background boolean、backgroundColor | P：五字段已有，缺统一“启用 / 关闭此样式覆盖”和逐项默认；background=false 不能变省略；仍为受控字段，不新增任意 CSS |
| O06 | clearId | command/id | E 基本；可列出本 Story 的 show ID，保留自由输入 |
| O07 | clearAllTexts | 清全部演出覆盖，保留聊天历史 | E；补影响提示 / 试播观测 |
| O08 | clearFlow | 清当前聊天流 | E；明确当前流与 owner 归属，不伪造跨流定向能力 |

### 5.5 主题与实体表现

| ID  | 入口                      | 字段 / 含义                                                         | 现状 → 施工要求                                                        |
| --- | ----------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------- |
| T01 | A06 → theme             | scope 缺省/ephemeral、area、student；后两者分别要 area:/variant: entityKey | P：scope / entityKey E，补“缺省”可恢复；切 scope 只休眠实体键，不清色板 / 覆盖          |
| T02 | theme.colorGroupId      | 可选底层色组；可与局部覆盖共存                                                 | E 基本；明确只用覆盖也合法                                                   |
| T03 | theme.palette           | 有序字符串色列表，最多 6 项                                                 | R → 增删改 / 重排 / 开关；区分不存在与合法空列表                                    |
| T04 | theme.tokens            | token 名到字符串值的覆盖字典                                               | R → 键值编辑、键更名 / 冲突诊断、候选提示与自由合法 key                                |
| T05 | theme.nodes             | 17 个 ThemeNodeName 到字符串值的部分覆盖                                   | R → 语义节点选择、逐项启用、删除；playerBubble 与 token 命名不能混用                   |
| T06 | theme.background[]      | 背景层有序列表                                                         | R → 完整图层编辑，字段见下表                                                 |
| T07 | setEntityPresentation   | target、optionId、owner、可选 lifetime story/area/init/manual        | E 基本；补目标不存在 / 无选项反馈；更换目标不能默选首项；author owner 与会话 owner 含义分别说明     |
| T08 | clearEntityPresentation | target/owner                                                    | E 基本；当前候选仅纳入已有 presentation 的实体，应核对清除场景需要；保留合同允许的合法原值，不把缺选项等同缺实体 |
| T09 | openingTitle            | 可选 title，省略或空串回退 Entry/Story 标题                                 | E 基本；补回省略与作用范围预览，不增加无合同的时长字段                                     |

T06 背景层须覆盖全部现有字段：`id`（同主题层覆盖身份）；`kind`（empty/solid/gradient/image）；`value`（对应颜色、渐变、图片等字符串）；`opacity`；`position`；`size`；`repeat`；`blendMode`；`attachment`（scroll/fixed/local）；`scale`；`rotation`；`enabled`。可选项均支持关闭和恢复，图片层复用 Pic 目录与受控资源规则。范围与合法值以当前投影 / 背景消费方为准，不能只凭名字给 opacity 等字段创造新的保存规则。

这只补 StoryThemeValue 能声明的背景。完整 ThemeDef / EntityPresentationDef 的宿主、组件、装饰、状态等编辑器属于相关内容编辑入口，可链接过去，不塞进 StoryAction 内形成第二份定义。

## 6. 数值表达式、Extra 与局部 JSON 的完整覆盖

### 6.1 表达式入口与算子

统一从 S01/S02/S05/S07/S08/S09/S12 的值字段进入“字面量 / 数值表达式”。需要新建、编辑、替换子树、切换后恢复草稿、删除可选配置；仅 JSON 字符串摘要不能验收。

| 分支 | 完整字段 | 含义 |
| --- | --- | --- |
| `const` | value:number | 常数节点；与 `Value.source=const` 是不同合同形状 |
| `value` | value.type=value、source、params | 读取一个有来源的数值，见下表 |
| `add/sub/mul/div/min/max/pow` | left/right 两个表达式 | 加减乘除、最小最大、幂；保留运算树顺序 |
| `floor/ceil/round` | expr | 向下 / 向上 / 四舍五入取整 |
| `clamp` | expr/min/max 三个表达式 | 将值限制在范围内，不把 min/max 降级为只能填数字 |

| ValueSource | 参数入口 | 含义与提示 |
| --- | --- | --- |
| const | params.value | 数值来源常数；字符串 / 数字类型按合同保留 |
| res | params.resource → 完整资源目录 | 读取资源数量 |
| spotLevel | params.spot → Spot 目录 | 读取设施等级 |
| areaSpotCount | params.area → Area 目录 | 由现有求值器计算区域设施数；实现使用 ID 前缀，试播应说明实际结果，不承诺更强聚合语义 |
| managerCount | params.init → Init 目录 | 按现有实现统计经理；不要只凭标签承诺“所有成员数量” |
| funclet | params.funclet → Funclet 目录；声明的参数列表 | 字符串 / 数字参数；新增 Funclet 引用候选，展示定义参数；现有 evaluator 对 calc 的调用形状需用样例验证后再宣称可运行 |
| data | params.path → ExtraPath 编辑 | 读取合并 Extra 视图并转数值，缺失回退按引擎规则 |

表达式 params 合同是 string/number 字典。已知来源的必要键提供专用控件，其他合法参数可在高级键值区编辑并明确是否被消费者使用；不能静默删除。编辑器展示当前样本值时必须标为预览，不把计算值替换进作者 AST。

### 6.2 三种值树不能混同

| 使用位置 | 现有类型全集 | 当前情况与要求 |
| --- | --- | --- |
| A01 localFlag.value | string / finite number / boolean / null / JSON 数组 / JSON 对象，递归 | 标量 E、复合 R；补有类型的 JSON 树，数组增删重排，对象增删键 / 改名；false/null 仍是“键存在” |
| S08 setExtra.value | 合法字面量，或 ExtraValue，或 ValueExpression | 只开放字面量；完整支持类型切换。ExtraValue 的六分支为 int/float/str/bool/list/dict，每个都是 `{t,v}`，不是任意 JSON |
| D03 StoryDef.extra | ExtraCompound，即 dict 根 | 当前无入口；同 Extra 树内核，根类型固定 dict |
| S07 setFlag.value | string / number / boolean / ValueExpression | 不支持 null、数组、ExtraValue；不要因通用值编辑器能力更大而放宽合同 |

Extra 的 int/float 必须保留区别；list 可异构；dict 的键可增删改名并校验重复；合法空集合可保留；遵守 Extra 引擎已有深度和路径规则。未完成值能存草稿，正式提交不得写旧合法值、0、空对象来掩盖输入错误。

## 7. 条件：现有 17 类全部可理解、可配置

当前 Story 条件叶子已经列出下列全集，并非每类都 N。问题在于全靠手填 key，作者难知道是什么、该引用哪个域、数值 0/1 表示什么。统一仍输出 `target/key/comparator/value:number`，不新增任意表达式、字符串比较、NOT 或 MapRun 条件。

| target | 建议编辑入口 / key 含义 | 当前求值含义与必须说明的边界 |
| --- | --- | --- |
| alwaysTrue | “恒真”简化项，不要求填写无意义键 | actual=1，但当前仍走 comparator/value；仅在明确选择恒真预设时写规范四元组，已有非规范内容不能悄悄改义 |
| resource | 资源目录 | 当前 ConditionSystem 读取 state.resources；不要自动承诺全局资源读取 |
| spotLevel | Spot 目录 | 设施等级与数值比较 |
| manager | Spot 目录 | 是否已指派经理，actual=0/1；不是选择某个经理名字 |
| flag | 玩家持久标记名候选 + 自由输入 | 存在 / 非空的历史语义；实现对 value=0 有特殊处理，再走比较器，必须行为验证，不把界面“未设置”预设直接等同 value=0 |
| hasEnh | Enhancement 目录 | 是否拥有强化，0/1 |
| hasTag | 层级 tag 目录 / 输入 | 是否存在拥有该 tag 的已拥有 Spot，0/1；不等于任何实体带 tag |
| countTags | 层级 tag | 命中 tag 的已拥有 Spot 数量，含层级匹配 |
| tagCount | kind + tag 构建 `<kind>:<tagDisplay>` | 分类收集数；不能混同 countTags |
| stat | 统计函数 DSL 编辑 / 帮助 / 样本诊断 | key 为 `$Function 参数...`；不能只提供无说明的一行字符串 |
| hasReadStory | Story 目录 | storyLog 是否存在该 Story 的完成记录，0/1；key 是 StoryDef 身份，不是 Entry 请求 ID |
| hasReadStoryInRun | Story 目录 | 注入的当前 Run 完成检查，0/1；与 MapRun / Entry.localFlags 无自动映射 |
| visitedStoryInChain | Story 目录含当前 Story | 当前 Entry 跳转链是否经过，0/1 |
| extra | ExtraPath 构建 / 解析提示 | 读取合并视图转数值，缺失按引擎规则 |
| protoStat | Character 目录 | 原型累计获得次数；不是差分好感 |
| affectionLevel | Variant 目录 | 对应差分的当前好感等级 |
| area | Area 目录 | 当前所在区域是否匹配，0/1；不是是否到访过 |

条件树还需：叶子 / AND / OR 的显式替换、增删、稳定重排与嵌套操作、原值与诊断定位；目标切换时保存不兼容的旧输入，不把旧 key 自动当新域的有效引用。说明空 AND 为真、空 OR 为假，不能统一标成“无条件”。

大树采用折叠、分支编辑或可验证的高级结构入口。UI 分页 / 可视化预算不能截断合法作者数据；如果某个复杂度不支持可视化，要给出实际可编辑替代入口与同一投影校验，不能继续只读后称“完整覆盖”。

## 8. 游戏投放与组织内容：不能遗漏的第二层

这些对象不是 StoryNode 的字段，但决定作者写的内容能否在游戏里出现。当前 Story Editor 没有专用表单；通用 Runtime Editor 的编辑 policy 也没有这些表。建议与 Story 文档关联提供入口，而不是把它们写入 StoryDef.extra 规避正式合同。

### 8.1 StoryEntry 完整字段

| ID | 建议入口 / 字段 | 含义及施工范围 |
| --- | --- | --- |
| E01 | E → 基础：id/type/storyId | Entry 身份、active/passive、引用哪份 Story；入口与文档是两个对象，支持反查全部引用 |
| E02 | 范围：availableInits[]、owner、tags | 可用世界线、全局 / owner 对话归属、内容标签；保留空数组等当前语义，owner 不强行等同原型角色 ID |
| E03 | 准入：triggerCondition、revealTriggers[] | 启动资格与可见性揭示分别管理；reveal 有 existence/name/condition/utility/unlock，各自可带单叶 / 条件组 |
| E04 | 展示 / 回放：openingTitle、replayable | 开幕标题与是否允许重读，不改 Story.name 冒充入口标题 |
| E05 | 完成：completionStrategy、completionReward.first/repeat | simple / conditional、首次 / 重复完成奖励；奖励是 Engine Effect[]，不是 StoryAction[] |
| E06 | conditionalRewards[]：condition/effects | 有序条件奖励；当前采用首个匹配，不把它画成“所有成立都执行” |
| E07 | branchGuards[]：storyId、prerequisites[].storyId/talkletIndex、denialMessage | 重读控制转移守卫；先核对旧 talkletIndex 与新节点阅读记录的含义，再提供可理解的定位器，不直接解释为 option 下标 |
| E08 | reactions[]：id/activation/lifetime/on/condition/effects/once | 完成后挂载的局部反应；事件支持 tick/resource/spotLevel/item/story/init/area/shop/character/cultivated 及各自过滤参数；不能把它当任意事件脚本 |
| E09 | followUps[]：id/waitFor/outcome | 当前仅 next-enter-area + start-story-entry；配置目标 Area 与 Entry，显示等待 / 完成诊断；不添加战斗事件伪装已有能力 |
| E10 | extra | Entry 级 ExtraCompound，与 StoryDef.extra 分别保存 |
| E11 | passive 专有：repeatable/weight/cooldownFrames | 可重复、权重与帧冷却；单位帧，避免标签写成秒后未换算 |
| E12 | passive：affectionRequired/pushAfterStory | 好感门槛与指定 Story 后推送条件，候选目录与域按当前消费方核对 |
| E13 | passive：block/interruptible/leaveArea/blocksInteraction | 会话阻塞、可打断、离开区域与玩家交互门控；缺省 / false / true 分开，解释组合行为 |

E08 的 `lifetime` 在类型中存在，但本次读取的 `StoryEntryReactionMount.toTrigger()` 没有消费该字段；因此标 V。施工不能仅增加一个下拉就宣称两种生命周期已支持，需检查直接调用与恢复后明确实现、限制或单独裁定。同理 E07 的旧索引、表达式 funclet 等存在语义风险的项，必须先做针对性行为核验，不擅自随表单重写引擎规则。

表现能力要以生产宿主为准：当前 Runtime wiring 已给 StoryService 接入 `StoryNodePresentationHost`，ActionHost 对 overlay / presentation 优先委托它。无专属宿主时的 fallback 限制，不应误算成生产引擎缺失；试播也需接入对应隔离宿主，避免编辑器能配置、试播却因使用了简化 fallback 拒绝。

### 8.2 被动池、目录与外部触发

| ID | 建议入口 | 字段及含义 | 当前与施工要求 |
| --- | --- | --- | --- |
| P01 | F → 被动池 | id/name/tags/condition/owner/cooldownFrames；children[].id/weight/cooldownFrames | N：树状抽选结构，child 指向池或 Entry；提供引用候选、权重 / 冷却与环路诊断；不通过复制正文创建新池 |
| P02 | F → 剧情目录 | category.id/name/parts；part.id/name/chapters/items；chapter.id/name/items；item.id/name/entryId/replayable | N：当前 `baseStoryHierarchy` 为产品内容表，不是现成 Datapack 字段。需先裁定可保存的所有者和装载入口，再实现增删排序与 Entry 引用；不得假装现在就能写进任意包 |
| P03 | F → 被引用 / 引用关系 | Story ↔ Entry、Transfer、入口卡、池、目录、Init.startStoryId | P：部分目录查询已有，缺统一编辑导航；必须区分“能查看”与“能修改该引用来源”，跨域跳转到相应编辑入口 |
| P04 | F → 局部标记关系 | writers/readers、Choice 绑定、initialFlags 来源 | P：Choice 绑定 / 解除 / 更名和 reader 拖放已有；模型有查询，补可发现的反查与受标记节点创建入口，显示外部投入可能性 |
| P05 | G → 启动参数 | Entry、owner、initialFlags、replay / normal 模式 | N：initialFlags 是启动命令输入，不是 StoryDef 字段；作为试播配置保留在作者会话，不写到正式文档冒充默认值 |

Init.startStoryId 在通用 Runtime Editor 已有入口；Area / Spot / Trigger 等处的外部启动声明应通过引用导航链接各自编辑器。该 Task 负责使作者能找到其入口及含义，不扩大为重写所有领域的内容编辑器。

## 9. 保存、试播与安全提交

| ID | 入口 | 必须交付的行为 |
| --- | --- | --- |
| C01 | 保存草稿 | 保留未完成输入、分支缓存和稳定行身份；不改游戏状态；复杂树同样能保存 / 重开 |
| C02 | 应用本次运行 | 延续现有纯投影与 Registry 校验；提示只影响本次运行、不改变已启动会话的文档副本 |
| C03 | 保存到目标包 | 新增显式编辑包目标、差异、引用校验、冲突复核；写入后重新装载仍存在，包源文件 / 包记录 / Registry 不冒充同一层 |
| C04 | 校验 / 定位 | 任意树内错误定位到文档、节点、稳定动作行和字段；提供保留 / 显式清理，不靠自动删除坏节点过检 |
| C05 | 沙盒试播 | 使用隔离状态 / owner 测试正文、选择、局部标记、Operation、转移与结束；清晰标明是否模拟副作用，不在作者点击预览时改真实资源 / 奖励 / 旅行 |
| C06 | 试播诊断 | 展示当前节点、跳过原因、Entry 准入、条件样本值、转移栈、动作拒绝与表现宿主；随机 / 初始状态可复现 |
| C07 | 导入 / 导出衔接 | 使用既有包导入导出能力或明确的文档格式；不产生第二套“看似 Story 但无法载入”的 JSON。跨未提交 Story 的引用要给保存顺序或原子批次方案 |

C03 不是给当前原型保存偷偷加副作用。按现有 Runtime 内容协调 / 包冲突合同实施独立命令，涉及内容 apply 与保存恢复时读取对应规范；不覆盖其他在飞包和作者草稿。

## 10. 完整覆盖不意味着暴露引擎内部字段

| 内容 | 处理方式与原因 |
| --- | --- |
| StoryView/Talklet DTO 的 choices、kizuna、noAvatar、showAvatar 等投影字段 | 来源为正式节点 / presentation 的转换，不另建作者字段表造成两套事实 |
| FlowEntry 的 streamKey/instanceKey/lifecycle/source/marks/headingMarks | UI 协调身份与受控标记；只诊断，不开放 HTML / DOM 标记编辑 |
| Flow 的 system/reward/typing/map、地图卡片 / 位置附件 | 由业务投影产生；不把 UI kind 直接当 StoryContent.kind 新选项 |
| Flow repeatPolicy/contentId、200 条上限、滚动跟随与 replaceSameId | 当前是呈现 / 投递合同，正式 StoryNode 未声明。可诊断，但若要作者配置，须另立契约决定；不能直接塞入 StoryDef |
| token/runId/historyId、播放 index/返回栈、随机状态、完成与已读记录 | 由运行维护，试播能观察 / 重置样本，不直接改正式状态 |
| StoryDef.stages / stageId | 兼容数据由系统维护，0342 已退出播放控制 |
| Button / ChoiceOption.reply | 0339 已删除，老师回应应为独立 Talklet；不恢复内嵌回复 |
| 旧 Effect 的 loot / triggerStory / setSpotMaxLevel 等 | 不属于 StoryStateAction；Entry 奖励 / reaction 若用 Engine Effect，则在其独立、合法上下文编辑 |
| 音频、配音、动画时间轴、镜头、MapRun 新叙事队列 | 本次未在 StoryNode 作者合同发现现成能力；属于新增机制，不归类为编辑器漏字段 |

任何保留为内部 / 未实现的能力都应在覆盖表说明原因，不能通过隐藏未知字段静默遗漏作者数据。

## 11. 建议施工分组与验收

| 工作包 | 对应清单 | 可独立验收的结果 |
| --- | --- | --- |
| W0 基线与 P0 | F3/F4/F5、A01、S07、0340–0342 在飞结果 | 嵌套 localFlag 能从真实 DOM 编辑准确行；可选字段可回省略态；不恢复 stage / reply；先构造回归再修复 |
| W1 值、条件与文档数据 | D03、S01/S02/S05/S07/S08/S09/S12、第 6–7 节 | 新建一个此前只能只读的复杂值，完整编辑、草稿重开、投影、Registry 保存和试算一致 |
| W2 演出与节点编辑闭环 | D05–D10、I01–I10、O01–O08、T01–T09 | 正文、Click、动作、覆盖层、主题在四种动作位置行为一致；每个可选覆盖都能关闭与恢复 |
| W3 投放与组织 | E01–E13、P01–P05 | 新 Story 从 Entry 到游戏实际准入 / 抽选 / 导航可达；V 项有实际结果或明确受限说明；目录所有权先裁定 |
| W4 包保存与验证 | C01–C07 | 编辑包写入与重载闭环、隔离试播、引用和诊断；完成最终覆盖矩阵及机制文档更新 |

### 必须验证的行为

1. 用实际 UI 在 Button.result、Choice.sharedActions、Option.result 内分别新建 localFlag set/remove，并与 Operation 根 action 对照；验证回读只修改所选动作路径。移动 / 删除 / 存读后原始输入仍属于原行。
2. 对任一可选枚举走“省略 → 值 → 沿用默认”，对可选文本走“省略 → 空串 / 非空 → 移除”，对布尔走“省略 → false → true → 省略”，每次比较正式投影而非仅比较 DOM。
3. 全部 14 种状态 op、6 种 StoryAction、4 种 overlay command、4 种 presentation command、3 种 Click 分支都有可操作样例；每个合法动作出现位置均覆盖，不仅测试模型 editProperty 能写值。
4. 表达式 13 种节点形状及 7 个 source；Extra 六类型与 JSON 全类型；主题色板 / 字典 / 全字段背景，均能从无到有新建并修改，合法值往返不失真。
5. 非法 `-`、空数值、NaN/Infinity、错误引用、重复字典键、坏路径、非法 scope/target、错误 Branch / 复杂树都保留草稿，正式提交拒绝且原运行定义不变。
6. 切换类型 / 分支 / 可选能力再切回，复合树、原始文本与行身份恢复；休眠内容不进入运行定义；删除不复活幽灵字段。
7. 条件各 target 的 key 域、0/1、flag 特殊逻辑、空 AND / OR 均有真实求值例子；不只测能序列化。funclet、reaction lifetime、重读 guard 等 V 项先复现运行行为。
8. 保存 Story 不自动创建 Entry；创建 Entry 后按准入 / owner / 可见性 / replay 正确出现；first/repeat/conditional 奖励不因试播或编辑刷新重复触发。
9. 保存目标包、重新加载后 Story/Entry/pool 仍在；目标包已变化时提示冲突，不覆盖；另存新身份不改变旧引用。目录 P02 按审阅后的所属层验证。
10. 编辑过程中不推进真实 Story；试播结束恢复临时主题 / 覆盖、清理宿主与票据；其他 owner / 游戏存档不受污染。
11. 大树和多行属性编辑保留输入焦点、右栏与中栏滚动，不整页重建；当前项目只验宽屏鼠标操作，按任务明确需要再扩键盘 / 竖屏。
12. 完工覆盖账逐项将 E/P/R/N/V 更新为“可新建、可改、可关、可存、可执行验收”或审阅认可的有理由保留项；不能只用“全部字段已显示”结案。

测试经 `npm test` 统一运行，完整输出 `.test-artifacts/latest.log`；新增验收资料落 `.test-artifacts/`。重要结构改动与已报告缺陷按 [[ai/guide/conventions/testing]] 优先行为 / 回归验证；按影响做类型、架构、构建检查。仅此规划阶段不预建占位测试。

实施 UI 设计时使用 `frontend-design` skill，先核对既有视觉方向与 [[ai/guide/context-packs/ui-presentation]]。修改字段 / 枚举遵守 [[ai/guide/conventions/schema-sync]]；优先补编辑入口，不为表单方便扩大正式合同。涉及包写回、状态与跨层接线补读架构 / 内容协调规范；禁改生成产物，Schema 按流程生成。

## 12. 待审阅选择与建议默认

| 待审阅事项 | 建议默认 | 影响 |
| --- | --- | --- |
| “完整覆盖”是否包含 Entry / pool / 目录 / 包保存 | 包含，按 W0–W4 分批 | 否则只能完成文档编辑，不能称完整游戏流创作 |
| 复杂结构是否直接开放通用 JSON 文本 | 常用能力提供有类型的树 / 字段；高级结构文本可作为补充，经过同一投影与诊断 | 不能把全部复杂数据丢进无含义的大文本框，但也不因 UI 深度限制永远只读 |
| Story/Node/Option ID | 常规显示稳定 ID，显式更名 / 另存；已发布 Story 身份默认锁定 | 避免外部引用与存档等待点被静默破坏 |
| 目录归属 | 先为产品目录建立明确可保存所有者，首期不冒称原生 Datapack 字段 | 如果要跨包目录合并，需要单独确定优先级与冲突合同 |
| 试播副作用 | 默认隔离沙盒，显示模拟 / 拒绝信息；正式执行走已有游戏入口 | 便于作者检查动作而不扣真实物品或完成真实剧情 |
| 类型存在但消费未闭环的字段 | 显示真实能力限制，先验证再补实现或限制选择 | 例如 reaction lifetime，不用一个下拉掩盖运行缺口 |
| 本次是否直接实施 | 否，保持待审阅与待施工 | 本轮只交付 Task |

以上为可审阅建议，尚未作为最终产品裁定。审阅后可拆分施工 Task，保留本清单作为总覆盖账，避免拆任务后遗漏低频字段。

## 13. 相关文件、事实来源与施工入口

| 文件或资料 | 用途 | 本次状态 |
| --- | --- | --- |
| [story-node.ts](../../src/data-services/contracts/story-node.ts)、[story-node-actions.ts](../../src/data-services/contracts/story-node-actions.ts) | 四类节点、Click、所有作者动作与值类型权威输入 | 已核对，未修改 |
| [expression.ts](../../src/engine/contracts/expression.ts)、[expression types](../../src/engine/types/expression.ts)、[extra.ts](../../src/engine/contracts/extra.ts)、[theme.ts](../../src/engine/types/theme.ts)、[chat-presentation.ts](../../src/engine/contracts/chat-presentation.ts) | 表达式、条件、Extra、主题背景与样式全集 | 已核对，未修改 |
| [property-fields.ts](../../src/ui/story-editor/property-fields.ts)、[property-options.ts](../../src/ui/story-editor/property-options.ts) | 表单、引用目录、只读与缺失入口 | 已核对，未修改 |
| [property-model.ts](../../src/ui/story-editor/property-model.ts)、[flag-fields.ts](../../src/ui/story-editor/flag-fields.ts) | 路径、分支与原始输入、局部标记缓存 | 已核对，未修改 |
| [controller.ts](../../src/ui/story-editor/controller.ts)、[view.ts](../../src/ui/story-editor/view.ts)、[model.ts](../../src/ui/story-editor/model.ts)、[persistence.ts](../../src/ui/story-editor/persistence.ts) | 入口、回读、操作、草稿保存与运行提交 | 已核对，未修改 |
| [story-definition-projection.ts](../../src/data-services/authoring/story-definition-projection.ts)、[registry.ts](../../src/data-services/registry/registry.ts)、[registry-story-mutation.ts](../../src/data-services/registry/registry-story-mutation.ts) | 纯投影、结构 / 引用验证和原子替换 | 已核对，未修改 |
| [value-system.ts](../../src/engine/expression/value-system.ts)、[condition-system.ts](../../src/engine/expression/condition-system.ts) | 值与条件的真实求值含义 | 已核对；部分消费风险待行为验证 |
| [story-node-action-host.ts](../../src/arona-clicker/services/story/story-node-action-host.ts)、[story-node-presentation-host.ts](../../src/arona-clicker/services/story/story-node-presentation-host.ts)、[runtime-wiring.ts](../../src/arona-clicker/runtime/runtime-wiring.ts) | 动作准入、表现专属宿主与生产接线 | 已核对相关部分；试播不能误用更弱的 fallback |
| [story-entry.ts](../../src/data-services/contracts/story-entry.ts)、[passive-pool.ts](../../src/data-services/contracts/passive-pool.ts)、[trigger.ts](../../src/engine/types/trigger.ts)、[reveal.ts](../../src/engine/contracts/reveal.ts) | 投放、池、反应与揭示合同 | 已核对，未修改 |
| [story-hierarchy.ts](../../src/arona-clicker/content/story/story-hierarchy.ts)、[story-rewards.ts](../../src/arona-clicker/services/story/story-rewards.ts)、[story-entry-reaction-mount.ts](../../src/arona-clicker/services/story/story-entry-reaction-mount.ts)、[story-follow-up-mount.ts](../../src/arona-clicker/services/story/story-follow-up-mount.ts) | 目录归属、完成奖励与后续消费方 | 已核对，未修改 |
| [content-policies.ts](../../src/data-services/authoring/content-policies.ts)、[dsl-editors.ts](../../src/ui/runtime-editor/dsl-editors.ts)、[condition-target-editors.ts](../../src/ui/runtime-editor/condition-target-editors.ts) | 既有 Runtime Editor 能力边界与可复用部分 | 已核对，未修改；不是现成全功能设计器 |
| [flow-entry.ts](../../src/ui/flow/flow-entry.ts)、`src/ui/presentation/chat-stream.ts`、`src/arona-clicker/services/story/story-node-player.ts` | 流 DTO 与作者合同边界；执行与投递入口 | 本会话已核对；施工需复核 0342 后现状 |
| [story-editor-properties-acceptance.test.ts](../../tests/ui/story-editor-properties-acceptance.test.ts)、`tests/ui/story-editor-properties.test.ts`、`tests/ui/story-editor-properties-model.test.ts`、`tests/ui/story-editor-workspace.test.ts` | 现有模型、表单、草稿与 DOM 覆盖 | 部分读取；未运行，不作为缺口已验证证据 |
| `tests/data/story-definition-projection.test.ts`、`tests/engine/story-definition-save.test.ts`、`tests/engine/story-service-node.integration.test.ts` | 正式保存、拒绝、会话与运行验证基础 | 施工定向入口；本轮未运行 |
| [[ai/plan/task-0336-story-node-properties-and-safe-projection]]、[[ai/plan/task-0340-story-editor-insertion-and-drag]]、[[ai/plan/task-0341-story-choice-flag-bindings]]、[[ai/plan/task-0342-free-story-flow]] | 在飞任务与语义约束 | 已核对相关资料 / 现状，不覆盖其他改动 |
| [[runtime-editor-and-project-checks]]、[[story-and-effects]]、[[story-chat-and-theme-presentation]]、[[runtime-content-coordination]] | 机制、保存分层与后续写入规范 | 已读命中部分；与源码不同处已记录，施工配套修订 |

## 14. 验证与结果记录

| 检查 | 本次实际结果 | 说明 |
| --- | --- | --- |
| 契约—表单—回读—保存的静态调查 | 已完成 | 缺口 F1–F12；对运行消费风险单列 V，不宣称已复现运行缺陷 |
| 游戏 / 浏览器 / 自动化行为测试 | 未运行 | 当前授权为调查与待审阅 Task，没有实施或修复游戏代码 |
| `npm run check:docs`、本次差异空白检查 | 文档检查通过，扫描 113 篇、errors: 0；定向 `git diff --check` 无报告 | 只验证文档机械规则，不代表编辑功能已验收 |
| 本次两条直接影响路径的地图只读复核 | Task 与索引均返回 `unreferenced_path`，没有直接 Evidence / maps_to 关联可继续核对 | 未改图、未刷新、未写 freshness |

当前结果：调查完成，施工未开始。剩余工作为审阅与 W0–W4 施工；没有把编辑器限制、原型保存边界或未验证的类型消费隐藏为“已完成”。
