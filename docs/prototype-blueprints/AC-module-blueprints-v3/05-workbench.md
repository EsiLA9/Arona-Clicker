# M05 Workbench 与全领域实体查看编辑服务

## 1. 现况与本模块的重构边界

现有 `EditorWorkbench.project`、BrowseInstanceManager、EditorExplorerService、WorkspaceColumns 已负责部分实例、布局和树投影；Story 和 World 仍具有各自领域控件、保存入口及摘要。独立编辑器有通用表单，但其来源、关系、编辑状态不同（A06–A10）。最近另一个 Task 对 Datapacks/Storys/IAS 的公共 Explorer、Logo 与三种聚焦做了明确施工要求，实际完成状态不在本次材料中。后续应接其最终生产接口，而不是重复建设或覆盖它。

首个完整作者产品宿主采用游戏内 Advanced Workbench（推荐，待确认）。同时独立工具接 M01/M03/M04/M06，作为真实消费者而非再复制公共工作台。长期是否迁出游戏到独立应用尚不决定。作者项目和当前已启用 Runtime 是两个来源，不是两个相同名字的编辑模式；前者可保留非法草稿，后者只能按已有受限在线命令修改。

## 2. 目标界面和数据结构

Workbench 保留左侧独立 Explorer、实例条、跟随活动实例的 Ribbon、中栏领域内容、右栏 Inspector。左栏只负责浏览和显式定位，不拥有中右栏实例。添加“作者项目”上下文：项目身份、源/依赖选择、权限、草稿状态与诊断；普通保存、检查、构建、试播、应用为不同命令。游戏内浏览仍可独立打开运行定义。

```ts
type ResourceTarget =
  | {kind:'author'; sessionId:string; owner:Owner; localId?:string}
  | {kind:'runtime'; packageRef?:string; entity:EntityKey; localId?:string};
interface ResourcePresentation {
  title:string; typeLabel:string; svgLogo:string; status?:string;
}
interface DomainEditorDescriptor {
  table:string; browseGroup:string; view:'form'|'table'|'map'|'story'|'tree'|'custom';
  summaryFields:string[]; fieldGroups:{label:string; paths:string[]}[];
  specialEditors:{path:string; editorKind:string}[];
  commands:string[];
}
interface InstanceViewState {
  instanceId:string; target:ResourceTarget; selectedLocalId?:string;
  // 布局、滚动、展开等继续由现有工作台合同管理
}
```

ResourceTarget 只表达作者/运行资源身份；若当前已有 `EditorResourceRef` 等等价类型则扩展原合同，不增一层重复类型。svgLogo 在实例 renderer 最终一定存在；领域可提供共享 SVG token/专属图标，无法解析时用公共保底 SVG。原本已有 presentation.icon/typeLabel/status 的机制优先保留。领域描述只提供数据与专用动作；Workbench 不直接读取 `providerKey` 猜 Story 或 World 行行为。

### 2.1 Explorer 与实例定位

Datapacks、Storys、IAS 作为既有同级视图扩展作者源。Datapacks 可在当前包平铺五类资源的基础上消费 M01 的真实文件树和其它实体叶；Storys 按游戏目录；IAS 按 Init/Area/Spot。后续其它实体按注册的浏览组接入，不在每个域重建搜索、滚动、DOM 或事件。一个实体可以出现多个 placement，目标通过 Owner 和真实位置消歧。左栏搜索、来源、折叠、滚动与中右栏独立。

实例正文点击立即激活并隐聚焦，仅在当前可见树更新活动标记，不改变用户选择、导航、查询、滚动。Logo 单击激活后类型显聚焦；双击只执行一次路径显聚焦，进入实际所属包/文件位置，不先闪到类型导航。保留每个实例 SVG Logo，即使无法定位也返回原因。具体单双击协调、过期请求取消、失败恢复沿最近 Explorer Task 裁定；不得为作者项目再建一套聚焦系统。激活失败不执行定位；定位失败不撤销成功激活。中右栏及 Ribbon 随活动实例切换，左栏只在显式定位时改导航。

### 2.2 领域界面构造

默认详情由 M02 字段描述与 M06 字段服务生成，领域 descriptor 增加分组、专用视图、语义操作，而不是复制读取/保存/引用/诊断。中栏对普通定义可为数据详情、复杂域为地图/正文/树；Inspector 随局部选择显示属性。实例名称、源、只读、草稿、错误状态明确。顶部命令按能力启用：新建、保存、删除、引用影响、构建等分别走 M04/M02/M03。创建默认值来自实际领域模板，允许作者后续补齐；删除前列引用及未知范围。已启用定义的兼容由 Runtime 准入检查，不在作者 UI 偷偷更改存档。

所有普通字段、资源候选、条件树、Effect 列表通过 M06；Story 节点、地图布局、角色资料等专用交互仍可保留领域组件，但最终写共同草稿。诊断面板按文件/实体/阶段过滤；点击采用 M01 SourcePoint，过期先重定位。局部修改更新受影响行、引用摘要、预览和诊断，保持输入、caret、滚动及不相关 DOM。遵守 `ui-style/visual-languages/authoring` 和 `ai/guide/frontend-design-project-overlay.md`，宽屏鼠标与 hover-only scrollbar 是实际验收。

## 3. 全领域编辑服务范围

以下覆盖表沿用第三轮 17 页的源码表清单和主要领域建议，纳入本模块作为实际目标，不表示当前已支持。每一行须完成打开、普通字段、复杂字段（有则必须）、正反向关系、创建/删除影响、保存与重读，才可标为完成。运行态读写另标权限。Gameplay B/Operation 只要求作者工具覆盖，不设计新玩法。字段精确名字由当前合同核对。

### 世界、地图与剧情

| 表 | 位置和打开途径 | 先看与普通编辑 | 复杂字段、重要引用和领域操作 |
| --- | --- | --- | --- |
| inits | 世界 / 世界线，或从 Area 归属回跳 | 名称、描述、起始剧情 | 启动指向 Area/Story 的真实字段、开始状态与条件。创建需给实际可启动世界，预检删除是否仍有 Area/Entry |
| areas | 世界 / 地区，或从地图动作打开 | 名称、描述、归属 | 条件树、到访效果、默认设施、相邻路线、导航图。变更 initId 属迁移，关系预览后提交 |
| spots | 世界 / 设施，从地区打开 | 名称、说明、初始量与容量 | 升级、生产、功能条件。各功能按种类选 Shop/Map/Operation 或卡池。核对归属和挂接后创建/删除 |
| areaMaps | 世界 / 区域导航图，从 Area 回跳 | 名称、说明、收录方式 | 布局编辑、边、节点动作、揭示、动作条件。选 Area 或其他导航图，删除节点展示边和局部引用影响 |
| maps | 行动 / Gameplay Map，从设施 Map 入口打开 | 地图资料、起点配置 | 地图图谱、节点/边、局内状态、遭遇与动作。节点删除预览通路变化，保留完整 Map 定义 |
| stories | 剧情 / 正文，从 Entry 或任一引用打开 | 标题、背景、起始场合 | 稳定节点列表、对白/选项/动作/演出、局部 Flag、跳转。新建给合法起始结构，节点删除先列续接目标和局部引用 |
| activeStories | 剧情 / 主动入口，从正文反查、区域或人物入口打开 | 名称、可用世界线、重复设定 | 条件、接取、续接、归档。引用 Story、Area、Init。改变投放或删除前查看未完成入口和关系 |
| passiveStories | 剧情 / 被动入口，从池的候选打开 | 名称、可用范围和冷却 | 条件、权重相关字段、奖励、正文和目录关联。用实际随机候选路径验证新增或移除 |
| storyDirectories | 剧情 / 阅读目录，按 Init 或人物打开 | 标题、说明、公开与 order | 树、显式路径、其他包放置许可、封面与 ThemeDesign。移目录要预览游戏编号/摆放影响，作者文件路径不参与 |
| passivePools | 剧情 / 被动池，从 Entry 反查 | 名称、拥有者、冷却 | children 树、候选权重与冷却、门禁。选子池或被动 Entry，预检成环及移除后默认池表现 |

### Items、生产规则与成就

| 表 | 位置和打开途径 | 先看与普通编辑 | 复杂字段、重要引用和领域操作 |
| --- | --- | --- | --- |
| items | 物品 / 物品，从奖励和商品回跳 | 名称、用途类别、说明 | Pic、堆叠、使用效果。创建先选类别，删除看库存兼容及商店/掉落/Story 正反向 |
| dropTables | 物品 / 掉落，从实际引用点打开 | ID、抽取次数 | 保底、数量范围、权重、条件和 Item 目标。以固定输入验证概率边界与空表 |
| shops | 物品 / 商店，从 Shop 类型设施打开 | 名称、描述、进入条件 | 分区、商品、价格 unitCosts、库存、购买范围、后置 Effect。选择 item 或 resource 后才展开金额参数。商品 ID 已产生购买记录时需要兼容方案 |
| enhancements | 成长 / 强化，从条件或奖励回跳 | 名称、说明、价格、分类 | 价格、效果、挂靠对象、AffectorPack。预览授权后有何用途，删除前找 hasEnh 与挂载引用 |
| resourceDisplays | 世界 / 资源显示，从货币字段查资源 | resourceId、显示名称、order | 展示策略、图标等有效字段。按 resourceId 创建和定位，显示商店及其他显示消费者 |
| affectorPacks | 规则 / 影响包，从强化或挂载方打开 | ID、适用说明由上下文给出 | 条目、目标、条件、数值修改、交通网络。选择真实作用域。以实际前后数值或旅行路线验改和删除 |
| triggerDefs | 规则 / 触发，从事件或被引用规则打开 | ID、事件种类 | 事件过滤、条件、有序效果。预览收到哪个事件，核对正常触发及重复触发 |
| funcletDefs | 规则 / 函数，从表达式调用处打开 | ID 与函数声明 | 参数和表达式，检查调用参数与引用。移动或删除不能留下无法解释的动态调用 |
| milestones | 目标 / 里程碑，从监听打开 | ID 与已有用途 | 事实条件树。创建时预览首次满足条件，以实际完成回显核对范围 |
| milestoneListeners | 目标 / 监听，从 Milestone、Area 或 Achievement 打开 | ID、所在地区、对应里程碑 | 完成后 then 效果与失败行为。移动 Area 或删除前列成就与准入影响 |
| achievements | 目标 / 成就，从地区诊断或监听打开 | 标题、线索、奖励描述 | 选择实际 listener，预览玩家可见进度，避免做无法完成或无明确出处的条目 |
| tags | 项目 / 标签，通过实体标签回跳 | 标签键、名称、说明 | 规范包名/路径、父标签与引用。预览改名与父子变化，防跨包冲突 |

### 人物、培养与外观

| 表 | 位置和打开途径 | 先看与普通编辑 | 复杂字段、重要引用和领域操作 |
| --- | --- | --- | --- |
| characters | 人物 / 基础人物，从 Entry 或差分打开 | 名称、显示名、学校、描述、稀有度 | 羁绊节点、Variant/资料/Story 回查。创建人物身份和发放差分为独立操作 |
| characterVariants | 人物 / 差分，从人物或卡池打开 | 名称、归属人物、可用的差分字段 | 培养曲线、技能、外观、成长槽。与角色原型 ID 分开，检查卡池和现有持有 |
| charaProfiles | 人物 / 资料，按人物 ID 打开 | 当前生效昵称和头像 | names/avatars 局部列表、Pic、activeName/activeAvatar。删除活动项先选择替代 |
| cultivateCurves | 人物 / 成长曲线，从差分回查 | 等级和星级上限 | 经验表、突破消耗和加成表达式。用临界等级与受影响差分核对 |
| gachaPools | 人物 / 卡池，从相应设施打开 | 名称、货币、单抽消耗和模式 | rates 是稀有度权重，members/featured 是 Variant。保底、重复奖励、关闭条件。变化后用边界输入对照 |
| favoriteItems | 人物 / 爱用品，从差分或培养配置打开 | 名称、说明、用途 | 阶段、成本、效果与归属，核对目标差分和库存关联 |
| uniqueWeapons | 人物 / 专武，从差分打开 | 名称、说明 | 星级、消耗和效果。保存验成长边界，删除先查被装备和现有差分配置影响 |
| traits | 人物 / 特性，从角色成长字段打开 | 名称、简介 | 效果、条件与拥有者引用。用实际应用对象预览变化 |
| gears | 人物 / 装备，从装备配置打开 | 名称、说明 | 等阶、材料或物品消耗、成长。已持有装备的兼容走应用检查 |
| gearConfig | 人物 / 装备总设置 | 单种生效配置及来源 | 槽位和全局成本换算。新建同包单例需要编辑现有记录，删除区分回归缺省和依赖覆盖 |
| characterPersistConfig | 人物 / 保存范围 | 显示 roster、gacha、equips、chatRead 的 global/init 配置 | 附存档切换的影响说明。改范围由真实游戏策略批准，删字段预览继承默认 |
| affectionConfig | 人物 / 好感总设置 | 等级上限、超出阶梯的需求 | 阶梯和不同星级的默认上限。对照现有好感进度，区分删字段与置零 |
| pics | 表现 / 图片，从头像和背景打开 | ID、来源、用途、资源状态 | 图片预览及实际资产、相对路径。替换/删除时查使用方和构建支持，显示丢失占位 |
| colorGroups | 表现 / 配色组，从实体的主题字段打开 | 名称、简介 | 配色色槽、头像和主题预设。预览在现有主题工具中完成，存到明确的编辑来源 |
| colorEquipments | 表现 / 配色装备，从角色或组反查 | 名称、说明 | ColorGroup、Effects 和效果预览，删除前查已配置的同组引用与兼容 |
| themeDesigns | 表现 / 主题设计，从目录、地区或差分打开 | 名称、说明 | Theme 参数、颜色、背景、引用和继承。复用现有主题预览和编辑来源选择 |

### Operation 及包元数据

| 表 | 位置和打开途径 | 先看与普通编辑 | 复杂字段、重要引用和领域操作 |
| --- | --- | --- | --- |
| operationEvents | 行动 / 事件，从 Spot 的 operationEntry 打开 | 标题、Init、起始地点、最多访问次数 | 地点顺序、局部 track/fact/actor/队伍、奖项与目标。创建需可开始，移除局部对象检查整个 Event 作用域 |
| operationLocations | 行动 / 地点，从 Event 打开 | ID、阶段、场景说明 | 路线、scene/actions、eligible pools、购买与分支。检查初始和目标地点，区分此处局部与 Event 局部 |
| operationActions | 行动 / 动作，从地点、池或人物配置打开 | 标题、参与者种类 | 目标、成本、条件、效果。能按所属 Event 查看上下文候选，缺上下文时不提供错误的自动改名 |
| studentOperationProfiles | 行动 / 人物配置，从 Start Event 或人物反查 | 人物、能力、理由 | 候选/优先动作、策略、卡池与技能。核对实际 Character ID 与本 Event 能否生效 |
| operationStrategyProfiles | 行动 / 策略，从人物配置打开 | ID、偏置说明 | Tag 及权重偏置，比较实际选择结果，删除前查消费者 |
| operationCardPools | 行动 / 行动池，从人物或地点打开 | ID 与适用范围 | entries 权重、筛选和 action 选择。空候选与同上下文引用需有明确显示 |
| extras | 项目 / 常量 | 键、值类型、包来源 | 树形值及引用影响，深合并时显示有效来源。未知动态消费者要标不完整，避免静默重命名 |
| name/version、manifest | 项目 / 包信息 | 包身份、显示名称、版本、当前来源 | 依赖和覆盖、分片一致性、包标志和有效资源。修改包名或重新打版需预览实际 Runtime 影响 |

## 4. 原有组件去向

`EditorWorkbench.project`/WorkspaceColumns/BrowseInstanceManager/Explorer 保留为真实外壳，新增作者来源与资源打开注册。`world-browser-provider.ts`/Story controller 的专用中右栏与视图模型逐步从 Registry-only 输入改为作者或运行明确来源。`tools/datapack-editor/ui/components/field-editor.ts:renderType/renderField` 的普通字段迁到 M06，`ui/navi.ts` 迁到 M02；独立工具调用共同服务。`runtime-content-browser.ts` 的关系查询由 M02 提供真实数据，不复制 Codex。Story 试播与临时栏继续走现有生命周期并接 M08。旧实现只在其生产调用方已经迁移并验收后退出，不新建纯演示替代。

## 5. 制作阶段

1. M05-A：实际 Advanced Workbench 打开作者项目，从真实地图→Area→Spot 打开，修改、保存、诊断定位、引用卡、两个标签共享草稿；对照同 ID 的运行定义不变。M01/M02/M04 可用后进行。宿主必须具备明确目录写权限，若浏览器只能下载，至少另有实际写入宿主验证原文件保存。
2. M05-B：接 M06 普通字段、Area/Entry 条件；现有 World 和 Story 两个真实消费者都使用同一交互能力；保留目录管理、Classic 与预览的现有语义。
3. M05-C：按上表分批扩展 Story/Entry/目录、Item/Shop、Character/Profile/Variant、生产/规则/成就、外观、地图与 Operation；每批登记真实 Schema、专用结构、源保存和反查。缺专用控件明确标未完成，不用 JSON 视图宣布全量覆盖。
4. M05-D：接 M07/M08 文本和预览；接多包构建面板和 CLI 同源报告；迁出重复领域组件、独立数据处理及旧入口。宿主最终产品形态需要负责人评审后再正式切换。

验收：真实鼠标、焦点、caret、滚动、实例重用及绑定释放；新增一个领域不需要重写搜索、树、保存和关系服务；两个来源同 ID 不混写；缺权限只读；旧 Story/World 行为回归。使用 `tests/ui/workspace`、`tests/ui/story`、`tests/ui/runtime-editor/runtime-editor-world-browser.test.ts` 并增加真实浏览器验收，不把组件单测当作已完成 UI。
