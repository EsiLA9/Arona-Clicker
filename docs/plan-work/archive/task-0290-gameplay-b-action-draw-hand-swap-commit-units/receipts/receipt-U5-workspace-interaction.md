# Receipt 0290-U5：Map Workspace 行为交互

**结果：实现、验证与独立只读复核完成；无阻塞问题。**

## 修改内容

- `MapRunService.previewEncounterCommit()` 与正式 `commitEncounterRound()` 现在共用纯 `resolveEncounterCommitPlan()`；预览返回可提交状态、PlayerCost 需求、诊断与 settlement，不写 MapRun、资源、draftVersion、Hand、RNG 或轮次。
- `MapRunEncounterCommitPreview` 只增加只读结果合同，没有添加运行时状态字段。
- GameInstance 组合 MapRun Owner 的 Prepared Action / Target、完整 Hand、PlayerCommand affordability、Commit Preview、资源余额与最近回执，生成冻结的 Workspace 投影。MapRunQuery 保持只读；正式 Swap、Command、Target、清除和 Commit 通过 Controller → GameCommands → GameInstance 窄 Facade → 私有 MapRun Owner。
- Map Workspace 展示全队完整 Hand、自然/当前 Prepared Action、目标、资源余额、单一共享 Override、Commit 可用性和最近结算结果。PlayerCost 或行动资源不足时依据 Runtime 投影禁用候选；Wait 作为状态文案展示，不创建伪造 Action。
- UI 采用现有 Map / Operation 卡片样式，保留键盘按钮语义、`aria-pressed`、焦点可见样式和窄屏换行。Map 行为命令通过既有 Map Workspace region refresh 更新；稳定 action key 恢复仍有效的焦点。Encounter 子区域局部刷新留给 U6。
- Controller 错误路径将过期草稿、非法目标、资源不足和共享槽冲突转换成可行动提示，并刷新当前 Map 投影；UI 不直接调用 MapRun Owner。

## 精确白名单

- `src/arona-clicker/runtime-game-instance.ts`
- `src/arona-clicker/contracts/map-run.ts`（只增加只读 Commit Preview 类型）
- `src/arona-clicker/services/map-run-service.ts`（只抽取并复用纯 Commit plan）
- `src/arona-clicker/contracts/runtime.ts`
- `src/arona-clicker/runtime-commands.ts`
- `src/ui/components/map-workspace.ts`
- `src/ui/controller-actions-operation.ts`
- `src/ui/css/map-workspace.css`
- `tests/ui/gameplay-b-map-workspace.test.ts`
- `tests/engine/gameplay-b-map-run.test.ts`

U5 未新增或修改白名单以外的源码、测试或 Schema 文件。

## 验证

- U5 定向验证：`npx vitest run tests/engine/gameplay-b-map-run.test.ts tests/ui/gameplay-b-map-workspace.test.ts --reporter=dot --silent`，**36/36** 通过（MapRun 28，Workspace 8）。
- Map / C1 / C2 联合回归：Registry 72、Map ID 2、Resolver 2、MapRun 28、Runtime Integration 4、Save / Resume 6、正常入口竖切 1、Workspace 8，**8 个文件、123/123** 通过。
- `npx tsc --noEmit` 通过。
- 白名单 `git diff --check` 无诊断；十个白名单文件的尾随空白扫描无匹配。
- `npm run check:docs`：Receipt 与状态更新写入后执行，876 篇 Markdown、0 错误。
- 独立只读复核：无阻塞问题。确认 UI 只读冻结投影、正式命令链与共享 Commit plan；目标和版本校验在 Owner 写入前执行，预览不推进抽牌 / RNG。复核指出清除 Override 或 Commit 后原控件消失时，焦点目前回到地图标题；U6 的局部刷新验收要求将失效焦点放在 Encounter 子区内。

## 关键行为证据

- 重复获取 Workspace View 后 Run snapshot 不变；投影包含每名固定队员的完整 Hand 与首项自然 Prepared。
- UI 交互经正式命令链覆盖 Swap、Target、清除共享 Override、手牌外 PlayerCommand、另一角色的 Target 和整轮 Commit；成功回执显示 PlayerCommand、目标与精确 `1 PlayerCost` 消耗。
- PlayerCost 不足时，Runtime affordability 与禁用按钮一致；无行动队员展示 Wait，且没有 Wait Action 按钮。
- Commit Preview 与 Commit 共用结算 plan；引擎测试验证 Preview 与 Commit 诊断一致、成本不足不写入、重复 Preview 不推进状态。

## 边界与后续

- U5 按总控明确的 Unit 分界使用现有 Map Workspace region refresh；未实现 U6 的 Encounter 子区域局部刷新。
- U6 负责 Encounter 子区域 DOM 连续性、失败/过期路径的端到端覆盖以及从正式 Datapack → Registry → Resolver → Spot 入口完成真实行动回合。
- C3 不加入 HP、Enemy、Ability 或 Item；这些由 C4 沿用同一 MapRun Commit 管线扩展。
