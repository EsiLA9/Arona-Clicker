# M03 内容检查、构建与运行准入服务

## 1. 当前实现与必须改造之处

`parsePack/mergeFragments` 负责读包形状；独立 `tools/datapack-editor/validate/index.ts:validateDatapack` 检查表/ID/引用；`registry/registry-validate.ts:validateDatapack` 检查运行定义；`ContentAuthoringPolicy` 限制特定写操作；`RuntimeContentCoordinator`、`RuntimeWorldContentCoordinator` 管热写修订与回执。它们解决不同问题，却存在重复静态规则、不同错误形状、首次失败即停止等现象。Base TS 导出目录与 bundle 同步分开，独立工具还有 ZIP 输出。这不是仅增加一个 Validator 能解决的结构问题（A01–A06、A08）。

已报告的真实差异：Base 分片和 bundle 数量相同，但 46 个 Story.initId、4 个 Millennium startContext、1 个 Active/5 个 Passive Entry.availableInits、5 个 Pic.src 有差异。addition-test 同版本目录和两个 ZIP 的 scanner.baseCapacity、Story.initId 等不同。新构建必须比较值、来源和行为，不能按版本或实体数声称相等。

## 2. 目标结构与所有权

共同内容检查消费 M01 的固定源与 M02 的定义/关系。能脱离玩家状态的规则统一，只有与当前存档、活动会话、已启用关系、运行状态有关的判断留在 Runtime。作者局部编辑策略不是发行合同，不可直接全量提升为阻断规则。检查无副作用；构建生成真实可读取产物；应用由现有 PackManager/Runtime 写入。不能让 Runtime 与 CLI 分别运行相互矛盾的静态验证器。

```ts
interface CheckInput { read: ProjectRead; scope: 'file'|'project'; file?: string }
interface CheckReport {
  inputRevision: string; scope: CheckInput['scope'];
  status: 'valid'|'invalid'|'incomplete'; diagnostics: Diagnostic[];
  countsByTable: Record<string,number>;
  incomplete: ProjectRead['incomplete'];
}
interface DomainRule {
  code: string; tables: string[];
  check(context: RuleContext): {diagnostics:Diagnostic[]; skipped?:string[]};
}
interface BuildInput {
  project: string; inputRevision: string; outputPackageRef: string;
  destination: string; purpose:'release'|'preview';
}
interface BuildResult {
  status:'built'|'blocked'|'failed'; inputRevision:string;
  packages: PackageInput[]; countsByTable:Record<string,number>;
  artifact?: {path:string; digest:string}; sourceIndexPath?:string;
  diagnostics:Diagnostic[];
}
```

`RuleContext` 为只读的该次目录、实际声明/有效定义、引用边和依赖组合，不得读当前玩家。DomainRule 返回规则码、实际 SourcePoint 及相关位置；规则没有前提时记录 skipped 而不是说通过。CheckReport 可同时有错误与 incomplete，status 优先 invalid，仍保留未查范围。构建无阻断且完整才生成正式产物；preview 也不得运行语法坏/不可执行定义，作者阅读可用 M08 部分结果。规则返回 Diagnostic 使用 M01 统一类型，代码稳定、严重程度按实际规则，文案可调整。

## 3. 检查与构建的执行方式

1. M01 固定文件与依赖字节、识别源类别。语法坏文件不阻断其它可读文件的检查，保留 parse 诊断。
2. M02 取键、登记所有声明。迁移/默认值必须在明确的领域规则中记录，未知字段保留，不能作为自动丢弃项。结构校验后仍保留坏对象位置。
3. M02 提取并解析引用；仅在引用可靠时执行需要这些边的领域规则。重复定义同时列两个实际位置。条件/Effect 的动态目标标注范围，避免伪精确。
4. M03 执行结构、ID、领域约束（地图拓扑、Entry/continuation、Reveal、Milestone、Operation 局部语义等）。可独立的规则继续；依赖坏输入的规则标记未查。按阶段、位置与代码排序/归并，不吞相关位置。
5. 产物只用该次固定的有效输入。发行默认生成现有 `datapack.json`、标准有序 content.json 与独立资产；不把依赖定义静默复制到输出包，依赖声明保留。预览可装配明确的完整依赖组合。资源地址按现有包/图片解析要求转换并记录原地址，不能只比较 URL 字符串。暂存、回读成功才替换旧产物。相同输入、规则版本、顺序和资产应具有可重复语义；固定归档元数据后可进一步验证字节稳定。
6. Runtime 以现有 PackManager/Registry 进行应用预检，核对目标启用组、依赖、保存和活动剧情。应用失败旧选择、定义、游标及可用存档保持。正式运行仍保留边界检查；禁止仅凭作者报告绕过现场校验。

### 3.1 规则迁移清单

| 现有路径 | 必须迁出的责任 | 必须保留的责任 |
| --- | --- | --- |
| fragment-parser/pack-parser | 源位置、重复及格式归类到 M01/M02 | 旧包读取和兼容迁移，直到新发行回归通过 |
| 独立 validateDatapack | 通用结构、键、引用及静态领域规则调用共同实现 | 编辑界面如何呈现诊断 |
| Registry validateDatapack、area-map-validation、validation/story-continuations | 能独立运行的静态规则、共享错误信息 | 运行组合、准入和状态相关保护 |
| ContentAuthoringPolicy | 与定义结构重合的规则和字段说明 | 热写可编辑范围、运行约束，不直接扩大权限 |
| Base export/sync、独立 ZIP export | 实际生成规范定义、资产和发行结果 | 薄脚本/界面入口、对照用旧路径 |
| RuntimeContentCoordinator | 不再独立重写已共同检查的静态规则 | 修订、写入回执、通知失败回退及热更新边界 |

不要求一次迁移所有规则。每一批要证明两个真实入口对同一输入得同一静态结论，然后退出重复职责；旧 Registry 其余规则继续运行，直至迁完。不能把现有 Registry 函数整包放进作者 UI 当作最终设计。

## 4. 多包管理与构建界面合同

新增构建面板（M05 宿主调用本服务），明确显示已安装/已打开、本次选定依赖、当前游戏启用三个集合。每行显示 modName/version、实际 record/path、digest、依赖要求和解析目标。缺依赖、循环、同版本多份源、覆盖来源和受影响引用可追踪。选定依赖不会改变游戏启用。切换记录后重读整项目；首轮允许全量重检，不以缓存复杂度阻止交付。构建报告区分输出包与完整装配环境；查看同一 ID 的原定义、覆盖贡献者和有效字段。依赖仅安装快照时标明没有真实源文件。

`applyCandidate(artifact, selection, expectedRuntimeRevision)` 为 Runtime 适配入口；返回 accepted/rejected/failed、实际采用包、现场诊断。旧热写可以继续作为受限业务命令，不等同于完整包应用。是否允许当前正在播放的 Story 切换版本需 D06 裁定；首轮只在测试副本演练，生产迁移需明确兼容策略。

## 5. 建设阶段

- M03-A：公共检查主入口与报告；从独立校验器与 Registry 迁移少量真实规则，先重复 scanner、坏 JSON、缺 `theme.colorGroupId`、地图联合动作。CLI/独立编辑器都实际显示诊断并能定位。
- M03-B：统一构建输入、资产与包输出，接旧 `parsePack` 回读、Base 和 addition-test 比较。确认旧 source 与 bundle 哪个值为运行基线；差异逐条汇报，不自动选值。
- M03-C：三包组合、覆盖、缺依赖、同版本不同摘要、反向影响；构建面板接实际 UI，不把构建和启用混为一步。
- M03-D：试播装配及实际准入失败恢复；逐项切换旧导出和静态检查入口。保留旧包和存档的恢复入口，正式 Base 权威源切换必须另行批准。

验收：同输入 UI/CLI 同代码、位置与候选；坏文件不隐藏其它错误；修正前允许作者保存但发行阻断；坏 build 不覆盖旧包；正常产物经真实 Registry 与 Story/世界/奖励加载；同版本不同字节不会误复用；预检失败不改变正式状态。现有 `tests/data/datapack`、`tests/engine/runtime-content` 和独立 validate 测试作为回归，新增实际构建及多错误报告测试。构建通过不证明所有玩法正确，M08–M12 有独立运行验收。
