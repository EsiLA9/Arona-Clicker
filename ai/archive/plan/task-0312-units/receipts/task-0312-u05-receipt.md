# Receipt 0312-U05

| 项 | 内容 |
| --- | --- |
| 状态 | U05 WorkItems 与指定验证完成，交负责人审查；不代表 E1 产品整体完成。 |
| 实际修改 | 修改 `src/data-services/normalization/gameplay-map-effect-program.ts` 与 `tests/data/gameplay-b-effect-normalization.test.ts`；新增本 Receipt。原有初稿已存在于当前 HEAD，本次继续补齐递归条件类型、Action 字段边界和对应回归。 |
| 预算估算 | 两份完整 U05 代码/测试文件与 Receipt 共427行，低于500行常规预算；估算不包含并行U04文件。 |
| 未完成内容 | 无 U05 内剩余项。没有新增 executor、Owner、source 队列或运行时安装行为；新规范化结果供后续 Unit 使用。 |
| 范围外变更 | 未修改 Task、Unit、其它产品文件或旧金样。当前并行工作树另有 U04 的 `scripts/gen-engine-schema.mjs`、生成 Schema 及其测试改动；本 Unit 未触碰这些路径。未提交 Git。 |
| GALHCG 影响闭环 | 只读身份确认 `project_id=acprogram` 且根路径匹配。定向 path 查询定位到 normalizer；旧相位 source 搜索无命中后回到 `map-run-service.ts`、`map-card-effects.ts` 和旧金样核实。直接影响路径按 Task 约定累积至 U19 统一只读复核；未改图、refresh 或写 freshness。 |

## 实际规范化边界

- `normalizeMapActionEffects` 继续把旧 `hpEffects`、`effects`、`cardEffects` 规范化成同一指令集合，保留数组次序、账户映射、path、legacy/program 模式和按来源分类的旧相位标签。旧输入使用 `legacy-unmetered`，不会追溯套用 program 的静态或 4096 动态预算。
- 新 program 保留 prepare、resolve 次序、when/else 树；递归条件的每个 all/any/not/谓词都有可见且静态可访问的 `originPath` 与 `mode: 'program'`。Normalizer 生成新对象，不修改传入 Action。
- normalizer 在入口按 `GameplayMapActionDef` 的 11 个已定义顶层字段拒绝未知 Action 字段；旧叶子和新 program 继续各自拒绝未知叶字段。它不复做 Registry 的必填字段、引用、source 上下文和业务语义校验。
- 单测覆盖 legacy HP/resource/card 数组的稳定路径与相位、team/sourceActor/primaryActor映射、Enemy/Actorless 相位标签、new program 的 prepare/空 resolve/when/else、递归 all/not path 与类型访问、输入不变、旧总计66叶仍可规范化、新旧混填拒绝、旧/新叶及 Action 顶层未知字段拒绝。

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向行为与旧回归 | `npx vitest run tests/data/gameplay-b-effect-normalization.test.ts tests/engine/gameplay-b-effect-legacy-goldens.test.ts --silent` | 通过，退出码0；2 files / 19 tests | 按 U05 Verification 指定路径执行；未改动旧金样。 |
| 类型检查 | `npx tsc --noEmit` | 通过，退出码0 | 递归类型初次实现暴露了 TS union narrowing 报错，显式返回类型后复跑通过；已有畸形字段测试改用 `unknown` 中转断言，保持运行时测试意图。 |
| 架构 | `npm run check:architecture` | 通过，退出码0 | data-services 没有新增反向依赖或写入口。 |
| 差异空白与范围 | `git --no-pager diff --check`；本 Receipt 与两份 U05 文件尾随空白扫描 | 通过 | U05 修改限于两个产品白名单文件和本 Receipt。其它并行 U04 路径未纳入本 Unit。 |
| 文档 | `npm run check:docs` | 通过，退出码0 | Receipt 初稿写入后首次检查扫描1111篇 Markdown、errors=0；Receipt 最后修订后再次检查扫描1112篇 Markdown、errors=0。 |

## 合同映射与问题

| 合同 / ID | U05 证据与边界 |
| --- | --- |
| E1-COMPAT-1 / OLD01 | 旧数组的叶子顺序及来源相位标签由 normalizer 单测核对；完整旧效果行为金样仍使用现存 `tests/engine/gameplay-b-effect-legacy-goldens.test.ts`，13 条通过，未改 OLD 期望。 |
| EQ02（旧 card prepare） | 旧 `cardEffects` 映射到 `discountSCost` prepare 叶并保留 path；金样文件内 EQ02 回归通过。U05 不改变卡牌准备执行。 |
| D06 / NEW06 | 新旧资源变更使用共同叶子与 sourceActor/primaryActor/sourceTeam 账户；U05 不取代 U03 的来源、声明余额或 Actorless 业务校验。 |
| D08 / NEW07 | 新 program 标记 `program-4096`；旧数组明确标记 `legacy-unmetered`，66 个旧叶仍规范化。U05 不实现动态计数器。 |

- Source 搜索对旧相位符号未返回命中；实现结论来自回读当前源码与旧回归测试，而非将地图零命中当作不存在。

## 需上游确认项

- 无阻塞项；负责人审阅时可确认 normalizer 的顶层字段白名单与 `GameplayMapActionDef` 保持同步。

## 事实更新建议

- 后续 Unit 可直接消费 `normalizeMapActionEffects` 的统一 instruction tree；condition 的每层节点都可按类型读取 `originPath` 和 `mode`。Normalizer 严格拒绝未知 Action 顶层字段，但不替代 Registry 的完整作者内容校验。
