# 交接：超级图鉴阶段 A/B（2026-10-15）

状态：completed — A/B 已于2026-10-15完成验收并归档；阶段C/D未实施。窄屏验收按用户要求排除在本轮范围。

> 本文先保留接手时的历史快照；下方“最终验收”覆盖其中当时的失败与待办状态。

## 接手先读

- 总体裁定：[[docs/plan-work/draft-0282-super-codex-and-authoring-workspace]]。
- 阶段 A：[[docs/plan-work/archive/task-0282-super-codex-phase-a-reliable-relations]]；正式 Unit 与 receipts 在 `docs/plan-work/archive/task-0282-units/`。
- 阶段 B：[[docs/plan-work/archive/task-0283-super-codex-phase-b-friendly-workspace]]；正式 Unit 与 receipts 在 `docs/plan-work/archive/task-0283-units/`。
- 按 AGENTS 的 UI／Datapack 领域入口、[[docs/ai/frontend-design-project-overlay]]、[[ui-style/00-index]]读取最小范围。UI施工继续使用 frontend-design skill。

工作目录：`C:\Users\15229\Documents\Obsidian Vault\1-项目\ACProgram`。项目地图已核对 `project_id=acprogram`；接手再次用 graph_project 核对目录，后续查询显式传project_id。

## 用户授权与范围

用户已批准 A/B 施工，明确允许多个 **Luna MAX** 子 Agent。无需再次询问启动许可；如委派，使用 `gpt-6-luna`、`reasoning_effort=max`、`fork_turns=none`，保留各 Unit 白名单。现有子 Agent 已停止；详情代理最后因额度限制异常结束，不要假设它已完成验收或 Receipt。

冻结方向：图鉴主阅读为**资料＋被引用**；完整出向引用、字段树、JSON进入技术详情。中文分类优先、数据包为范围；当前生效定义只读，不按玩家拥有／解锁隐藏。延续浅色工具表面和局部 `--codex-*`，保留 body 工具宿主；不套游戏场景主题。

B仅交付共享框架的图鉴端。**阶段 C 的编辑器迁入、按条目草稿、保存／应用重构，以及阶段 D 扩充未实施**。保留原 Editor 操作；不改Schema、玩法结算、发布包或玩家存档。

## 交接时的代码状态（历史快照）

| 部分 | 已落盘内容 | 验收状态 |
| --- | --- | --- |
| A 一般关系 | 精确字段／union规则、全局类型约束、Effect／Condition／Trigger、剧情入口和表现局部选项；未知扩展为candidate | 定向9项通过 |
| A Operation | 六表全局关系；owner/context局部解析；Team、持有物品、Scene内选择；动态actor资源/type筛选保留候选位置 | 定向6项通过 |
| A 查询整合 | 同一批边构建正反索引；原始端点不交换；部分覆盖、确定诊断、来源owner与缓存修正；DTO／字段树安全读accessor与循环 | 查询10项、Runtime规则3项通过 |
| A 真实发布包 | 内存加载正式base、Carousel、StrategyPark及Runtime补充源；真实剧情入口、设施关卡、资源、Team与actor type代表断言 | 1项通过；全部已声明非candidate关系无missing/ambiguous |
| B 共享骨架 | 纯renderWorkspaceLayout＋renderContentWorkspace；三栏与可选操作插槽，pane-switch；图鉴实际使用 | Frame13项通过 |
| B 壳与导航 | 中文分类／类型、未知来源可见、重复派生入口去重；无名剧情入口复用Story名称；筛选外定位；复制ID | Shell9项通过；集成待本检查点结果 |
| B DOM与历史 | input／列表／详情宿主保持；IME提交、键盘tabs；50步关系历史、范围与scroll恢复；popover按变更子树处理 | DOM边界2项通过；此前集成22项通过，随后又有新增补丁 |
| B 资料与被引用 | 已改资料／被引用／技术详情；按source分组，direct/self/derived/runtime-rule/candidate分区；primitive引用数组可点；嵌套progression资料 | 最后补丁已落盘，尚需整体验证与独立复核 |

### 关键源码

- A公共合同：`src/data-services/contracts/runtime-content-browser.ts`。
- A内部规则合同：`src/data-services/registry/runtime-content-reference-types.ts`。
- A实现：同目录 `runtime-content-browser.ts`、`runtime-content-reference-rules.ts`、`runtime-content-operation-references.ts`、`runtime-content-operation-context.ts`。
- B模型／状态／壳：`src/ui/runtime-editor/codex/model.ts`、`state.ts`、`view.ts`、`content-labels.ts`、`workspace.ts`、`dom-updates.ts`、`codex.css`。
- B资料：`src/ui/runtime-editor/codex-details/render.ts`、`profiles.ts`、`types.ts`。
- 接入：`src/ui/runtime-editor/view.ts`、`actions.ts`；共享布局 `src/ui/components/workspace-frame.ts`。

### 不可回退的语义修复

1. incoming 显示／跳转引用者 source，outgoing跳target；`path`始终属于原引用者。原始edgeSource/edgeTarget保留。
2. 同ID跨类型先按targetKinds过滤。Init.startStoryId可为Story或Active入口，kizuna为Active，FollowUp为Active/Passive；不把派生storyEntries当另一个全局候选。
3. local关系用owner ref＋完整path及context表达，不构造局部假全局条目。Actor资源、位置、类型等依运行时recipient/selector的开放选择不报确定缺失／歧义。
4. 仅declared且非candidate参与确定诊断；coverage始终partial。未知扩展可查，不等于完整覆盖或可安全删除判断。
5. 来源仅接已有可靠owner：Init/Area/Spot、characterVariants、resourceDisplays。namespace不是来源证明；未知条目仍可从全部／来源待确认访问。未做全表来源台账。
6. 指纹包含owner、loadedModNames、规则源revision；定义继续沿替换／重载边界更新，不保证任意深层原地修改自动失效。
7. 列表select-entry沿旧行为不压关系栈；open-entry和主动locate才记录。历史上限50，失效键清理。跨范围跳转不自动清列表筛选。

## 验证记录与初始检查点（历史快照）

以下是**实际已执行**，不是预计结果：

- A查询10、一般规则9、Operation6、Runtime规则3、真实包1，共29项已分别通过。最近真实包与Operation合跑为2文件／7项通过。
- B Shell9、Frame13、DOM边界2已通过；早一轮Integration22通过，之后新增键盘／复制／分组适配和最后详情补丁，不能据此宣称当前集成全通过。
- 原Editor兼容：launcher1、form23、definition12、persistence5、popover5通过。export首次4通过2失败，原因是旧测试夹具缺ctx.game；仅给两个夹具补getPackCatalog空结果后6/6通过，未改生产导出流程。合计52项已有通过证据。
- `npm run check:architecture`通过。
- 交接文档与补充Receipt落盘后，`npm run check:docs`扫描823份Markdown、0错误，通过。
- 最近差异空白检查通过；有工作区原有CRLF提示，不是本轮空白错误。
- **本次交接最终检查存在类型及8项UI失败，详见下方“检查点结果”。**

### 检查点结果

当前源码检查点已跑完，**仍有失败，不能交付为已完成**：

| 检查 | 实际结果 |
| --- | --- |
| `npx tsc --noEmit` | 失败1处：`tests/ui/runtime-editor-codex-details.test.ts:275`，unknown不能传给RuntimeContentRawValue参数 |
| 当前5文件UI批次 | 52通过、8失败，共60项；Shell9、DOM2、Frame13全过；Integration22/23；Details6/13 |

八项失败的具体入口：

1. Integration「键盘切换页签保留按钮与标题身份，重复同步不重建工具」：按End后仍为overview，预期raw；从`actions.ts`的keydown委托及当前tab DOM排查。这项不能仅改预期为overview。
2. Details旧overview转义用例还要求Unsafe title出现在详情body；B已把身份移到shell header，应把对应转义证明放在正确责任区，不能恢复重复标题来凑测试。
3. Details旧关系诊断用例仍在relations断言出向状态；完整出向关系已按裁定移到raw，应迁移测试入口并继续证明resolved/missing/ambiguous与只读行为。
4–5. 两项旧「相关组分」用例要求overview同时有出向／反向聚合。该旧主区已移除；需改为资料引用字段、被引用source分组、技术出向各自的行为验证，不能简单删掉覆盖。
6. 六类Operation profile用例：Event字段标签预期“位置上限”，实现为“位置访问上限”；核对术语并统一。
7. 被引用分组用例：fixture包含3个不同source path（含局部引用），实现为3条；测试仍期望2条。先核实source/path去重口径再修断言。
8. 部分覆盖空态：断言仍要求旧空态文字及本体出向条数；relations已改为“未找到确定的直接引用者”和部分识别说明，出向计数留技术详情。按当前裁定重写断言。

这些失败来自本次接手快照，未在编写交接文档时继续修代码。建议先处理类型错误和键盘行为，再更新过时详情断言并补真实资料验证。

### 浏览器最终证据（桌面 1440×900）

- localhost开发服务为 `http://localhost:5173/src/ui/index.html`；使用独立IAB页并设置1440×900，未操作用户现有Edge页。验收结束后恢复视口并关闭临时页。
- 中文三栏显示452条当前生效内容及“来源待确认”。搜索“夏莱主厅”得到4条结果；Area详情的“被引用”显示13个引用者／14条路径。
- 点击引用Spot后保留原筛选并显示“当前条目在筛选范围外”；主动定位后两次返回恢复Spot的筛选外状态，再恢复原Area、查询与“被引用”页签。
- 长ID与Operation Profile可读；技术详情显示出向引用、局部路径、缺失推断、覆盖说明和字段树。End键切换到技术详情；不存在的搜索显示明确空结果；页面和详情未发生横向溢出。
- 超级图鉴在“主题系统展示 Init”场景下保持独立浅色表面。原Editor入口仍可打开既有内容浏览器。
- 浏览器交互仅用cua_repl；evaluate只读取DOM布局，不访问隐藏game对象。真实包验证只在内存加载，不写包库或玩家状态。
- 已保存桌面截图：codex-super-index-incoming-1440.jpg、codex-super-index-desktop-1440.jpg、codex-super-index-technical-details-1440.jpg，位于本任务 Codex visualization 输出目录。
- 用户明确“不需要考虑窄屏验收”，所以本轮未执行390×844检查，也不把它列为完成条件。

## 初始交接待办（已由最终验收收尾）

### 第一优先：冻结与复核最后详情补丁

详情子Agent最后一次因额度限制异常退出，未能提交自己的U3/U8/U9 receipts。主线程已补交接Receipt并明确标记in-progress；源码文件当前存在，不应从HEAD覆盖。先读当前diff与测试结果，再修确定失败。

重点核实最后已落盘项：inferred/global归candidate；resolved边不重复显示“可能目标”；storyEntries可靠canonical导航；source分组HTML键encodeURIComponent；覆盖空态去重复；中文引用kind；progression嵌套路径；primitive引用数组名称按钮。

事实纠正：`ResourceDisplayDef`在`common.ts`确实使用resourceId/label/detailLabel/showWhen/order；Init在`world.ts`确实使用worldTilt/worldTiltAlias。CharacterVariant.curve仍在顶层，只有favoriteItem/uniqueWeapon/initialTraits/gearSlots/skills在progression内。不要按聊天中的待核怀疑改掉正确字段。

最后render仍留有旧“入向空态”字符串，请核对是否已不可达／仅技术说明，完成产品文案清理。检查资料页字段遗漏与重复：被隐藏的身份字段必须在header或完整技术详情可读。

### 第二优先：交互验收与收尾

1. 完成当前类型／定向批次，修复实际失败后再做一次有针对性的验证；不为省时间跳过失败。
2. 确认普通Tick不重建工具；IME独立重绘时不破坏正在输入的组合。已有测试主要覆盖composition输入被延迟提交和compositionend后节点／焦点保持。
3. `patchCodexPane`缺失Pane恢复当前向grid末尾append，需核对恢复左／中栏时顺序是否正确；尚无该恢复路径回归。
4. 局部owner路径提示已接，具体已渲染字段的滚动定位与折叠祖先情形尚未实机验证。
5. 冻结源码几分钟后，用1440×900和390×844验证真实Area入向→Spot、跨筛选跳转→定位→返回、页签与scroll、长名称／空态、原Editor入口；保存最终截图。
6. 按实际修复结果更新U3/U8/U9、主线程U6/U7交接receipts。U3只render，U8为profiles/types，U9为details测试；不要为了预算压缩可读性。
7. 把Task A/B当前核验／检查框、Draft和索引从旧“待开始”叙述同步成实际验收结果；当前机制／ui-style已有更新，必须按最终实现复核，不能把未验收记录当作完成证明。
8. 只有全部独立完成条件满足才标complete，并按goal-workflow把Task及Units/receipts一起移入archive、更新链接；保留Draft作为C/D设计来源。当前不要归档未完成Task。

## Unit与Receipt归属及最终状态

- A U1一般规则、U2 Operation collector、U3查询整合、U4 incoming适配、U5 Operation context、U6真实包、U7一般测试、U8 Operation测试。对应receipts已存在。
- B U1共享Frame、U2壳、U3详情render、U4模型／状态／投影、U5 DOM／actions、U6导航/DOM测试、U7当前文档、U8 profiles/types、U9详情测试、U10旧Editor导出夹具。
- A的U1–U8 receipts与B的U1–U10 receipts均已更新并随Task归档；B的U3/U6/U7/U8/U9已按最终运行结果回填。Task receipts保留各Unit责任边界，最终批次结果见父Task。

## 工作区保护与地图状态

**所有改动仍在同一工作区，未提交Git，未创建PR或新worktree。** 接手不要reset／clean，不要把其它任务改动当作本任务修复。

开工时就存在的无关修改，必须保留：

- `docs/docs-829/06-wiki/50-ui/presentation-theme.md`
- `src/arona-clicker/services/color-system.ts`
- `src/ui/components/contacts-workspace.ts`、`rail.ts`、`story-workspace.ts`、`story.ts`
- `src/ui/controller-actions-topbar.ts`、`controller-theme.ts`、`controller.ts`
- `src/ui/css/chat.css`
- `tests/ui/contacts-story-workspace.test.ts`

本轮另修改read-model-context、refresh-update、ui-style/patterns与foundations等当前文档，详见git status。禁止改生成schema、dist、node_modules与只读历史快照。

GALHCG已经只读复核改动的直接路径：已映射文件通常为content_changed、旧Evidence基准过期，owner分页完整；新模块／测试／计划多为unreferenced_path或未索引。**没有刷新、写freshness或维护图谱，不得宣称图谱验证通过。** 本交接文档的直接路径检查返回unreferenced_path（只读），未写图谱。正确局部调用为 `graph_health(check="changed", options={"path":"项目相对路径"}, project_id="acprogram")`，path要在options内；早期误放顶层会被忽略并返回全局第一页，不应继续沿无关结果扩读。

## 交接时建议复核的命令（现已执行）

```powershell
npx tsc --noEmit
npx vitest run --silent --maxWorkers=4 --minWorkers=1 tests/ui/runtime-editor-codex-integration.test.ts tests/ui/runtime-editor-codex-details.test.ts tests/ui/runtime-editor-codex-shell.test.ts tests/ui/runtime-editor-codex-dom-updates.test.ts tests/ui/workspace-frame.test.ts
npx vitest run --silent tests/data/runtime-content-browser.test.ts tests/data/runtime-content-reference-rules.test.ts tests/data/runtime-content-operation-references.test.ts tests/engine/runtime-content-browser-rules.test.ts tests/engine/runtime-content-browser-published-content.test.ts
npm run check:architecture
npm run check:docs
git diff --check
```

源文件冻结后才做浏览器最终验收。现有Vite服务有HMR，代码修改会重置验收页；动作后重新读DOM，别复用过期AX编号。

## 最终验收（2026-10-15）

- A 数据与Runtime批次：5个测试文件、29/29通过。正式内容在内存GameInstance中加载，确定关系没有missing／ambiguous误报。
- B UI与Frame批次：5个测试文件、62/62通过；覆盖Integration 24、Details 13、Shell 9、DOM updates 3、Workspace Frame 13。
- 原Runtime Editor兼容回归52项通过：launcher 1、form 23、definition 12、persistence 5、popovers 5、pack export 6。
- npx tsc --noEmit、npm run check:architecture、npm run check:docs、git diff --check均通过；文档扫描823份Markdown、0 errors。差异检查仅有工作区既存CRLF提示。
- 1440×900浏览器验收覆盖中文分类、搜索、Area→被引用→Spot、筛选外提示、主动定位、两次返回恢复、键盘页签、长ID、Operation资料／局部路径／缺失推断／字段树、空结果、浅色主题隔离和原Editor内容浏览器入口。
- 已保存3张桌面验收截图。临时视口已reset，临时IAB页已关闭；用户现有Edge页未操作。窄屏验收按用户明确要求排除在本轮范围。
- 已更新U3/U6/U7/U8/U9及父Task receipts、两份Task、Draft与索引；Task及Units/receipts与本交接记录一并归档。Draft保留为C/D设计来源。
- 没有提交Git、创建PR或写入GALHCG；保留工作区其他任务既存修改。阶段C编辑器迁入与阶段D更多编辑能力仍未完成。
- 最终GALHCG直接路径只读复核：归档Task、Draft和新Receipt返回unreferenced_path；00-index、机制／样式文档、相关源码和集成测试返回content_changed，旧Evidence基准未更新。按权限未刷新或维护图谱，因此不把这些结果称为图谱验证通过。
