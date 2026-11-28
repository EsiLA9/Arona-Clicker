# 共同检查、引用与构建怎样组织

适用 P0、P2、P6。先读[操作规格](01-content-pipeline.md)和[数据合同](13-authoring-service-contract.md)。首批以 AreaMap 动作、Spot 配色和重复 scanner 检验链路。

## 从实体目录到一次完整检查

| 步骤 | 首轮由谁做 | 输出与相邻步骤 |
| --- | --- | --- |
| 读取定义 | P1 通过 PackSource 与作者格式读文件，供 P3 处理文本 | ProjectRead 给出每条定义和源位置。语法失败只划掉该文件的可靠覆盖 |
| 建实体目录 | 按表的实际取键规则登记所有来源，包括重复项和只读依赖 | 先看同包重复，再按字段/表的实际覆盖规则计算本次有效实体。索引保留有效来源与被遮盖来源 |
| 描述字段 | 优先沿 TS 合同与现有生成 Schema，编辑帮助从 editor extras 补充 | 类型、默认值拥有者、枚举、展示提示。缺值是否补默认由领域入口决定。读属性描述无需运行游戏 |
| 检查结构 | 表入口先校验字段和联合类型，适配现有结构规则 | 无效记录留在目录供定位，解析引用时标明其目标不可使用。可以解析的其余字段继续检查 |
| 提取和解析引用 | 每表注册引用规则，项目装配执行。解析器按本次依赖和局部范围查目录 | 产生正反向都可读的一组边，错误定位与候选选择来自同一个规则 |
| 执行领域规则 | 读当前定义、已解析边与同次选择的依赖 | 例如地图边有效性、续接父/子类型和回传身份。缺前提时说明哪部分检查被跳过 |
| 汇总和构建 | 聚合读取、结构、引用和领域诊断。通过后形成定义、资产、报告和旧格式产物 | 同版重复可归并为一条带关联位置的诊断。输出准备齐才替换目标。Runtime 收到候选后做现场准入 |

规则随定义的领域维护，首批把表与规则的装配放在 `src/data-services` 侧。表新增时在同一处登记取键、字段描述入口、引用规则和领域规则。每条引用注册给稳定规则码、源表、字段匹配、目标范围、必需或可选、计算办法。只在需要对联合类型、表达式或上下文特判时加提取函数。构建、UI 与 CLI 从同一装配入口取规则。普通引用不通过扫描任意看起来像 ID 的字符串形成报错或改名建议。

## 一条引用从登记到编辑器回跳

| 类型 | 声明和提取 | 查找和失败 |
| --- | --- | --- |
| 固定目标 | `studentOperationProfiles.characterId` 指向 characters，读取原字符串和标准字段路径 | 按 Character 键，不按 Variant。缺失交给共同解析 |
| 取决于动作种类 | `areaMaps /nodes/*/action/areaId` 仅在 `action.kind` 为 `attemptAreaTravel` 时取 areas。openMap 用相应 mapId 规则 | 先从实际联合字段识别当前动作。坏 discriminator 由结构规则报，不能得到 Area 选择器 |
| 嵌套数组 | `inits /entries/*/areaTransitNetworks/*/areaIds/*` 登记一条实际数组项一条边 | 报告真实下标，如 `/entries/0/areaTransitNetworks/1/areaIds/2`。联动跳转由定位表转换到文本 |
| 动态表达式 | Effect / 条件根据真实操作枚举识别静态 ID，计算值需显式报告表达式和可能目标种类 | 仅静态可证明者参加确切反查。动态列潜在影响，删除或改名时保留风险 |
| 局部目标 | `AreaMap.edges[].fromNodeId/toNodeId` 查本地图节点。Story 的跳转按正文实际作用域查相应节点/正文 | 边指另一地图同名 node 仍报缺失。回跳要带父实体和局部节点的来源 |
| 上下文候选 | 现有 Operation 的行动和人物资料存在多 Event/Location 上下文，沿真实声明查局部 track、fact 或 position 候选 | 一条声明回到多处定义时返回拥有者和上下文。凭候选不承诺安全级的自动改名 |

查询返回同一版本的边，正向按 Owner/字段筛选，反向按有效目标和局部作用域筛选。提取者填写 source、raw、target 与 required。解析者填写 status、candidates 与 effective。目标范围在选择器打开前即可取得。

~~~ts
type ReferenceEdge = {
  ruleCode: string; owner: Owner; source: SourcePoint;
  raw: string; required: boolean;
  target: { tables: readonly string[]; parent?: Owner; packageRef?: string };
  status: 'resolved' | 'missing' | 'ambiguous' | 'dynamic' | 'unchecked';
  candidates: readonly SourcePoint[]; effective?: SourcePoint;
};
type ReferenceResult = {
  inputRevision: string; edges: readonly ReferenceEdge[];
  incomplete: ProjectRead['incomplete'];
};
~~~

可选字段未出现不产生边。填了不存在的值如何报由领域规则决定。解析器遇到跨包允许覆盖时返回有效目标，同时记录其它来源。同一来源内重复或覆盖不明按歧义处理。编辑器还可在当前字段未填写时向同一规则查询合法候选，已填时用同一解析器获得跳转位置。删除预览从相同边倒查，遇到未读依赖或动态目标不能给“零影响”结论。

第一处改接从 `src/data-services/registry/runtime-content-reference-rules.ts:collectDefinitionReferences` 及其 `ReferenceRequest` 看现有声明和置信度，Operation 专用提取在 `runtime-content-operation-references.ts:collectOperationReferences`。这些依赖当前 Runtime 的目录类型。试验先把一个已证实的条件型规则接到源定义目录，再让 Runtime 查询适配同一个提取规则。已有推断命中可作为搜索建议。拿 AreaMap 无动作、走 Area、开另一张图、坏字段以及键冲突对照。现有路径模式是否已检 discriminator 要逐条核实，旧规则发出额外推断时留在提示层。结构对照 `area-map-validation.ts:validateAreaMapShapes`，续接对照 `validation/story-continuations.ts:validateStoryContinuations`。只退出实际改接且行为一致的旧规则，保留 Registry 其余检查与上下文准入。编辑器优先改接 `tools/datapack-editor/validate/index.ts:validateDatapack` 对应小组，游戏内选择器与 P6 各有第二次实际消费。

## 作者同时管理三份包时看到什么

以三个试验副本为例。Base 提供 `base:area:schale_rooftop`，角色包声明依赖 Base，自制剧情包声明使用两者。这里描述操作，三份样例的依赖与覆盖需要按实物配置。

1. 构建面板把已安装或已打开、当前游戏已启用、本次构建选择分别显示。每行列 modName、version、物理来源、摘要、依赖要求和解析到的实际记录，其中依赖清单当前是 modName 字符串列表。依赖未启用、缺失、同 modName 有多个可选记录或循环时，指出需要处理哪条。选择记录须显式，可从实时启用组复制成候选。此操作不改变启用。
2. 作者点自制 Story 的起始 Area，回答“本次落到 Base 哪一版的哪个文件”。如果依赖只有已安装后的合并数据，跳到包/实体并说明没有作者文件级位置。另一个包覆盖它时，把原定义、取代者和最终值一并显示。既有 PackManager 的依赖顺序及 Registry 的各表合入准则决定有效关系。普通 ID 表有后写取代行为，Tag 冲突、目录归属、extras/单例等各有规则，避免设计一条万能覆盖算法。
3. 切换角色包记录或重读变更，先重建本次实体和引用视图，再与上次输入比较。显示增加、删除、字段改变、有效来源改变和明确的反向受影响内容。另列动态/坏文件无法完整求得的影响。影响范围保守包含依赖该包的项目。首轮允许整份重新检查。用同版本不同摘要的 addition-test 输入证明面板不会只按 version 判断相同。
4. 选择实际输出后，从同一 ProjectRead 构建。报告分开候选产物内容和它将参与的完整启用组合，依赖只参与检查与装配对照，发行物按原包依赖声明，默认不静默复制依赖定义。准备失败、引用断裂或资产缺失返回阻断位置，旧成功输出继续可用。成功时先让现有读包口读回，再显式在临时 Runtime 验证候选。正式启用的结果可与候选逐项比对，正在运行 Story 或旧档的拒绝原因来自现场。

追入口用 `src/data-services/datapack/pack-manager.ts:dependencyHints`、`enabledPacks` 和现有 Runtime Apply 计划。含覆盖与资产的同一候选由 `PackManager`/ `Registry.load` 实际对照。首个切换范围仅 P0 检查入口和一条构建消费者，现有在线写入和旧包加载回归继续运行。验证顺序先重复 scanner 与缺配色，再地图条件与局部边，最后三包读、缺依赖、两版本覆盖、产物加载和旧包保留。
