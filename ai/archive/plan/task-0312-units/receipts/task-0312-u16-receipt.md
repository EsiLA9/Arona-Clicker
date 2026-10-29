# Receipt 0312-U16

| 项 | 内容 |
| --- | --- |
| 状态 | U16 Workspace / Flow 呈现与定向验证完成；不代表 U18 浏览器验收、U19 文档与 GALHCG 统一收尾或完整 E1 发布验收完成。 |
| 实际修改 | 修改 `src/ui/components/map/map-workspace.ts`、`src/ui/flow/map-flow-model.ts` 与既有 `tests/ui/map-flow-adapter.test.ts`；新增 `tests/ui/gameplay-b-effect-workspace.test.ts` 及本 Receipt。未修改 CSS、token、全局刷新控制器或生成文件。 |
| 未完成内容 | 本 Unit 的实现与定向验证无未完成项。宽屏真实浏览器检查留 U18；U19 文档和 GALHCG 统一复核仍待执行。 |
| 范围外变更 | 无；仅 U16 白名单。未扩大到 E2–E5、全局刷新系统或其它 UI。 |
| GALHCG 影响闭环 | 项目身份 `acprogram`；影响累计至 U19 统一只读复核。本 Unit 未编辑图、刷新或写 freshness。 |

## 实际呈现

- Workspace 角色行动、Ability、Item 与敌方当前行动的既有摘要展示 E1 声明效果。分支带条件描述并标为“声明”；不展示 `effectPath`，不由 UI 判断条件真假。
- 右栏活动进度复用既有 `activity-progress` 区域展示完成条件声明与 ReadModel 当前 Counter / Flag 值。无完成条件声明时不自行推导真假。
- 提交操作区在 Owner Preview 可提交时展示实际条件结果、HP / 资源变化、Counter / Flag 前后值及 sCost 费用；变化 `0` 保留。不可提交时保留原诊断，不渲染不完整预览结果。
- Flow 现有 Commit 行消费 ReadModel 最近回执与持久 Receipt 两条路径，展示实际条件读取与分支、Counter / Flag 变化、Party / Enemy / Ability / Item 资源与 HP 结果。Ability / Item 的资源变化已纳入正文；活动范围以 Receipt 原 node/activity 标记，跨活动时显示原活动回执。
- 更新仅使用原有 Workspace 区域、卡片摘要和 Flow 条目，不新增 Workspace、滚动壳、弹窗、按钮、CSS/token 或全局调度。

## 行为覆盖与 ID 映射

| 映射 | 本 Unit 证据 |
| --- | --- |
| OLD01 | 既有 Workspace 三列、卡片、操作区和 Flow 结算行回归保持；`gameplay-b-map-workspace.test.ts` 的稳定布局、滚动与实际提交用例通过。 |
| NEW01 | 声明摘要显示 then/else 条件语义，预览与 Flow 分别从 Owner Preview / Receipt 显示本次实际分支；测试确认 `effectPath` 不进入玩家文本。 |
| NEW03 / NEW04 | DOM 用例核对 ReadModel 当前 Counter / Flag、Owner Preview 的 Counter 饱和值 `delta=0`、Flag 更新和 HP 饱和零变化；重复渲染与 hover 不修改提供的 ReadModel View。既有 Workspace 集成回归验证真实 Commit 后的面板更新。 |
| EQ05 / D07–D08 | `map-flow-adapter.test.ts` 对 ReadModel `recentCommit` 与持久 Receipt 两条路径核对来源、条件读取、Counter / Flag、Ability / Item 资源与 HP、原 activity scope，并确认重复刷新不重复 Commit 行。 |
| E1-COMPAT-1 | UI 只格式化 Owner 提供的声明、预览、Trace 与 Receipt；不执行 Guard、不修改 Owner 状态。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向行为 | `npx vitest run tests/ui/gameplay-b-effect-workspace.test.ts tests/ui/map-flow-adapter.test.ts tests/ui/gameplay-b-map-workspace.test.ts` | 通过，3 files / 44 tests，退出码 0。 |  |
| 类型 | `npx tsc --noEmit` | 通过，退出码 0。 |  |
| 范围 / 空白 | `git diff --check`；检查新增测试文件尾随空白 | 通过；无空白问题。 | Git 提示三份既有 CRLF 文件下次触及时会规范为 LF；没有新增整文件行尾变更。 |
| 文档 | `npm run check:docs` | 通过，扫描 1134 份 Markdown，errors=0，退出码 0。 |  |

## 未完成验收与风险

- 宽屏鼠标实机浏览器验收明确留给 U18；本 Unit 以三组定向 DOM / Flow 回归、类型检查和差异检查验收。
- 当前刷新基础设施满足本 Unit 的组件与 Flow 更新范围；本 Unit 未修改全局 controller / patcher，也未增加第二套调度。

## 需上游确认项

- 无。
