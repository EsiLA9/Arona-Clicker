# Receipt 0320-U07

| 项 | 内容 |
| --- | --- |
| 状态 | 实施与定向验证完成；屏幕验收按用户指示跳过，需求单已交付 |
| 实际修改 | `src/arona-clicker/contracts/runtime/runtime.ts`、`src/arona-clicker/runtime/runtime-game-instance.ts` 增加 detached AG-1 Preview／Recent Commit sequence 投影与展示标签；`src/ui/components/map/map-workspace.ts`、`src/ui/flow/map-flow-model.ts` 按 Owner 序列呈现 Preview／Feed，并保留 E1 旧路径；`src/ui/css/map-workspace.css` 仅新增顺序摘要行距；扩展 Runtime integration、Map Workspace、Map Flow 定向测试；更新 `ui-style/patterns.md`；新增 U07 Unit 与 Receipt。 |
| 未完成内容 | 无代码或自动化验证遗留项。用户指示跳过浏览器屏幕验收；需求单已提供，不作为本阶段阻塞项。 |
| 屏幕验收 | 未执行，按用户指示跳过；需求单与逐项通过条件见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U07-screen-acceptance-report]]。该状态不代表人工验收通过。 |
| GALHCG 影响闭环 | 未修改图、未刷新或写 freshness；按 Task 0320 收尾统一核对 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 |
| --- | --- | --- |
| Runtime ReadModel | `npx vitest run --silent tests/engine/gameplay-b-map-runtime-integration.test.ts` | 通过，7/7；含 AG-1 Preview／Recent Commit、source/target CardRef scope freeze 与 detached 验证 |
| Workspace / Feed | `npx vitest run --silent tests/ui/gameplay-b-map-workspace.test.ts tests/ui/map-flow-adapter.test.ts` | 通过，50/50；覆盖执行顺序、目标与账本结果、PlayerCommand、敌方 Actor 资源、card target 解析／安全回退、空／缺失 sequence 和 E1 兼容 |
| 定向合跑 | `npx vitest run --silent tests/engine/gameplay-b-map-runtime-integration.test.ts tests/ui/gameplay-b-map-workspace.test.ts tests/ui/map-flow-adapter.test.ts` | 通过，57/57 |
| 类型检查 | `npx tsc --noEmit` | 通过，退出码 0 |
| 差异检查 | `git --no-pager diff --check` | 通过，无空白错误；Git 提示现有多文件换行符会在未来操作时转换 |

## DOM / 刷新草图

- 沿用三列 Map Frame、`talk-feed` 和 `commit-dock` 既有宿主，不增加 wrapper 或交互控件。
- AG-1 Commit Preview 在 Dock 的既有摘要位置输出 `executionSequence` 有序行；E1 沿用 effectTrace 摘要。
- AG-1 Recent Commit 在既有 requestId Feed 条目中按 `executionSequence` 有序输出；E1 保持分组式正文。
- 更新继续走 Map Workspace 区域 patch；保留 Frame、列、Feed 滚动宿主、有效按钮与范围外浮层。

## 实施摘要

- `executionSequence`、CardRef、target 和账本变化均由 Runtime 对 Owner Receipt/Preview 深复制并冻结；标签仅用于展示，不改变顺序或结算语义。
- Party 无 source CardRef 的来源显示为“指令”；Actor 资源支持 Character 或 Enemy 身份。卡牌目标按完整 CardRef scope 匹配当前 `view.cards`，匹配不到时显示“卡牌目标”，不显示不透明实例 ID。
- AG-1 sequence 缺失时显示不可用提示，空序列显示无已选来源；两者都不退回旧分组顺序。
