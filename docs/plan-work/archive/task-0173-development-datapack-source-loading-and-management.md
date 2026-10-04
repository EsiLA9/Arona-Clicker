# Task：开发数据包固定目录自动加载与包库管理

状态：done — 固定目录自动加载、包库对账与管理 UI 已完成（2026-10-02）

## 目标

让 AC 启动时自动发现项目约定目录中的开发数据包，并接入现有 PackManager / Runtime 数据包序列。发现范围严格限于该目录，不增加目录选择或扫描接口。目录支持经典压缩包，以及按 `modNameVersionNamedEditingOrFinished` 形式命名、内容已直接展开到数据包根部的目录包。

本 Task 的首个独立交付是固定目录来源和启动加载。完整包库 UI 行为是本 Task 的后续切片，必须建立在来源身份、来源刷新与启用冲突规则稳定之后。

## 设计边界

- 固定唯一开发目录为仓库根部 `datapack-dev/`。现有 `datapack/` 继续作为手动/示例数据存放区：它包含同身份 ZIP、无根 manifest 压缩包和旧格式目录，不能直接整体自动启用。
- `datapack-dev/` 顶层的 `.zip` 文件均作为普通态来源；只认 ZIP 根目录 `datapack.json`，ZIP 文件名不承载 editing 状态。
- `datapack-dev/` 顶层包目录命名为 `<modName>@<version>@<editing|finished>`，状态后缀使用小写；`modName` 与 manifest 一致并遵守现有小写字母/数字/连字符规则，`version` 与 manifest 完全一致且非空。内容文件直接置于包根，包内资源子目录允许递归读取。
- 只发现 `datapack-dev/` 顶层 ZIP 和符合命名的直接子目录；不递归发现嵌套 ZIP 或展开包、不读旁侧的 `datapack/`。UI 不提供目录选择或扫描接口。
- 每个来源以相对路径作为稳定记录身份。相同来源内容变化时更新同一记录；来源移除或当前内容解析失败时，不把旧快照作为有效自动来源继续启用；目录文件本身不由游戏删除。
- 第一次发现的 `finished` 来源在 ModName 唯一且无现有启用项冲突时自动进入启用序列；`editing` 来源保留在包库但不直接运行。多个 `finished` 来源共享 ModName 时保留记录、全部不自动启用并报告冲突。后续启动尊重已持久化的启用选择；新出现且无冲突的 `finished` 来源采用上述默认策略。
- 启动发现结果并入 PackManager，与手动导入/编辑记录协作；来源路径身份须允许未启用包存在相同 ModName、Version 与 Editing 状态。
- 本 Task 后续 UI 切片：顶部模式 Switch；经典包的未启用 / 启用中双列表与拖放；启用中 ModName 唯一，未启用项允许同 ModName、Version 和 Editing 状态并存；删除与普通态/编辑态转换；右侧以 ModName 为冲突单位呈现创建/转换控制；从普通态创建编辑态前要求输入不同 VersionName，再复制为新编辑态 Mod。
- 本 Task 不涉及独立 `tools/datapack-editor/`。
- 不实现档案迁移或旧快照兼容；按 `AGENTS.md` 的清档策略处理破坏性数据结构变化。

## 当前事实与代码落点

| 已核实事实 | 源码/测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| 通用 `PackSource` 已有 `folder` kind，但当前只有 `ZipPackSource` 有实现。 | `src/data-services/datapack/source.ts` | 展开目录应实现同构来源读取，不需要另建解析格式。 |
| `parsePack()` 要求根 `datapack.json`，manifest/分片共用现有解析流程；ZIP 已接入同一流程。 | `src/data-services/datapack/pack-parser.ts`、`docs/docs-829/04-mechanisms/data-services/pack-loading.md` | 文件夹包应以内容根部为解析根，不增加额外包格式。 |
| PackManager 管理存储记录、顺序、启用集和编辑态；有效启用集要求 ModName 唯一，编辑态不能直接加入启用集。 | `src/data-services/datapack/pack-manager.ts:PackManager`、`validateEnabledSet` | 自动来源需要清晰地区分“发现/保存/排序/选择应用”状态，并服从启用校验。 |
| 应用启用序列会 reload Runtime，目标侧可校验候选数据包并在 Apply 失败时恢复。 | `docs/docs-829/04-mechanisms/data-services/pack-loading.md` | 自动加载失败不得留下半更新 Runtime 或图片登记。 |
| 游戏启动时从 IndexedDB 恢复包管理器。 | `src/ui/main.ts` 的 `IndexedDbPackSnapshotStore`、`restorePackManager` 调用 | 固定目录发现需与快照恢复次序、重复发现和来源内容变化协调。 |
| 游戏内路由已有唯一 datapack workspace；基础 frame 已支持列合并。 | `src/ui/workspace/workspace-router.ts`、`src/ui/components/workspace-frame.ts`、[[task-0172-workspace-composition-and-datapack-management-shell]] | 后续管理页可以继续在该 workspace 上迭代，不再新建平行场景。 |

## 施工切片

### P0：固定目录来源契约与命名识别

- [x] 固定目录选为 `datapack-dev/`，并确认 Vite `import.meta.glob` 静态资源清单可避免浏览器额外文件选择接口。
- [x] 裁定目录名为 `<modName>@<version>@editing|finished`，并要求目录与 manifest 的 ModName / Version 一致。
- [x] 定义按来源路径区分记录、同源更新、来源删除/无效内容及重复 ModName 的行为。
- [x] 定义首次发现自动启用与后续尊重用户保存选择的规则；editing 来源不直接进入 Runtime。

### P1：实现目录扫描、解析与启动接入

- [x] 只发现固定目录顶层 ZIP，展开包仅识别符合约定的直接子目录；不读项目其他路径。
- [x] 为展开目录实现 `PackSource`，复用 `parsePack()`；ZIP 继续复用现有解析器。
- [x] 启动时先恢复 PackManager，再对账开发来源并通过启用集加载 Runtime。
- [x] 对坏 ZIP、缺少 manifest、无效分片、错误目录名、同源内容更新与来源消失建立结果和测试。

### P2：管理 UI 行为收敛

- [x] 复用 task 0172 workspace，实现经典 / 开发目录模式切换与经典包双列表拖放；启用侧维持 ModName 唯一并遵守依赖、核心包和编辑态边界。
- [x] 未启用库按记录身份保存；删除与转换只作用于选定记录。
- [x] 右侧 ModName 详情区提供编辑态副本、普通态转换与编辑器控制；编辑态副本要求不同 Version。
- [x] 固定目录来源与用户导入记录分开显示；包库移除不会删除目录文件，后续发现会重新加入。

## 测试与验收

- [x] 固定路径发现只纳入顶层 ZIP 和约定展开包，不读取旁侧或更深层级的 ZIP。
- [x] ZIP 与展开包得到等价 manifest、Datapack 和图片条目；展开包编辑态按目录名识别。
- [x] 快照恢复后来源对账、同源重复发现、内容变更与来源消失保持幂等；启动通过启用集加载 Runtime。
- [x] 同 ModName 的未启用记录可共存；启用冲突由草案校验阻止。
- [x] UI 拖放、删除、启用、排序、版本变更复制、普通/编辑态转换均有行为测试。
- [x] 类型、架构、文档检查通过；桌面浏览器验收确认经典/开发目录模式与右侧详情展示。窄屏未验收（按用户要求）。

## 当前核验（2026-10-02）

- `datapack/` 现有平铺 ZIP 包括两份同身份 Addition Test 包；`arona-clicker-core.zip` 无根 manifest，`arona-clicker-core2.zip` 的 manifest 位于 ZIP 内子目录。复用它作全量自动扫描会产生重复与解析失败，因此固定新目录 `datapack-dev/`。
- `src/data-services/datapack/source.ts` 定义 `PackSource` 的 folder kind，但当前未实现文件夹来源类。
- `src/ui/main.ts` 在 IndexedDB 快照恢复后扫描开发目录、对账来源并调用 `loadDefaultDatapack()`；Vite 静态 glob 只收集固定目录资源。
- 验证：定向 Vitest 通过（8 个测试文件、85 项）；`npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs` 通过；本地桌面浏览器检查了经典与开发目录模式。
- `npm run build` 在实现过程中通过，验证 Vite 静态 glob 转换；该命令写入忽略的生成目录 `web-dist/`。
- 当前工作区基础工程及验证见 [[task-0172-workspace-composition-and-datapack-management-shell]]。

## 剩余工作

- 本 Task 范围内无剩余工作。窄屏适配不属于验收范围。

## 相关路由

- [[docs/docs-829/04-mechanisms/data-services/pack-loading]]
- [[docs/docs-829/03-data-structures/datapack-contracts]]
- [[docs/docs-829/05-conventions/architecture-discipline]]
- [[docs/ai/context-packs/ui-presentation]]
- [[docs/ai/PROJECT-CONSTITUTION]]
- [[task-0172-workspace-composition-and-datapack-management-shell]]
