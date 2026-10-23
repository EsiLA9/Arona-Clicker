# reports/story-talklet-investigation/authoring-and-validation — 作者入口、编辑器与校验调查

本文回答：现有 Story/Talklet 如何被创作、打包、浏览、编辑、校验和导出，以及未来 Story 编辑工具必须承接哪些已有语义。

调查日期：2026-10-22。范围是当前工作树；HEAD 为 `36f1b1018bb72ab79845093b41c99166f207a58d`，存在大量未提交的并行开发内容，不能把 HEAD 单独视为本报告完整基线。本文是调查快照，不是已批准的整改方案，也不替代持续维护的 docs-829。

## 1. 入口并非只有一个

| 入口 | 当前能力 | 边界与证据 |
| --- | --- | --- |
| TypeScript 内容 Builder | `story().scene()` 接受 Talklet 或 TalkletBuilder；支持对话、旁白、点击、效果、跳转、选项等 | `src/arona-clicker/content/def-factory/story.ts` 与 `talklet.ts`；Builder 不是完整字段编辑器 |
| Datapack JSON | `stories`、`activeStories`、`passiveStories` 三张正式表；Story 内联 Talklet 数组 | `src/data-services/contracts/datapack.ts`、`story.ts`、`story-entry.ts` |
| 正式内置数据 | `defaultDatapack` 直接导入 `base-pack/content.json` | `src/arona-clicker/content/default-datapack.ts`；不能假定修改旧 TS 内容文件就自动改变产品内容 |
| 独立 Datapack Editor | stories 整表自定义 Schema、嵌套 Talklet/choice 字段表单、通用数据模型和撤销重做 | `tools/datapack-editor/schema/editor-extras.ts:726`、`model/editor-model.ts` |
| 游戏内 Runtime Editor | 可浏览和检查 Story 定义、关系和内容字段树；正式作者策略目前只有 Init/Area/Spot/Enhancement | `src/ui/runtime-editor/codex-details/`、`src/data-services/authoring/content-policies.ts:373` |
| 游戏内导出 | 保留来源包的 stories/activeStories/passiveStories | `src/ui/runtime-editor/pack-export.ts:124`；保留导出不等于已支持 Story 草稿编辑与 Apply |
| Flow 的类型化投递 | 接受 Talklet 加可选 id/repeatPolicy，转换为 FlowEntry | `src/ui/flow/flow-entry.ts`；有实现和测试，当前未找到生产调用，不是现行 StoryDef 作者字段 |
| showChatText 演出覆盖层 | 可在 Effect.value 中嵌入最小 EngineTalklet、坐标与样式 | 与故事页面的执行语义不同，见同目录 `position-id-presentation.md` |

## 2. 三表与虚拟合并表

正式契约中 `stories` 是演出本体；入口按主动、被动分表。独立编辑器还构造 `storyEntries` 虚拟合并视图，`EditorModel.rowsOf('storyEntries')` 返回两张入口表的联合，用于引用候选；它不是第四张需要导出的正式内容表。

`runtime-content-reference-rules.ts` 对入口别名也有归一规则。浏览器、Schema 的显示标签、游戏命令参数名均不能单独作为引用目标身份的依据。至少应按引用位置分别识别：

| 引用位置 | 当前语义 |
| --- | --- |
| StoryEntry.storyId | StoryDef |
| Talklet.jumpToStory / choice.jumpToStory | StoryDef |
| Talklet.kizuna.storyId | ActiveStoryEntry |
| branchGuards.storyId / prerequisites.storyId | StoryDef；前置还带 talkletIndex |
| passive.pushAfterStory | StoryDef |
| followUps.outcome.storyEntryId | 主动或被动 StoryEntry |
| Effect.triggerStory.target | StoryEntry；引用收集实际映射 activeStories/passiveStories |
| Effect.showChatText.target | 覆盖层临时 ID，不是 Story 或 Talklet 节点 ID |

证据：`src/data-services/registry/runtime-content-reference-rules.ts:37`、`:166`、`:314`，`tests/data/runtime-content-reference-rules.test.ts`。其中注释、手写 Schema 与运行时未必完全一致；例如手写条件 `hasReadStory` 的引用候选目前使用 storyEntries，但引用收集按 stories 识别，应与条件系统实际执行一起核实，不能统一机械替换。

## 3. Builder 覆盖程度

`TalkletBuilder` 构造函数要求 text；`build()` 对空字符串抛错，非空白校验并不存在。可链式设置 speaker/avatar、narrate/align、click/clickWork、effects、sendText/reply、mute/muteReply、side、noAvatar、showAvatar、image、typing、thinking、jump、kizunaCard、choice、choiceJump。

需注意：

- `StoryChoice.condition` 是正式字段，但 Builder 的 `choice()` / `choiceJump()` 没有对应条件参数；直接 Talklet 对象能表达更多内容。
- `narrate()` 和 `click()` 都写同一个 kind，连续调用以最后一次为准，但不会清理其他已设置字段。
- `noAvatar()` 和 `showAvatar()` 可同时设置；Builder 不负责组合语义校验。
- `jumpMode` 仅在设了 jumpToStory 时输出；空字符串字段多数被省略，typing/thinking 的显式 0 会保留。
- `.scene()` 追加页面，不生成页 ID；StoryBuilder 本身没有按 ID 建图、重排进度迁移或复杂语义校验。
- Builder 的 effects 与 choices 数组直接交给 build 结果，不能将其理解为深冻结的不可变作者模型。

证据：`src/arona-clicker/content/def-factory/talklet.ts`、`story.ts`、`tests/engine/def-factory/talklet.test.ts`。本轮此测试 8/8 通过。

## 4. 独立编辑器的手写 Story Schema

生成器 `scripts/gen-engine-schema.mjs:42` 将 StoryDef、StoryEntryDef、ActiveStoryEntry、PassiveStoryEntry、Talklet、StoryChoice 列入 `HAND_TYPES`。`editor-extras.ts` 为 stories 和入口表提供 `custom` 整表配置。`merge.ts:69` 遇到 custom 会直接返回整张自定义表，跳过自动字段合并。

因此“源接口新增字段，再生成 Schema”不能自动保证 Story 表单完整覆盖。stories 的当前字段表如下：

| 内容 | 手写字段覆盖 |
| --- | --- |
| Story 基础 | id、name、talklets、extra |
| Talklet 文本/头像/图片 | text、speaker、avatar、image |
| 页面种类与位置 | kind、align、side |
| 头像控制 | noAvatar、showAvatar |
| 回复与工作量 | sendText、muteReply、clickWork.base/rand |
| 节奏 | typing、thinking，附默认 0.9 秒、最大 10 秒说明 |
| 效果与分支 | effects、choices.text/effects/condition/jumpToStory/jumpMode |
| 页跳转 | jumpToStory、jumpMode |
| 当前未列出的正式 Talklet 字段 | kizuna |
| 当前也未成为正式 Talklet 字段的扩展 | id、repeatPolicy、x/y、mapOverview/mapCards/mapLocations、actions、marks |

`kizuna` 的缺口是手写表单元数据缺口；不能据此宣称 JSON 导入一定删除它。EditorModel 的导入与导出深复制整张表行，嵌套 `setValue()` 也先复制整行再改路径；对于已导入但没有对应控件的字段，存在保留路径。是否经所有整对象编辑操作都保留，需要专项往返测试。

### 4.1 Effect 编辑入口的表达边界

`editor-extras.ts` 的 effectArray 使用手写 Effect 枚举与值字段；定位演出 `showChatText` 的复杂对象不能仅凭 op 下拉框出现就认定有完整可视化控件。必须分别验证其 value 可否写入 text/talklet/x/y/style 等结构，是否正确保留字段。

同样，显示选择字段不等于支持分支图可视化、循环诊断、insert 返回点预演、效果沙盒或预览时间轴。本次没有发现这些已在上述 Story 表单链路闭合的证据。

### 4.2 通用编辑模型可以复用的基础

`EditorModel` 提供行添加/删除/复制/移动、任意嵌套路径写入、record 操作、撤销重做；历史上限 50。它存储的是通用对象快照，不维护故事页身份或玩家已读进度的语义映射。

未来 Story 工具即使复用该模型，也仍需另行明确页面移动、删除后的引用和进度处理。通用 `setValue()` 能修改数组，不代表故事进度迁移已经存在。

## 5. 游戏内 Runtime Editor 的事实边界

`RuntimeEditorContentKind` 目前仅为 `'inits' | 'areas' | 'spots' | 'enhancements'`。草稿状态、持久化 envelope 与 `CONTENT_POLICIES` 同样只闭合这四类。

另一方面，Codex 内容浏览器有 stories/activeStories/passiveStories/storyEntries 标签、详情 profile、字段树和关系；`view.ts` 会处理合并入口的别名与目标 Story。这解释了“能看见 Story”与“已经能正式修改 Story”之间的差别。

`pack-export.ts` 从来源包复制三张 Story 表，因此当前编辑其他实体并导出包时可以保留 Story。新增 Story 编辑不能只加一个 UI 页，还需补充或明确：

1. authoring policy 与可写字段；
2. 草稿定义、恢复版本、损失诊断；
3. 运行时应用策略及失效通知；
4. 正在播放的游标如何面对定义替换；
5. 包归属、跨包引用、暂停与恢复；
6. 导出与再导入的对称性。

以上是调查导出的待决事项，不是批准的实现清单。

## 6. 校验实际分四层

| 层次 | 已核实检查 | 不能推定具备的检查 |
| --- | --- | --- |
| TypeScript 契约 | 字段形状、可选性、部分枚举 | 任意 JSON 运行时安全、字段组合、引用存在 |
| 独立 Editor Schema 校验 | 必填、类型、枚举、ref 集合、嵌套字段、整数/有限数等 | 未列入 hand/custom Schema 的字段语义；完整 Story 图可达性 |
| Registry validateDatapack | Story/Entry 重复、实体 ID 格式、Entry.storyId 存在、FollowUp 局部 ID/Area/Entry、Extra | 本轮在其 Story 分支未见 Talklet 全字段组合和跳转图完整性校验 |
| 运行时防护 | 缺少目标、空 Story、选择索引、choice 条件、点击门槛、重读守卫、跳转深度 | 作者编辑阶段完整诊断；这些错误可能到播放时才返回 |

Registry 的 Story 定向证据：`src/data-services/registry/registry-validate.ts:1093`、`:1281`、`:1372`、`:1415`。引用收集的证据是 `runtime-content-reference-rules.ts`；它用于浏览和关系诊断，不应直接等同于 Registry 拒绝规则。

### 6.1 Schema 同步测试的盲区

`tools/datapack-editor/schema/engine-schema.sync.test.ts` 多处通过 `if (meta.custom) continue` 跳过 custom 表的生成字段对应检查。stories 正是 custom 表。因此同步测试通过不证明 Talklet 所有字段都有控件，更不证明所有能力能在编辑器中无损往返。

本轮不修改生成文件，不执行 Schema 生成。现有并行 Gameplay B 契约变化不能被本调查“顺便同步”覆盖。

## 7. 正式包内容统计

统计来源：`src/arona-clicker/content/base-pack/content.json`；统计方式为遍历 stories 顶层 talklets，以及每页/每 choice 的直接 effects。它不包含所有测试包、可选 Gameplay B 包或演出 value 内嵌的 Talklet；字段出现次数不是功能质量指标。

| 对象 | 数量 |
| --- | ---: |
| StoryDef | 43 |
| Talklet 页面 | 118 |
| ActiveStoryEntry | 14 |
| PassiveStoryEntry | 25 |

页面字段出现次数：text 118、speaker 88、sendText 64、effects 59、kind 30、align 27、choices 7、clickWork 3、jumpToStory 3、noAvatar 2；avatar/image/jumpMode/kizuna/muteReply 各 1。该包没有显式声明 typing/thinking/side/showAvatar 的页面，不意味着运行时不支持这些字段。

| 直接效果 op | 次数 |
| --- | ---: |
| addResource | 35 |
| setFlag | 17 |
| showChatText | 12 |
| setTheme | 6 |
| addItem | 5 |
| clearIdChatFlow | 3 |
| addAffectionExp | 2 |
| clearAllChatFlow | 2 |
| showOpeningTitle | 2 |
| clearAllChatText | 1 |
| setSpotLevel | 1 |
| travelToArea | 1 |

这份内容说明定位演出、临时 ID 清除、主题切换并非只存在于旧规划或孤立接口，正式包已有声明。执行语义与覆盖限制见专题附件。

## 8. 给上层 chat 的具体推演题

以下是建议思考的决策问题，尚无本轮授权答案：

1. 创作单位是线性 StoryDef、跨 Story 的图、StoryEntry 演出链，还是更高层作品？保留哪几层身份？
2. 页面稳定身份是否进入作者契约？如何与 Story 数组顺序、读档位置、已读日志、choice 历史与 branchGuards 对齐？
3. 作者编辑的是“呈现块”“等待输入节点”“状态效果”还是现在的可选字段组合？若拆开，旧组合如何映射？
4. x/y/id 覆盖层与正常历史是否继续分离？清除/覆盖操作的作用域是什么？
5. Map 专用内容的来源和命令能力是否被允许进入 Story 作者层？若允许，来源过期和宿主权限如何保证？
6. 预览是纯静态渲染、隔离的播放 Runtime，还是正式游戏的特殊运行模式？不能默认 replay 是无副作用预览。
7. 仅支持编辑未播放内容，还是允许热替换正在播放的定义？失败时保留哪些原状态？
8. 手写 custom Schema 是否继续使用？如何为完整字段覆盖、引用目标、未知字段保留建立独立护栏？
9. 对话角色是否仍是 speaker 字符串，头像/主题/owner 是否建立结构化关系？当前显示身份与游标 owner 是不同概念。
10. 哪些既有行为必须保持，哪些允许作为本次大整改明确改变？应先列兼容矩阵再估算迁移。

## 9. 验证与阅读入口

本轮根 Agent 执行 9 个定向测试文件，120/120 通过，详见总报告的验证记录。本附件有关 Editor custom 字段缺口、Registry 范围与草稿能力的结论来自静态源码核查；没有运行独立编辑器浏览器验收，没有测试新 Story 工具，也没有声称完成所有编辑往返验证。

- 当前契约入口：[[docs/docs-829/03-data-structures/datapack-contracts]]。
- Schema 维护：[[docs/docs-829/05-conventions/schema-sync]]。
- 独立工具职责：[[docs/docs-829/02-modules/datapack-editor]]。
- 本次总报告：[[docs/plan-work/report-0321-story-talklet-capability-investigation]]。
