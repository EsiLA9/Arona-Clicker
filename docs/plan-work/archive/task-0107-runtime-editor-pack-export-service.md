# Task：Runtime Editor 编辑态 Mod 导出为数据包压缩包

状态：done — 2026-09-18 完成

## 目标

为当前 Runtime Editor 增加一个“导出数据包”服务：把正在编辑的 Mod Draft 编译为可再次导入的标准数据包压缩包，下载到本地保存。

导出的事实来源是当前编辑态 Draft，而不是最近一次 Apply 的 Runtime 快照。用户即使尚未 Apply，也可以保存当前草稿；导出过程不得改变 Runtime、PlayerState、玩家存档或包库启用集。

## 当前事实与问题

- `RuntimeDatapackEditorState` 已持有 Mod 元信息、Init / Area / Spot / Enhancement Draft、挂起 ID 与当前表单暂存；长效保存由 `task-0106-runtime-editor-draft-persistence` 完成。
- `toRuntimeModDraft()` 主要服务于 Runtime 提交，不是可直接写入 Datapack 的 Def：其中仍有编辑器局部 ID、Draft 诊断字段和挂起语义，不能直接作为压缩包内容。
- `buildAuthoringDef()` 与 `ContentAuthoringPolicy` 已提供 Draft 输入校验和 Draft → 引擎 Def 编码；当前已授权 Init、Area、Spot、Enhancement 四张表。
- `src/data-services/datapack/pack-parser.ts` 要求压缩包根目录存在 `datapack.json`，其余 JSON 文件作为分片合并；`PackManifest` 已定义 `modName / name / version / author / dependencies / icon`。
- 现有 `JSZip` 依赖可用于生成浏览器下载的 ZIP，但仓库目前只有 ZIP 读取与日志 JSON 导出，没有通用归档写出服务。
- 编辑器当前没有图片、图标、原始 JSON 分片和未知字段的保存能力；不能把这些缺失内容伪装成已保留。

## 核心裁定

### 1. 导出的是规范化语义包，不是原包结构回写

首期只保证“导出 → 再导入”的 Datapack 语义等价，不保证原始文件名、分片边界、注释、空白、未授权字段、图片二进制或原包目录结构保留。

输出由当前 Editor 能表达的已校验字段重新编码；任何编辑器内部字段（`applied*`、`formDraft` 元字段、问题注记、挂起操作）都不得进入 ZIP。

### 2. Draft 是唯一导出来源，导出不等于 Apply

导出前按以下顺序处理：

1. 读取当前 Mod 表单和当前内容页表单，确保仍停留在输入框中的内容进入 Draft；
2. 若当前内容表单有未保存输入，执行“只保存 Draft”的校验路径，不调用 Runtime Apply；
3. 以 `editor.inits / areas / spots / enhancements` 和对应的 Mod 元信息编译导出内容；
4. 校验全部通过后生成 ZIP 并触发下载。

导出成功不会清除本地编辑态、不会标记 Draft 已 Apply，也不会刷新 Registry。导出失败保留内存和本地 Draft，并把错误定位到表或字段。

### 3. 挂起条目在独立数据包中直接省略

`suspended*Ids` 是 Runtime Preview 的 Draft-only Tombstone，不是 Datapack 文件格式。导出时省略对应内容，不输出删除标记，也不把背景包内容复制进目标包。

### 4. 当前内容范围与无损边界

- 首期导出 Init、Area、Spot；若编辑态中已有 Enhancement Draft，则按现有 Enhancement Policy 一并导出，不能静默丢弃。
- 当前 UI 尚未提供 Enhancement 的完整编辑入口，本 Task 不扩展其编辑 UI；若已有 Enhancement Draft 无法通过当前 Policy 编译，应阻止导出并说明原因。
- Spot 的 `unsupportedFunctionalityIds`、`unsupportedPaymentOptionPaths` 以及未来出现的不可回写诊断均阻止导出，避免把原内容静默变成空数组或默认值。
- 不导出编辑器未持有的主题、Extra、效果脚本、图片和未知字段；若这些字段属于当前 Draft 的已知来源内容，必须先建立明确的保留协议，不能在本 Task 中偷偷丢弃。

### 5. 包格式与依赖

导出包采用现有 Pack 解析协议，固定包含根目录 `datapack.json`，并以规范化 JSON 分片保存内容：

```text
<modName>-<version>.zip
├── datapack.json
└── data/
    ├── 00-meta.json
    ├── 10-inits.json       # 有内容时生成
    ├── 20-areas.json       # 有内容时生成
    ├── 30-spots.json       # 有内容时生成
    └── 40-enhancements.json # 有内容时生成
```

- `datapack.json` 的 `modName / name / version` 必须与导出 Draft 一致；`author` 非空时写入，首期不写 `icon`。
- `00-meta.json` 始终生成 `name / version`，即使当前只有 Mod 元信息，也能被 `parsePack()` 识别为合法包。
- 内容分片只写非挂起的目标 Mod 自有 Def；数组顺序遵循 Draft 顺序，JSON 使用固定缩进和结尾换行，保证同一 Draft 重复导出结果稳定。
- `dependencies` 首期由编译后 Def 中的完整实体 ID 引用扫描得到：排除目标 `modName`，保留所有外部命名空间（包括 `base`）。不根据描述文本或编辑器内部局部 ID 猜测依赖；无法可靠解析的动态依赖必须报告并阻止导出。手工声明“未被直接引用”的依赖不在本 Task 范围内。
- 现有编辑器没有资产字节和 `PicDef` 编辑能力，因此首期不生成图片目录和图标引用；资产导出另立任务。

### 6. 先建立可复用的归档层，再接入 Datapack

Datapack 导出不能直接把 `Datapack`、`PackManifest` 和 `JSZip` 绑定在一个服务中。首期先冻结一个与业务无关的“归档计划 → ZIP 字节”接口：业务模块负责决定文件路径和内容，归档层负责安全校验、稳定排序、编码和压缩。

推荐接口形状如下，具体命名可在 P0 进一步裁定：

```ts
type ArchiveEntryContent = string | Uint8Array;

interface ArchiveEntry {
  /** POSIX 相对路径；目录由路径中的 / 表达，不要求单独创建目录条目。 */
  readonly path: string;
  readonly content: ArchiveEntryContent;
}

interface ArchivePlan {
  readonly entries: readonly ArchiveEntry[];
}

interface ArchiveWriter {
  write(plan: ArchivePlan): Promise<Uint8Array>;
}
```

接口边界：

- `ArchivePlan` 不规定 `datapack.json`、`data/` 或任何业务目录；未来个性化布置可以提交 `layouts/...`，图片服务可以提交 `assets/...`，其它服务可以提交自己的目录树。
- `ArchiveEntry.content` 同时支持 UTF-8 文本和二进制字节；JSON 的稳定序列化由业务侧或通用 JSON entry helper 完成，归档层不理解 JSON 语义。
- 写入前统一规范化并拒绝绝对路径、反斜杠、`.` / `..` 穿越、NUL、空路径和规范化后的重复路径；不能让未来的文件服务把任意路径写出到归档之外。
- `ArchiveWriter` 按规范化路径稳定排序，固定 ZIP 时间元数据和生成选项；同一 `ArchivePlan` 必须产生稳定文件清单与稳定字节内容。
- 归档写出只返回字节和结构化错误；浏览器 `Blob`、object URL、文件名和下载行为由单独的 UI 下载适配层负责，避免每个业务服务重复实现下载。
- 归档层不负责 manifest、依赖、引用校验、PackManager 或 Runtime；这些属于 Datapack / 其它业务编译器。

这样，Datapack 导出只是一个 `ArchivePlan` 编译器；未来个性化布置文件服务只需复用同一个 `ArchiveWriter` 和路径安全规则，不需要依赖 Runtime Editor 或重新实现 ZIP 细节。

### 7. 不与包库动作混淆

本 Task 只提供“下载 ZIP”。不自动导入 PackManager、不自动启用、不替换已有同名包、不删除 Runtime Mod，也不清理编辑态。导出后的安装 / 替换 / 版本冲突确认另立任务。

## 服务边界与代码落点

| 模块 | 计划职责 |
| --- | --- |
| `src/data-services/archive/` 下的归档写出模块（新增） | 实现通用 `ArchivePlan` / `ArchiveWriter` 能力，生成确定性 `Uint8Array` ZIP；不依赖 UI、Datapack 语义或 Runtime。 |
| `src/ui/runtime-editor/` 下的 Draft 导出模块（新增） | 将 Editor Draft 编译为 Datapack `ArchivePlan`、Manifest 和分片；调用 Policy 校验、`buildAuthoringDef`、挂起过滤和依赖扫描，返回结构化错误。 |
| `src/ui/runtime-editor/actions.ts` | 导出前 flush 当前 DOM、执行只保存 Draft 的路径、调用 Draft 导出模块和通用下载适配层；不调用 Apply。 |
| `src/ui/runtime-editor/view.ts` | 在编辑器面板提供全局“导出数据包”入口，显示未配置 Mod、存在诊断或导出失败的状态。 |
| `src/ui/runtime-editor/state.ts` / `persistence.ts` | 仅在确有需要时补充依赖显示或导出提示；不把 ZIP 字节写入编辑态快照。 |
| `src/data-services/index.ts` | 暴露通用归档写出服务，保持数据服务单向依赖。 |
| 数据服务归档写出测试（新增） | 嵌套目录、文本 / 二进制条目、路径安全、稳定排序、稳定元数据和 ZIP 生成契约。 |
| Runtime Editor Draft 导出测试（新增） | Draft 编译、当前表单 flush、挂起过滤、诊断阻断、依赖扫描和不触碰 Runtime。 |
| `tests/ui/topbar-settings-workspace.test.ts` | 真实面板入口、下载触发和导出前当前输入不丢失。 |

数据服务的通用归档层只接收 `ArchivePlan`；Datapack 编译器留在 UI / 应用边界，最终再把 Manifest 和 JSON 分片转换为归档条目。数据服务不得反向引用 `src/ui/runtime-editor`，避免破坏架构检查。

## 施工切片

### P0：导出合同与格式冻结

- [x] 确认语义等价导出边界、四类内容表、挂起省略规则和不支持字段的 fail-closed 规则。
- [x] 冻结通用 `ArchivePlan` / `ArchiveEntry` / `ArchiveWriter` 合同、UTF-8 文本 / 二进制边界、POSIX 路径安全规则、重复路径策略和空目录语义。
- [x] 固定 Datapack 的 `datapack.json`、`data/` 分片命名、`dependencies` 推导规则、文件名规则和稳定 JSON 序列化规则；这些只属于 Datapack 编译器。
- [x] 定义导出结果类型：成功返回 ZIP 字节、文件名、manifest 摘要；失败返回表 / 字段 / 条目级诊断。

### P1：通用归档 ZIP 写出服务

- [x] 新增纯数据服务，将任意 `ArchivePlan` 条目写入 `JSZip`；不在此层拼装 Manifest 或 Datapack。
- [x] 统一执行路径规范化、重复检查、稳定排序和固定 ZIP 元数据；支持嵌套目录、文本和二进制内容。
- [x] 单独提供或复用稳定 JSON entry helper，保证固定缩进和结尾换行；Datapack 的分片路径与 `parsePack()` 合同由上层测试负责。
- [x] 生成失败只返回错误，不留下半成品下载，不改变包库或 Runtime。

### P2：Runtime Editor Draft 编译与校验

- [x] 复用 `ContentAuthoringPolicy` 为 Init / Area / Spot / Enhancement 构建引擎 Def，不复制字段白名单和编码规则。
- [x] 将 `datapack.json`、`00-meta.json` 和内容分片编译为 `ArchivePlan`，不直接操作 `JSZip`。
- [x] 导出前合并当前页面 DOM / `formDraft`；只保存 Draft，不调用 `setRuntimeModMetadata`、`applyRuntimeWorldDraft` 或 Spot mutation。
- [x] 过滤挂起条目，剥离 `unsupported*`、选择状态、Applied 快照等编辑器字段。
- [x] 扫描外部实体引用生成 dependencies，并对无法证明可导入的结构返回错误。
- [x] 输出只属于当前编辑 Mod 的内容；校验 ID、跨表引用、重复 ID、空 Mod 元信息和所有 Policy 诊断。

### P3：UI 接线与下载反馈

- [x] 在 Runtime Editor 面板提供单一、跨 surface 可见的“导出数据包”按钮；未配置 Mod 或存在阻断诊断时禁用或给出明确提示。
- [x] 下载名使用规范化 `modName-version.zip`，通过 Blob / object URL 下载，及时释放 object URL。
- [x] 成功显示包含文件数与内容表摘要的提示；失败显示首个字段诊断并保留草稿。
- [x] 导出成功后面板、编辑态持久化快照、Runtime 和 PlayerState 均保持原状。

### P4：往返与验收

- [x] ZIP 经 `parsePackFromZipBuffer()` 再解析，Manifest 与 Datapack 字段通过一致性检查。
- [x] 再以 Registry 静态校验解析结果，验证 Init → Area → Spot 引用与外部 Resource / Item / Tag / Reveal 引用成立。
- [x] 对 Draft 修改后重复导出，验证文件路径、JSON 内容和引用结果稳定。
- [x] 完成类型、定向测试、全量测试、架构检查、文档检查和空白检查。

## 用户验收场景

| 编号 | 场景 | 期望 |
| --- | --- | --- |
| US-1 | 只填写 Mod 元信息后导出 | 下载可再次导入的 metadata-only ZIP，不触碰 Runtime。 |
| US-2 | 编辑 Init、Area、Spot 后尚未 Apply 即导出 | ZIP 包含最新 Draft；游戏运行内容保持导出前状态。 |
| US-3 | 用户停留在内容表单输入框，直接点击导出 | 当前输入先进入 Draft；合法输入进入 ZIP，非法输入阻止下载并定位字段。 |
| US-4 | 删除 / 挂起一个已生效条目后导出 | 目标条目从独立包中省略，不输出 Runtime Tombstone 或背景包内容。 |
| US-5 | Spot 存在 unsupported round-trip 诊断 | 导出被阻止，提示具体条目与字段，不生成误导性空字段。 |
| US-6 | Draft 含跨 `base` 或其他 Mod 的完整引用 | Manifest 生成对应 dependencies，重新导入时引用关系保持。 |
| US-7 | 导出 ZIP 再导入 | `parsePack` 与 Registry 校验通过；内容表、ID、版本和引用语义一致。 |
| US-8 | 导出过程中生成或解析失败 | 不触发下载，不改变编辑态、Runtime、PlayerState、SaveData、PackManager。 |
| US-9 | 归档写出服务接收嵌套目录的文本与二进制条目 | 不依赖 Datapack 解析即可生成稳定 ZIP；验证未来个性化布置文件可复用同一接口。 |

## 明确不做

- 不把编辑态 ZIP 字节写入玩家存档或 LocalStorage 草稿快照。
- 不在导出时 Apply、reload、清除 PlayerState、改变 Init 位置或刷新 Registry。
- 不自动安装、启用、替换、删除或写入 PackManager 包库。
- 不保存原始 Datapack 的文件布局、注释、未授权字段、未知表、图片和图标。
- 不在本 Task 实现个性化布置文件或其它新业务格式；本 Task 只为它们提供可复用的归档写出接口。
- 不扩展 Enhancement 的完整编辑 UI，不新增通用全表编辑器，不复活已暂停的全量 Runtime Editor 规划。
- 不实现手工依赖声明、图片资产管理、导出包版本替换与冲突解决。
- 不编写存档 / 草稿迁移代码；若导出契约版本发生破坏性变化，按当前项目约定直接拒绝不支持的输入。

## 测试与验收命令

每个施工切片都必须带 vitest 测试。最终至少运行：

```text
npx tsc --noEmit
npx vitest run tests/data/pack-writer.test.ts tests/ui/runtime-editor-pack-export.test.ts tests/ui/topbar-settings-workspace.test.ts
npm test
npm run check:architecture
npm run check:docs
git diff --check
```

浏览器验收需要确认：当前表单输入不丢失、导出不闪回 Mod 编辑页、不触发 Apply、下载文件可重新导入、失败后草稿仍在。

## 风险与停工条件

| 风险 | 处理 |
| --- | --- |
| Draft 只保存了编辑器可表达字段，原始包仍含未知字段 | 不宣称无损回写；遇到已知不可回写诊断直接阻止导出。 |
| 当前表单未进入 `editor.*` 数组 | 导出入口必须先走当前表单的只保存路径，不能只读取 `toRuntimeModDraft()`。 |
| `dependencies` 自动扫描遗漏动态引用 | 首期只接受可从完整实体 ID 证明的引用；无法证明时阻止导出，另立显式依赖任务。 |
| ZIP 可生成但再次导入失败 | P4 的 parse → Registry round-trip 是硬性准出条件；失败不得只修下载 UI。 |
| 未来文件服务重复实现压缩和路径校验 | 先完成通用 `ArchivePlan` / `ArchiveWriter`，业务模块只编译条目，不直接依赖 `JSZip`。 |
| 导出服务反向依赖 UI | 纯归档 writer 留在 `src/data-services/archive/`，Draft 编译留在 `src/ui/runtime-editor/`。 |

## 实施结果（2026-09-18）

- 新增 `src/data-services/archive/archive-writer.ts`：提供通用 `ArchivePlan` / `ArchiveEntry` / `ArchiveWriter`、路径安全校验、稳定排序、固定 ZIP 元数据、文本 / 二进制条目与 JSON entry helper；未来 `layouts/...`、`assets/...` 等文件服务可直接复用。
- 新增 `src/ui/runtime-editor/pack-export.ts`：从当前 Draft 复用 `ContentAuthoringPolicy` 编译四类 Def，过滤挂起与编辑器内部字段，扫描外部实体 / Tag 依赖并生成标准 `datapack.json` 与 `data/` 分片；失败返回条目级诊断。
- 新增 `src/ui/file-download.ts`，并在 Runtime Editor 面板接入跨 surface 的“导出数据包”入口。导出只读取并保存 Draft，不调用 Runtime metadata、Apply 或 PackManager；下载成功后释放 object URL。
- 新增归档服务与导出服务测试，覆盖嵌套文本 / 二进制、路径穿越、重复路径、稳定字节、挂起过滤、依赖生成、unsupported fail-closed、ZIP 往返、Registry 静态校验和真实面板下载入口。
- 验收结果：`npx tsc --noEmit`、`npm run build`、`npm test`（176 个文件 / 1625 个测试）、`npm run check:architecture`、`npm run check:docs`、`git diff --check` 均通过。

## 相关路由

[[docs/docs-828/00-INDEX]] · [[docs/docs-828/02-modules/runtime-editor]] · [[docs/docs-828/02-modules/registry]] · [[docs/docs-828/05-conventions/architecture-discipline]] · [[docs/docs-828/05-conventions/testing]] · [[docs/plan-work/archive/task-0106-runtime-editor-draft-persistence]] · [[docs/plan-work/archive/task-0057-single-mod-editor-workbench]] · [[docs/plan-work/archive/adr-0004-datapack-management]]
