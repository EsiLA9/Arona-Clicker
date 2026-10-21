# Receipt 0312-U02

| 项 | 内容 |
| --- | --- |
| 状态 | U02实施与指定验证完成，交负责人审查；不代表E1产品整体验收通过。 |
| 实际修改 | `src/data-services/contracts/gameplay-map.ts` 挂接作者程序、Encounter locals及条件完成合同；新增 `src/data-services/contracts/gameplay-map-effects.ts`、`src/data-services/validation/gameplay-map-effect-syntax.ts`、`tests/data/gameplay-b-effect-syntax.test.ts` 与本Receipt。 |
| 未完成内容 | 无U02内剩余项。Registry引用/来源上下文校验、Schema生成接入、规范化和运行时解释继续由后续Unit负责；没有宣称作者内容已可装载或执行。 |
| 范围外改动 | U02代码与测试改动仅在四个白名单路径；保留工作树中U01两份测试修改。未改 `data-services/index.ts`、总Task、其它Unit或生成Schema；未Git提交。负责人已在U02正文记录本Unit额度放宽到1000行，白名单与合同边界不变。 |
| GALHCG | 只读身份确认 `project_id=acprogram`，根路径匹配任务工作区。局部源码搜索未命中；随后回到当前磁盘核实合同。直接影响范围按Task约定累积至U19统一只读复核；未改图、refresh或写freshness。 |

## 实际接口

- `GameplayMapEffectProgramDef` 提供可选 `prepare` 与 `resolve`；prepare叶子为 `discountSCost(amount)`，resolve有限节点为 `hpChange(target, delta)`、`resourceChange(account, resourceId, delta)`、`counterAdd(counterId, delta)`、`flagSet(flagId, value)` 和 `when(condition, then, else?)`。
- `GameplayMapEffectConditionDef` 只包括 `all`、`any`、`not`、HP阈值、HP有理比率、Counter比较和Flag比较。HP目标为 `source | primary`；资源账户为 `sourceActor | primaryActor | sourceTeam`。资源键校验沿用当前Map局内key规则，只要求trim后非空字符串，实际声明与账户绑定留给U03。
- `GameplayMapEncounterLocalsDef` 声明Counter和Flag。locals名称限制为首字符字母、后续最多63个字母/数字/下划线/连字符；两类共用名字域。Counter的initial/min/max必须为安全整数且满足 `min <= initial <= max`，Flag初值为布尔值。
- `GameplayEncounterCompletionDef` 现有 `manual` 合同保持；新增 `condition` 分支，沿用必需 `label` 并增加受限条件。label对新分支也必填，是为保持已有作者/调用方无条件读取 `completion.label` 的接口兼容。完成时点与非战斗上下文由后续Unit验证。
- `GAMEPLAY_MAP_EFFECT_LIMITS` 导出静态节点64、resolve深度4、condition深度4、prepare叶子8、locals64、整轮新程序访问4096。纯语法校验只静态执行前五项；4096是后续运行时累计上限，不由本校验器消费。
- `validateGameplayMapEffectProgram(value: unknown, path = 'effectProgram')` 与 `validateGameplayEncounterEffectSyntax(value: unknown, path = 'encounter')` 均返回 `{ ok, issues, counts }`。issue含 `path`、`code`、`message`及可选`limit`；counts为 `{ staticNodes, prepareLeaves, locals }`。前者校验一个程序且locals为0；后者校验Encounter locals/完成条件，静态条件节点计入staticNodes。
- 两函数只校验纯语法，不做Registry引用或上下文绑定；严格未知字段/操作拒绝，节点超限或深度越界时先拒绝并停止对应超限分支的下钻，避免恶意深树递归。`when`的then/else均静态计数并校验。

## 测试与验证

| 项 | 命令 | 结果 |
| --- | --- | --- |
| U02语法行为 | `npx vitest run tests/data/gameplay-b-effect-syntax.test.ts` | 通过，退出码0；1 file / 6 tests。覆盖有限AST、未知op/字段/条件、非字符串枚举、两分支静态计数、节点64/65、resolve与condition深度4/5、prepare 8/9、locals 64/65、safe integer、非零delta、HP比例、Counter范围、深树及非plain对象拒绝。 |
| 旧作者合同回归 | `npx vitest run tests/data/gameplay-b-map-registry.test.ts` | 通过，退出码0；1 file / 135 tests。 |
| 类型 | `npx tsc --noEmit` | 通过，退出码0；现有调用方完成类型兼容。 |
| 架构 | `npm run check:architecture` | 通过，退出码0；data-services没有新增反向依赖。 |
| 文档 | `npm run check:docs` | 通过，退出码0；扫描1109篇，errors=0。 |
| 范围与差异空白 | `git --no-pager diff --check`；新文件另做尾随空白扫描 | 通过，退出码0；U02文件符合白名单。 |
| Schema生成 | 未运行 | 本Unit只提供源类型与语法函数；生成接入属于U04，不改生成协议。 |

## 合同映射与需上游注意

| 合同/ID | U02证据与边界 |
| --- | --- |
| D01 / NEW01 | 语法只接受当前HP/HP比例/Counter/Flag谓词，支持有界all/any/not及可选else；不接受资源条件。仅验证形状与静态两分支，不验证运行时读数。 |
| D03 / NEW03 | Counter声明强制显式initial/min/max及合法有界值；delta为非零安全整数。饱和执行结果与溢出原子性由运行时Unit验证。 |
| D06 / NEW06 | 语法验证局内资源键为非空字符串及局部变量名字域；不校验Action source、账户是否声明、Actorless限制或跨Encounter依赖，保留给U03。 |
| D08 / NEW07 | 新测试覆盖静态节点、分支、条件、prepare、locals和深度边界；动态整轮4096仅导出额度常量，本Unit没有运行时访问累计器。 |
| OLD作者合同 | 旧Map Registry测试135项通过；本Unit未更改旧数组定义或修改OLD金样期望。 |

未改Schema生成结果属U02 Explicit Non-goal；U04应以新作者类型和TSDoc生成Schema，并核对有限联合类型没有丢失分支。U03应消费本Receipt记录的实际导出名、参数和返回形状，且继续拒绝尚未接通Runtime的新内容。未提交Git；不提前后续Unit。
