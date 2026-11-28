# M02 定义目录、Schema 与引用关系服务

## 1. 现有建设基础

M01 首批已交付。入口是 `src/data-services/datapack/project-source.ts:readProject`。实际 `ProjectRead` 带本次 `project`、`packageRef`、文件、原始声明和诊断，包 manifest 可选。读取为 `complete` 时另有合并 Datapack。 `incomplete` 仍可浏览已读声明。实际 `DefinitionRecord` 有 `occurrenceId`、`table`、`value`、`ordinal` 和 `source`。 `SourcePoint` 提供相对路径、可选 JSON Pointer 及包作用域，尚无字段级来源表、字节范围、持久身份或输入 revision。 `packageRef` 是本次打开的范围标识，安装记录、依赖版本或长期身份由以后真正需要它们的消费者提供。同一文件布局操作产生新副本，重新读入后来源位置也会更新。

M01 的 `projectEntityKey` 只为文件命名尝试 `id/resourceId`。M02 要依据各表领域键识别定义。例如 Character 与 Variant 分属不同表，键区分大小写。运行 `Registry` 握有有效定义，`runtime-content-browser.ts` 已组合普通和 Operation 引用提取，输出给实际 Runtime 图鉴。独立编辑器的表定义来自 generated Schema 与 `editor-extras`，`ui/navi.ts` 查询的是当前表单行。现有 CLI 的 `datapack:layout inspect` 提供文件及声明路径。M02 在这些入口上接共享目录和引用解析。

## 2. 首批交付

1. **按实体查源。** 从原始声明建目录，按表、精确键、名称及文件查找，真实 CLI 可用。展示重复、缺键和未查范围。M01 完整投影与物理声明目录同时保留用途。
2. **查真实引用。** Runtime 图鉴与作者输入共用引用提取与目标匹配。实际 CLI 可从 Entry 正查 Story、从 Story 反查 Entry，并定位源字段。修正 AreaMap 的动作判别与局部节点边解析。
3. **接作者界面。** 独立工具从导入源的树和查询区查看定义、引用并导航。继续使用现有表结构和表单。游戏内 Workbench 的跨实体关系及编辑由 Task 0432 承接。

## 3. 目录与来源

首批合同直接消费 M01 当前类型。以下是拟议的目录结果最小形状。

```ts
interface CatalogDeclaration {
  packageRef: string;
  record: DefinitionRecord;
  key?: { table: string; key: string };
  state: 'unique' | 'duplicate' | 'unkeyed';
}
```

`(packageRef, occurrenceId)` 用于打开本次物理声明。`(table, key)` 用于逻辑查询。跨文件移动不改变领域键，重新查询获得新来源。普通列表依据按表确认的 `id`，资源显示使用 `resourceId`，三个单例按各自表定位。Active 与 Passive Entry 保留物理表，联合目标同时查询两类。同键出现多次须保留全部位置，缺键也可按位置查看。首批保证 Init、Area、Spot、AreaMap、Story、Active/Passive Entry、StoryDirectory、Pic、ColorGroup、Character、Variant 及资源显示的实体查询。特殊 Tag、extras 或其他未接规则的数据可按原声明查看，可以扩充但须有实际消费者和字段依据。

目录的查询范围来自明确读入的项目及调用方已经选定的依赖输入。缺文件或未提供 manifest 声明的依赖时标明未查范围。发现一处结果只说明该范围内找到一处。多个候选不得凭物理读取顺序自动取得有效值。Runtime 适配器只描述已装载的有效定义。真正的跨包覆盖、字段来源、Tag 或 extras 合并，跟随 M03 的有序依赖组合核验现有 Registry 规则，届时再加有效视图。目录复用一次快照构建，首轮不加常驻版本注册、增量索引或缓存失效设施。

Schema 的结构权威沿用 TypeScript 生成链。已有 `TABLES` 在独立工具提供本批实际字段名和结构提示。Data Services 不依赖 UI 或独立工具。领域字段、附加候选、默认值来源和通用字段描述服务按真实编辑或 CLI 消费逐步扩展。

## 4. 引用和定位

已有 `runtime-content-reference-rules.ts:collectDefinitionReferences` 和 `runtime-content-operation-references.ts:collectOperationReferences` 生成 `ReferenceRequest`。现有 `runtime-content-browser.ts:buildSnapshot` 与 `diagnosticFor` 按 ID/类型匹配目标，再构建出向和入向集合。M02 抽取共同解析与查询逻辑，让作者适配器提供全部源声明，Runtime 适配器提供已装载定义，继续由原图鉴端口展示。Runtime 的游戏数据范围、派生展示及未提供文件位置的降级保留。

| 首批引用 | 规定 |
| --- | --- |
| Init、Area、Spot | 使用已有归属、默认项、导航图和 Spot 色组的确切字段。 |
| Story、Entry | 使用 `Story.startContext`、`Entry.storyId/availableInits` 等已核实字段。派生或旧版本映射的引用只保证可证实的位置。 |
| AreaMap 动作 | `nodes[].action.kind` 取 `attemptAreaTravel` 时读 `areaId`，取 `openMap` 时读 `mapId`，`inspect` 无目标引用。当前普通提取器只按两个路径匹配，需修正。 |
| AreaMap 局部边 | `edges[].fromNodeId/toNodeId` 在该地图的该次声明内查节点。不同地图同名节点和同键的另一处地图声明互不替代。 |
| 图片及已有复杂规则 | 图片和已登记静态字段沿用规则。Operation、Effect 和 Condition 的已有行为用回归固定，未覆盖的动态表达式保持候选或未查。 |

作者查询保留来源声明、实际字段路径、原值、目标类型、作用域、置信度、候选以及解析状态。能证明字段存在于原始声明时，使用原始 Pointer 加转义字段段。现有诊断采用 `$.field[index]` 风格，转换时须区别数组下标和合法属性名；无法明确映射时保留声明级位置及相对字段提示。选择候选要区分已确认目标与歧义边。只有在当前范围足以判定时才报告缺失。未能核实的运行期或缺依赖引用标明范围。旧推断和候选不升级成已确认依赖，引用查询也不承担结构验证、修复和写入。

## 5. 实际 Task 与后续边界

| 阶段 | Task 与检查入口 |
| --- | --- |
| M02-A / A2 | [0440 实体识别与定义查询](../../../ai/plan/task-0440-datapack-definition-catalog.md)。继承现有 CLI 打开流程实现 `find`，用 addition-test、重复 scanner 和缺键样本验收。 |
| M02-B / B3 | [0441 引用解析及 Runtime 图鉴复用](../../../ai/plan/task-0441-datapack-reference-index.md)。共用解析、实际 `refs` 命令和既有 Runtime 图鉴端口。 |
| M02-C | [0442 独立编辑器查询入口](../../../ai/plan/task-0442-datapack-reference-consumers.md)。文件组织源区接定义查询、出入向浏览和原声明定位。 |
| 后续 | M03 按实际需要接有效覆盖与检查，M04/M06 承接草稿、结构化候选和安全写入，Task 0432 接游戏内 Workbench 的关系查看与编辑。特殊表和全量覆盖随实际接线推进。 |

首批共同验收使用 addition-test 的 scanner、welcome Story 与入口，Base 分片的 `base:area-map:schale_office`，以及双重声明、局部缺目标、坏文件和未提供依赖的副本。CLI 和独立工具返回同一作者源位置。Runtime 图鉴的既有关系和 Operation 回归继续通过。已有 `authoring/story-identity.ts` 的特殊改写在共同影响分析及真实写入流程就绪后再评估迁移。
