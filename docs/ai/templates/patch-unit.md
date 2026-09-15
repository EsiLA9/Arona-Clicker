# Patch Unit 模板

> 用法：由高层 AI 填写，作为 Luna 的唯一施工入口。复制下方骨架即可，不要删节标题。
> 纪律依据：[[docs/ai/PROJECT-CONSTITUTION]]（Unit 预算、Allowed Files、Completion Criteria、停止条件）。
> 存放位置：默认内联在所属 Task 文档的小节中（`docs/plan-work/archive/task-*.md`）；单个 Task 超过 3 个 Unit 时才拆出 `docs/plan-work/archive/<task-id>-units/<unit-id>.md`。

## 骨架

```markdown
# Unit <task-id>-U<n>：<一句话目标>

## Goal
<本 Unit 要做成什么，一句话；不要写“顺便优化”>

## Must Read / Read Set
| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | docs/docs-828/... | ... |
| 源码 | src/...:Symbol | ... |
| 测试 | tests/... | ... |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | <例如 10k–30k token；包括文档、源码、测试和工具输出> |
| 文档 Read Set | <默认 3–8 篇；只列完成本 Unit 必需的文档> |
| 历史文档 | <默认 0 篇；必要时最多 1–2 篇并说明原因> |
| 超预算处理 | <超过 60k token 时拆分 Unit 或升级调查范围> |

## Optional Read Set

- <只有 Required Read Set 不足时才读取；不要作为默认上下文>

## Do Not Read by Default

- `docs/plan-work/archive/**`（除非本 Unit 明确需要追溯历史理由）
- <与本 Unit 无关的领域文档、源码目录或工具目录>

## Confirmed Facts
| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| ... | ... | 仅限已核实 |

## Constraints
- <必须遵守的边界；架构硬约束只给链接，不复述正文>

## Allowed Files
- <允许修改的文件；写入即白名单>

## Explicit Non-goals
- <明确不做的事，用于阻止范围扩张>

## Stop Conditions
<默认使用 PROJECT-CONSTITUTION §停止条件 的 6 条；如需收紧在此写明，不得放宽到不可判定>

## Completion Criteria
- [ ] <可验收的最小完成定义；这是最大边界，不是最低要求>

## Verification
| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | npx vitest run tests/... | 通过 |
| 类型检查 | npx tsc --noEmit | 无新增错误 |
| 人工验收 | <浏览器 / 文档核对项> | ... |
```

## 填写要求

- `Read Set` 只列完成本 Unit 必需的文档、文件与符号；不要把“可能相关”的都塞进去。
- `Context Budget` 统计文档、源码、测试和工具输出；256k 是容量上限，不是默认阅读目标。
- 超过 Unit 预算时先拆分或交回高层 AI，不得靠扩大 Read Set 继续堆上下文。
- `Confirmed Facts` 不得出现推测；未核实内容写成问题，而不是事实。
- `Allowed Files` 为空说明拆分失败，Unit 不能开工。
- `Completion Criteria` 未列出的相关工作不得顺手完成。
- `Verification` 必须可在本仓库执行；无法执行的验证要写成 Stop Condition，而不是省略。
- 超出 3–5 个文件或 300–500 行净改动时，先拆分 Unit，不要扩大预算。

## Pre-flight（Luna 开工前必须复述）

1. Goal；
2. Allowed Files；
3. Explicit Non-goals；
4. Stop Conditions。

复述后若发现与 `Read Set`、源码事实或本模板任一项冲突，按停止条件上报。
