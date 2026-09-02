# 08-roadmap/0001-datapack-management-rollout — Datapack 多包管理落地（S1-S7）

> 本文回答：多包管理这一长期目标的切片拆解、当前进度与验收口径。设计权威：[[0x-plan&work/active/adr-0004-datapack-management]]（裁定与实现记录，本文不重复设计，只做状态追踪）。

## 目标陈述

引擎支持任意多 Datapack 并存：三段式 id 命名空间（`modName:typeName:idName`）、Source → Pack → PackManager 分层、包库与启用集（IndexedDB 包库 / 玩家启停 / 手动排序 / modName 冲突拒绝）、惰性存档（切 mod 不丢档、残留可查可清）、mod 管理 UI。`base` 仅表示当前测试/示例包的命名空间，不是引擎恒启用的生产基底；具体应用内容由入口显式选择。

## 里程碑切片

| 切片 | 内容 | 状态 |
| --- | --- | --- |
| S1a | 语义组中段归位 + id 校验基建（`ENTITY_TYPES` / `validateEntityId` / `checkEntityIds` 16 表强校验） | ✅ 2026-08-30 |
| S1b | Story entry id 拆分（本体 / 投放位分表，story 三表收紧强校验） | ✅ 2026-08-30 |
| S1c | Character / VariantId 命名空间化（`base:character:*` / `base:variant:*`），完成后 characters/characterVariants 收紧强校验 | 待用户 review 方案 |
| S2 | Source 适配器：`PackSource`（file / folder / zip）统一条目集，`zip-loader.ts` 降级为第 1 层解析器 | 未开始 |
| S3 | manifest（`datapack.json`，v1 强制）+ 分片解析器按扩展名注册 | 未开始 |
| S4 | PackManager：IndexedDB 包库 / 导入并存 / 启停 / 手动排序 / modName 冲突与全量干跑校验 / `game.reload` 接线 | 未开始 |
| S5 | 惰性存档：加载期存在性过滤 + 残留检查/清除界面 | 未开始 |
| S6 | 连带机制：affectionConfigId 特化表 / extras 置空冻结 / 标签子叶命名空间化（可与 S1 并行） | 未开始 |
| S7 | mod 管理 UI：包库列表 / 导入 / 启停排序 / 依赖提示 / 残留管理 | 未开始 |

切片内容以 ADR §8 实现切片为准；各切片完成后的实现记录写入 ADR §8，本文只更新状态列。

### S1c 摘要（下一步，方案待 review）

- **现状**：`src/engine/types/ids.ts` 的 `Character` 枚举值为裸名（`'hoshino'`，None='none'）；默认差分 id = 原型名首字母大写（`character-rework.ts:67` 派生 `Arona` / `HoshinoSwimsuit`）。
- **波及面**：`owner('Hoshino')` 等字符串引用、`ConditionTarget` affectionLevel key、gacha featured/members、roster 存档键（VariantId）、`proto` 字段、tests 大量字面量。
- **目标**：测试包中的 `base:character:hoshino` / `base:variant:*`；完成后 registry-validate 收紧 characters/characterVariants 强校验（参照 S1b 收尾方式）。
- **建议做法**：与 S1a/b 相同——先摸底 Character 枚举值 / VariantId 的全部引用形态 → codemod（枚举值本身 + 字符串字面量引用）→ 收紧校验 → 全绿。

## 用户已裁定的关键决策（速记；权威口径见 ADR §2-§6）

1. id 三段式 `modName:typeName:idName`；包内 id 必须属于本 modName；typeName = 游戏类型枚举（存档判别用）。
2. 跨包自由引用 + 事后校验；依赖仅提示；手动排序。
3. 同 modName 包在包库并存、玩家启停；启用集内 modName 冲突拒绝加载。
4. 惰性存档：查不到的存档数据不加载不索引但保留，重新启用复活；残留可检查可清除。
5. affectionConfig 特化表化（角色级 `affectionConfigId`）；extras 置空冻结；标签子叶带 `modName:idName` 跨包挂靠。
6. 导入任意包统一显示由玩家启停（无自动替换 / 弹窗）。

## 引用语义分界

S1b 拆分后的 entry id / story id 引用语义权威口径见 [[0x-plan&work/active/adr-0004-datapack-management]] §8 表格，此处不复制（防双源漂移）。

## 验收口径

- 每切片：`npm test` 全量绿 + `npx tsc --noEmit` 通过 + 用户逐片 review（动手前先给改动清单与裁定点，不跳步合并实施）。
- 改 `src/engine/types/` 字段后跑 `npm run gen:schema`（S1a/b 未改 types 字段，未跑）。

## 操作备忘

- zip 是打包产物：`datapack/*.json` 改后跑 `node scripts/pack-arona-clicker-core.mjs`。
- 大批量 id 改名走一次性 codemod，用完即删（`scripts/` 现存 `_fix*/_refactor*` 为历史遗留，非本目标产物）。
- S1b 连带修复：`init-service.ts` 的 startStoryId 完结守卫、`ui/components/story-gate.ts` 的标题/奖励/完结解析，均已改为按 `entry.storyId` 正向解析。

## 进度记录（append-only）

- 2026-08-30：S1a + S1b 落地，`npm test` 995/995 全绿，`npx tsc --noEmit` 通过；改动未 commit（遵循"用户未要求不提交"）。
- 2026-08-30：本文由会话交接稿 `handoff2.md` 迁移建立（交接稿删除，防双源漂移）；建立 [[0x-plan&work]] 分区。
