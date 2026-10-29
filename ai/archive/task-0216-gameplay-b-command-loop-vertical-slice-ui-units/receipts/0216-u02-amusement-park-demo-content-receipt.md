# Receipt 0216-U2：游乐园安全事件样例内容

## Outcome

已完成 Runtime 样例与 app composition 注入。事件只在 `base:init:schale_office` 下通过 app resolver 开始；通用 `GameInstance` 仍使用空 resolver。Runtime 规则、纯 ID 与 UI 静态文案拆成独立模块。

## Sample

- 事件 `demo:operation-event:carousel-safety-slice`，地点 `demo:operation-location:carousel-platform`，seed 17，危险轨道初始 3、范围 0–6，两 Beat试玩。
- 三名学生必须是玩家真实持有并解锁的星野、芹香、白子；另有两名对手与旋转木马环境目标。没有自动发放角色。
- 星野的 frontline-protection 只解锁紧急停机，常规制动仍可选；紧急停机消费 Actor stamina，芹香游客疏导消费 Team coordination。刹车与节奏信号可对同一目标组合。芹香随机技能只在提交后结算焦点值，不改变危险度结论。
- 静态展示文案与 Runtime action/event rules 分离；`OperationEventDef` 不包含本试玩的 Beat 上限/正式结局。presentation catalog 记载两 Beat 本地试玩判读，Runtime 不执行这个上限。
- app bootstrap 在调用自定义 resolver 前先核对 `activeInit`；自定义 resolver 也不能在其他 Init 覆盖同一 demo ID。

| 路线 | 第一次提交后危险度 | 第二次提交后危险度 | 结束时旋转木马耐久 |
| --- | ---: | ---: | ---: |
| 不干预 | 4 | 5 | 4 |
| 星野紧急停机 | 1 | 2 | 3 |
| 芹香疏导游客 | 3 | 4 | 4 |

危险度 3 或以下的本地判读只在 U4/U5 UI 展示；这是试玩用判读，不是 Operation formal Outcome。

## Verification

| 命令 | 结果 |
| --- | --- |
| `npx vitest run tests/engine/gameplay-b-operation-sample.test.ts tests/engine/gameplay-b-event-runtime-integration.test.ts --silent` | 通过，17 tests |
| `npx tsc --noEmit` | 通过 |
| `npm run check:architecture` | 通过 |
| `npm run check:docs` | 通过，637 Markdown、0 errors |
| `git diff --check` | 通过；仅显示工作树既有 CRLF 转换提示 |

## Limits / Follow-up

- 本 Unit 没有制作 UI 入口、dialog log 或结果卡；U4/U5 将消费独立 presentation catalog 并在中心聊天流中展示。
- 切换到其他 Init 时新建该样例 Run 会被 resolver 拒绝；Run 的现有易失 owner 生命周期未因本 Unit 改动，Operation Surface 仍须由 UI 按当前 Init 路由门控。
- 0215 归档仍等待 Task Owner 独立确认。
