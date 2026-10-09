# Unit 0241-U12：SceneAction 准入与角色战术候选分离

## Goal

修复旋转木马试玩启动时 `playerSceneDeck.cards[0]` 找不到合格 student Action user 的回归。SceneAction / 共享场景牌的执行资格不得依赖角色战术 `eligibleActionIds` / Character Hand 候选；同时必须保持首幕三张 SceneAction 不进入角色战术 Hand。

## Evidence / Read Set

- `src/arona-clicker/services/operation-action-content-validation.ts`：Registry / Admission 场景行动与目标资格检查。
- `src/arona-clicker/content/operation-samples/carousel-scene-action-slice.ts`：首幕候选卡清理，需保持。
- `tests/engine/gameplay-b-operation-sample.test.ts`：现有 Carousel start、SceneAction 与玩家牌组集成验证。
- `tests/engine/operation-card-candidate-resolver.test.ts`、`tests/engine/operation-plan-preparation.test.ts`：Hand 是角色战术候选和默认准备行动的权威。

## Constraints

- 不恢复把 carousel SceneAction ID 追加到学生 `candidateActionIds` / `actionPriorityIds` 的旧注入；否则三张 SceneAction 会再度作为额外角色战术卡出现。
- 不修改 UI、Quick Test Console、Datapack/Editor、通用 Engine、Operation Hand 抽取规则或 Director U10/U11 文件。
- 只可按下列白名单改动；若必须扩大边界，停止并交 Task Owner。
- 旧样例测试中“noIntervention”如果在新 Hand 下实际采用了默认战术行动，应改为明确断言新语义（首张合法 Hand action 被采用及其结果），不得删掉行为覆盖或降低断言强度。

## Allowed Files

- `src/arona-clicker/services/operation-action-content-validation.ts`
- `tests/engine/gameplay-b-operation-sample.test.ts`
- `docs/plan-work/archive/task-0241-units/receipts/receipt-0241-u12-scene-action-admission-separation.md`

## Completion Criteria

- [ ] Operation sample 在不授予 SceneAction 战术候选资格时可正常启动。
- [ ] 首幕每名学生 Character Hand 不含旋转木马 investigate / guide / treatTeam 三张 SceneAction。
- [ ] 在合法地点与目标下，共享玩家牌组的 team-first-aid 能列出合法执行角色并可提交结算；地点变化后可重新呈现合法性。
- [ ] 旧默认行动样例依据新 Hand 规则表达真实语义，不弱化检查。
- [ ] 未改 U10/U11、UI、Datapack 内容或更广的 Runtime 范围。

## Verification

- `npx vitest run tests/engine/gameplay-b-operation-sample.test.ts --reporter=dot`
- `npx vitest run tests/ui/gameplay-b-operation-controller.test.ts tests/ui/gameplay-b-card-inspector.test.ts --reporter=dot`
- `npx tsc --noEmit`
- `git diff --check`

## Receipt

`docs/plan-work/archive/task-0241-units/receipts/receipt-0241-u12-scene-action-admission-separation.md`
