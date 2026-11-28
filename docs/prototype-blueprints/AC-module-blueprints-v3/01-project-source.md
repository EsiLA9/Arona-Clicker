# M01 数据包项目文件服务

## 1. 当前实现与问题

本地审计 A01、A02、A05、A06：`src/data-services/datapack/source.ts` 的 PackSource 只有 list 与路径/字节读取；`pack-parser.ts:parsePack` 从根 datapack.json 读清单，遍历其他 JSON 与图片，`fragment-parser.ts:mergeFragments` 拼接列表、对单例和 extras 执行后写覆盖。结果是合并后的 Datapack 与图片 data URL，原记录属于哪个文件不再是数据模型的一部分。独立编辑器 `EditorModel` 只持有表与行；`ui/io.ts` 导出单一 content.json 和 manifest，不能可靠保留原布局、未知字段和资产。Base TS 到分片目录和 Runtime bundle 有两条独立路径。已安装包 `StoredPack` 也不等于可写工作目录。

根本改造是让读取结果保有文件、内容与声明位置，同时继续提供现有 Datapack 合并结果。作者可以按自己的目录组织 JSON，运行侧沿用现有 Datapack 结构与发行读法。

## 2. 建设需求和目标边界

首批交付依次是多文件读入与来源、按表/实体拆分及选合/全合、快速层级化、独立 Datapack 编辑器与 CLI 接入。支持单 JSON、旧包目录及 ZIP，目录可任意嵌套，同一文件可混合多种表。资源沿用包内相对路径。转换先输出新目录或 ZIP。移动文件不改变 ID、Story 目录、Area 关系或运行行为。M02–M04 可以消费首批成果，基本拆合和层级化无需等待这三个模块。

原文件保存随 M04 草稿推进，读入及导出迁移在首批完成后可独立推进。M03 消费固定构建输入。Base 保留 TS 原始构建和测试，并将实际分片导出接入共用服务。局部路径样本可以先试，全量 Base 导出是迁移验收。Base 历史差异和权威源选择独立裁定。

## 3. 目标数据结构

共同合同分期实现。首批读入保留规范相对路径、表、原始值、JSON Pointer 或声明位置、实际读入顺序、原始文件字节以及合并投影和诊断。兼容迁移后的值与原始来源分别保存。同包重复声明以位置区分，缺键记录依然可读。首批复用分片解析的表规则，M02 后续补齐按表取逻辑键及引用。

下列是共享合同的候选形状。摘要、固定 revision、依赖选择按实际消费加入。`packageRef` 是本次选择中具体包记录的标识。安装包使用实际 record ID，本地目录或 ZIP 使用本次打开分配的标识。

```ts
type EntityKey = { table: string; key: string };
type Owner = { packageRef: string; entity: EntityKey };
type TextRange = { start: number; end: number }; // UTF-16，零起始半开
interface SourcePoint {
  packageRef: string; path: string; digest?: string;
  entity?: EntityKey; field?: string; documentPointer?: string;
  range?: TextRange;
  precision: 'range'|'field'|'definition'|'file';
}
interface Diagnostic {
  code: string; phase: 'read'|'parse'|'shape'|'reference'|'domain'|'edit'|'build'|'preview'|'admission';
  severity: 'error'|'warning'|'info'; message: string;
  at?: SourcePoint; related: { at: SourcePoint; message: string }[];
}
interface SourceFile {
  packageRef: string; path: string; digest?: string;
  role: 'manifest'|'definition'|'asset'|'author-config'|'other';
  format?: { id: string; version: string }; writable: boolean;
}
interface DefinitionRecord {
  occurrenceId: string; // 本次读取唯一，不等于持久实体 ID
  owner?: Owner; table: string; value: unknown;
  source: SourcePoint; fields: Record<string, SourcePoint>;
  ordinal: number; // 同包同表的原始次序
}
interface PackageInput {
  packageRef: string; modName?: string; version?: string; digest?: string;
  dependencies?: string[]; mode: 'project'|'dependency';
}
interface ProjectReadBase {
  project: string; revision?: string; packages: PackageInput[];
  files: SourceFile[]; definitions: DefinitionRecord[];
  diagnostics: Diagnostic[];
}
type ProjectRead = ProjectReadBase & (
  | { status: 'complete'; datapack: Datapack }
  | { status: 'incomplete'; incomplete: { packageRef: string; path?: string; reason: string }[] }
);
```

`ProjectRead` 通过读取器访问原始字节。M03 或试播需要固定输入时，读取器按 revision 提供一致的文件与资产字节，无法保证则拒绝旧请求。版本可覆盖清单、读取顺序、依赖选择及草稿。JSON Pointer 按 RFC 6901 编码，区分实体字段 `/theme/colorGroupId` 与文档位置 `/spots/3/theme/colorGroupId`。文本接入后按语言精度提供范围，展示行列从一开始，CRLF 计一次换行，内部偏移用 UTF-16。M02 提供领域逻辑键，读取不依赖 Registry 或运行状态。

### 3.1 项目目录、包与作者配置

首批沿用根 `datapack.json` 和现有 JSON 分片。单 JSON 继续直接导入。目录可用 `world/`、`characters/`、`chapters/` 或作者自定义。混合表可以共用一个文件。说明、配置和资源按角色保留。CLI 与 UI 可直接传本次分组规则和手工映射。以后需要持久化规则、登记文本格式或选择依赖时，再评估可选作者配置（候选 `project.author.json`），并隔离旧解析器不应读取的内容。

```
project/
  datapack.json               # 当前真实发行清单

  world/areas.json
  characters/shiroko/invite.json
  stories/entries.json
  assets/...
```

导入记录每表实际次序。保持实体内部数组。顶层表按实际消费者分为有顺序意义、已证明可换序和待核实。既有分片顺序无法表达受约束的交错时，为受影响表记录目标文件与片内位置，校验缺项、重复及外部新增。待核实表优先保序，无法可靠恢复时明确提示。旧读取器兼容产物输出有序合一 JSON，局部顺序信息随作者布局流转。首批不建设全局顺序清单、依赖锁和永久身份。

### 3.2 布局计划与后续保存计划

首批拆分、合并及分组共用布局计划，记录源声明、目标路径、保留文件、资产、诊断和移动原因，给 UI/CLI 预览并由目录或 ZIP writer 输出新副本。下列文件级写入结构用于后续原文件编辑。

```ts
interface FileChange {
  path: string; expectedDigest: string|null; // null = 新文件应不存在
  nextBytes: Uint8Array|null; // null = 删除；移动 = 创建+删除
}
interface FilePlan {
  project: string; baseRevision: string;
  changes: FileChange[]; retained: {path:string; reason:string}[];
  placements: {occurrenceId:string; table:string; ordinal:number; targetPath:string; reason:string}[];
  diagnostics: Diagnostic[];
}
interface SaveResult {
  status: 'saved'|'conflict'|'failed'|'partial';
  files: {path:string; previous?:string; current?:string;
    status:'written'|'unchanged'|'conflict'|'failed'|'pending'; recoveryPath?:string}[];
  diagnostics: Diagnostic[];
}
```

`readProject(selection)` 为读取入口。`planSplit`、`planMerge`、`planGroup` 只生成布局计划，确认后由共同 writer 输出副本。后续 `planPatch` 接 M04 改动，`applyFilePlan` 验证权限、真实路径及摘要，`readAt` 按 M03 需求提供固定输入。浏览器文件权限与 PackManager 安装接口分别处理。

## 4. 具体的转换规则

| 操作 | 目标行为 | 不能做的事 |
| --- | --- | --- |
| 按表全拆 | 一张表一份 JSON，元数据和三种单例各明确归属 | 不把未知键塞入 extras |
| 按实体全拆 | 每个完整实体一份含原表外层的 JSON；实体无键或不能重识别时整表移动 | 不拆 Story.nodes、Map.nodes/edges、Operation 局部定义为独立表 |
| 选中合一 | 选择文件/实体生成一个标准 JSON，未选部分仍保留，写回时更新归属清单 | 不复制外部依赖，不删除未选文件 |
| 全包合一 | 生成全部有序定义的单 JSON；资产独立；旧清单保持身份 | 不把图片/音频当作定义文本，不重复编译 DSL 与生成 JSON |
| 快速层级化 | 按表、明确 Init 归属、角色显式映射、Story 系列或手工路径分组；多归属进入共享/待分组 | 不凭正文名字猜角色，不改变游戏目录或触发条件 |

例：原 `passiveStories=[A,B,C]`，A/C 放在一个文件、B 放另一文件。作者副本可按局部顺序回读，有序合一后的兼容产物得到同样结果。全拆、分组、选合、全合可用每次输出继续执行。现行规则见 [包 I/O 与定义来源层](../../docs-830/02-data-and-state/package-io-and-source-layers.md)。

同包重复 ID、单例重复、extras 键冲突和未知顶层字段在源中保留并定位。旧导入可提供旧合并结果对照，但不能无提示折叠冲突。未知字段原样保存；无法无损合一时阻止该转换，允许保留未处理的原文件。已知对象内的未识别字段随对象完整复制。作者布局中 DSL 与 JSON 可同时存在但同一实体只有一个作者声明；反向转换并取代源须独立确认并保证完整。发行默认生成旧 Runtime 可读取的单 JSON + 资产，由 M03 决定发行形式。

## 5. 原地保存与失败边界

一份文件中可能同时含若干实体草稿。M04 提交同一文件的完整改动集合；本服务基于固定底稿组合实际修改，禁止一个实体的旧副本覆盖另一个刚保存的修改。JSON 首轮可局部替换对应声明或整个有效文件（保留其他定义、未知字段及资产；格式重排须可见）；DSL 保留原文，只有语言声明支持并经再解析验证的改写可自动写入。原始未完成文本可直接保存；结构化操作若无法可靠定位源，保留草稿并禁止自动重写。

每次写入前校验路径、大小写碰撞、摘要；目标新文件应不存在。首次全拆/重排以新目录为默认；先备份与暂存，再替换已确认文件。部分写入必须返回具体完成项、未执行项、恢复位置；不宣称普通多文件磁盘写入天然原子。对外部写者的更强事务、日志恢复、持久身份是后续增强，不是首轮障碍。批量改名/删除需要 M02 的引用影响结果和明确用户确认。

## 6. 建设阶段与旧职责退出

1. M01-A（Task 0435）已验收归档。`project-source.ts:readProject` 复用 PackSource 和分片解析，保留原位、未完成范围与未知项。严格运行加载仍可用。
2. M01-B（Tasks 0436–0437）已验收归档。`project-layout.ts:planProjectLayout` 提供拆合、五种分组与手工预览。独立工具和 CLI 已接入副本输出，使用方式见 [独立 Datapack Editor 与 Schema](../../docs-830/07-tooling/datapack-editor-and-schema.md)。
3. M01-C 对应 [Task 0438](../../../ai/plan/task-0438-datapack-source-save.md)。接真实可写宿主和 M04 字段保存，先验证单文件两个实体，再扩到外部冲突、多文件及恢复。只读入口仍可导出副本。
4. M01-D 对应 [Task 0439](../../../ai/plan/task-0439-datapack-pipeline-convergence.md)。首批完成后可迁移 Base 实际导出、独立工具与 CLI，退出重复分片和资产组装。正式构建随 M03，只有实际写回的接线依赖 M01-C。保留 Base TS 原始构建与测试。正式 Base 权威源、运行切换和历史差异另行裁定。

验收分两期。首批用真实包完成读入、拆合、分组、手调、输出及回读，对照字段、运行意义的表序和资产，验证重复声明、坏文件、未知键、空目录、大小写碰撞和资产缺失。后续验证原地保存、外部变化、中途失败恢复与生产等价。以 `tests/data/datapack/` 中 PackSource、解析、归档、Base 导出测试及 `tools/datapack-editor/ui/io.test.ts` 作旧行为对照。
