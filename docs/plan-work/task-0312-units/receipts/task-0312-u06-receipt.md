# Receipt 0312-U06

| 项 | 内容 |
| --- | --- |
| 状态 | U06 实施与指定验证完成，交负责人审查；不代表 E1 产品整体完成。 |
| 实际修改 | 新增 `src/arona-clicker/contracts/map-effects.ts`、`src/arona-clicker/services/map-effect-planner.ts`、`tests/engine/gameplay-b-effect-planner.test.ts` 与本 Receipt。 |
| 实际行数 | 合同 113 行、planner 167 行、定向测试 168 行、本 Receipt 34 行，合计482行。此前负责人已登记540–730行估算并批准最多1000行，本次未越额度。 |
| 未完成内容 | 无 U06 内剩余项。Planner 尚未接入 MapRun 权威完整轮计划；由 U07/U10 按 Receipt 接线。 |
| 范围外变更 | 未修改 Task、Unit、U04/U05 文件、生成 Schema 或 Git 状态。保留工作树中并行 U04 的 schema/script/test 修改及 U05 文件；本 Receipt 与 U06 产物只属于本Unit白名单。未提交 Git。 |
| GALHCG 影响闭环 | 只读身份确认 `project_id=acprogram` 且根路径匹配。对 `src/arona-clicker/services/map-effect-planner.ts` 做定向 path 查询命中当前磁盘文件；未改图、refresh 或写 freshness。直接影响范围累积至 U19 统一只读复核。 |

## 实际接口与语义

- `planMapEffectSource({ input, effects, instructions?, visit })` 输入 U05 规范化 effects、已绑定 source/primary/sourceTeam、HP与cap快照、Encounter locals快照；输出新的HP/locals、顺序资源意图账本、实际规划trace和prepare折扣元数据，不修改输入。
- `instructions` 可由外层传入legacy相位切片；helper 共用同一叶子实现，不从内部选择来源队列或重放完整legacy效果。`legacy-unmetered` 不报告动态访问。
- `program-4096` 每访问一个resolve statement及实际到达的 condition node调用外层 `visit`；helper不持有或重置访问累计器，没有回调会失败。未执行分支和短路节点不报告。prepare只返回有序折扣元数据，实际准备阶段由外层报告一次访问，helper不重复计数。
- HP变化用BigInt中间运算后截到0..cap；当前HP为0时不复活。guard按语句当前位置读更新后的detached HP/locals。HP比例用BigInt精确比较，避免safe整数相乘越界后精度丢失。
- Counter先用BigInt检查数学和仍处于safe integer范围，再截到声明min/max；溢出拒绝，饱和产生的0实际delta仍写trace。Flag重复写也各写一条trace。Counter/Flag trace和guard read带 `encounterLocal` 及局内键；HP trace带Actor身份与实际before/after；guard trace含实际读数与分支结果。
- `resourceChange` 只写含 source/action/path/account、已绑定受用身份、resourceId及delta的有序账本/意图trace，不读取余额、不产生资源before/after；余额和真实delta由外层兑现时补齐，避免资源重复应用或费用预聚合。
- 缺失source/primary、HP/cap（cap必须为正整数）或local key、无效detached Counter状态、safe整数溢出及未知指令均拒绝；错误时不返回部分plan。Encounter completion无source/primary绑定时仍不支持HP条件。

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 单来源行为与旧效果金样 | `npx vitest run tests/engine/gameplay-b-effect-planner.test.ts tests/engine/gameplay-b-effect-legacy-goldens.test.ts --silent` | 通过，退出码0；2 files / 23 tests | 新测试10项覆盖HP4/5、guard前后与else、counter +1/0/负向/overflow、重复Flag、HP0/cap边界、精确比例、missing身份/key、三类账本受用身份、legacy相位分片无重放且不计数、prepare、输入不变、4096/4097注入共享预算、短路、非法normalized op；旧金样13项未改。 |
| 类型 | `npx tsc --noEmit` | 通过，退出码0 | 以最终实现重跑通过。 |
| 架构 | `npm run check:architecture` | 通过，退出码0 | 基础层无新增反向依赖或写入口。 |
| 空白与范围 | `git --no-pager diff --check`；三个新增代码文件独立尾随空白扫描；只读 `git status --short` | 通过，退出码0 | diff check 有工作树中既有 U04 CRLF 提示，无空白错误；U06的三个代码文件无尾随空白，且只新增本Unit白名单路径。 |
| 文档 | `npm run check:docs` | 通过，退出码0 | Receipt 加入后检查1113篇Markdown，errors=0。 |

## 合同映射与需上游注意

| 合同 / ID | U06证据与边界 |
| --- | --- |
| E1-COMPAT-1 / NEW01 | `when`在当前位置读取规划HP/locals，只执行then或else一支；guard trace保存结果与实际白名单读数。资源不参与条件判断。 |
| D03 / NEW03 / NEW04 | Counter安全加法后饱和；溢出前拒绝；delta反复结算及0实际delta、Flag重复写可见。 |
| D06 / NEW06 | account标识按U03绑定到source Actor、primary Actor或来源Team；缺身份失败；不读取/支付资源余额。 |
| D07 / NEW07 | trace记录sourceKey、actionId、path、op、受用身份与变化/guard读数；资源before/after留给外层真实兑现。 |
| D08 / NEW07 | 唯一访问入口由外层注入；本helper不累计、不重置；resolve语句与实际条件访问逐项报告，短路/未执行branch不计，prepare不重复计数，旧模式不追溯计数。 |

无需因U06扩大接线接口。U07/U10应复用 `planMapEffectSource` 的phase切片能力、detached输出、prepare元数据和预算入口；若上游账本需要调整，先按实际Receipt更新对应白名单再接线，不把资源余额求值移入此helper。
