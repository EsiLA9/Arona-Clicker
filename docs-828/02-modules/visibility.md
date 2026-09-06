# 02-modules/visibility — 可见性与 Reveal 揭示阶梯

> 一句话：`VisibilityEngine` 事件驱动维护实体显隐布尔掩码；Reveal 是「信息可知程度」的 7 级阶梯，与可见性（是否存在）分离。

## 职责边界

- **管**：inits/areas/spots 等实体的显隐快照、单点显隐判定、反向索引、新区域揭示。
- **不管**：信息遮挡的 UI 呈现（`src/ui/components/tooltip-reveal.ts` 消费阶段渲染 `???`）。

## 关键文件（`src/engine/visibility/`）

| 文件 | 职责 |
| --- | --- |
| `visibility-engine.ts` | 可见性快照：事件驱动增量维护（`rebuild()` / `recomputeAll()` 全量重建用于注册表加载和读档） |
| `visibility-eval.ts` | 单点显隐判定（`revealTriggers` 的 `existence` 目标） |
| `visibility-index.ts` | 反向索引（id → 显隐） |
| `reveal.ts` | 揭示/曝光（新进 Area 揭示） |

## 核心概念

- **两套阶梯，勿混淆**：
  - `RevealStage`（7 级，实体信息揭示）：`invisible → presence → partial → known → utility → purchaseable → owned`；
  - `AccessStage`（5 阶段，访问权限收窄）：`hidden → obfuscated → revealed → accessible → active`。
- **`RevealTarget`（5 种）**：`existence`（唯一被引擎直接消费的——驱动可见性）/ `name` / `condition` / `utility` / `unlock`（其余仅信息揭示，UI 按阶段遮挡）。
- `revealTriggers`：`{ target, condition }` 声明；`get*Reveal`（UI tooltip-reveal 模块）统一求值。
- `VisibilitySnapshot` 包含 `inits`、`areas`、`spots`、`enhancements`、`items`、`stories` 六类布尔掩码；故事入口当前按旧语义保持全可见。
- 类型权威：`src/engine/types/reveal.ts`。

## 测试入口

`tests/engine/reveal.test.ts`、`spot-reveal.test.ts`、`entity-reveal.test.ts`、`character-availability.test.ts`

## 相关文档

[[docs-828/03-data-structures/declarative-dsl]]（RevealStage/Target/AccessStage 枚举）
