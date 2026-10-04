# Task：基础数据包包化、可编辑与可交换

状态：done — 发布包、唯一 base 槽位、交换和受支持字段编辑已交付；剩余全表 UI 覆盖独立进入 Task 0176

## 目标

将当前由 TypeScript 内容模块组合出的 `base` 改为应用内置的数据包资源；包库可以在同名 `base` 记录间交换启用位置，并允许将基础包复制为新版本编辑态，通过 RuntimeEditor 修改、Apply 与回退。基础包仍是游戏必需内容，但必需性归属于 `base` 启用槽位，不再归属于某条不可替换的内置记录。

## 设计边界

- 本 Task 包含：基础包来源包化、基础槽位语义、同名基础包交换、基础包 RuntimeEditor 编辑和可靠回退。
- 每次有效 Runtime 序列必须恰有一条启用的 `modName=base` 记录；当前基础包只能通过同名包交换替换，不可直接停用或删除到空槽位。
- 标准发布包与 `datapack-dev/` 开发来源分开登记与加载；不得将基础包伪装成开发目录来源，以免来源对账将它移除。
- 内置基准包保持只读。人工编辑创建同 `modName`、不同 `Version` 的编辑态副本，通过交换进入 `base` 槽位；原包保留为未启用回退记录。
- UI 编辑必须保留未编辑的包表与字段；不得因 RuntimeEditor 覆盖范围较窄而静默丢弃基础包内容。
- 明确非目标：窄屏适配、独立 `tools/datapack-editor/`、旧存档迁移与任意自定义 ModName 编辑。

## 当前事实与代码落点

| 已核实事实 | 源码/测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| 正式基础内容已作为 1 个 manifest 与完整 JSON 分片发布；`defaultDatapack` 现在是只读兼容出口，运行时包记录直接使用 JSON 资源。 | `src/arona-clicker/content/base-pack/`、`src/arona-clicker/content/default-datapack.ts`、`src/arona-clicker/runtime.ts` | 产品启动仍同步；发布内容经测试可由 `FolderPackSource` / `parsePack()` 解析。 |
| 发布包来源为 `bundle`；旧快照中的 `builtin` base 会在规范化时转为 `bundle`。 | `src/arona-clicker/runtime.ts`、`src/data-services/datapack/pack-manager.ts` | 发布来源独立于 `sourcePath` 开发目录对账，不会被开发来源刷新移除。 |
| 包库 UI、拖放 helper 与交换交互曾把 builtin 记录标成不可排序/不可交换。 | `src/arona-clicker/runtime.ts`、`src/ui/workspace/datapack-workspace-state.ts`、`src/ui/controller-actions-topbar.ts` | 已改由 base 槽位保障唯一性，活跃记录只能用同名交换替换。 |
| RuntimeEditor 目前可编辑 Init、Area、Spot、Enhancement；打包转换会保留 `previous` 中其它数据，但没有这些类型的对应编辑面。 | `src/arona-clicker/contracts/runtime.ts:RuntimeModDraft`、`src/ui/runtime-editor/view.ts`、`runtimeModToDatapack()` | 需要逐字段盘点基础包的 UI 编辑覆盖；完整人工编辑不可仅以“未丢字段”作为验收。 |
| RuntimeEditor 保存编辑态包到包库 IndexedDB 快照；独立浏览器 Profile 有独立 IndexedDB。 | `src/data-services/datapack/pack-storage.ts`、`src/arona-clicker/runtime.ts:persistRuntimeEditingPack` | 编辑副本跨启动保留且不被 `sourcePath` 对账删除；浏览器之间没有自动同步或写回 datapack-dev 的能力。 |
| 多个测试直接读取 `defaultDatapack`，Runtime 构造又同步创建内置包。 | `tests/engine/`、`tests/data/`、`AronaClickerRuntime` 构造 | 文件包化需裁定加载时序与测试 fixture；不能让游戏启动或测试依赖未定义的异步顺序。 |

## 施工切片

### P0：基础槽位、包源和 UI 编辑覆盖裁定

- [x] 必需基础内容定义为恰有一个启用的 `modName=base` 记录；空槽位在 PackManager 配置、Runtime Apply 与停用入口拒绝；基础包通过同名交换替换，不能直接删除活跃记录。
- [x] 发布资源路径为 `src/arona-clicker/content/base-pack/`；Vite 静态 JSON import 保持启动同步，不带 `sourcePath`，不参与 `datapack-dev/` 对账。
- [x] 已记录编辑覆盖矩阵：Init、Area、Spot、Enhancement 具备 RuntimeEditor 读/增/改/删路径；`items`、`characters`、`characterVariants`、`dropTables`、`pics`、`charaProfiles`、`cultivateCurves`、`colorGroups`、`colorEquipments`、`gears`、`gearConfig`、`gachaPools`、`shops`、`triggerDefs`、`passivePools`、`passiveStories`、`stories`、`activeStories`、`affectorPacks`、`funcletDefs`、`resourceDisplays`、`extras` 尚无对应编辑面，保留原值且不由 Apply 静默删除；完整覆盖另立 [[task-0176-base-runtime-editor-full-content-coverage]]。
- [x] 编辑态副本保存在当前浏览器的包库 IndexedDB 快照；基准 `bundle` 记录只读，版本升级作为新记录加入，不覆盖已选版本；副本没有 `sourcePath`，不会被开发来源对账擦除。不同浏览器 Profile 不自动共享 RuntimeEditor 的 IndexedDB 编辑结果，也不自动写回 `datapack-dev/`；这项同步能力另行拆解。

### P1：基础包从代码对象转为发布包资源

- [x] 正式基础内容迁为 manifest 与 JSON 分片；`defaultDatapack` 只读引用发布分片；标准 `parsePack()` 测试覆盖完整相等性。
- [x] Runtime 同步注册发布包；首次创建默认启用 base，恢复快照时保留已有记录与启用版本。
- [x] 发布来源为 `bundle`，版本身份从 manifest 取得；新版本不抢占已有启用槽位。
- [x] 直接读取 `defaultDatapack` 的测试继续通过兼容出口读取相同发布分片。

### P2：基础包同名交换与槽位保障

- [x] 移除 `builtin` 的槽位强制语义；PackManager 仅按 `modName=base` 校验必需且唯一。
- [x] 同名交换保持活跃 base 的序列位置；原记录退回未启用列表。发布基准只读但可作为回退候选。
- [x] 阻止直接停用唯一启用 base、删除当前 base 或 Apply 空槽位；UI 提示改为同名替换语义。
- [x] 替换继续经过依赖、Registry 校验和原子 Runtime Apply；新旧版本均留在包库。

### P3：基础包的人工作业流程

- [x] 包库支持将发布基准复制为同 `modName`、不同 Version 的编辑态记录；RuntimeEditor 只写编辑态副本。
- [x] 编辑态 base 可同名交换进入启用序列；当前 Init/Area/Spot/Enhancement 编辑操作可保存至记录并 Apply。
- [x] 未覆盖表已列明并拆至 [[task-0176-base-runtime-editor-full-content-coverage]]；当前转换只更新已支持表，其它分片字段保留。
- [x] 可交换回发布 base；定向 Runtime 测试验证编辑记录保留、发布版本恢复运行。

## 测试与验收

- [x] 包化发布 JSON 覆盖完整 `Datapack` 顶层内容；解析结果与兼容出口逐项相等，Runtime 生产记录直接取 JSON 资源。
- [x] 首次启动启用一个 base；快照恢复与来源对账保留已选编辑副本，发布新版本不会覆盖用户选择。
- [x] 同名 base 记录可交换，候选占用原启用位置；取消交换不改变工作区草案，旧记录保留待回退。
- [x] 已启用集必须恰有一个 base；不能直接停用或删除唯一启用项；base 固定在核心顺序边界。
- [x] RuntimeEditor 覆盖表中的四类内容可编辑、Apply 并交换回退；其它 22 个表已明确保留语义并交由后续 Task 提供 UI 编辑。
- [x] 持久化边界明确为当前浏览器 Profile 的 IndexedDB；副本重启后保留且不受开发来源对账影响。不同浏览器 Profile 不自动同步、不自动写回开发文件，此项不是本 Task 的交付能力。
- [ ] 定向数据服务、Runtime、UI 测试、`npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs` 通过；涉及拖放、编辑和启动交互时完成桌面浏览器验收。

## 当前核验（2026-10-02）

- `src/arona-clicker/content/base-pack/datapack.json` + `content.json` 由 `parsePack()` 解析后与 `defaultDatapack` 完整一致；JSON 437 KB，为同步启动资源。
- base 唯一槽位由 PackManager 执行；禁用、重复启用与空槽位均被阻止。拖放 helper 允许编辑态 base 替换发布 base，并保留原位置。
- 基础包编辑副本保存在当前浏览器的 IndexedDB 快照中；本 Task 不提供跨浏览器 Profile 同步或浏览器文件写入。
- 定向数据服务、Runtime 与 UI 测试通过：包管理、包解析/来源、编辑态、基础包与工作区共 78 项。
- `npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs`（521 篇 Markdown，0 errors）、`npm run build`、`git diff --check` 通过。构建报告现有 game chunk 超过 500 kB 的提示，构建成功。
- 桌面浏览器验收确认：基础包编辑副本弹出新 Version 提示；拖拽编辑态 base 至启用列会提示同名交换并说明沿用原位置；取消后工作区配置不变。

## 后续工作（不阻塞本 Task）

- 22 个未覆盖内容表的结构化 RuntimeEditor 面见 [[task-0176-base-runtime-editor-full-content-coverage]]。
- 不同浏览器 Profile 的编辑态自动共享 / 写回开发目录当前不提供；本 Task 明确包快照只在创建它的浏览器 Profile 的 IndexedDB 中持久化，不将其误称为跨浏览器同步。

## 相关路由

- [[docs/docs-829/04-mechanisms/data-services/pack-loading]]
- [[docs/docs-829/03-data-structures/datapack-contracts]]
- [[docs/docs-829/02-modules/ui]]
- [[docs/docs-829/05-conventions/architecture-discipline]]
- [[docs/ai/context-packs/ui-presentation]]
- [[docs/ai/frontend-design-project-overlay]]
- [[task-0173-development-datapack-source-loading-and-management]]
- [[task-0174-editing-packs-in-runtime-and-conflict-swap]]
