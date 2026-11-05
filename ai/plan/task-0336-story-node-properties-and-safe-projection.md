# Task 0336：Story Editor E1 · 条件属性编辑与安全提交

状态：代码/自动化验收通过（2026-10-29 续接完成，未做浏览器验收）。数据边界、草稿模型、属性表单接线与回归已整合通过；交接记录正文已随旧归档清理，此处保留当时的实现状态摘要。

后续施工基线补充：Task 0337（原归档已删除） 已单独实现 Entry 局部 Map、共用 requiresFlag 和 localFlag 动作基础表单。本任务施工时须保留这些字段与草稿侧输入；下文完整分支缓存、安全投影及其他属性编辑仍待实施，不因 0337 完成而视作本任务已完成。

## 目标与范围

让作者在 Story 编辑器右栏先选择节点/行为种类，再填写该分支需要的属性；可选能力通过明确开关展开。切换前的输入保留在本地草稿，保存到运行内容时只提交当前启用且合法的 StoryDef。

延续 Task 0335（原归档已删除） 的三栏、节点身份和局部刷新机制，以及其后已接通的 `saveStoryDefinition` 链路。Registry 保存仍只影响当前 Runtime，不写源 Pack；本任务不增加编辑态 Mod 门控、发布流程、播放预览、通用表单框架或新 Story 协议。

本任务覆盖四类 StoryNode、Click 三类交互、共享结果与 StoryAction 各分支的基本属性编辑；复杂树和主题设计器的边界见下文。安全投影和 Registry 防线必须完整实现，不能因某项编辑器暂缓而跳过校验。

## 已核实事实

下表是任务起草时的调查基线，不表示续接时仍未修改；当前施工成果、未完成项和实际验证以交接记录为准。

| 当前实现 | 依据与影响 |
| --- | --- |
| 正式节点只有 talklet / click / operation / transfer | `src/data-services/contracts/story-node.ts`；只有前两类有 stageId，nodes 是唯一顺序 |
| 行为是具名联合类型 | `src/data-services/contracts/story-node-actions.ts`；StoryStateAction 不是旧 Effect 的 op/target/value 外壳 |
| 当前右栏只开放基本文字/发出方和单按钮文案 | `src/ui/story-editor/view.ts`、`controller.ts`；Operation/Transfer 可建空草稿，复杂 Click 仅摘要 |
| 当前草稿没有分支缓存 | `model.ts`、`persistence.ts`；v1 信封只保存 document 等信息，未配置载荷仅局部放宽 |
| 当前转换不会剔除其他分支字段 | `model.ts::storyDefinitionFromDraft` 通过展开原对象收窄缺失载荷，不能作为安全序列化器 |
| 当前 Registry 已有基础验证与原子替换 | `src/data-services/registry/registry-story-mutation.ts::prepareStoryDefinition` 深拷贝后验证，但仍保留原对象字段；不等于递归逐分支白名单及完整值校验 |
| 提交命令与作者草稿已分开 | Controller → GameCommands → GameInstance → Registry；已有保存会话快照、Pack 不变和失败不替换测试，必须保留 |
| 条件树与目录控件有复用基础 | `src/ui/runtime-editor/dsl-editors.ts`、`reference-options.ts`；现有目录仅覆盖部分实体，不能假定 StoryEntry/差分/图片/表现选项已齐备 |

## 一、右栏的最小交互规则

1. 固定顺序为「节点类型 → 当前分支基本项 → 可选能力 → 高级项/阶段 → 错误与节点操作」。id 默认只读，顶层类型允许显式切换并保留同一 node.id。下一级选择直接展开在本栏，不做逐级弹窗或向导。
2. **不适用的分支隐藏**；其旧输入休眠在草稿。**可选能力未启用**时保留开关、收起子项。**当前分支缺少前置选择**时保留相关控件并禁用，说明先选什么，例如先选实体才能选它的表现选项。
3. 折叠不等于关闭，只读不等于失效。合法的已存高级配置仍参与提交；不能用“DOM 中是否有控件”决定字段存在性。合同允许同时存在的字段不得人为改成互斥模式。
4. 开关关闭和类型切换只改变启用状态，恢复时取该节点/该行最近一次输入。首次进入新分支显示未配置，不代填假目标、空效果、默认 Click 或第一个目录项。
5. 当前启用的必填项无效，允许保存草稿，但阻止整份 Story 提交并定位至对应节点、行和字段。禁止删除坏节点来凑通过、把无效数值转成 0、回退旧合法值或静默忽略活动分支。
6. 保留有意义的 `0 / false / '' / null / undefined` 区别；空数值不是 0，owner 的全局 `null` 不是缺失值。可选枚举提供“沿用默认”，不把运行默认值自动写入作者数据。
7. 引用选择来自完整内容目录，不按玩家解锁/拥有/当前可接取状态筛选。丢失引用仍显示原值和错误，不能跳到首项。自由 speaker 是显示名，不强制变成角色外键。
8. 普通标量输入只更新当前节点展示、对应表单和保存状态；切换分支只替换所属表单子树。保留三栏根、流滚动、输入区和无关控件身份，沿用自然变高的 Talklet 外观。

右栏结构草图：

```text
共享顶部：属性
节点类型 [Talklet / Click / Operation / Transfer]    节点 ID（只读）
当前分支选择 → 基本属性
□ 可选能力 → 启用后展开其字段
高级项 / 阶段（折叠不影响启用状态）
字段诊断 + 删除 / 上移 / 下移
```

## 二、字段与显隐矩阵

字段名以现行合同为准，界面使用中文标签；下表的“可选”均有明确启用/默认状态。不得新增顶层 clickText、senderType 或旧 talklets 协议。

### 顶层节点与正文

| 选择/区域 | 编辑项与条件 |
| --- | --- |
| Talklet → talk | text 多行；speaker 自由显示名并提供角色/老师快捷选择；可选 image 使用现有图片资源目录/引用规则 |
| Talklet → narration | 只有 content.kind/text；speaker/image 的切换缓存不进入 narration.content |
| Talklet → 呈现 | 可选 side、align、avatarMode、avatar，使用合同枚举；avatarMode=hide 时解释头像不显示，但不把合同允许的 avatar+hide 组合判为非法 |
| Talklet → 节奏 | 仅非右侧 talk 可启用 typing/thinking，单位秒，非负有限数，0 显式关闭；缺省沿用播放器默认。右侧或 narration 下休眠，不提交 pacing，不以播放端的时间夹取替代输入校验 |
| Talklet / Click → 阶段 | 高级项显示 stageId 和对应 advance；可选已有阶段或显式新建声明。改变分组不自动改 advance、不补 Click；不连续、缺声明、输入点位置等错误留到诊断 |
| Operation | action.kind 先选类，再显示对应行为属性；不显示/提交 stageId |
| Transfer | mode: goto/insert；storyId 目录选择。说明 insert 返回调用处后继，goto 不新增返回点；不显示/提交 stageId |

发出方快捷选择仍映射现行 content/presentation；它不是新的互斥持久化枚举。老师对应右侧 talk，旁白对应 narration。正文切换缓存保存旧内容；不为“老师”另造节点类型。

### Click、回复与结果

| interaction.kind / 区域 | 编辑项与条件 |
| --- | --- |
| button | text；可选 press 开关后显示 base/rand：base 正安全整数，rand 非负安全整数，合计不得溢出；不提供该合同之外的多击参数 |
| button → reply | 可选回复，选 talk/narration 后编辑对应 StoryContent；回复没有独立 presentation、pacing、stageId |
| button → result | 动作列表 actions 与 transfer 可分别启用并共存；先执行动作再转移，不设计成二选一 |
| choice | options 有序列表：新增/删除/移动；每项稳定 id（默认只读）、text；分别可选 condition、reply、result；另有独立 sharedActions 列表。不提供单选项 press |
| entryCard | card.request 固定 active/card，仅选择 active Entry；owner 显式选全局 null 或填写角色游标；可选 title、buttonText、align:left/right；不带 button/choice 的 reply/result/press |
| 共享回复编辑 | 复用正文 content 编辑块，仅开放其合同字段，不嵌套完整 StoryNode |
| 共享结果编辑 | actions 复用下表 StoryAction 编辑块，支持增删重排；transfer 复用 goto/insert+Story 选择。关闭后数据留草稿，不输出空的休眠结构 |

choice 至少一项且项 id 在该 Click 内唯一；新项先是未完成草稿，不自动产生默认行为。输入文案的必填规则沿用正式验证，不能把所有字符串一律 trim 或一律判空。

### StoryAction：所有出现位置使用同一编辑块

复用于 Operation.action、button.result.actions、choice.sharedActions、option.result.actions。数组保留作者顺序，行身份独立且稳定。

| action.kind | 展开内容 |
| --- | --- |
| state | effects 有序批次，每行先选 op，再出现对应参数，见下一表 |
| travel | areaId；可选 notice，区分省略与显式 false |
| entryRequest | entryType:active/passive → 对应 Entry；owner 全局/角色；intent:ordinary/system，只有 active 可选 card。切换 passive 后 card 输入休眠，必须明确选择合法 intent 才可提交 |
| overlay | command 选择 show/clearId/clearAllTexts/clearFlow，见下表 |
| presentation | command 选择 theme/setEntityPresentation/clearEntityPresentation/openingTitle，见下表 |

| state.op | 只展开该行参数 |
| --- | --- |
| setResource / addResource | resourceId、amount |
| setSpotLevel / addSpotLevel | spotId、amount |
| setManager | spotId、managerId（Character，不误用 VariantId） |
| addEnhancement | enhancementId |
| addItem | itemId、amount |
| unlockInit | initId |
| setFlag | flagId、value；先选字符串/数字/布尔/数值表达式，再展开值输入 |
| setExtra | path、value；先选字面量/表达式/ExtraValue，再展开对应值输入 |
| addExtra / removeExtra | path；只有 addExtra 有 amount |
| grantCharacter / addAffectionExp | variantId；只有 addAffectionExp 有 amount |

amount 首先选“数值/表达式”；负数等范围由该操作合同与既有执行语义判断，不统一限制为正数。ExtraPath 使用现行路径规则；不通过拆字符串猜测新规则。引用目录缺少的类型补最小适配器，不把旧 Effect 编辑器的 loot/triggerStory 等分支混入 StoryStateAction。

### Overlay 与 Presentation

| 选择 | 展开内容与限制 |
| --- | --- |
| overlay.show | id、可选 x/y（0..1，现行为左下原点）、align，以及 content.kind |
| show.content=text | text、可选 template:default/title/badge/note、style；不含 kizuna 模板 |
| show.content=message | StoryContent、可选 StoryPresentation、style；不是递归节点或行为容器 |
| show.content=entryCard | 复用 active/card 入口卡编辑；不附带 text/message 的 style 字段 |
| overlay.clearId | 只有 command/id |
| overlay.clearAllTexts / clearFlow | 只有 command；分别说明清覆盖层/清当前流，不做跨游标定向清理 |
| presentation.theme | value：可选 colorGroupId 与 palette/tokens/nodes/background 覆盖可共存；scope 缺省/ephemeral 无 entityKey；area 必选 area 实体；student 必选 variant 实体，并按域组装 entityKey |
| setEntityPresentation | target 先选 init/area/spot/enhancement/variant 实体，再选该实体 optionId；owner 必填，可选 lifetime:story/area/init/manual |
| clearEntityPresentation | target、owner；不输出 optionId/lifetime |
| openingTitle | 可选 title，省略或空字符串沿用 Entry/Story 来源标题，不强制填写 |

style 的基础控件覆盖 font（default/serif/sans/mono/handwritten）、fontSize、color、background、backgroundColor；按合同处理，不为 CSS 值另造不兼容枚举。开关 background=false 是合法作者值，不因 false 被过滤。

### 本轮复杂编辑器的明确边界

- 本轮可新建并编辑上述全部分支的普通标量、枚举、引用、有序列表；数值/布尔/字符串字面量以及基础 style、theme.scope/colorGroupId 必须形成可用闭环。
- condition 复用现有条件树的渲染/操作能力，增加 Story 字段适配与严格读值；数值表达式只在确认可复用的纯组件基础上开放。现有工具的深度/数量限制是编辑能力边界，不能静默截断合法来源。
- 本轮不新建完整背景图层、任意 theme tokens/nodes、嵌套 ExtraValue 和完整数值表达式可视设计器。已有合法复杂值提供只读摘要并完整保留；可显式关闭可选覆盖或改选已支持的值分支。尚无可用编辑器的新建复杂模式应禁用并说明，不能生成 `{}` 作为已配置值。
- 只读复杂值也必须按真实合同递归验证后才能进 Registry；“保留原值”不是绕过校验的 opaque 通行证。未知/不合法来源字段留在草稿并列出诊断，直到作者明确清理或补充支持，不静默丢弃。

## 三、草稿：有限缓存，不扩张正式 StoryDef

1. `document.nodes` 继续是唯一有序活动节点列表。增加可选的草稿专用 `editorState`，放在持久化草稿信封侧，不塞进 StoryDef、extra、PlayerState 或 Registry。
2. 以 draftId/node.id/所属行稳定身份/分支路径定位缓存；每个已访问分支只保留最近一次输入、可选启用状态和必要原始输入，不存历史快照或无限撤销链。数组索引不能充当行缓存身份；不同节点/选项/Story 互不串值。
3. 切换 type/kind/op/command/value 模式时，先保存旧分支，再恢复目标分支；删除节点/行清理其缓存。节点移动不改变身份与缓存。主题 scope、回复/条件/结果/press 等开关同样遵循此规则。
4. 不完整活动载荷使用编辑器专用草稿类型；数值输入 `-` 等临时文本保留原始值并可本地保存。不能以 `as StoryDef`、NaN 或旧的已解析值冒充当前输入有效。
5. 当前 v1 草稿允许增加可选 editorState；旧草稿缺省时从已有 document 推导启用状态，已有合法字段默认保留。新增元数据需要独立基本形状验证。损坏/未知版本仍保留原存储、报错并禁止覆盖，不建设通用迁移框架。
6. 从来源导入时区分“合同已知但 UI 未开放”“作者主动休眠”“未知/非法字段”；后者不能冒充安全缓存后被悄悄洗掉。必要时展示逐项明确清理入口，清理只改草稿。
7. save-to-runtime 成功不清空分支缓存；之后本地草稿写入失败仍按现有策略分别报告 Registry 成功和本地失败。自动保存只存草稿，不自动提交运行内容。

## 四、提交：活动字段重建 + 边界复验

```text
草稿（活动输入 + 休眠缓存 + 原始输入）
  → 逐分支构造候选 StoryDef / 字段诊断
  → GameCommands → GameInstance → Registry 边界递归验证
  → 全部成功才原子替换一份 StoryDef
```

- 用明确的 typed 分支构造器逐层生成 Story/content/interaction/action/command/result/value；不得深展开整个 draft 再删除几个字段，也不得从当前 DOM 控件收集数据作为唯一真源。
- 只输出当前分支和已启用可选字段，缓存/UI 标志/未解析输入绝不进入候选；合法的字典内容如 extra、tokens 仍按对应合同保留，不把所有动态键都当未知字段。
- 活动必填错误、非法枚举/数值/条件树/表达式/Extra、错误引用、重复身份或阶段问题均阻止整份提交，返回稳定 nodeId/行身份/字段路径及原因；错误不修改 Registry、源定义或草稿缓存。
- 同时强化 `prepareStoryDefinition` 的递归合同与引用验证。绕过 UI 直接调用 GameCommands 的混合分支、编辑器元数据、未知结构键和畸形值也必须被拒绝，不能只在 UI 清理后宣称安全。拒绝策略不等于对输入自动删字段。
- 对已支持合同字段但暂不可编辑的合法来源值，显式序列化并验证保留；所有现行合法 Story 应能无语义损失地打开再保存。现有不合法来源应清楚报错，不能承诺可执行。
- 只为活动 talklet/click 输出其实际引用的阶段声明；被主动切换掉而无引用的声明放草稿缓存。导入时已存在的无引用声明先作为来源问题诊断，不借投影静默修复。保留仍被引用阶段的 advance，不自动合并/拆分、不改推进规则。缺声明、非连续、auto 含 Click、input 非唯一末位 Click 等仍报错；恢复阶段名产生冲突时由作者选择。
- 引用核对当前 Registry 合同目录，当前 Story 自引用按现有规则处理；其他未提交草稿不能充当已存在 Story。运行资格不属于作者结构校验，不能执行行为来“验证”。
- 数据服务层不依赖 UI；共享验证需提取到合适的纯合同/authoring 模块。若未改变正式字段/枚举，无需生成 Schema；不得为了缓存和表单方便放宽生产合同。

## 五、实施顺序与当前进度

### 施工分工（2026-10-29）

- 主 Agent：接口裁定、整合审查、独立验收与文档收尾；统一安排测试，避免多个进程覆盖 latest.log。
- Luna boundary：纯 StoryDef 逐分支投影、递归字段/引用校验、Registry 原子写入边界及专门测试。
- Luna model：草稿 side editorState、稳定行身份与分支缓存、原始输入、持久化和纯编辑操作及专门测试。
- Luna forms：右栏字段矩阵、目录控件、Controller 接线与 DOM 连续性测试；不持有另一份作者状态。
- 三方按明确文件范围并行施工，主 Agent 负责交界点核验；本任务不扩大 0337 的正式节点协议。

- [x] 核对正式联合类型、E0 属性能力、草稿持久化与当前 Registry 保存缺口。
- [x] 给出显隐矩阵、复杂项边界、休眠缓存和提交规则，登记本 Task。
- [x] 已建立草稿分支缓存与安全投影，并补强 Registry 递归验证。
- [x] 实现正文、Click、Transfer 基础属性及公共 reply/result/action 列表；再接 state、entryRequest、overlay、presentation 基础项。
- [x] 接入草稿持久化、字段诊断与局部刷新，补充自动化回归；按最终代码更新机制文档。

续接轮（2026-10-29）完成的修复：

- 类型与接线：补齐 `currentNode` 导入、阶段新建输入定位与 ES2020 兼容写法；`ContentCatalogQueryPort` 增补 `characterVariants`/`pics` 只读查询，使引用目录与图片候选可用。
- 主题作用域：新增 `data-story-theme-scope-path` 与 `selectThemeScope` 接线，area/student 的 `entityKey` 改为按域选择实体（`area:`/`variant:`），切换只休眠/恢复实体键。
- 可选能力：启用即渲染字段（节奏、执行动作、转移、共同动作、按击增量、条件/回复/结果不再空白）；`optional` 支持未启用时保留创建按钮；checkbox 只由 input/change 处理，只读复杂值与诊断都能显式清理。
- 字面量类型：新增草稿侧 `literalKinds`，选择数字/布尔后按所选类型投影；空数值与 `-` 不会被转成 0。
- 枚举默认：选择空项等于删除字段（`__default__` 占位已移除），可选项回选“沿用默认”不再写占位字符串。
- 错误定位：按 `nodes[i].a.b[0].c` 正确解析数组路径，选中节点后在同一次 refresh 完成的 DOM 中聚焦字段。
- 草稿信封：允许不完整载荷（缺 text/options/card）保存；类型切换为 Talklet/Click 时补齐必要阶段声明，不改写推进方式。
- 新增 `tests/ui/story-editor-properties.test.ts`（7 项真实 happy-dom 操作），并修正 E0 回归中两处已失效的提示文案断言。

## 六、验收与验证要求

| 场景 | 必须观察到的结果 |
| --- | --- |
| talk 含 image/pacing → narration → 保存运行内容 → 切回/重开草稿 | narration 无 speaker/image/pacing；草稿恢复旧输入。right talk 同样不泄漏 pacing；合法呈现字段按合同保留 |
| choice 配置选项/条件/结果 → button；关闭 reply/press/result 后提交 | 当前 button 仅含活动字段；选择/开关恢复输入，包括本地重开。选项重排不串缓存，无默认 Click |
| state.addItem → travel → 切回；重排多个动作行 | travel 无 itemId/amount；旧状态行可恢复且身份/顺序正确 |
| overlay.show(message) → clearId/clearFlow → 切回 | clear 分支仅有其合同字段，show 内容可恢复；不泄漏坐标/style/content |
| theme.area → ephemeral → student；setEntityPresentation → clear | ephemeral 无 entityKey，student 只用 variant 域；clear 无 optionId/lifetime，合法缓存可恢复 |
| 活动必填缺失、数值 `-`、错误引用/表达式/条件/阶段 | 草稿仍可存；整份 Registry 提交失败并定位字段，旧定义及已有会话不变；不使用旧数值偷偷成功 |
| 合法 0/false/空字符串/owner=null；合法只读复杂来源 | 保留合同允许的准确含义；折叠/只读不会丢数据；投影重复执行结果一致且不改输入 |
| 来源未知字段、缓存字段注入、混合分支直接走命令 | 未知来源留草稿并诊断；Registry 拒绝非法候选且不发生部分替换，动态合法字典不误伤 |
| 删除节点/行，切 Story，草稿重开，旧 v1/损坏存储 | 缓存作用域正确、删除清理；旧草稿可读；坏存储不被覆盖；Runtime 保存不清空草稿缓存 |
| 编辑流内属性、改分支、编辑条件/列表 | 焦点、无关控件、滚动身份稳定；自然高度与主题宿主保留；不触发故事推进/游戏状态写入 |
| 现有 Story 库及保存链回归 | 合法定义逐一 round-trip；保持 Pack 不变、运行会话快照语义和失败原子性 |

施工时通过 `npm test` 运行相关 UI/model/persistence、Registry/engine 保存与 Story 结构测试；完整输出写入 `.test-artifacts/latest.log`，新增定向结果也放 `.test-artifacts/`。再执行适用的类型、架构、构建和文档检查。涉及行为边界时写真实输入/输出回归，不以字符串存在断言替代。

用户仍未授权浏览器验收；不得自行恢复访问。代码施工、属性表单 UI 回归与自动化验收本轮已完成，浏览器视觉确认仍留待授权。

## 相关资料与调查回执

| 文件/入口 | 用途与本轮状态 |
| --- | --- |
| `src/data-services/contracts/story-node.ts`、`story-node-actions.ts` | 已核对四类节点、所有分支与限制；未修改 |
| `src/ui/story-editor/model.ts`、`persistence.ts`、`view.ts`、`controller.ts`、`dom.ts` | 已核对当前草稿、表单与提交行为；施工入口，未修改 |
| `src/data-services/registry/registry-story-mutation.ts` | 已核对现有基础验证；安全边界施工入口，未修改 |
| `src/ui/runtime-editor/dsl-editors.ts`、`reference-options.ts` | 已核对条件树与引用复用边界；不得整体套用旧 Effect 序列化 |
| `tests/ui/story-editor-model.test.ts`、`story-editor-workspace.test.ts` | 现有编辑回归入口；未来扩展测试，未修改 |
| `tests/engine/story-definition-save.test.ts`、`tests/data/story-node-structure.test.ts` | 现有保存与结构验证入口；未来补充边界回归，未修改 |
| [[runtime-editor-and-project-checks]]、[[runtime-content-coordination]] | 已核对当前直接保存事实；未来按实装更新，本轮不把提案写成机制事实 |
| [[ai/guide/context-packs/datapack-schema]]、[[ai/guide/context-packs/ui-presentation]]、[[ai/guide/conventions/architecture-discipline]]、[[ai/guide/conventions/schema-sync]] | 施工必读入口；UI 按 frontend-design skill 与项目视觉约定执行 |

起草轮仅文档检查的历史记录不作为本轮功能回执。数据边界 `.test-artifacts/0336-boundary.log` 为 4 文件 40 项通过；草稿模型 `.test-artifacts/0336-model.log` 为 3 文件 29 项通过。

### 续接轮验收回执（2026-10-29）

| 检查 | 结果 |
| --- | --- |
| `npx tsc --noEmit` | 通过，0 错误 |
| `npm run check:architecture` | 通过 |
| `npm run check:docs` | 通过（扫描 106 个 Markdown） |
| `npm test --` Story 相关 8 文件 | 通过：`tests/ui/story-editor-*`、`tests/data/story-definition-*`、`tests/engine/story-definition-*` |
| `npm test`（全量） | 349 文件、3491 项全部通过；原 25 项与本任务无关的 `gameplay-b-*`、`engine-contracts` 陈旧断言已按现行样例地图对齐，见 [[ai/plan/report-gameplay-b-test-alignment-2026-10-29]] |
| `npm run build -- --outDir .test-artifacts/0336-build-final` | 构建成功（仅既有 chunk size 警告），输出留在 `.test-artifacts/`，未写 `dist/` |

UI 侧新增 `tests/ui/story-editor-properties.test.ts`，覆盖 Talklet↔旁白与节奏休眠恢复、button/choice/entryCard 切换与草稿重开、state 效果数值转换与行重排、travel 字段隔离、主题 scope 与表现选项门控、未完成数值阻止提交并聚焦字段、可选枚举删除与来源未知字段诊断清理、局部标记专用表单共用草稿。按用户要求未做浏览器验收；直接影响文件的集中地图只读复核与 Web/UI 视觉确认留待授权。
