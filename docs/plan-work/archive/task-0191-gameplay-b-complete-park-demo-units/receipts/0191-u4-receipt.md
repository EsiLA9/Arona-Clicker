# Receipt 0191-U4

| 项 | 内容 |
| --- | --- |
| 状态 | 完成；十二节点与叙事触发目录已交接 U5–U7。显示层消费文本目录由 U6 接线。 |
| 实际修改 | 新增 `prototypes/gameplay-b/src/content/park-route.ts`：初始 2+2、固定十二节点、活动度 11、节点 6/10 入队与营地 modifier、连接 U3 三场遭遇；新增 `prototypes/gameplay-b/src/content/texts.ts`：逐节点入场/活动/加入/意图/结果/结尾文本及触发 ID；新增 `prototypes/gameplay-b/tests/content.test.ts`；本 Unit spec 与 Receipt。 |
| 未完成内容 | 无。Route Runtime 与 View 消费 `parkTextEntries` 的展示接线在 U6；本 Unit 只交付独立文本内容与稳定触发关联。 |
| 范围外变更 | 无。未改 `short-route.ts`、Runtime、main/view、UI、U3 敌人内容或 AC。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 内容/活动/Route 回归 | `npm test -- content.test.ts route-runtime.test.ts location-activity.test.ts`（`prototypes/gameplay-b/`） | 通过：3 个文件、18 项测试 | 覆盖节点顺序、战斗节点 5/9/11、活动 Click 合计 11、首始队伍 2+2 和数值、加入角色在活动前入队、固定/随机/属性活动配置、ID 独立性、文本触发和 U1/U2/U3 意图引用；验证 Node 1 固定活动一 Click 转场且不掷骰。 |
| 类型检查 | `npm run typecheck`（`prototypes/gameplay-b/`） | 通过 | `tsc --noEmit --project ./tsconfig.json`。 |
| 文档检查 | 根目录 `npm run check:docs` | 通过：561 篇 Markdown、0 errors | Unit 链接与源码路径有效。 |
| 空白检查 | PowerShell `Select-String -Pattern '[ \t]+$'` 扫描 U4 三个代码/测试文件及两份 U4 文档 | 通过：0 匹配 | U4 白名单 5 个文件。 |
| C2 净行数 | 按三份新增源码/测试与 Receipt 新增块核算 | 约 330 行 | 落在 300–450 行目标内；未计继承的 0190 Runtime/活动实现。 |

## 遇到问题

- 入口/活动结果文本是独立的 `parkTextEntries` 触发目录；RouteEventRecord 当前没有存储叙事扩展字段，因此消费该目录的渲染映射留给已拆分的 U6，不在 Runtime 增加状态。

## 需上游确认项

- 无。

## 事实更新建议

- `parkRouteNodes` 可直接满足 `GameplayBRouteRuntime` 的真实 `GameplayBRouteNode` 联合类型；战斗节点只携带 `encounterId/enemies`，初始角色由 `firstBattle.party` 映射为 Runtime 所需的 roster/battle 两份定义。
- Node 6 与 Node 10 入场时 Runtime 先写 `character-joined`，再在下一次同节点 Click 执行活动；两个角色不额外消耗 Click。新文本触发按 nodeId、activityIndex 或 intentId 关联，不写入路线状态。

