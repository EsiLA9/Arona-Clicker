# Receipt 0191-U3

| 项 | 内容 |
| --- | --- |
| 状态 | 完成；三组遭遇和确定性敌方意图配置已交接给 U4。R08 内容仍为导演候选/原型暂定，未记录成用户逐项确认。 |
| 实际修改 | 新增 `prototypes/gameplay-b/src/battle/enemy-intents.ts` 的意图构造与周期内容；新增 `prototypes/gameplay-b/src/content/enemies.ts` 的敌人模板、数值和节点 5/9/11 遭遇；扩展 `prototypes/gameplay-b/tests/enemy-intents.test.ts`；本 Unit spec 与 Receipt。首战的冲撞者/水枪射手复用已有 `firstBattle` 成员与 ID。 |
| 未完成内容 | 无；路线节点接入、文本与全队 4+2 输入由 U4/U6 完成。 |
| 范围外变更 | 无。未修改角色牌组、prepare/resolve/runtime、路线、UI、README、包配置或 AC。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 敌人意图测试 | `npm test -- enemy-intents.test.ts`（`prototypes/gameplay-b/`） | 通过：1 个文件、16 项测试 | 验证三场阵容/数值、首战冲锋与狙击选目标、烟花奇数轮固定前排爆破与偶数轮无目标装填、临时领头掩护/冲锋循环和受伤覆盖、Boss 每三轮混合固定伤害、护具掩护、稳定并列与重复准备。U1/U2 契约用例也在同一文件通过。 |
| 类型检查 | `npm run typecheck`（`prototypes/gameplay-b/`） | 通过 | `tsc --noEmit --project ./tsconfig.json`。 |
| 内容对照 | 按 Draft 0182 敌方复用模板、三场遭遇和 R08 对照实际配置/准备输出 | 通过 | 0188 首战 ID 与数值保留；Node 9/11 按候选阵容配置；目标由已交付 prepare 契约锁定，没有意图随机抽取。R08 的导演来源与可修订状态继续显式保留。 |
| 文档/空白 | 根目录 `npm run check:docs`；U3 修改文件行尾空白扫描 | 通过：561 篇 Markdown、0 errors；尾随空白 0 | 文档路径均以仓库相对源码路径记录。 |
| C2 净行数 | 按 U3 新增文件与扩展测试块核算 | 约 140 行 | 静态意图/敌人内容单元按 Task 记录的 120–240 行预算施工；5 个文件以内。 |

## 遇到问题

- 初次类型检查无失败；路线当前仍引用 0190 的临时第二战夹具，因此 U3 将 Node 9 遭遇独立导出，按 U4 白名单更新 `short-route.ts` 时再替换引用。

## 需上游确认项

- 无。

## 事实更新建议

- `parkEncounters` 仅保存 `encounterId` 与敌人快照，可直接赋值给 0190 的 `GameplayBRouteNode.battle`；节点 5 复用 `firstBattle` 原成员，Node 9/11 使用独立 encounter ID。
- 临时领头的受伤优先只配置 `previousRoundDamageReaction`；Boss “烟花齐放”使用 U1/U2 已支持的固定伤害 + `front-and-lowest-rear`，未扩大到所有后排。

