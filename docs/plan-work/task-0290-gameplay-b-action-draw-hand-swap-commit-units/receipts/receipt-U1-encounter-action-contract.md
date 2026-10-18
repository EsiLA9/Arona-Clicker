# Receipt 0290-U1：Encounter Action 作者合同

**结果：实现完成；独立复核通过。**

## 修改内容

- Map 现在可定义 Map-local Action，包含角色资格、目标、Actor / Team resource cost 与效果；Encounter 参与者按自己的正整数 Tendency 权重引用候选 Action。
- Map 显式声明 MapRun 初始 Actor / Team resources；缺少的余额按 0 初始化，不读取 PlayerState 或旧 EventRun。
- Registry 校验 Action 唯一性、角色准入、target/cost/effect 合法性、候选 ID 与资格、正权重、初始资源唯一性及非负安全整数。
- Registry 拒绝 Action、Target、Cost、Effect、Participant、Candidate 和初始资源对象的合同外字段，避免未知配置被 Runtime 静默忽略。
- Gameplay B 正常样例已有两名队员、三种 Action、不同 Tendency、显式资源初值与版本说明。

## 验证

- `npx vitest run tests/data/gameplay-b-map-registry.test.ts`：72/72 通过。
- `npx tsc --noEmit`：通过。
- `git diff --check`：通过；仅有工作区既有 CRLF→LF 提示。
- 独立只读审查第一轮发现 P2 合同外字段接受和 P3 两个重复准入用例缺口；已在原 U1 白名单内修复，并补八类未知字段测试、重复 Encounter participant 与重复 `eligibleCharacterIds` 测试。
- 独立复核最终通过，无剩余阻塞；复核者未改文件、未重跑测试。

## 边界与影响审查

- 改动限制于 U1 四个 Allowed Files；没有新增顶层 Datapack 表，也没有要求作者建立旧 Operation/Profile/CardPool/StrategyProfile 数据。
- 未改生成 Schema；新 Action 保持 Map-local，不引用旧 Event / Location / Scene Runtime。
- 只读 GALHCG 复核显示 Registry 与样例内容已变化、旧 Evidence stale；Map 合同与测试路径未关联。按总控 Task 约束，未写图或刷新 freshness。
- Draw / Hand / Save / Resume 运行状态由 U2 承接；本 Unit 不创建 Runtime 状态。
