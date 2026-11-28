# M13 原始内容资料库与还原导入服务

## 1. 当前实现及目标

现有 `content/story/stories.ts`、Story 目录与 `authored-story-catalog.ts/story-directory.ts` 组织游戏内正文和入口；Base TypeScript/JSON 生成包。调查 A16 未在已核查范围定位独立原文清单、逐段还原记录与覆盖服务。原作世界文本、起始故事、1.3R、2.3、2.3R 是未来内容生产方向；内部代号的真实范围、语言/版本与原始材料尚未确认。该模块设计工具与流程，不编造外部原文、章节对应或宣称已完成还原。

目标是建设从实际原始资料到可审查、可构建并实际被玩家遇见的内容导入服务。既保留原文对照，又允许 AronaClicker 自身的世界探索/入口设计。原作顺序、作者文件组织、游戏阅读目录和实际 Entry 投放是四种不同关系。不能以“导入一堆 JSON”或“有个完成率台账”替代服务。

## 2. 数据结构与文件归属

原始资料存放在单独只读来源区（不扫描为 Datapack），每次读取绑定确切版本/摘要；项目保存映射和审阅记录，实际 Story/Entry/Area/Item 等由 M01 管作者源。来源台账是内容工程资料，不进入玩家存档。已有角色/地区/资源的真实 ID 从 M02 查询，不建立另一套人物目录。

```ts
interface SourceEdition {
  sourceId:string; edition:string; locale:string; digest:string;
  locator:string; access:'metadata-only'|'available'|'hold';
}
interface SourceUnit {
  unitId:string; sourceId:string; edition:string; locale:string;
  series:string; chapter:string; order:number;
  kind:'episode'|'event'|'world-text'|'asset'|'bridge';
  locator:string; range?:TextRange; dependencies:string[];
}
interface SourceSegment {
  segmentId:string; unitId:string; order:number;
  kind:'dialogue'|'narration'|'choice'|'branch'|'presentation'|'unknown';
  text?:string; speakerToken?:string; raw?:unknown; locator:string;
}
interface SegmentMapping {
  segmentId:string; targets:{owner:Owner;localId?:string;field?:string}[];
  status:'mapped'|'unresolved'|'adapted'|'excluded'; reason?:string;
}
interface ImportUnitReview {
  unitId:string; sourceDigest:string; targetRevision?:string; artifactDigest?:string;
  status:'inventoried'|'mapped'|'authored'|'built'|'verified'|'blocked';
  mappings:SegmentMapping[]; issues:Diagnostic[];
  review?:{text:boolean;assets:boolean;presentation:boolean;gameEntry:boolean;traceRef?:string};
}
```

原始数据格式接入可有不同实现，首次只支持已实际提供的一种或使用本地已有 Story JSON 作为演练来源，不设计万能爬虫/转换器。Unknown 标记保留原结构及位置；外部章节、片段 ID 不等于游戏实体 ID。人物映射要区分发言人、Character、Variant、CharaProfile、具体图片与通讯空间；同名不自动匹配。每个原段可对应多个节点，也可与其它段合并，必须有双向对照。原有 source 更新时保留已编辑目标和历史差异。

## 3. 具体服务流程

`registerSource` 记录范围/语言/来源与可用条件；`extractUnits` 提取实际篇目、分段、顺序和未知标记；`mapTokens` 调 M02 查询人物/地点/资源等候选，人工确认歧义；`planImport` 生成候选作者定义、源片段映射和变更差异；`applyImport` 经 M04/M01 提交明确文件；`reviewUnit` 同屏或互相跳转原段/目标、记录漏段/改编/资源替换；`verifyUnit` 调 M03/M08 对真实构建及入口行为核验，并登记同一版本的结果。重复导入同来源/映射为无新增或明确 diff，不重复造正文；外部更新、作者修改、映射失效分别指出，不覆盖人工修订。

原文忠实层负责对白、旁白、选项/分支、顺序、发言人、资源、演出标记。当前缺音频/镜头等实际 Story 执行能力时，列原始标记、受影响节点、暂时呈现及评审要求；不能靠生成语法宣称已还原。游戏化层独立选择 Init.startStory、稳定 Active Entry、地区日常、人物邀约、Item/资料或调查入口，记录玩家从哪遇到、资格、完成和回顾。关键主线不随机卡住，接 M12；地点/物品/人物资料接 M09–M11。第一批可用标准 JSON，正式 DSL 语法不是前置。

## 4. 导入和覆盖界面

建立内容工程视图（可由 M05 注册）：左侧原始系列/篇章/段落，中央原文和候选定义，右侧映射/差异/缺资源/入口说明及诊断。支持原段→节点、节点→原段跳转，批量选择并审查文件计划。对同一篇目分别显示文本、资产、演出、游戏入口四项验收；构建成功只说明定义有效，不代表原文忠实。

覆盖率分母为负责人确认的具体来源/语言/版本/系列清单。未知分母明确显示未知；逐类别统计已登记、映射、写入、构建、验证及阻断、明确排除，不能以 Datapack ID 数替代。只有真实文本审阅、资源/演出审阅与实际需要的玩家行为通过才标 verified；源版本、目标或依赖改变会使有关结果过期并保留历史。原始资料和资源未提供时，不伪造内容或完成数字。

## 5. 制作阶段

M13-A：以已存在 `base:story:schale_welcome` 和白子天台为本地演练来源，建立来源单元、段落映射、目标文件/节点的双向对照，加入刻意缺图/未知演出。M13-B：接 M01/M04/M03 真实写入与构建，验证重复导入、外部源更新、人工修改保留和部分失败。M13-C：游戏入口与隔离试播验证，原始顺序和玩家目录分开；试用 M09–M12 的一条实际世界文本活动。M13-D：负责人确定 1.3R/2.3/2.3R 对应范围、版本、语言与可用资源后，按篇目逐批生成/审阅/构建/游玩；CLI 可做批处理，但每批有明确回退与完成标准。旧直接批改编译 JSON 的流程退出，仍保留源文件及原始对照。

验收：缺引用/缺资产可定位到真实原段和目标；同源重复导入不重复；新增段落不改无关人工内容；实际 Entry 可进入并完成；所有审阅结果与构建版本绑定；未提供正式资料时仅完成工具原型，不宣称正式内容还原完成。
