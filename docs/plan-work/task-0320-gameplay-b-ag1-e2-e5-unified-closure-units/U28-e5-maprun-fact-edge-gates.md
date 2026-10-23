# Task 0320-U28：MapRun Fact 路线边门控

> **状态：实现与自动化验证完成。** 本 Unit 为 P5 增加 Counter/Flag 对路线 Edge 的单条件门控；不扩展成通用布尔表达式。实屏记录单已交付，尚未人工执行。

## 目标

让 MapRun Fact 能控制地图路线是否可走。Runtime 移动判定与只读 Workspace 路线状态必须使用同一个纯判定结果。

## 冻结合同

- 一条 Edge 最多有一个现有 `condition`。
- 保留 `{ kind: 'teamResourceAtLeast', resourceId, amount }` 的原语义。
- 新增与候选池 gate 同形的单项 Fact 条件：
  - Counter：`{ kind: 'counter', counterId, comparison, value }`；`comparison` 限 `eq | lt | lte | gt | gte`，`value` 为安全整数。
  - Flag：`{ kind: 'flag', flagId, value }`；`value` 必须是 boolean。
- 引用必须存在于该 Map 的 `mapRunFacts` 且类型一致；MapRun Facts 未声明时不能引用。
- Fact 条件只允许用于显式 `executionContractId: 'AG-1'` 的 Map；既有资源门槛继续兼容 E1。
- 每次 `move` 读取当前已安装的 MapRun Fact 状态；门控只读、不消费、不写入。一次 Commit 更新 Facts 后，后续移动立即看见新值。新 Run 从声明初值开始；Restart 沿用本 Run 的 Facts。
- Workspace 对同一当前值执行同一判定，并将条件、满足状态和不可用原因投影到既有路线选择卡。Fact ID 使用作者声明 ID，不建立额外名称表。
- MapRun Facts 的保存、Restore 与 Effect Commit Receipt 结构不变；Map 内容改变 Edge 或相关 Fact 语义时作者提升 `resumeVersion`。

## 不纳入

- 多条件组合、否定、任意条件 AST、资源与 Fact 混合表达式。
- Edge 条件消费资源、修改 Facts 或直接改变当前 Node。
- 跨 Map 状态、Story/AC 状态及活动 Encounter/Activity 期间移动。
- 改变候选池的 Encounter 入场快照规则。

## 实施与验证

- 复用 Candidate Pool 的 Counter/Flag 字段和值域约定，Registry 校验 Edge 引用的 MapRun Fact ID 与类型。
- 抽出纯 Edge 条件判定，让 `MapRunService.move` 与 `GameInstance` Workspace 投影共用。
- 扩展既有路线只读 view 与 Flow 状态文案；沿用既有卡片身份、刷新边界和交互方式，不增加 DOM 节点。
- 覆盖 Counter 比较、Flag 真/假、未声明/错类型引用、当前 Facts 更新后的移动结果、Restore 后门控状态以及 UI 与 Runtime 一致性。
- 生成 Schema、运行相关 Registry/MapRun/Flow 定向测试、类型和文档检查。

## 屏幕验收

人工步骤与记录字段见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U28-screen-acceptance-report]]；自动化验证完成不代表人工屏幕验收通过。

## 文件范围

- `src/data-services/contracts/gameplay-map.ts`
- `src/data-services/registry/registry-validate.ts`
- `src/arona-clicker/contracts/runtime/runtime.ts`
- `src/arona-clicker/services/map/map-edge-conditions.ts`
- `src/arona-clicker/services/map/map-run-service.ts`
- `src/arona-clicker/runtime/runtime-game-instance.ts`
- `src/ui/flow/map-flow-model.ts`
- 对应的 Registry、MapRun、Flow 测试、Schema 同步与正式示例／机制文档。
