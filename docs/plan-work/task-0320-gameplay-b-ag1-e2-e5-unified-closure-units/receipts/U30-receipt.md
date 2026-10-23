# U30 实施回执

日期：2026-10-23

## 交付内容

- `GameplayMapStatusDef` 增加可选 `lifetime: 'encounter' | 'mapRun'`；生成 Schema 同步并由 Schema 回归确认。
- MapRun 新增唯一 `mapRunStatuses` Owner 与来源 Node/Activity、首次应用 Commit 版本和跨 Encounter tick 版本。活动 Encounter 将本地与持久状态按稳定顺序只读合并，Commit 后按定义寿命分区安装。
- MapRun-lifetime Status 仅允许满足合同的 Party Action 来源和 Party holder。恢复时重新验证 Status 定义、来源资格、双 Owner 分区、tick/expiry Trace、Receipt 和 scheduler 起点；Shop gap 的 Run 状态与最近 v7 Receipt 对账。
- 含 MapRun Status 的 Map 使用 scheduler v7 / Status Receipt v7。旧 Status Receipt v1–v6、scheduler v5/v6 与 E1/legacy v1 路径保留。
- 修复首 Commit 起始版本为 0 时被 Status tick guard 拒绝的问题；修复未经过 Planner Exit 清理的成功路径仍在返回快照中保留 MapRun Status 的问题。
- 注册正式 Map `gameplay-b:map:maprun-status-example` 与宽屏屏幕验收需求单；样例演示三次跨遭遇减伤 tick、Shop gap Save/Resume、自然到期、第四次完整伤害与成功 Exit 清理。

## 验证结果

- `npx vitest run --silent tests/engine/gameplay-b-maprun-status-example.test.ts`：3 tests passed。覆盖 Registry、Origin、创建 Commit 不 tick、Shop gap Save/Resume、购买/离店不 tick、Origin 篡改拒绝、后续 Encounter 减伤、自然到期、到期后完整伤害、成功 Exit 清理与失败终局清理。
- `npx vitest run --silent tests/engine/gameplay-b-map-runtime-integration.test.ts`：8 tests passed；新增断言确认活动 Encounter ReadModel 合并 MapRun Status，并且持久 Owner 未复制进 `activeEncounter.statuses`。
- `npx vitest run --silent tests/engine/gameplay-b-maprun-status-example.test.ts tests/engine/gameplay-b-map-runtime-integration.test.ts tests/engine/gameplay-b-map-run.test.ts tests/engine/gameplay-b-map-save-resume.test.ts tests/engine/gameplay-b-map-ag1-restore.test.ts tests/engine/gameplay-b-effect-lifecycle.test.ts tests/engine/gameplay-b-effect-save-resume.test.ts tests/engine/gameplay-b-effect-program-commit.test.ts tests/engine/gameplay-b-effect-receipt.test.ts`：9 files / 206 tests passed。
- `npx vitest run --silent tools/datapack-editor/schema/engine-schema.sync.test.ts tests/data/gameplay-b-effect-syntax.test.ts tests/data/gameplay-b-effect-registry.test.ts tests/data/gameplay-b-map-registry.test.ts`：4 files / 254 tests passed；全 Map Registry 186/186，Schema sync 15/15。
- `npm run gen:schema`：成功。
- `npx tsc --noEmit --pretty false`：通过。
- `npm run check:architecture`：通过。
- `npm run check:docs`：通过；本回执加入链接路由后重跑。
- `git diff --check`：通过。

## 人工验收

宽屏浏览器验收尚未执行。操作步骤、复制命令和结果记录字段见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U30-screen-acceptance-report]]；自动化验证不代表人工验收通过。
