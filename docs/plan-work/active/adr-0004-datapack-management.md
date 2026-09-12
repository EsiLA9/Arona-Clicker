# 0004 — Datapack 多包读取与管理（三段式命名空间 / 包库 / 惰性存档）

- **状态**：实施中（设计裁定已完成；S1a/S1b 与 PackSource、manifest、PackManager、IndexedDB 快照及基础 UI 已落地，惰性存档与 Character/Variant 命名空间化仍未完成；实现切片见 §8）
- **范围**：Datapack 的物理读取（单文件 / 文件夹 / zip）、包内格式与 manifest、多包包库管理与启用集、跨包引用与冲突语义、存档与多包的关系（惰性保留）
- **来源**：2026-08-29 设计会话（基于现有 `src/data-services/datapack/zip-loader.ts` 单包加载器与 `game.init(datapacks[])` 多包引擎语义的扩展设计）

## 术语

| 术语 | 含义 |
| --- | --- |
| **modName** | 包的唯一标识（manifest 声明），三段式 id 的第一段；测试/示例包当前使用 `base` |
| **三段式 id** | `modName:typeName:idName`，全游戏所有实体 id 的统一形态 |
| **包库** | 已导入的全部数据包集合（当前以 PackManager 快照存 IndexedDB），包之间可同 modName 并存 |
| **启用集** | 包库中被玩家勾选启用的有序子集，决定实际加载内容 |
| **惰性保留** | 存档数据在 Registry 中查不到对应 id 时不加载、不索引，但**原样保留在存档内** |
| **残留数据** | 存档中来自未启用 mod 的惰性数据，可在存档检查界面查看/清除 |

---

## §1 分层架构：Source → Pack → PackManager → Engine

```
第0层 Source（物理来源适配）  单文件 / 文件夹 / zip —— 统一为"路径→字节"条目集
第1层 Pack（包内解析）        manifest + 分片解析（按扩展名注册解析器）→ 一个逻辑 Datapack
第2层 PackManager（包库管理） 导入、启停、排序、启用集校验 → 有序 Datapack[]
第3层 Engine（已有，不改）    game.init / reload(datapacks[]) + Registry tableSteps 合并
```

**Source 统一接口**（zip 只是"不可变的虚拟文件夹"）：

```ts
interface PackSource {
  kind: 'file' | 'folder' | 'zip';
  list(): Promise<PackEntry[]>;          // 递归列出全部条目
}
interface PackEntry {
  path: string;                          // 包内相对路径
  read(): Promise<Uint8Array>;
}
```

- 单文件：一个 `.json` 构造为单分片包。
- 文件夹：File System Access API（`showDirectoryPicker`）递归遍历，与 zip 完全同构——文件夹开发与打包 zip 走同一条代码路径。
- 分片解析器**按扩展名注册**：`.json` 现状（JSON.parse → 分片）；将来 `.dsl` 等注册新解析器即可，Source / merge 层零改动。

现有 `zip-loader.ts` 重构降级为：`ZipSource` 适配器 + `parseFragment / mergeFragments`（留在第 1 层作 json 解析器），对外行为并入新的 Pack 流程。

## §2 三段式 id 命名空间（核心裁定）

全游戏所有实体 id 统一为 **`modName:typeName:idName`**：

| 段 | 语义 | 规则 |
| --- | --- | --- |
| `modName` | 所属包标识 | 包内自声明的 id **必须**属于本包 modName（校验不一致即报错，防手误跨包定义） |
| `typeName` | 游戏自身定义的类型枚举 | 与注册表表对应（spot / item / story / area / init / character / variant / …）；用于**存档数据内唯一判别**——同 mod 同 idName 不同类型的数据结构不冲突 |
| `idName` | 包内唯一名 | 仅要求同 mod 同 typeName 内唯一 |

- **跨包同 idName 不冲突**（命名空间天然隔离）；**modName 冲突**才是包级冲突（见 §4）。
- 跨包引用 = 引用完整三段 id，**自由引用 + 事后校验**：不强制声明依赖，Registry 现有"全量加载后统一校验悬空引用"机制覆盖（[[docs/docs-828/03-data-structures/id-reference-semantics]]）。
- 现有 `base:affinity:hoshino_2` 类两段/语义组 id **全面迁移**为三段式（纪律 #7：无迁移负担，直接改数据 + 同步测试与文档）。
- 字符集约束：modName / typeName 段为 `[a-z0-9-]`，idName 段为 `[a-z0-9_-]`（沿用现有下划线命名惯例），分隔符 `:`，保证解析无歧义。
- 校验三则：非三段格式报错；typeName 未注册报错；id 的 modName 与所在包 manifest 不一致报错。

## §3 包格式与 manifest

```
mypack.zip（或文件夹）
├── datapack.json        ← manifest（固定文件名、包根；不当作分片）
├── data/**/*.json       ← 分片（任意层级 .json 皆分片，现状行为保留）
└── images/*.png         ← 图片资产（ImageStore 登记，PicDef src 引用）
```

manifest（**v1 强制要求**，modName 是承载命名空间的负载字段，不做文件名推导歧义）：

```json
{
  "modName": "my-mod",
  "name": "显示名",
  "version": "1.0.0",
  "author": "...",
  "dependencies": ["other-mod"],
  "icon": "icon.png"
}
```

- `dependencies` **仅作展示提示与排序参考**，不参与校验（裁定：自由引用 + 事后校验）。
- 目录结构（`data/`、`images/`）只是给人看的约定，加载器保持路径无关。
- 图片资产 key 按 mod 命名空间化：同 mod 内 PicDef src 用包内相对路径（解析时自动加 mod 前缀），跨包引用用完整 `mod:path`——两包同路径图片互不冲突。

## §4 包库与启用集（PackManager）

- **存储**：当前以 `PackManagerSnapshot` 保存解析后的 `{ id, manifest, datapack, images, sourceKind, importedAt }`、启用集和顺序；浏览器入口使用 IndexedDB，JSON 快照适配器用于同步/测试。原始字节、文件夹快照和 `contentHash` 尚未纳入模型。
- **导入**：任意包随时可导入（含与已装包同 modName 的不同版本，**统一显示于包库、并存**），导入后由**玩家选择启用或弃用**；导入不做自动替换、不弹窗强制。
- **modName 冲突判定在启用时**：启用集内不允许两个同 modName 的包同时启用——预加载扫描发现 modName 冲突即**拒绝加载**该启用集（提示二选一）。
- **排序**：玩家手动排序（拖拽列表）+ 依赖提示（展示谁依赖谁）；顺序敏感语义（同表遍历序）由手动顺序唯一决定，可预测。
- **内置基础包**：产品内容以 `modName = base` 作为一个 `builtin` 来源的数据包登记进 PackManager。它显示在包库和启用集内，参与 Registry 应用、来源统计和存档环境记录；默认始终启用，不允许玩家停用或删除。`src/data/base/datapack.ts` 仍仅作为开发与测试包夹具，正式产品内容使用 AronaClicker 内容层的 `defaultDatapack`。
- **应用（all-or-nothing）**：启用集变更 → 全量校验（分片解析 + Registry 干跑合并校验）→ 通过才 `game.reload(orderedPacks)`（现有 reload 已实现清注册表 + 重置运行时）；校验失败则整套拒绝、保持旧启用集。

## §5 惰性存档与残留管理（关键新语义，取代"变更即清档"）

**设计原则（当前尚未完整接入）**：存档中所有"id 索引类"数据（roster 条目、背包 items、storyReadLogs、flags、spotTagOverrides、passiveCooldowns、好感值等），加载时按当前 Registry 做**存在性过滤**：

```
Registry 查得到 → 正常加载、索引、参与结算与 UI
Registry 查不到 → 不加载、不索引、不参与任何结算与 UI，
                  但原样保留在存档对象内，保存时全量写回
```

- **重新启用对应 mod → 数据复活**：下次加载时该批数据重新通过存在性检查。
- Registry 校验只针对数据包集（§4），**不针对存档**——存档悬空数据静默降级，不报错。
- **残留检查/清除界面**：列出存档中来自未启用 mod 的残留数据（按 modName 分组计数），玩家可**手动清除**（按 modName 前缀过滤删除）。玩家可见性裁定：可检查、可清除。
- 该语义取代"切 mod 即清档"：切 mod 不丢档，只有玩家主动清除才删数据。

## §6 连带机制裁定

| 机制 | 裁定 |
| --- | --- |
| **affectionConfig** | 单值表改**特化表**：`affectionConfigs: AffectionConfigDef[]`（key = 三段式 affectionConfigId）；角色/变体加 `affectionConfigId?` 字段——缺省标准表由 AronaClicker 内容层提供，声明则查特化表，查不到报错。多包全局合并问题随之消解为命名空间表 |
| **extras** | 暂不考虑多包语义、**置空**：v1 仅由指定的 AronaClicker 内容包声明有效，其他包携带 extras 时警告忽略 |
| **标签（tagDefs / spotsByTag）** | Tag 不另设独立 modName 字段；TagRef 使用 `modName:tagPath`，命名空间位于根部、子路径继承命名空间。TagDef 可声明完整 parent TagRef，允许扩展包显式挂靠公共 Tag；spotsByTag 索引按显式 parent/祖先链命中，扩展包可引用公共 Tag 并被 affector/条件命中 |
| **默认开局** | Runtime 在 Registry 中选择第一个没有 `existence` gate 的 Init 自动进入；多包组合后的默认 Init 由启用包顺序与该筛选结果共同决定 |
| **被动池/就绪队列** | 多包给同一角色（内容包角色）加 passiveStories 属**良性叠加**：共享池加权随机自然混排；好感台阶就绪队列按 affectionRequired 跨包混排，无需特殊处理 |
| **Spot 功能项** | spot 归属唯一 mod（命名空间隔离），不存在两包往同一 spot 声明功能项的问题 |

## §7 多包冲突语义矩阵（速查）

| 冲突面 | 多包同场语义 |
| --- | --- |
| 所有键值表（spots/items/stories/…） | 命名空间完全隔离，零冲突；跨包悬空引用 → 事后校验报错（启用集拒绝应用） |
| modName | 启用集内唯一；包库内可并存多个同 modName 包，玩家启停二选一 |
| 单值表（affectionConfig 等） | affectionConfig 表化 + 角色级引用（§6）；extras 冻结仅指定内容包 |
| 标签命中 | 子叶命名空间化 + 祖先链命中；跨包挂靠为特性非冲突 |
| 图片资产 | key 按 mod 前缀隔离，同路径不冲突 |
| 加载顺序敏感语义（同表遍历序） | 手动排序唯一决定 |
| 存档 | 惰性保留（§5），不因切 mod 报错或丢档 |

## §8 实现切片（建议顺序）

> 实现记录（随切片推进更新）：
> - **S1a 已落地（2026-08-30）**：`core/entity-id.ts` 强化（`ENTITY_TYPES` 注册表 + `validateEntityId`，idName 字符集含下划线）；`registry-validate.ts` 接入 16 张表的强校验（init/area/spot/enhancement/item/droptable/trigger(匿名 `anon:` 豁免)/affectorpack/funclet/passivepool/gachapool/cultivatecurve/colorgroup/colorequipment/themedesign/resource）。语义组中段已全部归位表名（func→funclet、enh→enhancement、pack→affectorpack、aff→affector、group→colorgroup、equip→colorequipment、curve→cultivatecurve、drop→droptable、design→themedesign、pool 按语境二分 passivepool/gachapool；`src/data/base` + `tests` + `datapack/*.json` + 重打包 zip，约 550 处）。story 域（entry/storyId 拆分前仅格式校验）与 characters/characterVariants（裸名）暂不校验，待 S1b/c。
> - **S1b 已落地（2026-08-30，当日完成）**：Story entry id 拆分。演出本体统一 `base:story:{语义组_}idName`（`base:affinity:X`/`base:bond:X` → `base:story:affinity_X`/`base:story:bond_X`）；投放位拆为 `base:activestory:*` / `base:passivestory:*` 并显式声明 `.story(本体)`（废除 entry.id == storyId 同值惯例）；被动池 `.child()` / 冷却键 / `studentBlocks.entryId` 跟随 entry id。JSON 分片（05/16-stories*.json）同步拆分并重打包 zip。story 三表收紧强校验。**引用语义分界**（拆分后的权威口径）：
>
>   | 引用点 | 语义 | 指向 |
>   | --- | --- | --- |
>   | `startStory` / `startActiveStory` / `startCardStory` / `replayStory` / `triggerStory` op / `InitDef.startStoryId` | 启动入口 | **entry id**（引擎 `rt.entryById` 解析；参数名 `storyId` 为历史遗留） |
>   | 聊天流 kizuna 卡（`Talklet.kizuna.storyId` / `kizunaCard()`）→ `data-kizuna` | 启动入口 | **entry id** |
>   | `StoryView.storyId` / `storyGate.storyId` / `storyTriggered` 事件 / 被动池成员 / `passiveCooldowns` 键 | 投放位标识 | **entry id** |
>   | `hasCompletedStory` / `storyLog` / `hasReadStory` 条件 / `visitedStoryInChain` / `pushAfterStory` / `branchGuards` / goto·jump / `onStory`（storyCompleted） | 本体与已读 | **story id**（`StoryView.storyDefId` = 本体） |
>
>   连带引擎修复：`init-service.ts` 的 startStoryId 完结守卫改为按 `entry.storyId` 判定（原来 entry/story 同值两用，拆分后必须解析）；`ui/components/story-gate.ts` 的 `storyDisplayTitle` / `rewardLines` / 完结判定改为按 entry id 正向解析（原 `e.storyId === storyId` 反查失效）。`npm test` 995 全绿。
> - **S1c 待做**：Character / VariantId 命名空间化（现 Character 枚举值为裸名、默认差分 id 为原型名首字母大写如 `Arona`、`HoshinoSwimsuit`；迁移为 `base:character:*` / `base:variant:*`）；完成后 characters/variants 收紧校验。

1. **三段式 id 迁移**：types / registry 校验（格式 + modName 归属 + typeName 注册表）+ `src/data/base/` 数据全面改名 + `gen:schema` + 相关测试同步。
2. **Source 适配器**：`PackSource`（当前已实现 zip；file / folder 适配器尚未接入）统一条目集 + `zip-loader.ts` 保留为兼容解析器。
3. **manifest + 包解析**：`datapack.json` 解析、JSON 分片解析与图片收集已实现；按扩展名注册的通用解析器仍未完成。
4. **PackManager**：内存编排、快照持久化、IndexedDB 恢复、导入、启停、手动排序、modName 冲突/依赖校验、临时 Registry 预校验与 `reload` 接线已实现。
5. **惰性存档**：加载期存在性过滤（逐 id 索引类结构接入）+ 残留检查/清除界面。
6. **连带机制**：affectionConfigId 特化表 + TagRef 根命名空间/显式 parent + extras 冻结（可与 1 并行）。
7. **mod 管理 UI**：包库列表、zip 导入、启停排序与依赖提示已实现；文件夹/单文件导入、残留管理和完整草案确认流程仍未完成。

## §9 测试清单

- 三段式解析校验：非法格式 / modName 与所在包不一致 / typeName 未注册 / 同 mod 同 typeName 重复 idName
- 多包加载：跨包同 idName 不冲突；跨包引用校验通过；悬空引用 → 启用集拒绝应用（all-or-nothing）
- 启用集：modName 冲突拒绝；手动顺序决定同表遍历序
- 包库：IndexedDB 往返；同 modName 多版本并存；三种来源（文件/文件夹/zip）解析一致
- 惰性存档：禁用 mod 后加载不索引不报错、数据保留；重新启用复活；残留计数与清除
- affectionConfigId：缺省标准表 / 特化表生效 / 查不到报错
- 标签：跨包子叶挂靠后祖先链命中（base affector 命中扩展包 spot）
- 图片：两包同路径图片隔离、跨包 `mod:path` 引用

## §10 开放点（未裁定负空间）

- manifest 缺省时的降级行为（v1 强制；是否放宽待包生态形成后看）
- `version` 语义：仅展示，不做区间匹配；将来若做更新提示再引入
- 依赖拓扑自动排序（当前纯手动 + 提示）
- 存档残留的跨 mod 合并语义（如两个 mod 提供同 typeName 同 idName 的角色变体时的好感数据归属）——命名空间隔离下理论上不出现，出现即校验错误

## 实现记录（2026-09-01）

- M5-4 第十一段：`base` 正式纳入 PackManager，作为 `base@1.0.0` 的 `builtin` 数据包进入包库和启用集；启动改为从启用集应用，内置包不可停用/删除，旧包库快照恢复时自动补入。

- M5-1 第二段：新增 `src/data-services/datapack/source.ts`，定义 `PackSource` / `PackEntry`，并实现 `ZipPackSource`；现有 ZIP Loader 已通过该 Source 读取 JSON 条目，文件夹与单文件适配器仍待后续切片。
- M5-1 第三段：新增 `src/data-services/datapack/manifest.ts`，实现 manifest 的结构与命名空间校验；兼容旧 Loader 暂不强制 `datapack.json`，由后续 Pack 解析流程接入强制规则。
- M5-1 第四段：新增 `src/data-services/datapack/fragment-parser.ts`，将 JSON 分片解析/合并从 ZIP 物理读取中剥离，解析器不依赖 ZIP 或 UI。
- M5-1 第五段：新增 `parsePack(source)` 统一 Pack 解析入口，强制根目录 manifest，使用 Source 条目读取 JSON 与图片；旧 Loader 保留为历史包兼容入口，后续 PackManager 接入新流程。
- M5-1 第六段：UI 导入已切换到 `parsePackFromZipFile`，新导入流程使用 manifest 的 `modName` 作为资源命名空间，展示名称与版本不再由 Datapack 名称字段承担。
- M5-4 第一段：新增纯内存 `PackManager` 与 `StoredPack` / 快照模型；包库持久化尚未绑定 IndexedDB，启用集冲突检查已在管理层完成。
- M5-4 第二段：新增 `PackSnapshotStore` 契约与 `JsonPackSnapshotStore`，通过既有 `StorageAdapter` 持久化包库快照；IndexedDB 仍作为后续介质适配，不侵入包库领域逻辑。
- M5-4 第三段：新增 `PackApplyTarget`，PackManager 通过最小运行时端口应用有序启用集；应用顺序为先 `reload(datapacks)`，成功后清理并登记图片资源，避免包库直接依赖引擎实现。
- M5-4 第六段：PackManager 可注入 `PackSnapshotStore` 并自动持久化成功变更；当前浏览器入口使用异步 IndexedDB 快照适配器，JSON 适配器仍可用于同步/测试场景。
- M5-4 第七段：`PackApplyTarget` 增加可选预校验；Runtime 通过临时 Registry 验证整个启用集，验证成功后才 reload 与替换图片资源。
- M5-4 第八段：PackManager 提供只读依赖提示，依赖仍仅用于 UI 展示与排序参考，不参与启用集合法性判定。
- M5-4 第九段：新增异步 IndexedDB 快照适配器；不改变 PackManager 的同步逻辑接口，应用层可在启动时异步恢复包库。
- M5-4 第十段：AronaClickerRuntime 提供显式异步恢复/保存方法，异步存储生命周期由应用启动层控制。

## 相关文档

[[docs/docs-828/03-data-structures/registry]] · [[docs/docs-828/03-data-structures/id-reference-semantics]] · [[docs/docs-828/02-modules/pics]] · [[docs/docs-828/05-conventions/architecture-discipline]] · [[docs/plan-work/completed/affection-planning]]（affectionConfig 现单值设计，本 ADR §6 修订）
