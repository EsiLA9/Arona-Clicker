# Task：超级图鉴阶段 A — 可靠引用与来源

状态：completed — 可靠关系、真实包与只读图鉴验收于2026-10-15完成；窄屏验收按用户要求不属于本轮范围。

## 目标与依赖

让超级图鉴的静态关系能够正确回答“哪些内容使用了当前条目”，点击引用者能打开正确对象；普通文本、局部键和状态键不会被误报为全局缺失引用，来源显示与筛选采用可证明的统一口径。

本 Task 独立交付只读查询及现有图鉴中的关系正确性，是 [[docs/plan-work/archive/task-0283-super-codex-phase-b-friendly-workspace]] 的前置。整体终点是图鉴与游戏内编辑器共用内容工作区；本 Task 不实施界面重塑或编辑器迁入。

设计来源：[[docs/plan-work/draft-0282-super-codex-and-authoring-workspace]]。用户已要求构造 A/B Task 并等待开始；本次仅冻结范围，不视为启动施工。

## 冻结边界

- 包含：字段语义与作用域明确的关系提取、类型约束解析、同源正反向索引、覆盖说明、不确定候选隔离、入向行显示及跳转修正、已有可靠 owner 接入与缓存一致性。
- 查询范围：当前 Registry 生效定义及现有 Runtime 规则补充源；不读取未加载包，不混入编辑草稿或玩家当前状态。
- 来源采用最小可靠方案：接入现成 owner 方法，保留“全部生效内容”和“来源暂不可确认”；本 Task 不建设全表统一来源台账、不承诺每条都有包版本。
- 不新增可写表授权，不修改 Editor 保存／应用／删除策略；图鉴关系结果不能充当删除安全证明或完整包校验结果。
- 不改变实体字段、Datapack Schema、世界线归属、玩家存档、玩法结算或独立 Datapack Editor。
- 不实施 B 的分类／资料页／大范围 CSS 重塑；只做证明 A 正确所需的现有关系行调整。

## 当前事实与代码落点

| 已核实事实 | 源码／测试依据 | 施工影响 |
| --- | --- | --- |
| 关系诊断保留 `source / target / path / candidates`，incoming 从同一批 outgoing 反建 | `src/data-services/contracts/runtime-content-browser.ts`；`registry/runtime-content-browser.ts: buildSnapshot` | 保留原始边语义，增强提取与解析，不另造独立反向扫描 |
| `collectReferenceStrings` 按字符串形态及字段尾缀发现引用；`diagnosticFor` 按 ID 查全类型候选，未使用 targetKind 过滤 | `src/data-services/registry/runtime-content-browser.ts: collectReferenceStrings / diagnosticFor / relationMetadata` | 文本／局部 ID 可误报；语义规则、解析状态与覆盖程度须分离 |
| `inspectorView` 对两个方向都调用取 target 的适配器，incoming 没有改为显示 source | `src/ui/runtime-editor/view.ts: inspectorReference / inspectorView` | 先补“查看目标，再点引用者”的 UI 回归，防止只修查询不修跳转 |
| 查询 `ownerOf` 只接 Init / Area / Spot；Registry 另有角色差分和资源来源方法 | 同文件 `ownerOf`；`src/data-services/registry/registry.ts: characterVariantOwnerOf / resourceDisplayOwnerOf` | 接可靠来源，不以 namespace 冒充最终提供者 |
| 缓存指纹目前基于容器／对象身份及补充源 revision 等值 | `src/data-services/registry/runtime-content-browser.ts: snapshotFingerprint / createRuntimeContentBrowser` | 来源变更及关系规则依赖须纳入正确失效边界 |
| 发布三包集可发现六类 Operation；其中 actor / track / fact / position / scene 等有局部语义 | `src/data-services/contracts/operation.ts`；发布 base 与两份正式 Operation 包 | 验证全局 action/location 引用和局部键边界，不能按 Id 尾缀一概查 Registry |

2026-10-15 调查已在内存复现反向行跳自身与文本／局部键 missing。调查运行的原有 5 个相关测试文件共 42 项通过，但未覆盖上述回归；这个历史结果不作为本 Task 的验收。

## 最小 Read Set 与修改边界

按 [[docs/ai/context-packs/datapack-schema]]、[[docs/ai/context-packs/ui-presentation]] 选择子题，先读当前关系查询契约／实现、UI 适配器及 `tests/data/runtime-content-browser.test.ts`、`tests/engine/runtime-content-browser-rules.test.ts`、`tests/ui/runtime-editor-codex-details.test.ts`、`tests/ui/runtime-editor-codex-integration.test.ts`。

涉及字段语义时只补命中的世界、剧情、角色、资源、Effect／Condition 和 Operation 源契约及消费方；不能依据字段名或本 Task 摘要推断。架构与验证入口见 [[docs/docs-829/05-conventions/architecture-discipline]]、[[docs/docs-829/05-conventions/testing]]。

预计改动：

- `src/data-services/contracts/runtime-content-browser.ts`、`src/data-services/registry/runtime-content-browser.ts`；必要时在同一 registry 目录拆出引用规则模块，避免主文件继续堆积。
- `src/ui/runtime-editor/view.ts`、`codex-details/types.ts`、`codex-details/render.ts`、`codex-details/profiles.ts` 的方向／端点适配。
- 上述直接定向测试；补充同目录的语义回归文件仅在已有文件职责不适合承载时使用。
- 相关当前机制文档、计划记录；不修改发布内容来迎合扫描结果。

这是一份 Task 级范围，不是正式 Patch Unit 白名单。启动后按实际切片需要依 [[docs/ai/PROJECT-CONSTITUTION]] 冻结 Unit 的具体路径、预算和停止条件，再执行该 Unit；当前不预建空 Receipt。

## 施工切片

正式施工 Unit（先核对事实／回归，再实施）：[[docs/plan-work/archive/task-0282-units/u1-general-rules]]、[[docs/plan-work/archive/task-0282-units/u2-operation-rules]]、[[docs/plan-work/archive/task-0282-units/u3-query-integration]]、[[docs/plan-work/archive/task-0282-units/u4-inbound-ui]]。主线程负责公共合同和集成，子 Agent 仅修改各自白名单；Receipt 随实际工作填写。

U2 初稿超过 500 行，主线程在整合前拆出 [[docs/plan-work/archive/task-0282-units/u5-operation-context]]：U5 仅新增 `runtime-content-operation-context.ts` 承担 owner 反查与局部声明定位，U2 留 collector／测试；同一代理按 U5 白名单完成拆分并分别记录 Receipt。

真实包回归独立放入 [[docs/plan-work/archive/task-0282-units/u6-published-regression]]，验证正式基础包、Carousel 和 Strategy Park 以及 Runtime 规则补充源；不把夹具测试通过等同于真实包语义正确。

规则实现与测试分别收束预算：[[docs/plan-work/archive/task-0282-units/u7-general-regression]] 承担通用规则回归，[[docs/plan-work/archive/task-0282-units/u8-operation-regression]] 承担 Operation 回归；由各规则代理继续完成，但每个 Unit 仅修改自己的一个测试文件与 Receipt。

### A0：锁定回归与只读合同

- 将调查中的设施 A→区域 B 路径变成现有 UI 集成测试：查看 B，应显示 A，点击后详情成为 A。
- 建立普通说明含三段形字符串、同 ID 跨类型、合法／缺失局部键和状态键的最小用例；先证明当前错误，再实施修正。
- 明确关系记录的 source、target、字段路径、用途、作用域、解析状态、语义来源和覆盖信息；保持只读快照与安全克隆。

### A1：登记世界、资源、剧情、角色的确定关系

- 按源 kind、字段路径及 union 判别分支匹配，数组保留完整路径而不因数字尾部丢失字段语义。
- 首批覆盖 Init／Area／Spot 归属与默认集合、资源费用／生产／效果、剧情入口及池成员、角色原型／差分及培养关联。
- 全局引用先限制目标 kind 再查 ID；支持多类型的字段显式列出允许集合。动态或不确定表达式不强行解析成确定边。

### A2：登记玩法 B 与复合字段作用域

- 覆盖六张 Operation 表的关键全局引用；区分 Action、Location 等全局定义与 Event／Location 内部局部声明。
- 对局部 actor / track / fact / position / scene 等按真实 owner 上下文解析；同一 Action 可在不同 owner 下使用时，保留上下文与候选，不任选一处。
- Effect、Condition、支付、Presentation、池成员按实际判别结构处理；同名 resourceId / itemId 不保证属于同一作用域。
- 局部目标用 owner 定位和字段路径表达；本阶段至少可查明所属定义与位置，具体区域高亮由 B 消费，不创建虚假的全局实体行。

### A3：统一索引、覆盖与现有图鉴适配

- 正反向查询来自同一批边；明确规则与唯一目标的关系才进入确定关系清单。未知扩展疑似引用保留为技术候选，不计入确定错误。
- incoming 行显示并跳 source，outgoing 行显示并跳 target；原始 source／target 不交换，路径始终属于原引用者。
- 自引用、派生视图及 Runtime 生成规则保留来源类别，方便 B 独立呈现和去重；无法证明生成规则 owner 时不能猜归属。
- 同步诊断数量与覆盖提示；“未覆盖”“未找到”“多候选”有独立含义，不把零结果解读为可安全删除。

### A4：可靠来源与缓存

- 补接现成的可靠 owner；来源、筛选、计数一致，不再将 namespace 与 sourceMod 混算。
- 来源未知内容始终可从全部／未知范围访问；后包覆盖 `base:...` 的来源不根据前缀判断。
- 对 clear、reload、覆盖、热替换及规则源 revision 验证缓存失效；包括 owner 改变但复用定义对象的用例。只在有事实需要时窄扩展 revision／来源依赖，不重做 Registry。

### A5：真实内容验证与交接 B

- 在内存装载发布 base、Carousel 与 Strategy Park 正式包，复核代表关系、候选和覆盖缺口；不写用户包库、玩家状态或生成文件。
- 对关键新合同作严格审查，运行定向测试、类型、架构与文档检查；验收现有 UI 的入向跳转。
- 向 B 交付实际类型、来源兜底、关系覆盖表、局部 owner 定位形式及未覆盖事项。B 不得依靠猜测填补 A 未支持的关系。

## 测试与独立完成定义

- [x] A→B 的 incoming 行显示 A 且点击打开 A；outgoing 仍正确打开 B。
- [x] 同 ID 跨类型按规则解析；多类型合法候选保留歧义；数组字段有正确语义与路径。
- [x] 普通文本不产生确定缺失；合法局部键与状态键不被误查 Registry；局部键真的缺失时在正确 owner 范围诊断。
- [x] 确定关系、技术候选及覆盖程度可区分，未知字段仍可查；正反向一致且查询不暴露写引用。
- [x] 真实三包集覆盖首批世界／资源／剧情／角色及六类 Operation 关键关系，有明确覆盖台账；未覆盖不假装完整。
- [x] 可靠 owner、未知来源、后包覆盖、筛选与计数一致；clear／reload／热更新及来源变化不会返回旧缓存。
- [x] 自引用、派生和 Runtime 规则来源信息足以让 B 分组；读取不触发玩家／包库写入。
- [x] 通过实际受影响的上述定向测试、`npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs` 和差异空白检查；记录新增回归数量及结果。
- [x] 现有图鉴实际操作验证 incoming 跳转、缺失／歧义显示；保存实际结果，未执行的浏览器验证不能记通过。
- [x] B 交接合同、当前机制文档及直接路径 GALHCG 只读复核完成。

## 最终核验（2026-10-15）

- A的字段规则、Operation引用、查询快照、owner/cache边界及真实发布内容回归已完成；真实包在内存GameInstance中加载，没有写入发布数据、包库或存档。真实包代表关系未出现确定missing／ambiguous误报。
- A数据与Runtime定向批次5个文件、29项全部通过；其中规则9、Operation6、查询10、Runtime规则3、真实包1。
- 与A相关的B五文件UI批次62项全部通过，包含Area incoming跳引用者、outgoing技术详情、候选／覆盖区分和详情字段树。1440×900桌面浏览器实操看到Area的13个引用者／14条路径，并打开引用Spot验证筛选外提示与正确source/path。
- `npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs`和`git diff --check`均通过。文档扫描823份Markdown、0 errors。
- Operation技术详情真实显示局部路径、缺失推断、覆盖说明与字段树；按DOM测量页面及详情未出现横向溢出。截图已保存于任务验收输出。
- 窄屏验收按用户明确要求排除在本轮范围，不视为未完成项。没有改动玩家或包库状态，也没有刷新或维护GALHCG图谱。

## B 实际交接合同与覆盖台账

| 范围 | 已实现的确定语义 | 覆盖限制 |
| --- | --- | --- |
| 世界／设施 | Init默认Area、Area默认Spot／邻接、Spot归属、设施operationEntry目标 | 未声明路径不会推导为确定关系 |
| 资源／物品／培养 | 已知费用、产出、效果、条件及培养关联，按目标kind收窄 | 状态键、标签和局内资源不能盲查全局表 |
| 剧情 | Init.startStoryId兼容Story／Active入口，kizuna为Active入口，FollowUp为Active／Passive，池children为入口或池 | 派生storyEntries保留sourceCategory，UI可归并重复入口 |
| 角色／表现／规则 | 原型／差分／装备关联，已判别Effect／Condition／Trigger，主题area/student目标与局部presentation option | 临时主题entityKey不被当作消费引用；未知扩展候选保留 |
| Operation六表 | Event的Init／Location／Action／Profile／Pool、Student的Character及策略／卡池／行动，CardPool的Action；Strategy偏好为开放标签 | 动态选择器保持candidate；不声称全局闭合 |
| Operation局部 | actor／track／fact／scene／sceneAction等按owner/context与完整路径定位；重复Scene键不跨Scene合并 | 多角色同名资源由运行时recipient决定，作为带位置候选展示 |

- 原始边 `source`／`target` 不交换，incoming UI跳source。`scope`为global／local／candidate；`sourceCategory`为definition／derived／runtime-rule。局部位置使用`targetLocations: {ref,path}[]`和可选`context`，保留多上下文。
- `confidence=declared`且scope不是candidate才参与确定诊断计数；覆盖始终为`referenceCoverage.status=partial`，0结果不证明没有引用。
- 来源仅接现成owner：Init／Area／Spot、characterVariants、resourceDisplays。未知内容仍在全部／未知范围可见；不以namespace猜包。缓存纳入owner、loadedModNames和补充源revision；未增加全表来源台账。
- 深度只读DTO保留完整字段；查询／规则跳过accessor并截断循环。定义更新继续遵守Registry替换／重载边界，不支持任意原地深层修改的自动追踪。

## GALHCG 影响闭环

- 已以绝对工作目录核对 `project_id=acprogram`。沿用 Draft 已完成的“编辑”→游戏内内容编辑→Runtime Datapack Editor UI 发现链及当前路径证据，不重新扫描全仓。
- 本轮只对新增 Task、更新 Draft／索引执行 `graph_health(check="changed")`；新文档若未关联图谱，记录返回范围限制，不写成通过。
- 实际结果：两份新 Task 与 Draft 返回 `unreferenced_path`；索引返回 `content_changed`，文件／owner 分页完整，3 条既有 Evidence 的内容基准已变化。未据此推断图谱验证通过，也未改图。
- 没有图谱维护授权，不刷新、不写 freshness、不创建节点／Evidence；开工后仅复核实际改动的直接路径。

## 剩余工作与下一步

- 本 Task 无剩余工作；阶段 B 已完成并归档。
- 后续终点仍是阶段 C 的编辑器迁入与按条目草稿、保存／应用反馈，以及阶段 D 的更多编辑能力；这些不属于 A/B，仍由Draft保留为设计来源。

相关路由：[[docs/plan-work/archive/task-0283-super-codex-phase-b-friendly-workspace]]、[[docs/plan-work/draft-0282-super-codex-and-authoring-workspace]]、[[docs/docs-829/03-data-structures/registry]]、[[docs/docs-829/06-wiki/50-ui/read-model-context]]、[[docs/ai/galhcg-project-map]]。
