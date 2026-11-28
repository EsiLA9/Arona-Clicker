# Task 0441 · Datapack 引用解析及 Runtime 图鉴复用

状态：待处理

## 目标、现状和边界

交付 [M02-B](../../docs/prototype-blueprints/AC-module-blueprints-v3/02-definition-catalog.md) 的正向与反向引用查询。依赖 [[ai/plan/task-0440-datapack-definition-catalog]] 的声明目录。在作者项目中真实查询引用和定位，运行图鉴通过既有端口消费同一规则与解析核心。

现有 `src/data-services/registry/runtime-content-browser.ts` 的 `buildSnapshot` 组合 `collectDefinitionReferences`、`collectOperationReferences`，由 `diagnosticFor` 生成诊断，再为匹配目标归集入向边。目前键以 `RuntimeDefinitionRef` 表示已运行的有效定义，不能表示同键多声明。普通引用规则已覆盖 Init/Area、Story/Entry 和 Spot 部分主题字段。AreaMap 的 `action.areaId/mapId` 目前按路径匹配，未核对 `kind`，普通规则未覆盖局部边端点。Operation 独立规则和 `scope: 'candidate'`、`confidence: 'inferred'` 已存在，应保留其语义。

## 施工方案

1. 把 `buildSnapshot` 内已存在的请求归集、目标匹配与入/出集合提取为基础数据服务的共享纯逻辑。保留两个现有提取器作为规则来源，从 AreaMap 动作的无条件路径规则移出 `areaId/mapId`，按 `attemptAreaTravel` 与 `openMap` 分别产出目标。对 `edges[].fromNodeId/toNodeId` 在该地图**当次声明的** `nodes` 列表中解析，重名的另一地图和同键的另一声明不可误入候选。覆盖 Init.defaultAreas、Area.initId/defaultSpots/navigationMapId、Spot.areaId/色组、Story.startContext、Active/Passive Entry.storyId/availableInits、AreaMap 图片。对已有推断和候选边保持原置信度，首批明确登记字段覆盖，动态语义无确切规则时标未查或候选。
2. 作者适配器输入 0440 的目录及明确选中的依赖。边至少有来源声明标识、字段相对路径、原值、目标类型、置信度、作用域、候选源以及状态。源定位优先拼接 `DefinitionRecord.source.documentPointer` 和已知字段段并做 RFC 6901 转义。旧 Entry 派生字段、任意含点的键或无法证明能映射回原文的字段保留路径与声明级定位。禁止把合并后数组下标拿回源文件使用。对多个匹配声明返回歧义；对不完整范围内没有候选的请求返回未核实。唯一命中附覆盖状态。反向返回准确边与可能候选边，显示区别，不能把歧义边当成已确认依赖。
3. Runtime 用现有快照内容与端口投影共同解析结果，保持 `getReferences/getEntityRelations/getResourceRelations`、缓存边界、已加载定义范围及现有图鉴呈现。Runtime 只有类型/ID及它实际提供的字段路径，无来源文件时显示定义级。保留 Operation 与派生、推断条目的旧可见性和诊断行为，变更仅涉及经核实的新增/纠正规则。
4. 在 0440 的 CLI 接 `refs <输入> --table <表> --id <键> --direction in|out|both`，同键多声明可以按 `--occurrence` 细查，并输出指向每条声明的文件及字段。只读命令不装载游戏、不写入数据，状态与未查范围从共同结果返回。

## 验收

用 addition-test 的 `addition-test:activestory:welcome` 正查 `addition-test:story:welcome`，从后者反查入口，源定位到 `02-story.json#/activeStories/0/storyId`。Story 再正查 Area。用 `base:area-map:schale_office` 的 `schale_main` 节点核对真实 travel 边。用测试副本补 `openMap`、inspect 附带无效字段、两个地图存在同名节点及本图缺少端点的反例。覆盖同键两处、坏文件、未提供依赖、字段只能到声明级、Runtime 已有推断边和 Operation 关系不退化。运行 `tests/engine/runtime-content/runtime-content-browser-rules.test.ts`、`tests/engine/runtime-content/runtime-content-browser-published-content.test.ts` 及作者查询回归。通过实际图鉴与 CLI 验证共用路径。

## 工作项

- [ ] 抽取共同解析与邻接逻辑，并纠正 AreaMap 联合动作及局部边。
- [ ] 接作者目录、CLI 与 Runtime 图鉴既有端口，验证来源和输出差异。

## 施工记录

待施工。
