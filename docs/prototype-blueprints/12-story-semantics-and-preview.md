# P3 附页：现有 Story 能力和试播对照

这份清单服务于未来语言设计与现有播放器的回归。先读 [P3 的实际操作](04-story-dsl-and-compiler.md)。下表中“已有”指当前工作树可以从所列合同或实现定位；“要补接”指作者工具需要新接口或行为验证。按领域解释哪些数据影响真正运行，方便初次接手的人用仓库已有 JSON 构建样本。

## 先区分三样东西

- **Story 正文。** `src/data-services/contracts/story.ts:StoryDef` 直接继承 `StoryNodeDocument`。在 `story-node.ts` 中，正文的 `startContext` 决定从 Area 或角色差分通讯空间开始；`nodes` 的数组顺序是执行顺序。正文 `initId`、`hierarchyString` 和 `directoryId` 是作者归属。它们与入口在哪一个世界线合法、玩家从哪里进入分别说明。
- **StoryEntry。** `src/data-services/contracts/story-entry.ts` 把正文与玩家的入口联系起来。一份正文可以被不同 Entry 使用。玩家在特定世界线满足前置、收到邀请或从池选择的是 Entry，播放才去找正文。玩家目录位置、条件、领奖与后续分别声明。Base 的真实白子例是最好的对照。
- **运行中的一次剧情。** StoryService 保存这次运行的上下文、当前位置、选择与局部标记；这些数据不能回写正文。切换语言实现若能生成同一正文、入口和稳定节点身份，现有运行代码应继续工作。作者阅读与临时试播产生的状态独立。

## 节点和入口的最低语义覆盖

| 标准定义或行为 | 工具需要能表达和展示的内容 | 当前接入与可验收对照 |
| --- | --- | --- |
| Story 文档、顺序、身份 | 真实 Story ID、名称、起始区或角色差分、节点顺序、作者目录、简介与扩展 | `projectStoryDefinition` 接收规范化对象及引用上下文。 `stages` 与 `stageId` 属兼容字段，不能把其中 auto/input 当成现行等待条件。对照 `tests/data/story/story-definition-projection.test.ts` |
| talklet 文字 | 区分包含发言人及可选图片的 talk 与旁白。已有角色引用、旧 speaker 和临时显示名的表现作用不同，文字行、气泡侧、对齐、头像及快慢均能保留 | 数据声明在 `story-node.ts`，外观、定位、pacing 走现有播放和 UI；用同一对白对照文本和 JSON 的内容字段、发言人和图像 |
| Click 输入 | 实际等待点击、可配置按击次数、互斥 Choice、入口卡和到指定 Area 的续播。旧 kizunaCard 保留为旧包案例，现有正式白子样例使用 entryCard.continuation | `StoryNodePlayer` 按节点和当前交互令牌推进。用户未操作前保持等待，过期选项不能提交。用现有选择/保存用例核对 |
| 选项与局部标记 | 选项 ID、文案、持久条件 showWhen、局部 requiresFlag、选择后 marks；一组内先去除其他互斥标记。requiresFlag 检查是否存在，false、0、null 仍是存在 | 查看 player 的选项处理与 flags 测试。作者阅读展示全部选项，试播展示当前允许选项。诊断要能指明是持久条件还是局部标记 |
| operation | `story-node-actions.ts:StoryAction` 定义可执行操作。调试要能区分状态变化、局部 flag、移动、表现、覆盖、清除节点和入口请求。字段须按真实动作形状 | action host 对 Item、Area、Variant、资源等做上下文验证。奖励数量、拒绝意图、通知和已执行记录需要从真实宿主取。用 `tests/engine/story/story-node-action-host.test.ts` |
| transfer | goto 和 insert 的目标正文、入口位置和返回行为。插入结束要回到调用处，goto 切换正文；检查非法目标和可达循环 | 用节点播放器的 insert、goto 与案例回归；显示实际跳转，定位原节点和目标，不按文本行猜测 |
| 空间变化 | 顶层 `moveToArea`、`moveToCharaspace`，以及独立的 travel operation。角色空间使用 Variant ID。需要表达在地区续播、何时移动玩家与何时仅改变重读呈现 | 对照 `story-continuation.test.ts` 的区域续播和正式场景改变。P4 的玩家主动旅行应走领域的正常入口 |
| 视觉及节奏 | 可定位演出、样式、主题、覆盖显示/清理、头像、图像、输入/停顿节奏 | 对照 `tests/data/story/story-performance.test.ts` 与 `ui-style/visual-languages/authoring/patterns/preview-and-performance.md`。镜头、音频或独立等待时长须查真实宿主可用动作；当前清单不会把写作期望认成已实现枚举 |
| Entry 资格 | active 与 fallback；random 的权重、可重复、冷却；affection 的等级或前置 Story。availableInits、条件、角色 owner、回放、地区与行为约束 | `validateStoryEntryActivation`、现有 Registry 和 StoryService。随机候选和确定性入口是不同用例 |
| Entry 完成与节目安排 | 首次/重复/条件奖励、分支守卫、完成后 reaction、下一次进入指定 Area 的 followUp、可读标题与候选目录、信息揭示 | 用 `tests/engine/story/story-reward-receipts.test.ts` 和 `tests/engine/character/passive-pool.test.ts` 的已有路径。若未实现记录，只能显示需要运行检查 |
| 父子剧情与恢复 | 父入口卡、被邀请的目标 Active Entry、Area 与允许回传的局部标记。未赴约前不能开子，完成后按现有返回规则继续，回放与正式分别验证 | `tests/engine/story/story-continuation.test.ts` 覆盖存档恢复、返回、禁递归、取消和重复通知；文本流只传已有标准意图 |

## 操作和演出，要逐项查真实参数

- `state` 里每个动作按原顺序到宿主，命名参数按领域变化。改资源用 resourceId 与 amount，改设施等级用 spotId 与 amount，设经理是 spotId 与 managerId。取得物品用 itemId 与 amount，增强用 enhancementId，角色与好感用 variantId，解锁世界线用 initId，收录用 mapId。不要把 Entry 奖励通用 Effect 的 target/value 搬来当 Story 节点格式。
- 信息揭示使用带实体种类和信息面的目标；未声明的面要返回具体错误。setFlag 是玩家持久状态写入。localFlag 的 set/remove 只改本次 Entry 的局部表。setExtra、addExtra、removeExtra 按实际路径及类型修改 Extra。动作的允许引用、数值表达式、失败和实际结果通过 action host 及其测试查看。把程序显示的局部标记和存档全局 flag 区分。
- 覆盖层 show 的 ID、位置与 text/message/entryCard 内容对应实际聊天呈现；clearId、clearAllTexts 和 clearFlow 的清除范围不同。clearNode 指向正文和节点，只清该节点展示；持久状态已经发生的效果不回退。theme、setEntityPresentation、clearEntityPresentation、openingTitle 是当前表现命令。正文 `performance` 设定位和节奏，和 Story 流的真实输入等待分别验证。
- entryRequest 的 ordinary/system 与卡片的 card 意图不同；卡片目标限 Active。父子卡的 continuation 可有 Area 和记号回传，普通入口请求不会凭空变为父子运行。旧 kizuna 及相关兼容字段通过已有迁移与领域回归对照。
- 已检查的 `StoryAction`、`StoryNode` 和展示命令中没有独立音频、摄像机或任意时长等待动作。未来确需这些表达时，先找到其他可调用的真实宿主或登记域缺口。临时文本前端不能凭新写法声称游戏可以运行这些动作。

## 一次真实试播的读法

从 `src/arona-clicker/content/story/story-shiroko.ts` 读取四个相关对象。 `base:story:shiroko_rooftop_invite` 从 Shiroko 通讯空间开始，匹配的 `base:passivestory:shiroko_rooftop_invite` 限定世界线和当前样本的资格。父文卡指定 `base:activestory:shiroko_rooftop`，要求去 `base:area:schale_rooftop` 接取，返回允许列表为 shiroko-rooftop-photo 与 shiroko-rooftop-route。子正文的两个选择分别写相应标记。审计中不同 Base 物理输入差异已经确认，先固定 Runtime 使用的 bundle 快照作行为对照。

1. 先在作者阅读看到候选入口和两个选项，记录原文/JSON 的每个节点来源。构建候选不改变正式玩家状态。
2. 用当前项目的隔离预览选父 Entry，给它满足真实前置的测试初态。共用 `previewStoryWithContent`、`StoryPreviewConditions` 与现有 UI。未满足前置的初态也要跑一遍，保留真实拒绝理由；如果试播为作者开放“继续”，在结果上区分人工放行。
3. 正式式样的试播从父开始，先查看等待状态，到天台接取，再选择 photo。在子过程中做一次保存/恢复对照。子完成后只回传允许列表中实际存在的 photo；父回到对应段。用新初态跑 route 检查另一支。使用已有测试 harness 固定起点、输入和断言。
4. 另跑旧的入口、取消赴约和坏目标。坏 Area 或 active Entry 先在作者诊断能定位；试播遭遇不合法游标时须说明失败点。现有“重读”隔离世界效果的能力与“作者当前草稿试播”不要混称。
5. 检查输入输出侧。需要记录的是初态、真实选择、已读/完成状态、效果是否执行、游标与观察结果，而不是仅记录是否返回成功。只有能从现有宿主得到这些数据时才承诺细粒度高级判定；其他内容按[主规格](04-story-dsl-and-compiler.md)设计分批接入。
