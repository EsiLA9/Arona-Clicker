# Receipt 0191-U6

| 项 | 内容 |
| --- | --- |
| 状态 | complete |
| 实际修改 | `prototypes/gameplay-b/src/main.ts` 加载并校验十二节点路线，以唯一按钮 Click 调用 Route Runtime；`prototypes/gameplay-b/src/view.ts` 投影路线节点、活动度、角色/敌方状态、冻结意图与事件文案，并修正首次长日志溢出后不跟随最新记录的问题；`prototypes/gameplay-b/tests/park-demo.test.ts` 覆盖路线校验、首节点/2+2 开局、入队人数变化及单次战斗结算边界；本 Unit Spec 与 Receipt 更新。 |
| 未完成内容 | U6 范围内无未完成项。整局通关/失败/平局回放、README 实测记录及完整路线浏览器验收留给 U7。 |
| 范围外变更 | 无 Runtime、model、路线/敌人内容、CSS、HTML、package 或 AC 文件变更。构建生成的 `prototypes/gameplay-b/dist/` 由根 `.gitignore` 忽略。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | 在 `prototypes/gameplay-b` 执行 `npm test -- park-demo.test.ts` | 通过：1 file / 3 tests | 首节点合法路线、首次活动无额外随机推进、节点 6/10 先入队，以及首场战斗 Click 后仅准备下一轮。 |
| 类型检查 | 在 `prototypes/gameplay-b` 执行 `npm run typecheck` | 通过 | 原型 TypeScript 项目。 |
| 独立构建 | 在 `prototypes/gameplay-b` 执行 `npm run build` | 通过 | Vite 8.3.2；22 modules transformed。 |
| 文档检查 | 在项目根执行 `npm run check:docs` | 通过 | scanned 561 markdown；errors 0。 |
| 边界检查 | `rg` 扫描 prototype source 的 AC 路径/模块引用与 U6 文件尾随空白 | 通过 | 未发现 AC import/path references 或尾随空白。 |
| 浏览器入口冒烟 | 当前本地原型页 `http://127.0.0.1:5173/`；从节点 1 依次 Click 至节点 5，再结算一次首场战斗 | 通过 | UI 显示节点 05/12、4 名我方、敌方两人、冻结第 2 轮；唯一按钮仍为“Click · 结算第 2 轮”，未在一次 Click 内执行第二轮。路线日志随新事件滚到最新记录。未单独读取 DevTools Console；页面未显示运行错误覆盖层。 |

## 遇到问题

首次浏览器冒烟时，路线日志已追加战斗结算，但面板仍停在旧记录。只读检查确认问题在 View 的自动跟随判断；加入“默认跟随、用户主动上翻时保留位置、回到末尾恢复跟随”的显示状态后，重载并重走首场战斗，最新结算记录已出现在面板底部。该状态只影响日志滚动，不读写游戏 Runtime。

## 需上游确认项

无新增确认。R06、R08、R10 及未决 R09 规则、敌方内容和 Camp 数值仍按根 Task 标记为原型暂定候选；本 Unit 未升级其裁定状态。

## 事实更新建议

- U6 证明单入口可加载经 `validateParkRoute` 校验的固定十二节点路线，并保持“单击只结算当前行为，新节点仅进入/准备”的 Click 边界。
- 首次入口/战斗浏览器检查完成，但不作为整局通关、失败、平局验收；由 U7 补齐可重放回归和完整体验验收。
- 因 Route Runtime、三栏布局骨架和大部分战斗投影已由前置 Unit 提供，U6 是复用型接线切片；Unit 目标预算据此调整为 160–280 行，不为达到默认范围而扩大实现。

