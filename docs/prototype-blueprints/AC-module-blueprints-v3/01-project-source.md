# M01 数据包项目文件服务

## 1. 当前实现与问题

本地审计 A01、A02、A05、A06：`src/data-services/datapack/source.ts` 的 PackSource 只有 list 与路径/字节读取；`pack-parser.ts:parsePack` 从根 datapack.json 读清单，遍历其他 JSON 与图片，`fragment-parser.ts:mergeFragments` 拼接列表、对单例和 extras 执行后写覆盖。结果是合并后的 Datapack 与图片 data URL，原记录属于哪个文件不再是数据模型的一部分。独立编辑器 `EditorModel` 只持有表与行；`ui/io.ts` 导出单一 content.json 和 manifest，不能可靠保留原布局、未知字段和资产。Base TS 到分片目录和 Runtime bundle 有两条独立路径。已安装包 `StoredPack` 也不等于可写工作目录。

根本改造：从“把包读成一个对象”改为“保有整个作者项目的文件、内容与声明位置，再根据目的生成 Datapack”。合并产物是派生结果，不能再作为所有作者操作的唯一底稿。

## 2. 建设需求和目标边界

支持单 JSON、旧包目录、ZIP、任意多级目录、若干格式的文本与资源。提供按表/实体全拆、选择式合一/全包合一、快速层级化、原文件回写、导入导出。目录不是运行归属；任何文件移动都不应变更 ID、Story 目录、Area 关系或行为。作者文件可以未完成；只读的依赖或 ZIP 不假装可写。包构建由 M03 负责，本服务只提供原始与固定读取输入，以及布局转换、保存。

## 3. 目标数据结构

以下是 M01–M14 的共同作者数据合同。`packageRef` 是一次项目选择中具体包记录的标识，不是 modName。安装记录采用实际 record ID；本地目录或 ZIP 使用该项目打开时分配的标识。`EntityKey` 按表的逻辑键；同包重复仍保留多个声明，通过位置区别。缺键的坏记录仍保留。

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
  packageRef: string; path: string; digest: string;
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
  packageRef: string; modName: string; version: string; digest: string;
  dependencies: string[]; mode: 'project'|'dependency';
}
interface ProjectRead {
  project: string; revision: string; packages: PackageInput[];
  files: SourceFile[]; definitions: DefinitionRecord[];
  incomplete: { packageRef: string; path?: string; reason: string }[];
  diagnostics: Diagnostic[];
}
```

`ProjectRead` 不把文件字节序列化进每次查询；与该 revision 对应的读取器必须能提供相同字节，包括资产。无法保证时重查摘要并拒绝旧请求。revision 覆盖清单、文件内容、读取顺序、依赖选择与草稿版本。JSON Pointer 按 RFC 6901 编码；实体字段 `/theme/colorGroupId` 与文档路径 `/spots/3/theme/colorGroupId` 分开。文本文件可仅给范围。默认生成字段定位到来源声明，不伪造精确范围。行列展示一基，CRLF 单次换行；内部偏移统一 UTF-16。M02 负责从真实表键构造 Owner；M01 读入阶段可调用它提供的纯取键函数，禁止依赖 Registry 或运行状态。

### 3.1 项目目录、包与作者配置

建议以现有 `datapack.json` 保留发行身份，在作者项目旁设一份明确的作者配置（候选名称 `project.author.json`，不进入旧包 parser）。配置声明纳入的文件/目录规则、格式、文件角色、作者表次序和依赖记录选择。旧项目无配置时按当前 PackSource 枚举规则导入一次，再固化明确次序。不要规定所有作者必须用同一种层级布局；允许 `world/`、`characters/`、`chapters/` 或完全自定义。配置与 README、实验输出不被扫描成第二份 Datapack。支持未来 DSL 文件，但首轮可仅声明临时格式。首轮无需为每个文件设置永久 GUID；包记录、规范路径、实体键及摘要足够识别大部分操作，移动时凭唯一 Owner 对应，发生歧义必须要求选择。

```
project/
  datapack.json               # 当前真实发行清单
  project.author.json          # 候选作者配置，不发行
  world/areas.json
  characters/shiroko/invite.story    # 扩展名仅示意
  stories/entries.json
  assets/...
```

作者配置应能表达每个表的逻辑次序，而不是简单文件排序。建议先采用 `orderByTable: Record<table, {key?,path,documentPointer}[]>`，唯一键优先匹配；无可靠键保持原表整体。清单中缺行、重复行、已移除行必须报告，外部新增可明确追加或指定位置。导入旧文件时记录实际读取顺序；不要用字母排序重新定义游戏语义。依赖选择可先记录实际来源/摘要，是否引入正式 lock 文件留待多包构建实验验证。

### 3.2 分片与保存计划

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

读、规划、提交分开。`readProject(selection)` 返回 ProjectRead；`planSplit(read, mode, target)`、`planMerge(read, selection, target)`、`planGroup(read, grouping, target)` 只生成计划；`planPatch(read, patches)` 将 M04 的实体字段或文本改动转为实际文件修改；`applyFilePlan(plan)` 通过宿主权限、真实路径、摘要验证执行；`readAt(revision,file)` 供构建固定输入。无权写本地时宿主只提供下载或导出计划。浏览器文件权限与 PackManager 持久包接口分开。

## 4. 具体的转换规则

| 操作 | 目标行为 | 不能做的事 |
| --- | --- | --- |
| 按表全拆 | 一张表一份 JSON，元数据和三种单例各明确归属 | 不把未知键塞入 extras |
| 按实体全拆 | 每个完整实体一份含原表外层的 JSON；实体无键或不能重识别时整表移动 | 不拆 Story.nodes、Map.nodes/edges、Operation 局部定义为独立表 |
| 选中合一 | 选择文件/实体生成一个标准 JSON，未选部分仍保留，写回时更新归属清单 | 不复制外部依赖，不删除未选文件 |
| 全包合一 | 生成全部有序定义的单 JSON；资产独立；旧清单保持身份 | 不把图片/音频当作定义文本，不重复编译 DSL 与生成 JSON |
| 快速层级化 | 按表、明确 Init 归属、角色显式映射、Story 系列或手工路径分组；多归属进入共享/待分组 | 不凭正文名字猜角色，不改变游戏目录或触发条件 |

例：原 `stories=[A,B,C]`。A/C 放在 chapter-1.json，B 放 chapter-2.json；回读仍为 A/B/C，不以路径排序替代逻辑次序。任何顶层列表默认保序：areas/spots 的 Registry 枚举、passiveStories/passivePools 的随机落点、triggerDefs/affectorPacks/milestones/listeners 的调用顺序、storyDirectories/resourceDisplays 的相同 order 都可能改变行为。其余 ID 表没有证明无序也保持原次序。所有内部数组原样保留。

同包重复 ID、单例重复、extras 键冲突和未知顶层字段在源中保留并定位。旧导入可提供旧合并结果对照，但不能无提示折叠冲突。未知字段原样保存；无法无损合一时阻止该转换，允许保留未处理的原文件。已知对象内的未识别字段随对象完整复制。作者布局中 DSL 与 JSON 可同时存在但同一实体只有一个作者声明；反向转换并取代源须独立确认并保证完整。发行默认生成旧 Runtime 可读取的单 JSON + 资产，由 M03 决定发行形式。

## 5. 原地保存与失败边界

一份文件中可能同时含若干实体草稿。M04 提交同一文件的完整改动集合；本服务基于固定底稿组合实际修改，禁止一个实体的旧副本覆盖另一个刚保存的修改。JSON 首轮可局部替换对应声明或整个有效文件（保留其他定义、未知字段及资产；格式重排须可见）；DSL 保留原文，只有语言声明支持并经再解析验证的改写可自动写入。原始未完成文本可直接保存；结构化操作若无法可靠定位源，保留草稿并禁止自动重写。

每次写入前校验路径、大小写碰撞、摘要；目标新文件应不存在。首次全拆/重排以新目录为默认；先备份与暂存，再替换已确认文件。部分写入必须返回具体完成项、未执行项、恢复位置；不宣称普通多文件磁盘写入天然原子。对外部写者的更强事务、日志恢复、持久身份是后续增强，不是首轮障碍。批量改名/删除需要 M02 的引用影响结果和明确用户确认。

## 6. 建设阶段与旧职责退出

1. M01-A：在 `data-services/datapack` 旁建立项目读取和文件角色识别；复用 PackSource 适配目录、ZIP、单 JSON，增加逐文件读取、保留位置、原始字节、未知项。第一批真实输入为 Base 分片、bundle 和 addition-test 目录/两个 ZIP。旧 parsePack 暂留作为旧发行读取及对照。
2. M01-B：新增分片规划、排序清单、拆合和分组；从 `base-datapack-export.mjs:exportBaseDatapackFolder` 迁出布局转换职责，独立编辑器 `ui/io.ts` 和 M14 调用共同入口。先导出新目录，回读比较全部字段、次序、资产。
3. M01-C：添加可写宿主、文件修改计划及冲突处理，接 M04 真实字段保存；先单文件，再选合、多文件移动和恢复。不能写的 ZIP 入口导出副本。用同一文件两实体改动检验无覆盖。
4. M01-D：M03 统一构建成功后，旧独立工具自行合并/导出的重复路径退出；Base 旧作者 TS 路径仅作转换和对照，正式迁移待负责人裁定。运行期包读取、安装记录和玩家存档不由本模块接管。

验收：拆→分组→选合→全合能还原同一数据；A/B/C 交错顺序、同值 order、随机固定输入与真实运行列表一致；重复 scanner 双位置、坏文件、未知键、空目录、大小写碰撞、资产缺失、外部改动与中途失败都可追踪。使用 `tests/data/datapack/{pack-source,pack-parser,fragment-parser,archive-writer,base-datapack-folder-export}.test.ts` 和 `tools/datapack-editor/ui/io.test.ts` 作旧行为对照，新增真实转换和保存测试。
