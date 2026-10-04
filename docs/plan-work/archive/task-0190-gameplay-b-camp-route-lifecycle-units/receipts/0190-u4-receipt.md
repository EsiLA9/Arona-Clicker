# Receipt 0190-U4

| 项 | 内容 |
| --- | --- |
| 状态 | 页面接线、首屏可见性修正、自动验证与 1280×720 浏览器短路线 smoke 均完成。 |
| 实际修改 | `prototypes/gameplay-b/src/main.ts` 切换为 Route Runtime 与 U1 短路线内容；`prototypes/gameplay-b/src/view.ts` 新增 RouteView 页面，动态同步队伍/遭遇、展示当前冻结战斗预览并按事件 sequence 追加路线日志；新增 `prototypes/gameplay-b/tests/short-route.test.ts`；更新本 Receipt。 |
| 未完成内容 | 无。临时第二战配置仍待 0191 正式遭遇替换。 |
| 范围外变更 | 无。未修改 `short-route.ts`、Runtime/model、CSS、HTML、AC 或包配置。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向回归 | `npm test -- short-route.test.ts location-activity.test.ts route-runtime.test.ts camp-lifecycle.test.ts runtime.test.ts battle-prepare.test.ts battle-resolve.test.ts`（在 `prototypes/gameplay-b/`） | 通过：7 个文件、58 项测试 | 覆盖完整五节点调用路径、旧 Click 只准备 Node 9 首轮、首战 HP 进入 Node 6 后继续治疗、Node 6 加成作用于下一战、活动全队归零即终止、事件 sequence 与出口终态幂等。 |
| 类型检查 | `npm run typecheck`（在 `prototypes/gameplay-b/`） | 通过 | `tsc --noEmit --project ./tsconfig.json`。 |
| 独立构建 | `npm run build`（在 `prototypes/gameplay-b/`） | 通过 | Vite 8.3.2 产物构建成功。 |
| 根文档检查 | `npm run check:docs`（仓库根） | 通过：560 篇 Markdown，0 errors | U4 Receipt/测试路径以完整仓库相对路径记录。 |
| 空白检查 | `git --no-pager diff --check -- prototypes/gameplay-b/src/main.ts prototypes/gameplay-b/src/view.ts prototypes/gameplay-b/tests/short-route.test.ts docs/plan-work/task-0190-gameplay-b-camp-route-lifecycle-units/0190-u4.md docs/plan-work/task-0190-gameplay-b-camp-route-lifecycle-units/receipts/0190-u4-receipt.md`；PowerShell `Select-String -LiteralPath <五个 U4 路径> -Pattern '[ \t]+$'` | 通过 | diff 检查退出码 0；新测试与文档扫描无尾随空格。 |
| 浏览器首屏检查 | Codex in-app browser，`http://127.0.0.1:5173/`，1280×720 | 通过 | 首轮暴露预览过高并已修正。复验时 Click 按钮底边在 y=683，位于 720 高视口内；预览区高 128px、内部可滚动完整 821px 内容。左右侧栏、中央日志和唯一 Click 均可见；Console error/warning 为 0。 |
| 浏览器路线 smoke | 同上；首战→节点 6→节点 7→临时第二战→节点 12出口 | 通过：11 Click，1–79 事件序号连续 | 战斗分别结算 4 轮与 3 轮；非战斗活动 Click 为 1+2+1；未产生额外转场 Click。千世在节点 6 入队后参与下一 Click 活动；进入节点 9 时仅准备第 1 轮，后续 Click 才结算。终态为 complete，5 人（前排 3 / 后排 2），按钮禁用，Console error/warning 为 0。 |
| C2 净行数 | 按 U4 新增块、入口净变更、Receipt 净变更核算 | 436 行 | view 新增 272、测试 117、Receipt 净增 29、main 净增 17、view import 净增 1；未计继承内容。 |

## 遇到问题

- 首次类型检查发现新测试辅助函数闭包内 `openingBattle` 仍可能为 `undefined`；增加经检查的局部别名后，类型检查通过。
- 浏览器首屏检查发现长战斗预览压出 Click 按钮；Route preview 限高和内部滚动后，在 1280×720 复验通过。

## 需上游确认项

- 无代码接口阻断；浏览器预览区与完整短路线均复验通过。

## 事实更新建议

- `mountRouteGameView()` 直接消费只读 `GameplayBRouteView`；路由推进仍由页面入口单次调用 `GameplayBRouteRuntime.click()` 完成。此为独立原型事实，不更新 AC 当前机制文档。
