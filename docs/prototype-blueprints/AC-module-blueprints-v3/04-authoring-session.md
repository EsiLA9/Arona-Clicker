# M04 作者项目会话与草稿服务

## 1. 现况与改造原因

独立 EditorModel 用 table/index/path 持有数据，提交时制作快照并 Undo/Redo；Story Editor 有自己的 Story、Entry、Pool 草稿、来源及保存流程；Runtime Editor 另有字段编辑和受限在线写入。它们的编辑状态和提交对象不同（A04、A06–A08）。当前 BrowseInstanceManager 管的是浏览实例生命周期，而不是全部作者数据。不能直接把草稿放进实例 Manager，或者在每个 Provider 再建一份数据底稿。

建设一个与界面无关的项目会话，统一负责“实际源的工作副本、尚未保存的修改、撤销、来源和提交”。它不接管玩家状态、Runtime 热写、实例布局及焦点。游戏内、独立工具和 CLI 可按各自宿主使用同一服务，不需要所有宿主共享一个进程或一个草稿实例。

## 2. 目标数据结构

```ts
interface DraftEntity {
  owner: Owner; source: SourcePoint; baseValue: unknown;
  value: unknown; state:'clean'|'modified'|'created'|'deleted'|'conflict';
}
interface DraftFile {
  packageRef:string; path:string; baseDigest:string|null;
  mode:'text'|'structured'; text?:string; // text 模式的实际权威草稿
  changedOwners: Owner[];
}
interface AuthoringSession {
  id:string; project:string; baseRevision:string; draftRevision:number;
  files: DraftFile[]; entities: DraftEntity[];
  history: EditTransaction[]; historyCursor:number;
}
type DraftEdit =
  | {kind:'replace-field'; owner:Owner; field:string; nextValue:unknown}
  | {kind:'create'; owner:Owner; targetPath:string; value:unknown}
  | {kind:'delete'; owner:Owner}
  | {kind:'replace-text'; packageRef:string; path:string; text:string};
interface EditTransaction {
  label:string; expectedDraftRevision:number; actions:DraftEdit[];
}
interface DraftEditResult {
  status:'updated'|'rejected'; draftRevision:number;
  changedOwners:Owner[]; changedFiles:string[]; diagnostics:Diagnostic[];
}
```

这是 M04 的工作结构，不是新的持久 Datapack。实际应用内部还需保存逆操作或事务前后值，不能将 expectedRevision 固定在历史中导致 Undo 无法执行。每个事务按当前草稿版本重新执行反向动作，Undo/Redo 是草稿内的行为。多个标签可共享同一 DraftEntity，不能各自持有覆盖式副本；同一个文件内多个实体修改最终组合到唯一 DraftFile 上。文本源以原文为权威，解析结果是派生，不允许结构和文本两个草稿并行争夺同一个字段。

## 3. 服务行为

`openProject(selection)` 调 M01；`openOwner(owner)` 取唯一来源定义及基础值，重复定义要求先选择具体源并处理冲突，不将其当可安全编辑的普通实体。`edit(transaction)` 先检查目标、版本与局部结构，整批写到会话并产生新版本；对完整性问题可以保存草稿。`readDraft()` 生成基于同一基础文件和修改的 ProjectRead，M02/M03 对该版本检查。`undo/redo` 改草稿，不直接改磁盘。`planSave(selection)` 生成 M01 的 FilePlan；`save(plan)` 只推进确实写入成功的文件/实体底稿，重读来源与关系。`reload()` 对比外部更改，按实际文件保留/合并草稿。`close()` 处理未保存草稿与引用它的标签、预览。

### 3.1 草稿合法性与身份

- 普通文字保存允许语法错误、缺引用及尚未完成字段。详细结构弹窗确认必须满足本次操作的结构与领域编辑约束，但未完成的项目引用可明确保留。正式 build 由 M03 拒绝阻断问题。
- 名称变化不改逻辑键。ID 改名是包含所有可改写引用和源声明的事务；从 M02 取得影响，用户审阅只读、动态、未知及运行兼容影响。未确认不可自动写。删除可以在草稿中表示待删，但存在引用时不得把“正式可发布”标为通过。
- 局部节点编辑身份与运行保存 ID 分开：Story/Map 的真实稳定局部键保留；无 ID 的条件/Effect 临时键由 M06 维护，不进入 Def。插删前先重查目标草稿版本。

### 3.2 保存冲突和多视图

同项目打开地图引用与文件树的同一 Area，数据共享，视图选择/滚动分开。外部改变原文件时，M01 以 baseDigest 阻止旧计划；会话显示基础、磁盘和拟保存内容。文件移动后若同 Owner 唯一可重新定位，提示换源；外部删除/重复时明确冲突，不另造同名实体。保存同一文件中的一条定义时要纳入该文件其它未保存编辑，或让用户选择哪些实际修改写入；不能先保存 A 后用 B 的旧整文件覆写。首轮采用同文件统一保存范围。部分写入后的其它草稿继续可用，逐文件标明状态。

已提交的修改不能通过普通 Undo 无声改回磁盘；需要生成反向草稿与新保存计划。关闭最后一个编辑视图时可保存、丢弃或保留会话内草稿；跨重启持久草稿属于后续增强，不能在 UI 中承诺尚未具备的恢复。

## 4. 具体迁移目标

| 旧实现 | 新职责 |
| --- | --- |
| `tools/datapack-editor/model/editor-model.ts:EditorModel` | 迁出表级修改、历史和数据所有权；只保留 UI 适配或退出 |
| Story `authoring-model.ts` 与草稿构建 | 其 Story 专用编辑命令、派生正文检查保留；底稿、来源、通用修改/历史交 M04；特殊 StoryAuthoringPatch 转为领域应用适配 |
| `saveStoryAuthoringToPack` | 保留已安装编辑态包的真实保存语义，明确与作者目录保存分开；静态规则接 M03 |
| Runtime 热 CRUD | 保留实时状态写入和修订回执，只接共用定义/字段检查，不能作为普通作者草稿提交 |
| BrowseInstanceManager | 继续持有实例、激活和退出；只引用 session+owner，不持有另一份实体底稿 |

## 5. 制作阶段

M04-A：独立工具与测试项目实际使用共享会话，先一个 Spot/name、一个 Area 引用；确认两种打开方式共享修改，Undo/Redo 有效。M04-B：M05 Workbench 接 AuthoringSession，并将 Story 专用命令接入同一事务；普通源与在线包分别标识。M04-C：接 M01 原文件保存，支持同文件多实体、外部冲突、只读、移动后重定位；再接 M06 复杂字段和 M07 文本。M04-D：旧重复草稿/历史退出，保留 Runtime 热写与业务状态边界。

验收以真实 UI 和文件为准：修改未保存时正式 Registry 不变；两个标签立即看到同一值；取消弹窗不影响草稿；保存无效引用成功但 build 阻断；外部改文件不会丢本地草稿；旧异步结果不覆盖新草稿；关闭标签不丢其他视图。测试参照独立 EditorModel、story-editor-authoring、story-editor-pack-source 和 Workbench 会话测试。
