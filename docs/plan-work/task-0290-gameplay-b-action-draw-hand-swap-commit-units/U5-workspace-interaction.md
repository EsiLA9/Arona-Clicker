# U5：Map Workspace 行为交互

**状态：实现与验证完成，独立只读复核中 — U1–U4 已完成并通过独立复核**

## 目标

在 Map Workspace 中让玩家观察完整 Character Hand、每名角色的 Prepared Action / Target、全队共享 Override 与 Commit 结果，并通过正常 Datapack / Registry / Resolver / Spot 入口完成一轮真实交互。

## 允许改动文件

- `src/arona-clicker/runtime-game-instance.ts`
- `src/arona-clicker/contracts/map-run.ts`（只增加纯 Commit Preview 的只读结果类型；不加运行时状态字段）
- `src/arona-clicker/services/map-run-service.ts`（只可把 U4 Commit 预检抽成共享的纯计划函数，并新增复用同一预检的只读 Can Commit Preview；不得增写状态或另建结算规则）
- `src/arona-clicker/contracts/runtime.ts`（只增加 Map Workspace 所需的只读 Preview View 与正式命令类型）
- `src/arona-clicker/runtime-commands.ts`（只将正式命令转发到 GameInstance；不直接写 MapRun）
- `src/ui/components/map-workspace.ts`
- `src/ui/controller-actions-operation.ts`
- `src/ui/css/map-workspace.css`
- `tests/ui/gameplay-b-map-workspace.test.ts`
- `tests/engine/gameplay-b-map-run.test.ts`（验证纯 Commit Preview 与正式 Commit 共享规则且无状态写入）

若需改全局 UI Shell、路由或其它状态 Owner，交回总控评估。不得绕过 Controller / GameCommands 正式命令直接写 MapRun；GameInstance 仅允许向私有 MapRunService 添加窄转发，MapRunQuery 始终只读。

## Read Set

- Task 0290 UI 验收与其 DOM 草图、UI 状态只能只读投影的约束。
- U4 `commitEncounterRound` 的整队起始资源联合核验；UI Commit 状态必须由同一纯预检返回，不得在 UI / GameInstance 复算成本规则。
- `docs/ai/context-packs/ui-presentation.md` 和 `frontend-design` skill。
- 当前 `map-workspace.ts`、`controller-actions-operation.ts`、`map-workspace.css` 以及相近的 `operation-workspace.ts` 卡片信息层级。
- `GameCommands` / `runtime-commands.ts` 的命令适配模式；Map Workspace Preview 通过 GameInstance 组合 MapRun Owner 的只读 Preview 与内容定义，不从 UI 直接调用服务或 Registry。
- `tests/ui/gameplay-b-map-workspace.test.ts`、`gameplay-b-map-vertical-slice.test.ts`。

## 建议的紧凑界面结构

```text
Map Workspace（保留现有 Map 区域和返回按钮）
└─ Encounter region
   ├─ Encounter 标题 / 轮次 / 简短结果
   ├─ Party member section（每名角色一组）
   │  ├─ Prepared Action + Target
   │  └─ 完整 Hand（候选行动按钮，当前准备项有 selected 状态）
   ├─ 一个共享 Override summary（Swap 或 PlayerCost Command）
   └─ 费用 / 校验状态 + Commit 按钮
```

UI 从 Encounter View 投影拿内容，不自建 Action 文案副本或 RNG 状态。U5 通过既有 Map Workspace region refresh 更新投影，并保留地图导航、route shell、键盘焦点与用户当前滚动位置；U6 再把行动更新收窄到 Encounter 子区域。沿用现有 Map / Operation 卡片按钮样式，不引入新视觉方向、拖牌物理区或动画装饰。

## 完成条件

- [x] 玩家能看到所有角色的完整 Hand、Prepared Action / Target、可用余额与当前共享 Override。
- [x] Swap / Command / 清除草稿 / Commit 经 Controller 命令正常生效；UI 不以 Preview 或 View 刷新重抽。
- [x] 等待、候选不足、不可支付、非法目标、过期提交均显示可行动的明确反馈；禁用状态匹配 Runtime 校验。
- [x] Commit 可用性由与正式 Commit 共用的只读预检给出；重复预览不写资源、不推进 Hand / RNG、不改变草稿版本。
- [x] 键盘操作、焦点和窄屏布局可用；U6 再验证局部刷新连续性。
- [x] C1 / C2 相关 Map、Registry、Save / Resume 和 Workspace 目标测试通过。
- [ ] 非施工者进行 UI 组件与命令接线独立审查，无阻塞问题；Receipt 记录测试结果。

