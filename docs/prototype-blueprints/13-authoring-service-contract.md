# 首轮作者服务怎样交接数据

本页是一份供评审的原型工作合同。获准试验时，P0、P1、P2、P3 和 P6 使用同一份字段定义和含义。需要调整时，同时改本页与两端验收。已有领域数据仍采用 `Datapack`、`StoryNodeDocument`、`StoryEntryDef` 等合同。[共同工作规则](08-cross-system-contracts.md)解释作者何时保存、检查、构建、试播和应用。

## 把实际文件读成一份可重复检查的输入

- 读项目时给一个保存版，或保存版加一份明确的草稿。读取包括根清单、实际选择的包记录、分片、资产目录与格式声明。返回读取成功的文件和无法读取的文件。依赖按选定记录固定，不能遇到同版本另一份 ZIP 就替换。在同一次检查或构建中，文件与资产只能读此次固定字节。若宿主不能保留旧字节，则重验摘要，改变时返回“输入改变”，由用户重新发起。
- 实体键用当前 `Datapack` 表名与该表实际逻辑键，如 `spots + addition-test:spot:scanner`。ResourceDisplay 用 `resourceId`，Tag 用包与现有规范规则得出实际键，Character、Variant 大小写各自保留。无普通 ID 的单例按表唯一，extras 按其显式键。缺键的坏记录仍能按文件路径和字段路径定位。局部节点用父实体与其局部身份，例如 Story 内的 nodeId。
- 项目目录选一个具体来源，实体定位额外带包记录标识。这样同一包两个文件里的重复 scanner 可同时列出，跨包同 ID 可以显示取代关系。包记录标识是此次来源选择的键。PackManager 已安装的记录用其 record ID，文件源用项目打开时分配的键。换文件位置，重新对应需满足同一包来源、同表同键且只余一个可写定义。找不到原记录时要求重新选择。
- 表内字段路径与文件内路径用途不同。前者从标准实体起算，后者从实际结构文本根起算。例如 `/theme/colorGroupId` 与 `/spots/3/theme/colorGroupId`。采用 JSON Pointer 编码数组下标与键中的 `~`、`/`。语言文本通常只有范围。范围以解码后的原文 UTF-16 计数，零起始半开区间。展示时转为一基行列，CRLF 保持两个代码单元但只增加一行。用 CRLF、中文与非 BMP 字符测 CLI 和编辑器。没有精确范围时就定位到字段、定义或文件，说明精度。生成默认值可跳回其生成声明，但应标明由工具生成。

~~~ts
// 原型形状。文件字节及打开权限在宿主保存，对 CLI 输出只序列化报告。
type EntityKey = { table: string; key: string };
type Owner = { packageRef: string; entity: EntityKey };
type SourceFile = {
  packageRef: string; path: string; digest: string;
  format: string; writable: boolean;
};
type SourcePoint = {
  packageRef: string; path: string; digest?: string;
  entity?: EntityKey; field?: string; documentPointer?: string;
  range?: { start: number; end: number };
  precision: 'range' | 'field' | 'definition' | 'file';
};
type DefinitionRecord = {
  owner: Owner; source: SourcePoint; value: unknown;
  // 索引标准实体路径，注册规则和文本前端按这一约定查位置。
  fields: Readonly<Record<string, SourcePoint>>;
};
type Diagnostic = {
  code: string; phase: 'read' | 'parse' | 'shape' | 'reference'
    | 'domain' | 'edit' | 'build' | 'preview' | 'admission';
  severity: 'error' | 'warning' | 'info'; message: string;
  at?: SourcePoint; related: readonly { message: string; at: SourcePoint }[];
};
type PackageInput = {
  packageRef: string; modName: string; version: string; digest: string;
  dependencies: readonly string[]; mode: 'project' | 'dependency';
};
type ProjectRead = {
  project: string; revision: string;
  packages: readonly PackageInput[]; // 本次评估时明确选择的包顺序。
  files: readonly SourceFile[]; definitions: readonly DefinitionRecord[];
  incomplete: readonly { packageRef: string; path?: string; reason: string }[];
  diagnostics: readonly Diagnostic[];
};
~~~

`revision` 绑定具体的文件和资产摘要、选择的包与顺序、格式和草稿版本。相同校验输入在 UI 和 CLI 应能对上同一位置。调用方可用稳定诊断码与位置识别问题，文案可读即可。坏文件和无权读取的依赖使报告部分有效。对于该依赖可能提供的引用返回“未完整检查”。用户可以查看另外两份文件的错误。

## 从检查到改动、发行与运行

| 操作 | 请求及结果 | 谁提供，谁实际使用 |
| --- | --- | --- |
| 查询引用 | 给输入版本、实体或字段、方向。返回起点、目标约束、解析状态、候选及所有可靠来源。返回检查不完整的范围 | P0 用共同规则生成。P2 用于选择和跳转，P5 查来源所涉及的实际引用，P6 输出 |
| 改草稿 | 给 Owner、预期草稿版本、动作与草稿字段。单字段写值、一次有序集合动作或一批片段插入都返回新草稿版本、变更范围和可撤销动作。越范围或旧版本拒绝，保留副本 | P2 会话负责。P3 插入走同一动作。有状态宿主中 P6 可复用。直接编辑文件的 CLI 流程走保存/重读 |
| 预览文件改动 | 给读取版本和改动意图，返回将写/创建/移动的路径、每个原文件预期摘要、未确认的冲突及引用影响。新文件预期为不存在 | P1 出计划。编辑器和终端展示同一清单 |
| 保存源文件 | 给项目版本、预期原摘要、明确要写入的目标与内容。返回实际写集、新摘要及 saved / conflict / failed / partial。冲突不刷新草稿底稿。部分结果列已完成、未执行和备份 | P1 经宿主存储口写入。游戏内包记录适配另外明确归属 |
| 构建 | 给读取版本、显式输出和固定依赖，返回 built / blocked / failed、诊断、输入与依赖摘要、有效定义概览，成功才有可读产物地址和摘要。产物及来源表分别输出 | P0 建旧 Runtime 能读的包。P1 对照转换，P5 和 P6 用于发布练习 |
| 试播 | 给已检查候选或构建结果、具体 Entry/Story、测试 Init、启动状态和允许的操作。返回 ready / rejected、选择的内容版本、诊断。结束记录实际路径、判定或受控人工选择、动作结果和停止原因 | 现有 Runtime 适配负责沙盒。P2/P3/P4/P5/P6 消费。同版本也可以用不同初态分别跑 |
| 应用 | 现场选择安装记录和顺序，Runtime 重新检查现场。产物曾通过检查可以用于候选，能否应用由当前玩家状态、启用与兼容决定 | 仅现有 Runtime 准入流程写实际状态。文档设计只安排副本对照 |

修复建议指向可预览的修改。位置过期时按实体和字段重新定位并重查。普通文本保存允许有语法/领域错误，详细字段弹窗确认要求此次局部结构有效。源保存、候选试播与现场启用各自有独立结果。基础文件不存在、文件权限丢失、旧状态不兼容各自指明原因及恢复入口。

## 编辑、构建和试播的最小返回字段

以下字段是各真实消费者之间要能透传的内容。类型中的 `unknown` 由动作所在领域的实际合同校验。构建与试播只读取固定的输入。

~~~ts
type DraftEdit = {
  owner: Owner; expectedDraftRevision: number; field: string;
  nextValue: unknown;
};
type DraftEditResult =
  | { status: 'updated'; draftRevision: number; changed: readonly string[]; inverse: DraftEdit }
  | { status: 'rejected'; draftRevision: number; diagnostics: readonly Diagnostic[] };
type SaveResult = {
  status: 'saved' | 'conflict' | 'failed' | 'partial';
  files: readonly { path: string; previous?: string; current?: string;
    status: 'written' | 'unchanged' | 'conflict' | 'failed' | 'pending'; recoveryPath?: string }[];
  diagnostics: readonly Diagnostic[];
};
type BuildInput = { project: string; inputRevision: string; destination: string };
type BuildResult = {
  status: 'built' | 'blocked' | 'failed'; inputRevision: string;
  packages: readonly PackageInput[]; countsByTable: Readonly<Record<string, number>>;
  artifact?: { path: string; digest: string }; sourceIndexPath?: string;
  diagnostics: readonly Diagnostic[];
};
type PreviewInput = {
  inputRevision: string; artifactDigest?: string;
  entryOrStory: { kind: 'entry' | 'story'; id: string };
  initId: string; initialStateRef: string;
};
type PreviewResult = {
  status: 'ready' | 'rejected' | 'ended' | 'cancelled';
  input: PreviewInput; sessionId?: string; reason?: string;
  diagnostics: readonly Diagnostic[];
};
~~~

编辑器批量操作先形成完整目标字段，再用一次 DraftEdit 提交和一次撤销。撤销在新的草稿版本上从 inverse 取值，已过期时照样核对。SaveResult 中只有成功写出的文件提供新摘要，恢复位置只指本次保留的备份或暂存。构建仅在 built 时带 artifact，以两个或多个包作为环境时 packages 仍记录选定闭包。未构建的可预览结果来自明确的已检查候选，artifactDigest 可空。试播的 initialStateRef 由实际宿主解析到新档、测试存档副本或已确认的一组输入。当前运行不能用该初态会拒绝，并列原因。ready 的 sessionId 对应实际隔离实例，返回值不能把 GameInstance 交给 UI 或 CLI。已有 Story 条件、投影及结束轨迹从其运行接口读取。

## 一次共同往返怎样验收

1. 用 addition-test **目录**副本读取 scanner，在另一分片复制同 ID，一处改名称。两条 DefinitionRecord 的 Owner 相同，SourcePoint 不同。编辑器与 CLI 都显示主、关联两个位置。若再损坏第三文件，另外两处诊断仍出现，反向查询标记范围不完整。
2. 去掉复制，改实际存在的 `theme.colorGroupId` 为不存在的键。用共同引用边检查并显示受允许的候选。选择真实目标后重新保存和检查。引用反查从目标回到同字段。打开旧报告后在磁盘改动原件，旧位置要重查，原保存请求报冲突。
3. 把另一个项目用作只读依赖。改动候选包版本时对比有效引用位置。构建以固定输入生成报告。坏输入保留旧成功报告指向的包。用实际 Runtime 试播同一候选，报告能回溯到当前构建与原文。草稿不能在不重启的情况下替换这场试播。

## 哪些旧方案值得保留

[技术备选](technical-notes-v1.md)正文保留了永久 EntityHandle/FileIdentity、依赖锁、诊断与建议、草稿反向动作、暂存与持久日志、并发比较、原子发布及旧档迁移。当前保留的技术页可以逐项追到这些内容。D08/D09 记录的类型化玩家事实、待投递与待授重试仍在裁定中，P4 专页补足适用条件。更早改写前全文缺少可独立比对的同版副本，因而这轮只能核对现存备选内容，无法保证逐字完整。首轮用文件摘要、来源标识和隔离副本验证，等看到真实重命名、多写者或重启恢复成本，再采用长期机制。
