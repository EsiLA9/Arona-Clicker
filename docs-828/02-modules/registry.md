# 02-modules/registry — 数据包注册表与构建器

> 一句话：`Registry` 是数据包的**编译态容器**（表 + 关系索引 + 校验，恒只读）；`def-factory/` 是各实体的链式构建器。

## 职责边界

- **管**：加载期建表/建索引/引用校验、`nameOf` 统一显示名、有效 tag 查询。
- **不管**：运行时状态变化（全部落 `PlayerState`，Registry 恒只读，T6 后无写破口）。

## 关键文件

| 文件 | 职责 |
| --- | --- |
| `registry/registry.ts` | `Registry`：25+ 张 `Map<id, Def>` 表；**表驱动** `tableSteps` 清单统一 merge / clear（T6）；关系索引 `spotsOfArea` / `areasOfInit` / `tagsOf` / `tagIndex` / `nameOf`；`effectiveSpotTags(spotId, overrides)` / `spotsWithTag` 有效 tag 查询；`validateCharacterRefs` 跨表校验 |
| `registry/registry-validate.ts` | 加载期引用校验（世界结构、剧情、曲线、色彩、卡池成员等；覆盖面清单见 [[docs-828/03-data-structures/id-reference-semantics]]） |
| `def-factory/` | 基础机制与通用数据 builder（init/spot/area/enhancement/item/story/story-entry/talklet/gacha-pool/cultivate-curve/color-group/color-equipment/chat-message/passive-pool/affector-pack/trigger/drop-table/expr/condition/extra/reveal/resource/chara-profile），经 `def-factory/index.ts` 聚合导出；角色/角色变体 builder 已归入 `src/arona-clicker/content/def-factory/` |

## 核心概念

- **构建一次、运行只读**：只在 `init(datapacks)` 时构建；校验失败即抛错（缺引用 / 重复 ID / 非法枚举）。
- **表驱动扩展**（T6）：新增一张表 = 私有字段 + getter + `tableSteps` 一条 step（原 4 处手工同步）。
- **同 id 覆盖语义**：多数据包同表同 id 后加载优先；`storyEntries` 合并视图同 id 时 passive 静默覆盖 active（注意避坑，见 [[docs-828/03-data-structures/id-reference-semantics]]）。
- 构建完成后由 Runtime 继续执行角色引用、Tag 引用、可见性与产出树等后处理；Registry 本身不发 `registry:built` 事件。

## 测试入口

`tests/engine/registry.test.ts`、`tests/engine/def-factory/*.test.ts`（13 个）

## 相关文档

[[docs-828/03-data-structures/registry]]（表与索引细节）· [[docs-828/05-conventions/schema-sync]]（改实体字段必须跑的协议）
