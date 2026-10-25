# Receipt 0326-S2 — MapRun保存绑定与严格恢复

> Parent Task: [[docs/plan-work/archive/task-0326-variant-translation-real-card-workspace]]
> Unit: [[docs/plan-work/archive/task-0326-units/task-0326-s2]]

- **结果**：完成。MapRun 保存 helper 把 stage snapshots 与 runId、保存时完整 JSON MapRun 的 canonical consistency 一同写入 `scenario`；restore 对来源顺序、模板、Init、Run、当前节点与来源构筑作严格检查，再逐份调用既有 translation `restore`。restore 返回不带旧 run proof 的 core binding，后续 commit 后再存档及 restart 可重新绑定新的 Run 进度。
- **验证**：`npx vitest run tests/engine/variant-training-scenario.test.ts` 5 tests 通过，覆盖恢复后 Commit→再次保存→再次恢复、重启并保留三份冻结构筑、未知字段/访问器、模板版本、Init、顺序、跨来源和跨 Run 拼接；`npx tsc --noEmit` 通过。
- **只读审查 stage_engine**：MapRun 的 start/move、AG-1/E1 结算与预览、workspace HP cap、active Encounter 与 last receipt restore 均按当前 Node 派生 setup；新 setup 清空旧 receipt/status 并重置各项局内初值；重访/restore 不重放 setup。未发现本场景的 cap 或保存恢复遗漏。
- **待上游确认**：partySetup生成Schema已由主Agent同步。Registry仍未校验该字段；本Task禁止修改Registry，当前仅由可信动态场景生成使用。若后续开放静态Datapack作者配置，另开校验工作。
