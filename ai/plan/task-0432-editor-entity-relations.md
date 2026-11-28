# Task：高级编辑器跨实体关系网与编辑服务

状态：待处理

## 目标与验收

从高级编辑器当前打开的实体出发，在共享关系面板查询出向引用、入向引用和引用字段。沿关系打开实体或定位引用字段。可写的已声明引用可以调用其所属实体的现有 Draft 编辑入口。首批验收贯通 Story、Entry、Init、Area、Spot 和 Story Hierarchy。随后分批接入其余 Registry 定义类型，按字段同时记录读取、定位、编辑三项覆盖情况。

验收样例用实际定义串起 `base:activestory:schale_flow_show` → `base:story:schale_flow_show` → `base:area:schale_main`，从每个目标反查来源；再用包含 Init、Area、Spot 和手动 Hierarchy 的小型数据包验证归属、默认项及目录落点。整个关系面板只需打开一次，切换 Datapacks、Storys、IAS 与实例时随当前实体更新。

## 当前依据

- `src/data-services/registry/runtime-content-browser.ts` 的 `referencesOf` 已经服务 `getEntityRelations` 和 `getResourceRelations`。它从有效 Runtime Registry 及补充规则源构建快照，组合 `collectDefinitionReferences` 和 `collectOperationReferences`，按 Registry 与补充源版本复用缓存。`contracts/runtime-content-browser.ts` 的关系已有方向所需的源与目标、字段路径、候选及状态，并能区分声明、推断、局部与候选。该投影的覆盖标记是 `partial`，草稿和包库版本需要显式输入。
- `src/ui/story-editor/relations-model.ts` 用 `collectDefinitionReferences` 派生 Story 与 Entry 的调用，合入当前草稿，并单独处理旧 `kizunaCard`。`relations-view.ts` 展示潜在调用、被调用、激活前置和转移可达的 Entry。Flag 表也消费这份语义，入网迁移须保留 Entry 边界、转移可达性和旧卡片上下文。
- `src/ui/runtime-editor/view.ts` 已将图鉴查询结果转换成 `codex-details` 的 Inspector 引用模型。`world-browser-provider.ts` 的 `resolveWorldSummary` 则直接扫描 Init → Area → Spot，`world-browser.ts` 通过公共资源请求打开链接。`src/ui/story-editor/directory-management.ts` 提供 Hierarchy 落点管理，导航目录可同时包含真实定义和合成路径。现有 Story 重命名影响分析在 `src/data-services/authoring/story-identity.ts`，World 改动经 `src/ui/runtime-editor/actions.ts` 的 Draft 校验和 `applyRuntimeWorldDraft` 提交。

## 实施方案

1. **先核对字段覆盖。** 以 Runtime Content Browser 注册的定义种类为清单，逐个对照 `runtime-content-reference-rules.ts`、`runtime-content-operation-references.ts` 与 Datapack 合同。第一批记录 `Entry.storyId`、Story 场景与节点引用、`Init.defaultAreas`、`Area.initId` / `defaultSpots`、`Spot.areaId`、Story/Entry 的目录落点。每类给出读取规则、解析所需上下文、定位适配、可用写入口和对应样例。可达、派生、动态候选和明确字段单列覆盖。补齐实际缺少的声明规则后再将该字段接到公共读取面。
2. **抽取共享读取索引。** 从 Runtime Content Browser 的快照构建提取引用解析与入／出邻接索引，接受带版本的定义集合。建议实体引用沿用 `RuntimeDefinitionRef`，额外给定来源范围，区分运行时、指定数据包记录和当前 Draft 投影。引用边用来源实体、字段定位、目标或候选、关系语义、置信度与解析状态标识。只有来源实体和字段定位参与可写边的定位；公开层级路径用只读导航目标表示。包库范围按指定数据包记录及其依赖解析；Draft 仅在所属范围内覆盖同身份的定义。缺失来源的恢复草稿沿用编辑器只读查询规则。缓存按范围和内容版本失效，并验证同 ID 的两版数据包之间没有串边。图鉴继续通过原有查询端口调用这份索引。
3. **接上公共面板和跳转。** 在 Workbench 使用当前实例提供的实体和来源，复用 `editor-review` 的区块与现有引用行样式。先交付出／入向列表，支持类型、关系和状态筛选，按需展开一跳，再沿边继续浏览。保留源字段与目标两种动作，以公共 `EditorResourceOpenRequest` 进入现有 Provider；存在已打开实例时沿用复用键。实体之间存在循环时按范围与实体身份限制遍历，首屏渲染仅查询邻接边。Story 继续用其领域投影显示潜在调用和 Flag 作用域，从共享边派生直接静态引用；IAS 将已验证的定义归属接到同一面板。
4. **写入交给源实体的编辑器。** 第一批从可直接重定向的声明字段入手，例如 Story 的场景引用或 Entry 的起始 Story，随后接入经验证的 IAS 与 Hierarchy 字段。关系面板根据源实体与字段定位打开现有编辑控件，或提交带预期旧值和来源版本的类型化替换请求。源 Provider 负责候选类型、包归属、Draft 与版本校验。跨包的入向边跳到拥有该字段的包，正常态、候选、派生、缺失来源与不支持编辑的边显示查看入口。保存使用现有 Story、Runtime World、目录管理命令，应用到运行时仍走各自已有流程。确认时若字段变动、数组位置重排、包切换或校验失败，保留输入并提示重新定位；无法稳定定位的字段先开放跳转。

## 工作项

- [ ] 产出首批字段覆盖矩阵和实测依据。核对 Init/Area/Spot 归属方向、Hierarchy 合成路径、Story/Entry 的静态边与潜在调用区别。其余实体按实际规则覆盖和写入口分批。
- [ ] 从现有快照复用共享索引并接图鉴与 Story/IAS 查询。扩展 `tests/data/runtime-content/runtime-content-browser.test.ts`，验证版本隔离、草稿覆盖、缺失／歧义、入向反查、循环和缓存失效。
- [ ] 接入 Workbench 关系面板与字段跳转。用 `tests/ui/runtime-editor/runtime-editor-codex-integration.test.ts`、Story 浏览和 World 浏览测试验证原入口、关系跳转及实例复用。
- [ ] 完成首批可写字段。验证草稿立即反映关系、保存后范围正确、应用仍显式，以及跨包只读、旧值冲突、取消编辑和失败后输入保留。

## 当前进展

- 已完成源码调查及实施分解。
- 下一步从 `runtime-content-reference-rules.ts` 与 Datapack 合同核对首批关系字段，产出覆盖矩阵后确定索引提取边界。
