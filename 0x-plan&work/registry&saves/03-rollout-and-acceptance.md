# 施工路线与验收矩阵

## 阶段

| 阶段 | 交付 | 状态 |
| --- | --- | --- |
| R0 | 记录当前基线；修正 roadmap 与代码事实；冻结 ID/存档字段清单 | 待开始 |
| R1 | S1c Character / Variant 命名空间化；全量 ID 校验 | 待开始 |
| R2 | PackSource 完整化；manifest、hash、原始来源快照 | 部分已有 |
| R3 | `validateDatapackSet`；跨包合并、全局重复、跨包引用、dry-run 回滚 | 部分已有 |
| R4 | PackManager 启用集恢复与 Runtime 启动接线；默认包仅首次默认值 | 部分已有 |
| R5 | Save residue 模型、过滤器、重建流程 | 进行中（TagOverride/TagEffect retained、按 mod 清除已接入） |
| R6 | 残留报告与按 mod 清除；取消导入清档 | 未开始 |
| R7 | affectionConfig、Tag、extras 多包连带机制；Tag 采用根命名空间 + 显式 parent | Tag 子项完成；affectionConfig/extras 仍按总路线维护 |
| R8 | 文件夹/单文件导入、包库完整 UI、文档收束 | 未开始 |

## 依赖顺序

```text
R1 → R2 → R3 → R4
                 ↘
                   R5 → R6
R1 ───────────────→ R7
R4 + R6 ──────────→ R8
```

## 每阶段统一验收

- `npm test` 全量通过。
- `npx tsc --noEmit` 通过。
- `npm run check:architecture` 通过。
- 若改动 `src/engine/types/`，执行 `npm run gen:schema` 并通过同步测试。
- 新增行为必须有失败路径测试；涉及运行时应用必须验证旧状态保持。
- 完成后更新本文件状态、ADR 实现记录和 `0x-plan&work/00-index`，不在多个文档复制机制正文。

## 测试矩阵

| 领域 | 最小测试组 |
| --- | --- |
| ID | 格式、typeName、modName 归属、包内重复、跨包完整 ID 重复 |
| Registry | 跨包引用、悬空引用、顺序、dry-run all-or-nothing、索引清理 |
| Pack | ZIP/文件夹/单文件一致性、manifest、hash、快照恢复、mod 冲突 |
| Save | 所有 ID map/array、per-Init/global、游标、未知实体保留与复活 |
| Residue | 按 mod 统计、清除隔离、空残留、损坏 DTO 安全降级 |
| 连带机制 | affectionConfig、TagRef/TagDef、显式 Tag parent、extras、图片命名空间 |
| UI | 包库恢复、导入不清档、应用失败提示、残留检查和确认清除 |

## 第一批施工任务

1. 完成 R0：列出 `PlayerState` / `InitSnapshot` 全字段的实体归属和存档策略。
2. 完成 R1：迁移 Character / Variant ID，并补 Registry 强校验。
3. 完成 R3：把逐包校验收束为启用集统一校验，补跨包测试。
4. 完成 R4：修复 UI 启动恢复顺序和默认包覆盖问题。
5. R5 已完成 TagOverride retained DTO 与 Runtime 分流；下一步扩展到实体 map/array、scalar ref 和 per-Init 快照。

## Tag 工程已落地切片

- `TagRef` 解析、构造、命名空间匹配与层级祖先语义集中在 `src/engine/core/tag.ts`。
- Registry 对 TagDef 的完整键、显式 parent、循环保护和跨包校验统一处理。
- Datapack 输入层 `TagDef` 与 Registry 内部 `ResolvedTagDef` 分离；入库后的 `id/parent` 均为完整 branded `TagRef`。
- 显式 parent 已在校验阶段进行 DFS 环检测；循环不会被仅作为运行时遍历保护而静默吞掉。
- 所有实体声明 Tag 与 Affector Tag 目标均经过统一 TagPath/TagRef 格式校验。
- TagDef 重复检查按 canonical TagRef 执行：同包覆盖保留分层语义，跨 namespace 冲突直接失败。
- 内容层继续保留 `TagPath[]` 形状；Registry 记录实体所属 datapack，避免裸路径因加载顺序漂移。
- Spot 展示查询提供带实体上下文的 Tag 名称/描述解析，避免 UI 受最后加载包影响。
- Spot 查询、条件、GameNum、TagStat、动态 Tag 覆盖和 Save retained 使用同一命名空间键规则。
- 编辑器 Tag 引用校验支持完整 `modName:tagPath`，并拒绝非法 TagRef 格式。
- 编辑器 `tags` 表对 `id/parent` 执行同一 TagRef 格式校验，裸 id 仅作为当前包 namespace 的输入简写。
- Affector 的裸 `modTag` 以 Affector pack ID 的命名空间为默认归属；无命名空间的旧内置 pack 归入 `base`。
- Enhancement 挂靠的 Affector Tag 目标同样先按 pack namespace 规范化，再参与 Spot 功能匹配。
