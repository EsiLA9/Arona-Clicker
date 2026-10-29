# Task 0315 U07 Receipt：Save / Resume 恢复清理

状态：completed。

## 修改

- `src/arona-clicker/contracts/map/map-run.ts`：MapRun Ability / Item source option 删除旧 `hpEffects` 作者字段，保留 `declaredEffects` 摘要。
- `src/arona-clicker/runtime/runtime-game-instance.ts`：运行时 Action 与 source option 投影不再复制 `hpEffects` / `cardEffects`；Actorless source option 只接受 effectProgram 定义。
- `src/arona-clicker/services/map/map-run-service.ts`：Save / Resume 恢复只接受 effectProgram Action；删除旧 `hpEffects` 驱动的 Party / Enemy / Ability / Item HP settlement 重建与旧资源变化兼容路径。Receipt 的 effect trace、program locals、CardRef、sCost、Item 和 request replay 校验保留。
- `tests/engine/gameplay-b-effect-save-resume.test.ts`：将旧 team supplies fixture 改为 `effectProgram.resourceChange`，补充保存 Receipt 不携带旧作者字段的断言；保留 Save / Load、Receipt 破坏拒绝、Item/inventory 与 replay 行为。
- SaveData 顶层格式与既有 Map `resumeVersion` 比较逻辑未改变。旧 draft `override` 字段兼容与单 Encounter Node 表述属于独立 Save 兼容，不是旧 Action 数组执行路径，未涉及。

## 验证

- `npx vitest run tests/engine/gameplay-b-effect-save-resume.test.ts`：**1 file / 2 tests passed**。
- `git diff --check`：通过；仅有共享工作树其他文件的既有行尾提示，无 whitespace error。
