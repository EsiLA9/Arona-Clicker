# M11 人物认识、资料开放与关系入口服务

## 1. 现况与建设目标

Character 是人物原型，Variant 是可招募/培养的差分；白子原型 `shiroko` 与差分 `Shiroko` 不是可互换字符串。`RosterSystem.getOwned/contactGroups/codex` 管拥有及已有角色投影，`CharaProfileService.characterProfile` 管现有 names/avatars/activeName/activeAvatar，AffectionSystem 和 bond-content 处理持有、关系成长及羁绊。现有通用 Reveal 无 Character 知识目标；公开地区 Story 与持有后的羁绊入口是不同资格（A13、原 P4-C）。

建设独立于 Roster 的人物认识资料能力：玩家未招募角色时即可通过地区会面、文献、访谈认识人物的若干侧面，已有差分的玩家也可以补认识。人物知识不发放 Variant、不自动加好感、不解锁需持有的角色通讯空间。不要给每个角色固定机械的“认识 1/2/3 级”；用作者定义的独立资料条目和实际开放依据。

## 2. 目标结构（推荐）

```ts
interface CharacterKnowledgeEntry {
  id:string; title:string;
  content:{kind:'text';text:string}|{kind:'story';storyId:string};
  revealCondition?:ConditionGroup;
  publicInitially?:boolean;
  followUpEntryIds?:string[];
}
// CharacterDef 新增 knowledge?: CharacterKnowledgeEntry[]
// 若当前 CharaProfile 是产品统一资料权威，可经评审改为其字段；不能两处定义同一条。
interface CharacterKnowledgeRecord {
  characterId:string; entryId:string;
  source?:KnowledgeSource; // M09 共同来源描述
  discoveredInInit?:string;
}
interface CharacterKnowledgeView {
  characterId:string; known:boolean;
  entries:{id:string;title?:string;known:boolean;available:boolean}[]; // 未公开标题不返回
  ownedVariantIds:string[]; availableEntries:string[];
}
```

记录键为 Character 原型 ID + 资料局部 ID，默认 save 范围（人物认识作为已知知识，不等于每条世界线的权限）。在不同 Init 的 Story 可揭示同一人物资料，但具体后续 Entry、当前位置、持有和好感按各自真实条件判定。是否存在特定世界线的独立人物认知属于 D08 待裁定，若需要则明确增加 scope，不通过复用 Variant ID 解决。旧档不从 Roster 自动推断已认识所有人物；已有 Story 已读与显式旧映射可以迁移具体条目，否则仅公开初始条目。

资料条目与现有 CharaProfile 名称头像职责分开；玩家显示可依知识决定公开的姓名/头像/描述，作者可查看完整定义。不能同时让 Character.knowledge 与独立 Profile 知识表各自权威，首轮推荐 Character 局部条目、Profile 负责现有表现；若发现 Profile 是更自然权威，在实际施工前统一迁移。资料内容引用 Story 时回顾使用已有只读回放，不能重复领取原 Entry 奖励。

## 3. 服务接口与实际写入

`getCharacterKnowledge(characterId,scope)` 合成公共资料、已揭示记录、现有 Profile 与 Roster；`revealCharacterKnowledge(characterId,entryId,source)` 作为明确领域命令，经 Story state action/Effect 等真实适配调用，检查条目存在，成功写一次并产生可被 M12 监听的真实事实。`publicInitially` 为无需记录即可公开的初始资料；`revealCondition` 为首次满足后持久揭示的可选条件，由真实事件/重查触发写入。两者均未声明时只允许显式揭示命令开放；显式揭示是否需要附加门禁由调用该命令的 Story/调查定义负责。已揭示后即使原条件变假也不撤销已知事实，不能每次打开资料页临时把已知写丢。`readKnowledgeEntry` 检查是否已知，输出资料或隔离回顾入口；`listFollowUps` 用真实 Entry 资格，不能仅因资料条目声明了 ID 就开放。

新增条件目标（名称候选 `characterKnowledgeKnown`）按原型+局部条目查询，依赖登记与事件唤醒接 M12。若普通条件合同的 key 只能字符串，使用明确可逆的局部身份编码或扩展相应参数，不以分隔符猜 ID。作者工具提供实际 Character 与局部条目选择；M02 校验条目/Story/Entry 引用，M03 检查重复局部 ID，M05 提供资料条目编辑与玩家遮蔽预览。

玩家界面建议在现有角色图鉴/资料入口增设“人物资料”，认识但未持有者可查已开放资料、曾在哪认识和下一次访谈；已持有时额外展示实际培养、关系、差分与通讯入口。不得直接把未拥有角色加入可操作 Roster。普通初见通过地区 Active Entry，不使用要求好感的白子既有羁绊作为公开入口。玩家不需要先获得差分才看人物资料。

## 4. 制作阶段

M11-A：从 Roster/Profile 实际读取层区分人物、差分、持有和知识投影；用新试验会面验证未持有角色可认识且培养不可用。M11-B：增加局部资料条目、存档事实与揭示命令，接 Story/Effect 与 M12 条件；作者工具支持创建/引用。M11-C：真实资料页与回访，联动 M09 地点调查、M10 资料/芯片；记录来源且不泄露未开放内容。M11-D：审查旧 Profile/图鉴与新知识服务的重复呈现，合并可复用读模型，不改变 Roster、招募和 Affection 所有权；正式跨 Init 认知与旧档映射需评审。

验收：同一白子人物未持有、持有一个/多个差分、旧玩家已招募但未访谈、已读资料、读档、换 Init；知识不改持有或好感，实际后续 Entry 仍检查自身资格；同角色两条资料独立开放，重复揭示不双发，隐藏条目不泄露全文。以 `roster-system.test.ts`、`shiroko-story-samples.test.ts`、`hoshino-story-spaces.test.ts` 为现有对照。至少制作一条地区会面→资料→下一次访问→实际招募/羁绊仍正常的真实试验，不把新增资料显示当全部完成。
