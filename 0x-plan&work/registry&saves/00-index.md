# Registry & Save — 多 Datapack 支持计划

> 本目录是 Registry、Datapack 启用集与多包存档语义的施工计划入口。
> 设计裁定继续以 [[0x-plan&work/active/adr-0004-datapack-management]] 为准；本目录负责把裁定拆成可验收的 Registry / Save 工作包。

## 目标

在不破坏“Registry 只读编译态、PlayerState 三层状态、StateMutationService 单一写入口”的前提下，实现：

1. 任意多个 Datapack 可被解析、校验、排序和启用。
2. 跨包引用在完整启用集上统一校验，失败时保持旧运行时不变。
3. 同一存档可在 Datapack 启用集变化后继续读取。
4. Registry 不存在的存档实体惰性保留，不参与运行；重新启用后自动复活。
5. 玩家可以查看并按 mod 清除存档残留。

## 文档分工

| 文档 | 内容 |
| --- | --- |
| [[01-registry-plan]] | Registry 编译、命名空间、跨包合并、引用校验与启用集应用 |
| [[02-save-plan]] | 存档 DTO、三层状态、惰性保留、残留清理与读档安全 |
| [[03-rollout-and-acceptance]] | 施工阶段、依赖关系、测试矩阵与完成判定 |

## 当前基线

- 已有：大部分三段式 ID 校验、ZIP/manifest/分片解析、PackManager、包库快照、基础包管理 UI。
- 未完成：Character / Variant 命名空间化、文件夹/单文件 Source、跨包统一校验、惰性存档、残留管理、affectionConfig 与 Tag 多包化。
- Tag 设定已裁定：不增加独立 Tag `modName` 字段；TagRef 使用 `modName:tagPath`，命名空间位于根部，子路径继承命名空间。
- 已知接线问题：UI 启动恢复包库快照后仍无条件加载默认包；导入数据包仍会删除旧存档。两项属于 P0。
- 项目纪律：不编写存档迁移；旧 DTO 不兼容时允许清档重来，但同一版本内缺失可选字段必须安全降级。

## 总体数据流

```text
PackSource → PackParser → PackManager 包库/启用集
                              ↓ 有序 Datapack[]
                   Registry dry-run → 正式 Registry
                              ↓
             SaveLoader 按 Registry 过滤“活跃视图”
                              ↓
              PlayerState + retained residue 原样保留
                              ↓
                   Runtime / GameView / UI
```
