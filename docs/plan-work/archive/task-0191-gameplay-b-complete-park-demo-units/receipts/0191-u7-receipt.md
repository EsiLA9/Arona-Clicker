# Receipt 0191-U7

| 项 | 内容 |
| --- | --- |
| 状态 | complete |
| 实际修改 | `prototypes/gameplay-b/tests/park-demo.test.ts` 增加正式路线确定性双回放、逐战轮数/sCost/敌方意图对账，以及终局失败和平局夹具；`prototypes/gameplay-b/tests/content.test.ts` 锁定三场遭遇阵容、烟花手 reload/no-op、领头受伤反应和 Boss 混合目标配置；`prototypes/gameplay-b/README.md` 补充独立运行、路线/规则说明与真实通关记录；本 Unit Spec 与 Receipt 更新。 |
| 未完成内容 | U7 范围内无阻塞项。正式入口没有切换 seed 或失败/平局的调试控件，因此失败和平局由同一 Route Runtime 的确定性夹具回归。DevTools Console 未通过当前浏览器操作接口独立读取；没有可见错误覆盖层，README 如实标注此限制。 |
| 范围外变更 | 未修改 Runtime、内容实现、UI、CSS/HTML、package 或 AC。Vite 构建生成的 `prototypes/gameplay-b/dist/` 由根 `.gitignore` 忽略。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 整局定向回归 | 在 `prototypes/gameplay-b` 执行 `npm test -- park-demo.test.ts content.test.ts` | 通过：2 files / 19 tests | 同 seed 全程两次回放一致；胜利、失败、平局、终态重复输入、队伍人数、Click 总量和三场敌方内容均有断言。 |
| 类型检查 | 在 `prototypes/gameplay-b` 执行 `npm run typecheck` | 通过 | 原型 TypeScript 项目。 |
| 独立构建 | 在 `prototypes/gameplay-b` 执行 `npm run build` | 通过 | Vite 8.3.2；22 modules transformed。 |
| 文档检查 | 在项目根执行 `npm run check:docs` | 通过 | scanned 561 markdown；errors 0。 |
| 隔离/格式检查 | 扫描原型 source 的 AC 路径引用，并检查本 Unit 的测试与 README 尾随空白 | 通过 | 未发现 AC 引用或尾随空白。 |
| 浏览器完整路线 | Codex In-app Browser，`http://127.0.0.1:5173/`；从默认入口连续推进到终态 | 通过 | 2026-10-03；视口约 1092 × 811。seed `park-inspection-demo`，节点 01–12，6 名 Chara，终态 `complete`；共 26 Click，其中非战斗 11、战斗 15。三战为节点 5/9/11，各 4/5/6 轮。页面无可见错误覆盖层；DevTools Console 未独立读取。 |

## 逐局对账

- 节点 5 开战 sCost 为 2；节点 6 后节点 9 的五人开战 sCost 均为 3；节点 10 后 Boss 第 2 轮 sCost（小栞、由理、芽衣、纺希、千世、玲奈）为 `3/3/5/5/5/2`，体现活动间保留、跨战重置和节点 10 的候选回复加成。
- 节点 9 第 1 轮临时领头实际掉 HP；第 2 轮使用 `temporary-leader-reactive-charge`。同轮烟花手意图为无目标 `fireworks-reload`，结算日志为无伤害。
- 节点 11 第 3 轮 Boss 混合目标为存活前排小栞、由理、千世、玲奈，以及最低 HP 存活后排纺希；事件记录对每个目标固定造成 1 点伤害。
- 总量为 10 次普通场所活动 Click + 1 次出口交接 Click + 15 次实际战斗结算 = 26；入队、进入节点和战后转场均未增加额外 Click。

## 遇到问题

第一轮内容断言曾将出口事件中的“游园会”误写成“游乐园”；按 Route Runtime 实际事件修正后，整局定向回归通过。无机制或内容实现缺陷。

## 需上游确认项

无新增确认。R06、R08、R10、未决 R09 子规则及营地数值继续保持原型暂定/候选；本 Unit 的观测不构成用户对这些候选的确认。

## 事实更新建议

- 默认入口 seed `park-inspection-demo` 可完整复现十二节点通关；战斗轮数为 4/5/6，总 Click 为 26。README 的数据来自 Runtime 双回放和真实浏览器走局。
- 失败和平局由确定性 Runtime fixtures 覆盖，正式页面保持单一固定入口与 Click 控件。
- U7 只增加整局验收和实测说明，没有将原型规则接入 AC，也没有把原型候选写成已裁定规则。
