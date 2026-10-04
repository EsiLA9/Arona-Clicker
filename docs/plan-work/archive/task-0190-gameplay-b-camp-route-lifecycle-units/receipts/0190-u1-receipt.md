# Receipt 0190-U1

| 项 | 内容 |
| --- | --- |
| 状态 | 完成；活动结算切片先完成，路线内容切片在 Read Set 修订并加入两个直接内容源后续做完成。 |
| 实际修改 | 新增 `prototypes/gameplay-b/src/locations/activity.ts`、`prototypes/gameplay-b/src/content/short-route.ts`、`prototypes/gameplay-b/tests/location-activity.test.ts`；本文件记录两阶段 Receipt。 |
| 第一阶段：纯活动结算 | 新增 `resolveActivity()`、节点 6/7/10 活动规则；结果包含个人检定、HP delta、有序事件和最终全队归零判定。活动输入纯逻辑、不消费 RNG、不写状态。 |
| 继续阶段：短路线内容 | 按修订后的 Required/Optional Read Set 读取首战与技能/角色 ID；新增五节点顺序、节点 6 千世入场资料、节点 9 临时首战副本、节点 10 玲奈 fixture 及其 camp modifier。 |
| 未完成内容 | U1 完成标准均已覆盖。节点 9 战斗是明确标记的首战临时样例，0191 正式内容交付时替换；节点 10 仅作为 U3 玲奈/回复加成测试夹具，不在五节点路线中。 |
| 范围外变更 | 无。未修改 `model.ts`、`runtime.ts`、战斗准备、UI、包配置或 AC 文件。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 场所活动与路线内容 | `npm test -- location-activity.test.ts`（在 `prototypes/gameplay-b/`；Vitest 按文件名筛选 `prototypes/gameplay-b/tests/location-activity.test.ts`） | 通过 | 1 个测试文件、6 项通过；覆盖固定恢复后个人资格的 R10 暂定顺序、骰值顺序、HP 上限/下限、属性阈值、全队归零、节点 10 存活与倒地成员治疗、五节点顺序/角色 ID/临时遭遇标记及确定性/输入不变。最初测试运行暴露固定-only 活动错误要求骰值的问题，已修复并在后续两次运行中通过。 |
| 类型检查 | `npm run typecheck`（在 `prototypes/gameplay-b/`） | 通过 | `tsc --noEmit --project ./tsconfig.json` 无诊断。 |
| 接口与边界 | 对照 0187–0189 Receipt、首战/角色内容与 U1 白名单 | 通过 | 活动纯函数不消费 RNG、不写运行状态；五节点是静态调用方数据，活动度/入队写入/推进仍由 U2 Route Runtime 负责。节点 9 使用独立 ID `node-9-temporary-short-route-sample` 复用 `node-5-first-battle` 输入，标明由 Task 0191 替换。 |
| 根文档检查 | 根目录 `npm run check:docs` | 通过 | 538 篇 Markdown，0 errors；U1 命令使用 basename filter，避免把包内测试路径误解析为仓库根源码路径。 |

## 遇到问题

- 第一阶段首轮定向测试发现固定-only 活动会把已被固定恢复救起的成员当作必须提供骰值者；函数改为仅在活动配置个人检定时验证骰值输入，回归通过。
- 继续阶段依修订 Read Set 读取 `first-battle.ts` 的实际遭遇 ID 和 `characters.ts` 的 Chise/Reina skill actor ID。角色静态数据按 Draft 0182 填入短路线内容；R06/R10 暂定候选未写成用户确认规则，R07 全队活动后归零立即失败按用户确认边界处理。

## 需上游确认项

- 根目录 `npm run check:docs` 首次因 U1 命令中包内相对测试路径触发 R3；改为 Vitest basename filter 后再次检查通过（538 篇 Markdown，0 errors）。

## 事实更新建议

- `resolveActivity()` 只依赖显式队伍快照、固定活动规则和预抽骰值；全队失败判定基于最终 HP。`shortRouteNodes` 为五节点静态内容；节点 9 遭遇是临时样例，节点 10 是独立 U3 夹具。R10 固定恢复后个人检定资格及线索边界仍为原型暂定；本原型不更新 `docs/docs-829/` 当前机制事实。
