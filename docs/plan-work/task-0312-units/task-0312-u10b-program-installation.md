# Unit 0312-U10B：新程序公开安装与事务验收

状态：completed — 本页仅保留施工计划；实际修改与验证结果以对应实施 Receipt 为准。
> 现行作者合同与迁移结果以 [[docs/docs-829/03-data-structures/datapack-contracts]]、[[docs/plan-work/task-0315-gameplay-b-legacy-action-migration-and-removal]] 和对应 Receipt 为准；本页的旧字段与 legacy 执行说明只记录当时施工计划，不是当前作者入口。

实际接口核对：U10A已在`MapRunEncounterCommitPlan`及typed Preview/Receipt预留版本、`effectScope`、`programVisits`、`plannedLocals`、`effectTrace`，Receipt装配代码已存在但被`encounterHasProgramActions`安装保护拦住。B仍需去掉该保护和Preview pending诊断、将下一轮`createEncounterSnapshot`的`currentEncounter.locals`改为本轮`plan.plannedLocals`（旧图保留原兼容），并验深复制/冻结、prepared token重放与GameInstance库存连续安装。实际资源trace op为`resourceSettlement`，纯核的resourceChange意图不再输出为实际trace。U10A保守净改动875行，低于上限；B仍按530–885行估算和1000行额度施工。

## 范围与预算

允许文件：

- `src/arona-clicker/services/map/map-run-service.ts`：净增40–100行，Receipt、locals与detached nextRun安装接线，移除U10A Commit保护。
- 新增（执行时才创建）：tests/engine/gameplay-b-effect-program-commit.test.ts；350–550行，公开GameInstance Commit、原子失败、幂等和跨Owner库存。
- `tests/engine/gameplay-b-effect-card-prepare.test.ts`：修改过渡门测试为实际新program Commit正例，净增0–25行。
- `tests/engine/gameplay-b-effect-program.test.ts`：仅更新U10A临时安装保护相关的canCommit/诊断/公开Commit断言，净增0–20行，不改已验收的费用、预算及效果期望。
- 新增实际 `docs/plan-work/task-0312-units/receipts/task-0312-u10b-receipt.md`：50–80行。

初估440–755行，待U10A真实接口复核；上限1000行，不扩至其它Owner或runtime源码。

上述U10A测试同步追加后预算为440–775行，四条源码/测试加Receipt；用于移除阶段保护后保持既有用例真实有效。

2026-10-22负责人接收U10A约90–110行用例迁移：在本Unit新测试补完整NEW01 primary初HP4/5、guard前后治疗两种顺序及Team med结果；NEW03/04 Counter上下界饱和、实际零delta、Flag true→false双记录及MAX_SAFE_INTEGER算术溢出先于clamp整轮拒绝。分别核公开Preview与GameInstance实际Commit/零安装，不改变归档合同ID含义。新测试预算调整为440–660行，总估算530–885行，仍≤1000。UI readmodel对trace的完整投影属于U15，本Unit不提前修改runtime查询层。

### 已核实的真实Owner验收入口

负责人委派U08代理只读核对后的最小场景为：Item成功及相同request重放/跨轮locals；草拟Item后移除库存的双Owner原子拒绝；活动切换重置locals；4097访问预算的公开Commit零安装。复用原父Unit Read Set及其fixture：`createLegacyGoldenOwner(map,itemCount)`、`draftToken`、`commitCommand`，以及已有source-transactions“rechecks useCondition at Commit and rejects missing Inventory with zero writes and no item event”和金样“OLD source order...”骨架。activities场景须用`createLegacyGoldenRuntime`后正常start/move，固定seed由Owner抽Hand；`draftToken`未带activityId，命令从真实snapshot补全。不得把内部MapRun的Item保护拒绝当成GameInstance双Owner原子性证明。预算fixture以U10A真实产物为准，不提前假设导出。

## 施工与验收

1. 从U10A实际plan安装locals、trace/version及旧settlement投影，通过现有Prepared token、canInstall/install和GameInstance两Owner连续安装，不能新增真实状态写入口。新活动初始化自己的locals；失败/离开清除；旧图字段兼容。
2. 验证Preview重复零写、公开Commit结果与Preview一致、same request不重算/重复费/库存、无效预算/账本/费用/版本/Scope均零安装；真实Item库存不足时MapRun与库存均不变。NEW02旧聚合拒绝不改为AG成功。
3. 对U10A的prepare+resolve访问总数断言，prepare每次从0、重放不执行；旧金样保持通过。U10A暂存的所有未完成原U10用例在此补齐，不用内部helper测试冒充公开Commit。
4. 验证新旧定向套件、map-run、source-transactions、tsc、architecture、docs及空白检查。Receipt逐项映射U10原Work Items和NEW/EQ，只有原U10完整通过才解除U11/U12依赖。GALHCG范围累计U19统一只读复核。

当前不做U11 condition、U12 receipt恢复校验或U13存档恢复。
