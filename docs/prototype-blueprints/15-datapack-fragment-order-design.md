# 多文件拆合怎样保留数据与顺序

适用 P1 的全拆、选文件合一、整个包合一和快速分组。[P1 的作者操作](02-datapack-project.md)给出入口与试用步骤。

## 先记录旧入口怎样读

`PackSource.list` 返回条目。Folder 来源保持传入顺序，ZIP 来源沿归档枚举。 `parsePack` 依这个次序解析所有非根清单的 JSON，即使其异步读取的完成次序不同，Promise.all 的结果仍按输入顺序。 `mergeFragments` 对列表依次追加，name/version 取第一个有效字符串，单例字段取最后一次，extras 在同包内按顶层键后写覆盖。根 `datapack.json` 另存 manifest，name/version 与合并结果不一致会报错。跨包时 Registry 另有合入逻辑，某些单例按字段合并，extras 深合并。这两处不能共用一个覆盖假设。

| 数据 | 当前明确的顺序作用 | 首轮输出规则 |
| --- | --- | --- |
| `areas`、`spots` | Registry 建每 Init 的 Area 列表和每 Area 的 Spot 列表，沿定义顺序加入，重复 Spot 的索引另有处理 | 保留顶层输入相对次序，同时保留 Area 内 defaultSpots 和线路。比较实际可查列表 |
| `passiveStories`、`passivePools` | PassivePoolSystem 遍历候选，未分配的 Entry 可进默认根池。候选权重即使不变，相同随机输入的落点也可能因顺序改变 | 保留顶层顺序以及每池的 children 候选次序，固定随机输入对照 |
| `triggerDefs`、`affectorPacks`、`milestones`、`milestoneListeners` | GameInstance 将前两表直接加载给执行系统。MilestoneAdapter 有顺序扫描与监听查找。合法包也需比较多个规则同时生效的次序 | 保留顶层与嵌套次序，对照实际事件轨迹。重复声明依既有规则检查，不能靠重排消除 |
| `storyDirectories`、`resourceDisplays` | Story 目录节点/放置与资源条有 `order` 字段。如 `src/ui/components/shared/header.ts` 用 0 作为资源缺省并按此排序，同值保持输入次序。目录仍需按其实际节点和放置行为比较 | `order` 本身照搬，保留输入顺序，比较同值、未填写和依赖覆盖三种情况 |
| `stories`、`activeStories`、`items` 等 ID 表 | 许多运行查询按 ID 命中，例如 Registry 查单篇正文或某件物品不靠表下标。目录、搜索或枚举消费者仍可能显示/使用插入顺序 | 可以自由移动完整定义的文件。按 ID 查找不证明全表可重排，首轮还原原始顺序 |
| 其余 Datapack 列表 | 未为每个枚举消费者证明可任意重排。P2 覆盖页穷举当前表 | 可按实体或表拆文件。导出同一份输入保持顺序。若以后允许明确重排某表，需有消费方证据和界面明示 |
| 实体内部列表及局部节点 | Story `nodes` 是执行顺序，choices、actions、Effects 和各队列也可能受顺序影响。Map 节点/边与 Operation Event 内部事实按所属实体解析 | 自动转换以整实体为单位。不得把这些嵌套结构升成可独立加载的顶层分片，原结构与顺序照搬 |
| 三种单例、元数据和 extras | 单例为 `gearConfig`、`characterPersistConfig`、`affectionConfig`。extras 是显式常量表，不是未知键收纳箱 | 首轮单例各一份，元数据单独放，extras 保持对象与原键。重复单例/键提示双方，等待明确选择或接受可解释的旧合并结果 |

顶层没有独立排序字段的表也采用统一的可回读顺序。Registry 的 Map 后写可改变有效值而保留既有插入槽位，一轮“按 ID 排序看起来正常”无法覆盖这种行为。实测应拿相同输入和实际消费者比较。只在确认能改变顺序的作者操作中改排序。

## 分片计划需要记什么

首轮建议在作者工作区明确声明文件及表内回读顺序。可以用作者专用清单作为试验载体，放在旧 reader 不扫描的作者侧，发行构建不复制此文件。持久文件名和项目格式由 D03 再定。计划由 P1 产生，结构如下。

~~~ts
type FragmentRow = {
  table: string;
  key?: string; // 有实际表键时填写，键缺失时保留源记录用于诊断。
  origin: SourcePoint;
  ordinal: number;
  targetPath: string;
};
type FragmentPlan = {
  inputRevision: string;
  rows: readonly FragmentRow[];
  outputs: readonly { path: string; expected: string | null; creates: boolean }[];
  retained: readonly { path: string; reason: string }[];
  diagnostics: readonly Diagnostic[];
};
~~~

1. 首次旧包导入时按实际读取的文件次序和表中行次序赋连续 ordinal，表与表分别编号。无显式清单的目录先记录宿主交来的枚举次序。把它写入计划，在转换报告展示。根 manifest 不参与内容行编号。同表同键重复仍保留来源，阻断结构化拆合，不能用键覆盖掉一行。已有合法无 ID 的结构以表、来源与位置处理。如果没有确认可重识别的键，首轮与整个表一起移动。
2. 设计中的作者清单在保存后按每表记录顺序与当前文件归属。有效唯一键行可用键重新找到。举例，原来 Story A、B、C 分落 `chapter-1/a.json`、`chapter-2/b.json`、`chapter-1/c.json` 后，回读按 A、B、C 的 ordinal 合并。文件路径、归类标签和路径的字母次序都不改变这个数字。分片手工添加记录时列“未在顺序中”，经确认追加或指定位置，删除或换键显示缺项，无法把移动自动认成改 ID。沿目标文件实际内容与摘要复核，避免旧清单覆盖手改。
3. 选择式合一先从已选行按序输出每张表，原顺序可跳过未选记录。仍在外部文件的行保留原位置引用，写回本项目时清单更新选中行的归属，整个项目再次合一仍为 A、B、C。首轮输出新目录，输入摘要或预期不存在的路径变化时刷新预览。原地重排与源版本冲突走 [共同合同](13-authoring-service-contract.md)。
4. 发行用根清单、顺序固定的标准合并 JSON 和独立资产，现有 `parsePack` 无需理解作者顺序清单。若另提供旧式多 JSON 发行目录，必须按旧加载能确定的枚举方式证明顺序，或按表输出各一份且每张表内完整有序。仅把分片文件名加数字不足以覆盖 A/C 同片、B 在别片的例子。
5. 未知顶层键目前在可读分片中被旧 parser 忽略。全未知文件可能报无 Datapack 字段。计划列路径和键，保留原件与值，不把它们提升成 extras 或静默丢失。用户只要整理已知表时，输出未处理原文作为作者资料并明确路径或跳过该文件。需要生成无损统一 JSON 而归属未决时先停转换。已有字段中的未识别属性随整对象复制。列出有意进行的旧 Entry 迁移，不当成文件移动导致的变化。

## 从预览到验收

打开独立工具的实际导入。文件列表显示每个源、定义数和可读状态。预览的清单逐行显示原文件、目标、分类理由和顺序，区分“无法归类”“多重归属”“目标冲突”“只读依赖”“旧兼容字段”。显示目标目录树及各表的合一预览。作者取消、调目标或选择给多归属记录一个存放目录，重新生成计划，无写入。消除冲突后写入新目录，显示实际创建的文件与可打开的产物，核对失败时保留源和上次成功结果，并列未执行的文件。按类型分组直接取表。按 Init 从显式归属与可验证关系取，多个 Init 记共享。按人物或系列由作者指定或用已声明归属，正文中的名字不自动变路径。

先用 Base 或 addition-test 的同一份实物，按表与按实体各走拆→分组→选合→全合，再经现有读取加载并比较数组、有效键、关联索引、旧模式和资产。加入交错 A/B/C 及位置对照，重复 ID、未知字段、同序号、名称冲突、失效顺序和旧 Root 清单。沿 `scripts/base-datapack-export.mjs:exportBaseDatapackFolder`、`src/data-services/datapack/fragment-parser.ts`、`tools/datapack-editor/ui/io.ts:fileInputImport/createDatapackPackage` 改接。旧导出只在相同输入、可读取产物和一次真实消费者通过后迁出相同职责。
