# Receipt 0312-U03

| 项 | 内容 |
| --- | --- |
| 状态 | 实施与本Unit指定验证完成，交负责人审查；不代表E1整体完成或可发布。 |
| 实际修改 | 修改 `src/data-services/registry/registry-validate.ts`（15行新增 / 3行替换），接入E1语法/上下文验证、允许`effectProgram.prepare`满足Card目标、拒绝Action新旧数组混填并严格检查Encounter字段；新增 `src/data-services/validation/gameplay-map-effect-context.ts`（234行），导出 `validateGameplayMapEffectContext(value: unknown): readonly GameplayMapEffectContextIssue[]`，逐Node直挂Encounter及Activity Encounter核验全部Party/Enemy/Ability/Item来源、实际primary身份、资源初值、Counter/Flag引用和Actorless约束；修改 `src/arona-clicker/services/map-run-service.ts`（23行新增），在`resolveEncounterCommitPlan`开始规划前拒绝尚未接通的effectProgram、Encounter locals与condition completion；新增 `tests/data/gameplay-b-effect-registry.test.ts`（235行）及本Receipt（28行）。本Unit合计约535行新增、3行删除。 |
| 未完成内容 | 无U03内剩余实现。效果程序执行、locals状态持有及condition completion执行仍由后续Unit负责；本Unit在其接通前保留明确拒绝。 |
| 范围外变更 | 本Unit未修改U02四个源码/测试文件、`data-services/index.ts`、Schema生成产物、总Task、默认内容或其它文件；保留工作树中既有U01/U02未提交改动。U03额度由负责人按已报告估算在Unit文档记录为1000行上限；其余白名单及合同边界未变。 |
| GALHCG 影响闭环 | 工作区身份只读核对为`project_id=acprogram`且根目录匹配。`registry-validate.ts`与`map-run-service.ts`定向source查询返回0项、无截断；按协议回到当前磁盘源码核实。直接影响路径累计到U19统一只读复核；本Unit未改图、refresh或写freshness。 |

## 实际接口与下游接线

- `validateGameplayMapEffectContext(value)` 返回路径化`{ path, message }`问题数组，不改输入或运行时状态。它依赖U02的`validateGameplayMapEffectProgram`与`validateGameplayEncounterEffectSyntax`；只有语法通过后才递归遍历受限树，避免重复解析越界输入。Registry将首个问题包装为`RegistryError`。
- helper按实际引用位置构造来源上下文：participant候选绑定具体Party Character，Enemy候选绑定具体Encounter Enemy；Ability/Item无sourceActor且绑定Party Team；primaryActor逐个检查该目标规则下每个可能Party/Enemy身份。资源键必须在对应身份/阵营的显式起始余额中声明；未走的then/else和条件树也检查。旧Actorless资格、目标、cost及actor-relative旧效果限制同样在此helper提供给后续Runtime复用。
- 过渡拒绝位于`src/arona-clicker/services/map-run-service.ts`的模块内`resolveEncounterCommitPlan`入口，在Action Preview及任何Commit计划构造前执行，因此经直接自定义MapContentResolver进入的内容也会在`previewEncounterCommit`返回诊断、在Commit安装前失败。U08完成Encounter-local状态持有后移除仅locals声明的拒绝；U10接通后移除effectProgram拒绝；U11接通后移除condition completion拒绝。当前Encounter声明了locals但没有新Action时也拒绝，避免静默忽略尚未持有的状态。负责人已据此Receipt局部修订U08接线；不改变U03范围。
- Encounter completion的HP谓词含source/primary相对单位，但整个Encounter条件没有source或主目标身份；本Unit按当前合同拒绝该无绑定引用，Counter/Flag与逻辑条件可用。未引入新的目标绑定字段或默认身份。

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向行为 | `npx vitest run tests/data/gameplay-b-effect-registry.test.ts tests/data/gameplay-b-map-registry.test.ts tests/engine/gameplay-b-map-run.test.ts` | 通过，退出码0；3 files / 190 tests | 新测试覆盖NEW06账户/来源/分支/Encounter上下文、同Map混用旧/新Action、Actorless与畸形cost、空prepare与Card prepare、无目标primary、条件完成限制、2000层深树拒绝、自定义Resolver Preview拒绝及Commit零写；旧Registry 135项和MapRun 46项保持。 |
| 类型检查 | `npx tsc --noEmit` | 通过，退出码0 | 首轮发现一处visitor回调参数签名错误，修正后重跑通过。 |
| 架构 | `npm run check:architecture` | 通过，退出码0 | data-services边界检查通过。 |
| 差异空白 | `git --no-pager diff --check`及新增文件尾随空白扫描 | 通过，退出码0；扫描无命中 | 工作树仍包含任务开始前未提交的其它Unit改动，均未改动。 |
| 文档 | `npm run check:docs` | 通过，退出码0 | 扫描1110篇Markdown，errors=0。 |
| GALHCG | 上述项目身份与定向source查询 | 只读完成 | 查询零命中不是未实现判断；未进行健康图写入。 |

## 遇到问题

- 当前Schema/类型边界允许program condition读取相对source/primary HP；Encounter completion没有来源或主目标身份字段。检查Draft §5.1/§11.3、U02 Receipt与现有Encounter契约后，没有找到completion为这些相对单位提供绑定的合同，因此拒绝该形状，留给后续Unit按相同边界消费。

## 需上游确认项

- 无阻塞U03交付的待确认项；负责人审查后再放行U04/U05。

## 事实更新建议

- 后续Unit以本Receipt记录的helper导出接口及planner过渡拒绝位置接线；不依照旧Draft伪码猜测运行时API。
