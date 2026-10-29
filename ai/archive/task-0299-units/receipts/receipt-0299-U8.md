# Receipt 0299-U8

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | src/arona-clicker/content/operation-samples/gameplay-b-map-datapack.ts；tests/engine/gameplay-b-map-save-resume.test.ts；更新 U8 Unit 与 Task 0299 进度；新增本 Receipt |
| 未完成内容 | U9 Workspace / UI Skip 状态与最终 UI 回归；Task 0291 U4 接口仍须稳定后再接线。 |
| 范围外变更 | 新样例只加入当前 Map-only Gameplay B Datapack；测试未装载、启动或依赖旧 Operation。未修改 Engine、Schema、Workspace / UI 或生成文件。 |
| GALHCG 影响闭环 | 项目身份 acprogram 已核对；直接复核 Map-only Datapack、GameInstance Runtime 和 Save / Resume 测试路径；未改图、未刷新或写 freshness。 |

## 结果

- 当前 Map-only Gameplay B Datapack 新增可游玩的“自主目标战斗演练”Map entry：白子与芹香对机器人 A / B / C。
- 样例通过真实 `GameInstance.init([defaultDatapack, gameplayBMapDatapack])` Registry 装载；未使用 Task-0298 作用线、旧 Operation 或 UI 目标推断。
- 第一轮不调用任何玩家目标 / Swap 命令即可准备两次合法普通射击并提交。白子按最低 HP 比例射击击败 A；芹香执行前读取结算后的 HP，改攻 B，未浪费在 A。
- 第一轮敌方攻击后以最新 Party HP、敌方状态、Team resources 和 RNG cursor 准备第二轮。Swap 到掩护得到 self target，清除后恢复自然射击并自动选 B；玩家改选 C 后 Save / Resume 保留该选择、Hand、费用 readiness 与随机状态。
- 原实例与恢复实例用同一第二轮 Commit 请求得到相同 Runtime 结果；Receipt 记录白子攻击 C、芹香攻击 B，正常 Enemy HP / clue resource 结算。

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| Runtime / Registry / Save / Resume | npx vitest run --silent tests/engine/gameplay-b-map-save-resume.test.ts tests/engine/gameplay-b-map-resolver.test.ts tests/data/gameplay-b-map-registry.test.ts | 通过 | 3 files、140 tests；新样例两轮战斗运行在 Save / Resume 测试内。 |
| 类型检查 | npx tsc --noEmit | 通过 | — |
| 文档检查 | npm run check:docs | 通过 | errors 0；scanned markdown 949。 |
| 差异空白 | git diff --check | 通过 | 只提示工作树既有 CRLF 转换信息。 |

## 遇到问题

- 初始战斗预期敌方 A / B 均分攻击队员；从 Runtime 实际结算证据确认敌方逐个攻击当时 HP 最低的合法队员，因此第一轮存活的 B / C 都攻击白子，实测 HP 为白子 4、芹香 10。只修正样例测试的真实预期，没有改变敌方既有战斗规则。
- 新样例完整自然 Hands 含普通射击、掩护和队友治疗；普通射击使用极高但合法的 tendencyWeight，以使正式首轮按确定性抽牌自然选定射击，同时保证两项真实 Swap 备选仍在 Hand。情境权重机制已由 U4 的精确概率测试单独覆盖。

## 需上游确认项

- 无；Map-only 正式样例路径与用户指定的两轮战斗验收已冻结。

## 事实更新建议

- MapRun 敌方攻击按 Enemy 固定顺序执行，每个存活敌人均在当下存活队员中选择 HP 数值最低者；重复 Preview / Save / Resume 的 Runtime 集成样例覆盖了前后两轮自然准备与提交。
