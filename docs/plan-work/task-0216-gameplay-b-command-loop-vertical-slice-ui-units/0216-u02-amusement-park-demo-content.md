# Unit 0216-U2：游乐园安全事件样例内容

## Goal

创建一组职责独立的临时 TypeScript 样例定义，并仅从 AC app composition 注入 resolver，呈现游乐园设施安全事件的两 Beat 决策差异。

## Must Read / Read Set

- `docs/plan-work/task-0216-gameplay-b-command-loop-vertical-slice-ui.md`
- `docs/plan-work/task-0215-gameplay-b-prepared-actions-and-intervention-resolution.md`
- `src/arona-clicker/contracts/operation-content-resolver.ts`
- `src/arona-clicker/services/student-operation-profile-resolver.ts`
- `src/app/runtime-bootstrap.ts`
- `src/ui/main.ts`
- `tests/engine/gameplay-b-event-runtime-integration.test.ts`

## Confirmed Facts

- Runtime options 支持可选 `operationContentResolver`；GameInstance 默认内容为空。依据：`src/arona-clicker/runtime-game-instance.ts`。
- Operation profile admission 依赖实际拥有且解锁的 AC 角色，不会自动授予学生。依据：`src/arona-clicker/services/student-operation-profile-resolver.ts`。
- Task 0217 才定义正式 Objective/Outcome/finish；本切片第二 Beat 后只允许 UI 本地试玩判读。

## Allowed Files

- src/arona-clicker/content/operation-samples/carousel-safety-slice.ts (new file)
- src/arona-clicker/content/operation-samples/carousel-safety-ids.ts (new file; IDs only)
- src/arona-clicker/content/operation-samples/carousel-safety-copy.ts (new file; static presentation only)
- `src/app/runtime-bootstrap.ts`
- tests/engine/gameplay-b-operation-sample.test.ts (new file)
- `docs/plan-work/task-0216-gameplay-b-command-loop-vertical-slice-ui-units/receipts/0216-u02-amusement-park-demo-content-receipt.md`

## Constraints

- 事件 ID 为 `demo:operation-event:carousel-safety-slice`，地点为 `demo:operation-location:carousel-platform`；只在 `activeInit === 'base:init:schale_office'` 的 UI入口启用。
- 固定 seed 17，风险轨道起始 3、范围 0–6；presentation catalog 记载最多两 Beat 和 UI 本地安全判读，Runtime 本身不实施试玩上限；PlayerCost=0、卡区为空。
- 三名学生使用 Hoshino、Serika、Shiroko 的既有 profile admission；两个对手和一个游乐设施环境参与者；不得伪造玩家 roster。
- 至少保留两种互斥干预路径和无干预路径，并验证专属 Profile 能力影响一条合法方案；随机技能只能在 commit 后结算，且不决定安全判读。
- 样例 content 与 Runtime rules 分离：Runtime 只接受受信样例 resolver；UI 展示文案之后由 U4 消费静态 display catalog。

## Explicit Non-goals

- 不登记 default Datapack / Registry，不写 PlayerState/Snapshot，不增加 PlayerCost、玩家卡或 SceneAction。
- 不在本 Unit 创建正式 Objective/Outcome 机制。

## Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件。若现有任务事实与真实 operation content schema 不符，停止并调整样例，不绕过 contract。

## Completion Criteria

- [x] 不干预、Hoshino 紧急制动、Serika 疏导三条路线对设施状态/风险轨道给出可解释差异。
- [x] 同地点 brake + signal 标签组合可以观察到一次协同。
- [x] Profile admission 缺失真实学生时返回可显示的失败原因，不自动发角色。
- [x] app bootstrap 只在夏莱办公室为样例启用 resolver（包含显式 resolver 覆盖时）；直接构造默认 GameInstance 仍没有该样例。
- [x] Hoshino 专属能力只解锁紧急停机，缺失时仍可采用常规制动；固定 Seed 重复试玩复现相同技能成功结果。

## Verification

- `npx vitest run tests/engine/gameplay-b-operation-sample.test.ts tests/engine/gameplay-b-event-runtime-integration.test.ts`
- `npx tsc --noEmit`
- `npm run check:architecture`
