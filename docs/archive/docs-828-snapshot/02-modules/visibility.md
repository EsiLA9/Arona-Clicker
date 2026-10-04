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
- **`RevealTarget`（5 种）**：`existence` 驱动动态可见性；`name` / `condition` / `utility` 属于 Information Reveal；`unlock` 属于实时可达性。
- `revealTriggers`：`{ reveal, condition? }` 声明。`get*Reveal`（UI tooltip-reveal 模块）仍按旧路径即时求值；新的 Information Reveal 域同时记录持久已知事实，尚未迁移 UI 消费者。
- `VisibilitySnapshot` 包含 `inits`、`areas`、`spots`、`enhancements`、`items`、`stories` 六类布尔掩码；故事入口当前按旧语义保持全可见。
- 类型权威：`src/engine/types/reveal.ts`。

## Information Reveal 并行路径

`src/arona-clicker/services/information-reveal-domain.ts` 从当前 Registry、Save Progress 与 active Init 推导目标状态和 Watch；`information-reveal-adapter.ts` 将 Watch 的精确唤醒源物化为可撤出的 Trigger Registration。事件只唤醒，完整 gate 始终由 ConditionSystem 重评；成功时经 StateMutationService 幂等提交 `informationRevealProgress`。一个 target 可由多条 gate 按 OR 揭示，`RevealStage` 仍只是表现投影。

首期 reactive 来源为 resource、spotLevel、hasReadStory、hasReadStoryInRun；stat、hasEnh、countTags 只在 admission/reconcile 求值。Init 完成、读档与内容更新显式 reconcile；定义卸载撤 Watch，不清 Save Progress。`initEntered` 早于默认 Area/Spot 建立，不能代替 post-admission 入口。

## 测试入口

`tests/engine/reveal.test.ts`、`spot-reveal.test.ts`、`entity-reveal.test.ts`、`character-availability.test.ts`；Information Reveal 见 `information-reveal-progress.test.ts`、`information-reveal-domain.test.ts`、`information-reveal-adapter.test.ts`、`information-reveal-lifecycle.test.ts`、`information-reveal-save-rebuild.test.ts`、`information-reveal-hot-content.test.ts`。

## 相关文档

[[docs/archive/docs-828-snapshot/03-data-structures/declarative-dsl]]（RevealStage/Target/AccessStage 枚举）
