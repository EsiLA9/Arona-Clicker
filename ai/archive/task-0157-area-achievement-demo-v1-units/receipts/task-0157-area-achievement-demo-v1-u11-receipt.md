# Execution Receipt：Task 0157 U11

日期：2026-09-26

## 结果

- 新增独立 `area-achievement-demo` 数据包，依赖 `base`；世界分片的 `name`、`version` 与 manifest 一致。
- 示例含 1 个 Init、起初双向相邻且可达的 2 个 Area，以及默认持续产出基础信用点的设施。
- 初始 Area 的资源目标使用 `$InitProducedAmount <initId> base:resource:credit`；第二 Area 的物品目标使用 `$InitCollectedAmount <initId> <itemId>`。第二 Area 每次进入发放一枚档案片。
- 两个 Achievement 分属各自 Area。测试确认第二 Area 首访前不可见且没有对应 Watch；到访后准入。两个测试顺序分别验证先产出、先收集都能独立完成；奖励各只到账一次，读档与返回不重放。
- 初测发现资源门槛为 3 时，档案片奖励到账也会使资源目标完成。为保留两条目标的独立玩法顺序，将资源门槛设为 6，并增加“无生产 tick 先完成物品目标”的运行时断言。另将 Listener ID 修正为规范的 `milestone-listener` 类型段。

## 验证

| 命令 | 结果 |
| --- | --- |
| `npx vitest run tests/data/area-achievement-demo.test.ts` | 通过；1 个文件、2 项测试通过 |
| `npx tsc --noEmit` | 通过；无输出 |
| `npm run check:docs` | Receipt 写入后复核通过；errors: 0，scanned markdown: 327 |

## 范围

- 仅新增 U11 Allowed Files 中的三个 JSON、定向测试与本 Receipt；没有修改引擎、基础内容或先前机制测试。
