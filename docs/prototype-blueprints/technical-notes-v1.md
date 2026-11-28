# 第一轮技术方案备查

原始候选合同保留供比较。第二轮行为规格见[共同工作规则](08-cross-system-contracts.md)，先按可见操作和真实数据选定要求，再决定是否采用下列类型、锁、事务和恢复机制。本文中的命名和方案尚未采纳。

## 原候选合同

状态为 Proposed。字段名可随[决策实验](10-decision-register.md)定稿，语义与事务边界是各页共用的候选合同。

## 身份与引用

~~~ts
type EntityKey = { namespace: string; kind: string; id: string }
type EntityHandle = { projectId: string; authorId: string }
type FileIdentity = { projectId: string; fileId: string; path: string }
type SourceSpan = {
  file: FileIdentity; contentDigest: string
  start: { line: number; column: number }
  end: { line: number; column: number }
}
type Reference = {
  from: EntityKey; fromField: string; to: EntityKey
  strength: 'required' | 'optional'
  location: SourceSpan; status: 'resolved' | 'missing' | 'ambiguous'
}
~~~

EntityKey 是逻辑身份，实体版本由锁定快照决定。新定义显式声明命名空间。导入器按领域转换现存编码，包括 shiroko、Shiroko 和 base:avatar(pic):hoshino，并保存可反查的 legacy key。同类实体别名碰撞时阻断转换。FileIdentity 和 authorId 由受版本控制的项目映射持有，既有行通过显式映射注册，重复导入同一身份复用映射。逻辑改名改 EntityKey 和受影响引用，Handle 保持。移动文件只改路径，编辑器标签按 FileIdentity 与 Handle 重解。Story 和 Map 内局部节点由父 Handle 加稳定局部 ID 定位。

编译器按领域声明解析引用。动态选择器保留表达式并校验可静态判定的部分。全局索引包含正向、反向和归属。必需引用缺失阻断构建，可选引用缺失按领域规则降级并发诊断。改名计划分别列可重写、只读和动态潜在命中，阻断项要求处理后整体重算。依赖先锁解析，同一闭包每个命名空间选定一个版本。

## 数据写入权

| 层 | 所有者 | 生命周期 |
| --- | --- | --- |
| Authoring Source | P1 Project Store 经显式提交 | 源、资产、manifest 与锁文件在 git 审阅 |
| Draft State | 作者服务命令，P2/P6 独立会话 | 带基础版本与 draftRevision，允许不完整，支持恢复日志 |
| Parsed Model | 格式前端 | AST、语法、位置和注释，从源重建 |
| Normalized Model | P0 | 标准默认值、实体、Handle、来源与引用描述 |
| Compiled Content | P0 | 不可变定义、资产/依赖摘要、版本，附来源侧车 |
| Registry | Runtime Admission | 候选完整准备后发布定义与索引 |
| Runtime State | Runtime 领域命令与状态写入服务 | 玩家事实、交易、游标、派生状态；预览独立 |
| Save State | Runtime Save Codec | 持久领域数据、world/Init、版本与可恢复游标；临时索引恢复时重建 |
| Temporary UI State | Workbench Shell / 游戏 UI | 实例选择、栏位、滚动、焦点、浮层 |

~~~ts
type ProjectSnapshot = {
  projectId: string; revision: string; lockDigest: string
  files: readonly { identity: FileIdentity; digest: string; format: string }[]
}
type CompiledBundle = {
  formatVersion: number; contractVersion: string; compilerVersion: string
  projectRevision: string; lockDigest: string
  contentDigest: string; bundleDigest: string
  definitions: readonly RuntimeDefinition[]
  assets: readonly { path: string; digest: string }[]
}
type EditPlan = {
  planId: string; projectId: string; baseRevision: string; draftRevision?: number
  writes: readonly { fileId: string; expectedDigest: string | null; newDigest: string | null }[]
  impact: readonly Reference[]; diagnosticIds: readonly string[]
}
~~~

NormalizedEntity 持有 EntityKey、Handle、结构化字段、每字段 SourceSpan。Build 降级为 RuntimeDefinition，其中包含 EntityKey 和运行字段。contentDigest 对规范运行定义和实际资产计算，供语义产物比较。bundleDigest 还覆盖产物头、项目修订和锁，构建报告、来源侧车与预览以此关联。打包时固定归档顺序和元数据，同一输入的归档可逐字节比较。Snapshot 同时提供按摘要读文件与资产的能力，内容改动且旧字节不可得时回报快照过期。

## 诊断协议

~~~ts
type Phase = 'source' | 'parse' | 'normalize' | 'shape' | 'reference'
  | 'semantic' | 'build' | 'admission' | 'behavior' | 'commit'
type Diagnostic = {
  id: string; code: string; severity: 'error' | 'warning' | 'info'; phase: Phase
  message: string; entity?: EntityKey; fieldPath?: string; location?: SourceSpan
  related: readonly { message: string; location?: SourceSpan; entity?: EntityKey }[]
  fix?: { title: string; planId: string; expectedRevision: string }
}
~~~

行列为 1 起始，列按 UTF-16 code unit 计，span 右端不含。fieldPath 用 JSON Pointer，以实体为根。文件缺失、准入和会话问题可无主位置，related 关联已知入口。稳定 code 描述规则，diagnostic ID 以来源定位和规范身份元组去重。调用方以 code/phase/status 判断，文案可本地化。修复是计划，应用时重新核对版本。摘要不同的编辑缓冲区先按实体与字段映射定位，无法映射则标过期并重验。

## 提交与恢复

1. 草稿编辑增加 draftRevision 并记录反向动作。验证、查询、预览钉住当时叠加快照。旧响应不覆盖更新状态。
2. 计划列写集、摘要、引用影响和警告。服务保存实际待写字节或暂存对象，应用时核对计划与字节摘要。项目写锁内核对基础修订、依赖锁与相关文件摘要。CAS 失败保留草稿以做基础、当前、拟议三方比较。成功应用部分草稿后，余项以新修订为基础重验。
3. P1 暂存文件并写持久事务日志。提交点为项目修订发布。下次打开先恢复，未发布时复原，已发布时补齐清理。P1 的所有读者经存储入口取得完整快照。直接文件系统读取可能在 staging 期间看到逐文件变化。相同 planId 和计划摘要返回既有回执，ID 相同摘要不同则拒绝。
4. P1 回执包含旧/新修订、实际写集与 planId。若构建随后失败，保留已提交源与上一版可运行产物。构建物全部完成后再发布。
5. Runtime 准入期间旧实例继续服务。定义、派生索引和持久选择从同一提交点生效。提交前失败释放候选。提交后通知可重试，禁止重复玩家状态写入；无法确认一致性时从最后可恢复点启动。

## Schema 与版本

初始推荐以版本化领域合同为权威，沿现有 TS 生成方式发布稳定 machine-readable 目录。领域结构、引用和语义共同注册，editor extras 提供显示提示。格式、Schema、编译器、锁闭包、资产和源摘要均进入 cache key。版本不支持时给出当前能力和处理入口。

作者源、产物、Schema、存档分别版本化。作者迁移输出候选变更和差异，旧包由一个导入入口转换。旧档依据项目清档规则和实际待保留的数据裁定，先验证拒绝、备份与回退，再发布切换版本。每个 release 记录 bundle 与支持的 Save schema。[D02、D06、D11](10-decision-register.md)
