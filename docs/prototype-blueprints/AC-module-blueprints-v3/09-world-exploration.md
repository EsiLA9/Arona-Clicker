# M09 地点调查、世界信息与旅行服务

## 1. 当前实现与改造目标

现有 `WorldInformationDef` 的 existence/name/utility/condition 可分别揭示；`information-reveal-domain.ts:queryInformationReveal/deriveDesiredInformationWatches`、InformationReveal 监听和持久进度已存在。`AreaMapCommandService` 管地图打开与收录，`AreaTravelGraph/buildAreaTravelRoutes` 管 adjacent/visited/transit/mapDirect，实际移动由 `InitService.travelToArea` 执行。Map edge 不是通行边，知晓地点不是可达，收录地图不是到访。`visitedAreas`、`collectedAreaMapIds` 和位置按 Init 保存，已揭示信息按现有保存范围记录（A11）。

当前缺少的是一个可让玩家在地点主动进行多项调查、获得可回顾资料、找到下一步行动的产品服务。不能把每项调查都写成一个无法管理的隐藏 flag，也不能为了知识记录重新实现地图、路线、Reveal 和 Story。目标改造包括三件事：扩展 Area/Spot 的实际调查行为；将既有世界信息及来源组织成玩家可读的知识视图；让真实权限与路线结果可解释且可使用。现有旅行与收录机制仍是唯一写入者。

## 2. 目标数据结构（新设计）

首轮新增调查条目作为 Area 或 Spot 的局部定义，不增加独立顶层表。字段名为推荐，不是现有合同。每条调查以父实体+局部 id 为身份，可由后续内容显式引用；大规模独立复用调查条目时再考虑独立表。条件和动作参数复用真实 Condition/Effect/Entry 合同。

```ts
interface InvestigationDef {
  id:string; title:string; hint?:string;
  revealCondition?:ConditionGroup; actionCondition?:ConditionGroup;
  repeat:'once'|'repeatable';
  action:
    | {kind:'story'; entryId:string}
    | {kind:'effects'; effects:Effect[]};
  review?: {title:string; text?:string; storyId?:string};
}
// 拟议扩展 AreaDef/SpotDef
// investigations?: InvestigationDef[]
interface InvestigationKey {kind:'area'|'spot'; ownerId:string; id:string}
interface InvestigationRecord {
  initId:string; key:InvestigationKey; completedCount:number;
  firstCompletion?:{sourceEntryId?:string};
}
interface PendingInvestigation {
  initId:string; key:InvestigationKey; entryId:string; runRef:string;
  state:'started'|'awaiting-completion';
}
interface KnowledgeSource {
  kind:'story'|'investigation'|'item'|'visit'|'effect'; id:string;
  initId?:string; detailId?:string;
}
interface WorldKnowledgeView {
  target:unknown; // 复用实际 Reveal target 类型，非新世界实体 ID
  known:{existence:boolean;name:boolean;utility:boolean;condition:boolean};
  acquiredSources:KnowledgeSource[];
  visited:boolean; collectedMap?:boolean;
  availableActions:{kind:string;label:string;enabled:boolean;reason?:string}[];
}
```

`investigations` 只描述地点可执行动作，不拥有第二套 Story/奖励。story 动作通过实际 StoryEntry 接取/播放；effects 动作走真实领域动作。完成记账在成功的指定行为后进行：Story 要求对应 Entry 实际完成回执，不在点击启动时完成；effects 如要求全部成功则用明确支持的领域提交（不假设通用 Effect 天然原子）。复杂非原子奖励交 M12 的可恢复交付；一次性调查完成不等同于奖励已交付。首轮不接受未实现的任意 action 字符串。

调查记录默认 per-Init，键以真实 Init/父资源/局部 id 为准；KnowledgeSource 仅在需要玩家回顾的成功揭示动作上保存首个可追踪来源，按已有 Reveal 事实的保存范围保存。相同目标/信息面不重复记录同来源，无来源的旧进度仍显示已知，标来源未知。地图与到访继续读取现有字段，不复制 `knownAreaIds` 或 `ownedMaps`。若将来要支持同一知识跨世界线或重置，必须明确产品规则和存档迁移，不能在普通编辑中改变。

## 3. 具体服务与交互

`listInvestigations(currentArea, optionalSpot)` 读取当前 Init、真实位置和父定义、Reveal 及条件，返回可见条目、可执行性、已经完成和已知提示。没有实际可达的 Spot 不因点击资料而获得执行资格。`inspectInvestigation(key)` 返回公开的标题/说明和缺前置（只显示已知信息）；`executeInvestigation(key, expectedState)` 重查当前地点、可见/资格与重复状态，调用领域服务，失败不记完成；异步 Story 由实际完成通知关联待处理条目，避免开始即发奖。待处理记录采用 PendingInvestigation，runRef 必须是现有运行/回执合同可稳定识别的一次执行身份；如当前没有，则补足真实回执的关联键，不能使用临时 UI token。保存恢复需要与 Story 运行状态一起对照，不另存播放器游标。已成功完成的回执须在同一实际提交中移除待处理并增加完成次数；取消/拒绝移除待处理但不计完成。可重复调查允许新的运行身份，一次性调查在已有完成或有效待处理时拒绝重复开始。

`revealInformation(target, facet, source?)` 沿现有真实动作入口扩展可选来源元数据；只在揭示成功时记录，普通重复揭示不产生新事实。`getWorldKnowledge` 合成 Reveal、地图收藏、到访、条目进度和已知来源。作者 Inspector 可以看全部定义，玩家视图只看公开字段。既有拒绝文案、地图节点、搜索/资料页必须共同遵守 Reveal，不泄漏尚未知的名称或进入方法。

旅行建议复用 `buildAreaTravelRoutes` 的结果，新增可读的候选原因与已知提示，而不是另一套路线算法。地图节点/普通 Area 导航都经现有实际准入；点击地图收录不移动，移动成功才写 visit、地点和现有事件。mapDirect 使用真实已收录/资格规则；允许通过 Enhancement/Affector 增加路线或权限，但不把 Map edge 自动变成路径。对消耗性通行凭证，先接 M10 的明确持量/支付合同，不能只显示已知就扣票。

### 玩家界面

- 地图：未知节点、已知未访、已访、不可达与可达状态区分；切图与前往按钮语义独立，显示收录来源和当前实际可用路线。
- Area/Spot：独立调查条目区；显示可读提示、未达条件、已完成、可重做及下一步链接。玩家主动选择，不能自动执行所有地点事件。
- 地区资料/回顾：从已发现地点与已完成调查查源 Story、地图或物品资料。重访能回顾而不重复发一次性奖励；资料跳转和实际旅行是不同动作。

## 4. 迁移与施工阶段

M09-A：保留现有 Reveal/AreaMap/Travel 领域，扩展只读知识与拒绝结果投影，实测主厅/天台存在→名称→用途→权限→到访，地图收录独立。M09-B：在 Area/Spot 合同增加 investigations，登记 M02/M03/M05 作者规则；实现 per-Init 调查记录及实际命令/完成关联；在真实 Area/Spot UI 接入。M09-C：来源回顾、可行动提示、地图和地区资料联动；以两个不同条目、可重做/一次性、Story 完成/取消为例。M09-D：与 M10 凭证、M11 人物知识、M12 必要投放/可靠交付组成探索活动；删除仅为实现相同功能而新增的临时 flag 和测试专用入口，不动原正常旅行。

实际验收：使用 `base:init:schale_office`、`base:area:schale_main`、`base:area:schale_rooftop`、`base:area-map:schale_office` 的独立测试副本。活动“旧图上的第二条路线”：两处调查任选先后，旧图可收藏但不能代替许可，取得实际 hasEnh 资格后真实抵达；重访可回顾不重复一次性授予。失败：未知地名不泄露、未满足条件不改变位置/库存、取消剧情不算完成、切 Init 后按作用域恢复、读档不重复发放。对照 `tests/engine/area-map`、`tests/engine/world/information-reveal-*`、原 Story 回归。新增存档字段对旧档缺项使用空记录，已有访问/收录不伪造调查完成。正式跨世界线知识策略待负责人裁定。
