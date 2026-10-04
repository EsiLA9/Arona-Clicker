# Task：玩法 B 原型正确性修正

状态：done — 两项正确性修复与回归核验完成（2026-10-03）

## 目标

修正玩法 B 独立原型中与已确认规则矛盾的全队初始倒地处理，以及把有概率发现线索的第二次巡查固定描述为“没有新发现”的文本错误。

## 设计边界

- 本 Task 只修正原型实现与对应回归覆盖，不改变 Click 推进、活动检定概率、路线、战斗规则或数值。
- 全队 HP 均为 0 时应在构造初始 Route 后立即进入失败终态，不等待首次 Click，也不先执行场所入场招募或活动效果。
- Node 2 第二次活动的固定聊天文本应描述已记录的个人检定结果，不预断定线索发现成败。
- 明确非目标：AC 接入、体验调参、其他场所文本改写、UI 结构调整。

## 当前事实与代码落点

| 已核实事实 | 源码/测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| Route 构造会直接进入节点 0；HP=0 成员合法，但构造时未判断全员倒地 | `prototypes/gameplay-b/src/runtime.ts` 的 `cloneRouteCharacter`、`GameplayBRouteRuntime.constructor`；`tests/route-runtime.test.ts` | 在首次节点进入前检查初始队伍并发出失败终态事件 |
| Route 活动结算已有全队倒地立即结束逻辑 | `prototypes/gameplay-b/src/runtime.ts` 的 `resolveActivityClick` | 初始状态应遵循同一条全队倒地规则 |
| Node 2 第二次检定可随机成功，但固定聊天文本写“没有新发现” | `prototypes/gameplay-b/src/content/park-route.ts`、`src/content/texts.ts`、`tests/park-demo.test.ts` | 改为中性结果摘要并使用固定 seed 覆盖 |

## 施工切片

### Unit 0196-U1：全队初始倒地立即结束

#### Goal

在任何节点入场副作用执行前，令全员 HP 为 0 的初始队伍立即失败；加入回归测试。

#### Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 源码 | `prototypes/gameplay-b/src/runtime.ts`：`GameplayBRouteRuntime.constructor`、`finish`、`enterNode` | 找到安全的初始终态时点 |
| 测试 | `prototypes/gameplay-b/tests/route-runtime.test.ts`：Route Runtime core | 覆盖首次 Click 前终态及入场副作用顺序 |
| 任务索引 | `docs/plan-work/00-index.md` | 维护当前 Task 入口与最终状态 |

#### Allowed Files

- `prototypes/gameplay-b/src/runtime.ts`
- `prototypes/gameplay-b/tests/route-runtime.test.ts`
- `docs/plan-work/task-0196-gameplay-b-correctness-fixes.md`
- `docs/plan-work/00-index.md`

#### Explicit Non-goals

- 不拒绝 HP=0 的初始角色配置；其规则表现为立即失败。
- 不改变活动结算、战斗结算或可复起角色规则。

#### Stop Conditions

使用 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件的六项默认条件。

#### Completion Criteria

- [x] 全员 HP=0 时初始只读视图为 defeat / terminal，Click 数为 0。
- [x] 初始化不先执行节点入场招募或恢复；终态 Click 保持幂等。
- [x] 新回归测试及玩法 B 定向测试、类型检查通过。

#### Execution Receipt 0196-U1

- **状态：**完成。
- **实际修改：**`prototypes/gameplay-b/src/runtime.ts`、`prototypes/gameplay-b/tests/route-runtime.test.ts`。
- **结果：**构造初始队伍后、进入首个节点前检查全队 HP；若无人存活，立即追加 Route defeat 终态并返回。回归夹具首节点带有恢复效果及入场招募，确认它们均未执行；初始快照 Click 数为 0、`terminal=true`、`result=defeat`，只有一条终态事件，重复 Click 不改变快照。
- **验证：**`npm test -- tests/route-runtime.test.ts tests/park-demo.test.ts`（13/13）；`npm run typecheck`（通过）；原型全量 `npm test`（13 文件 / 111 项通过）。
- **未完成 / 问题 / 上游确认：**无。

#### Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | 在原型目录运行 `npm test -- tests/route-runtime.test.ts` | 全部通过 |
| 类型检查 | 在原型目录运行 `npm run typecheck` | 通过 |

### Unit 0196-U2：Node 2 第二次巡查文案与结果一致

#### Goal

将第二次巡查的聊天文案改为不预判随机检定结果，并用固定 seed 验证本轮确有成功结果时文案仍然准确。

#### Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 内容 | `prototypes/gameplay-b/src/content/texts.ts`：Node 2 `activity-click` | 定位固定聊天文案 |
| 测试 | `prototypes/gameplay-b/tests/park-demo.test.ts`：canonical route helpers | 以正式 seed 验证随机结果与中性文本 |
| 任务索引 | `docs/plan-work/00-index.md` | 维护当前 Task 入口与最终状态 |

#### Allowed Files

- `prototypes/gameplay-b/src/content/texts.ts`
- `prototypes/gameplay-b/tests/park-demo.test.ts`
- `docs/plan-work/task-0196-gameplay-b-correctness-fixes.md`
- `docs/plan-work/00-index.md`

#### Explicit Non-goals

- 不改变活动骰面、随机种子或 Node 2 路线结构。
- 不重写其他节点文本。

#### Stop Conditions

使用 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件的六项默认条件。

#### Completion Criteria

- [x] 第二次巡查文案对成功与失败检定均准确。
- [x] 固定 seed 回归确认本轮检定含成功时，活动结果仍照常记入日志。
- [x] `park-demo.test.ts` 与原型类型检查通过。

#### Execution Receipt 0196-U2

- **状态：**完成。
- **实际修改：**`prototypes/gameplay-b/src/content/texts.ts`、`prototypes/gameplay-b/tests/park-demo.test.ts`。
- **结果：**Node 2 第二次巡查文本改为“本轮各项检定结果已记入日志”，不再固定宣称没有发现。固定 seed `park-inspection-demo` 的第三次 Click 仍产生成功检定，测试同时核验中性摘要文本不与成功结果矛盾。
- **验证：**定向测试 13/13；全量测试 111/111；`npm run typecheck` 通过；`npm run build` 通过（Vite 8.3.2，22 个模块）。
- **未完成 / 问题 / 上游确认：**无。

#### Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | 在原型目录运行 `npm test -- tests/park-demo.test.ts` | 全部通过 |
| 类型检查 | 在原型目录运行 `npm run typecheck` | 通过 |

## 当前核验（2026-10-03）

- 两项错误均有定向回归覆盖；定向、全量测试、类型检查及独立构建均通过。

## 剩余工作

- 本 Task 已完成；归档前文档索引终态核验见 `docs/plan-work/00-index.md`。

## 相关路由

- [[draft-0181-click-turn-location-gameplay-b]]
- [[docs/ai/PROJECT-CONSTITUTION]]
