# M02 定义目录、Schema 与引用关系服务

## 1. 当前实现与问题

现有 `Registry` 管理实际运行定义和索引，独立工具用 `schema/engine-defs.gen.json`、`editor-extras.ts`、`schema/merge.ts` 及 `ui/navi.ts` 构造表单和候选。`runtime-content-browser.ts:getReferences/getEntityRelations` 与 `runtime-content-reference-rules.ts:collectDefinitionReferences` 已具备真实关系查询，Operation 有专用规则，Story 改名另有 `authoring/story-identity.ts:planStoryIdentityChange`。这些不是尚待发明的系统。问题在于它们分别面向运行定义、独立编辑器对象和局部作者操作，不能共享同一组带原始文件位置的候选，也不能完整处理未生效包、重复定义、草稿或坏文件（审计 A06、A10）。

目标是建立独立于 UI 与玩家状态的定义服务，将取键、Schema、引用提取及解析集中在同一组领域描述上。运行 Codex 继续工作，但将其可靠关系规则迁移为可同时服务作者源和运行定义的实现，而不是新造一套关系图。

## 2. 目标职责

- 目录：列出所有表、定义、来源与有效/被覆盖/歧义状态，提供按名称、ID、类型、来源的查询。
- Schema：说明实际字段、联合类型、默认值来源、编辑角色和局部约束；为普通字段、选择器和 CLI 提供同一描述。
- 引用：从声明中提取确切、动态及局部引用，解析有效目标，提供正反向关系、合法候选及改名/删除影响。
- 本模块不写文件、不维护草稿、不负责 Runtime 是否能应用，不重新定义游戏语义。M03 调用本模块进行内容检查；M04–M06 使用同一目录和引用。

## 3. 数据结构与注册方式

共同输入使用 [M01](01-project-source.md) 的 ProjectRead、Owner、DefinitionRecord、SourcePoint、Diagnostic。以 `Datapack` 表为注册单位，而非将每个对象强制纳入新命名空间。`characters` 的 `shiroko` 与 `characterVariants` 的 `Shiroko` 不转换大小写；resourceDisplays 按 resourceId；tags 按实际包/路径规则；单例按表唯一，extras 按明确键。节点局部 ID 带父 Owner；同名不是同 ID。

```ts
interface TableDescriptor {
  table: string; label: string;
  cardinality: 'list'|'singleton'|'keyed-record';
  getKey(value: unknown, packageRef: string): string|undefined;
  schemaId: string; // 对应生成的领域结构描述
  references: ReferenceRule[];
  domainRuleIds: string[]; // 实现由 M03 领域规则登记
  editorRole?: string; // 仅编辑行为提示，不引入 UI 实现
}
interface FieldDescriptor {
  pathPattern: string; schemaRef: string; label?: string;
  editorRole?: 'text'|'number'|'enum'|'reference'|'condition'|'effect'|'list'|'object'|'asset'|'domain';
  referenceRuleIds?: string[]; help?: string;
  defaultSource?: string; readOnlyReason?: string;
}
interface CatalogEntry {
  owner: Owner; occurrences: DefinitionRecord[];
  state: 'unique'|'duplicate'|'invalid';
}
interface EffectiveDefinition {
  entity: EntityKey; value: unknown;
  contributors: Owner[];
  fieldOrigins: Record<string, SourcePoint[]>;
  state: 'resolved'|'ambiguous'|'unchecked';
}
interface ReferenceRule {
  code: string; sourceTable: string; pathPattern: string;
  targetTables: string[]; required: boolean;
  // 需要联合类型、作用域或动态表达式时注册纯提取函数。
  extractId?: string;
}
interface ReferenceEdge {
  ruleCode: string; occurrenceId: string; owner?: Owner; source: SourcePoint;
  raw: string; required: boolean;
  target: {tables:string[]; parent?:Owner; packageRef?:string};
  status: 'resolved'|'missing'|'ambiguous'|'dynamic'|'unchecked';
  candidates: SourcePoint[]; effective?: SourcePoint;
}
```

表描述登记于 data-services 侧；生成 Schema 优先保留 TypeScript 合同为结构权威，`editor-extras` 只补标签、控件、展示及动态字段说明。运行语义由真实领域规则负责。原型不提前迁移到 Schema-first；若发现生成器无法表达某类结构，补明确的描述函数和测试，而非复制一份全表定义。每次新增表，只登记真实键、结构来源、引用和领域规则，再由 M05 选显示方式。用自动对照检测 `fragment-parser` 可读表和描述登记差异，避免遗漏表。

### 3.1 来源与覆盖

目录先保留全部物理声明，再在明确依赖与顺序下生成有效视图。相同包同键重复：不能返回可写唯一 Owner，必须显示两处 occurrence。跨包覆盖：依据现有 Registry/PackManager 各表规则，普通 ID 表后写取代，特殊表、Tag、extras 与单例单独处理；有效值可能来自多个来源，因此需字段来源表，不能假设所有表都只有一个 effective owner。目录支持 `all`（作者源全部声明）与 `effective`（本次组合结果）查询。坏文件使查询覆盖不完整，不能将未见定义判定为不存在。

### 3.2 引用提取与解析

引用规则只描述真实数据语义，不按字符串外观猜。首批示例：

| 规则 | 提取 | 解析 |
| --- | --- | --- |
| AreaMap 节点前往 | `/nodes/*/action/areaId`，仅 action 为 attemptAreaTravel | areas，有效定义 |
| AreaMap 切图 | `/nodes/*/action/mapId`，仅 openMap | areaMaps |
| AreaMap 边 | `/edges/*/fromNodeId`、toNodeId | 本地图的局部节点，不查其他地图 |
| StoryEntry 正文 | 实际 storyId 字段 | stories，核对可用包和领域约束 |
| studentOperationProfiles | characterId | characters，不查 Variant |
| Effect / Condition | 按实际枚举与参数读取引用 | 静态可确定目标或动态/未查完整 |

源字段不存在且可选时无边；出现非法值由结构/领域诊断负责。每一项引用都返回规则码、实际字段路径、位置、候选、有效目标和状态。候选选择器也使用同一规则，即使字段尚未填写仍可查询适用种类。已填值的跳转不使用同名猜测。局部节点改名需要父 Owner 和局部路径；动态引用及旧推断结果标为潜在影响，不进入安全自动重写清单。

## 4. 服务入口与消费者

`createCatalog(read, descriptors)` → Catalog；`describe(table, path, valueContext)` → FieldDescriptor；`find(query)` → 目录结果及 incomplete；`resolve(owner/field)` → 实际声明或候选；`extractReferences(catalog)` → 同 revision 的边；`incoming/outgoing(target, scope)` → 边与范围；`listCandidates(fieldContext)` → 合法候选与来源；`planIdentityChange(owner,newKey)`/`inspectDelete(owner)` → 可改写、只读、动态/不完整、阻断项。所有结果带 inputRevision。修改计划由 M04/M01 执行，M02 不写数据。

Runtime Codex 提供现有运行定义读取适配器，位置可能仅到包/定义；作者目录保留文件范围。两者共享提取规则但不同查询范围，不用作者草稿替换正在玩的 Codex 数据。CLI、诊断、引用卡、条件选择器和关系页均调用此接口，不各自扫描表。索引首轮可整份重建；只有实测性能需要时再实现按实体/文件更新。

## 5. 建设阶段与退出路径

1. M02-A：核实 `Datapack` 各表键、Schema 生成和 extras，建立登记与目录。先 Area/AreaMap/Spot/Story/Entry、Pic、ColorGroup。重复 scanner 仍保留两条记录，跨包覆盖与原 Registry 对照。
2. M02-B：从 `runtime-content-reference-rules.ts` 提取纯规则及准确性标记，处理 AreaMap 联合字段、局部边、Story/Entry 和 Spot 主题；让现有运行 Codex 和作者目录都消费，不重做 Codex。
3. M02-C：接独立工具 `ui/navi.ts`、Workbench 引用卡及条件选择器，再接 CLI。已有 `story-identity.ts` 逐项迁入共同影响计划，保留确有领域特殊的改写动作。
4. M02-D：按照 M05 的全表覆盖扩展；Operation 复杂上下文单独登记，保留 dynamic/unchecked；旧独立候选、重复引用扫描在实际消费者迁移后退出。

验收：重复 ID 不被 Map 吞掉；区分 Character/Variant；AreaMap inspect 没有伪引用，openMap 和 travel 目标种类不同，边不能跨地图同名节点；未知依赖和坏文件给不完整范围；点击诊断/引用到同一真实位置；改名只改变确切字段；字段元数据变更能在两种 UI/CLI 得到一致候选。参照 `runtime-content-browser-rules`、`runtime-content-browser-published-content`、独立工具 schema/validator、`story-directory` 测试。不得把仅有索引单测当作消费者迁移完成。
