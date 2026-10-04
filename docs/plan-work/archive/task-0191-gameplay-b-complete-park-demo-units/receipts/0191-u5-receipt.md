# Receipt 0191-U5

| 项 | 内容 |
| --- | --- |
| 状态 | 完成；固定路线 validator 与失败诊断已交接给 U6/U7。 |
| 实际修改 | 新增 `prototypes/gameplay-b/src/content/validate.ts`：纯读校验固定顺序、节点类型、U3 Encounter ID/敌人引用、活动位置 ID、活动度、入队时点与角色引用；扩展 `prototypes/gameplay-b/tests/content.test.ts`；本 Unit spec 与 Receipt。未改 U4 `park-route.ts`。 |
| 未完成内容 | 无。文字渲染与整局重放仍分别由 U6/U7 消费 U4 内容。 |
| 范围外变更 | Task 级规划维护：记录 U5 纯静态校验切片的 160–280 行预算；无白名单外代码修改。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 内容校验测试 | `npm test -- content.test.ts`（`prototypes/gameplay-b/`） | 通过：1 个文件、13 项测试 | 有效路线返回空错误列表且输入未变；覆盖缺失/额外节点、空/重复 ID、顺序/类型、错误/重复遭遇、缺失/重复/错序敌人、活动度、空/重复/冲突位置 ID、招募位置与嵌套角色 ID。 |
| 类型检查 | `npm run typecheck`（`prototypes/gameplay-b/`） | 通过 | `tsc --noEmit --project ./tsconfig.json`。 |
| 文档/空白 | 根目录 `npm run check:docs`；U5 修改文件尾随空白扫描 | 通过：561 篇 Markdown、0 errors；尾随空白 0 | 无路径或文档结构诊断。 |
| C2 净行数 | 按 validator 与 content.test 新增块核算 | 约 180 行 | 纯内容校验预算为 160–280 行；不扫描仓库、不写运行状态。 |

## 遇到问题

- 首次 typecheck 检查发现测试辅助函数 `.find()` 未保留活动节点联合类型；将其改为显式 type predicate 后，测试与类型检查通过。

## 需上游确认项

- 无。

## 事实更新建议

- `validateParkRoute(nodes)` 返回所有诊断而不抛出，不修改 Route；校验实际导出的 `parkEncounters` encounter ID 与敌人顺序，Node/Activity/Encounter ID 各自独立检查。
- Route Runtime 已在 U4 内容测试中验证节点 6/10 的 onEnter 招募先于活动；本 validator 额外检查对应位置及嵌套 `id`/`roster.id`/`battle.id` 一致，不添加新存储字段。

