# Receipt 0289-U1：Map 固定队伍与初始 PlayerCost

**结果：实现完成；独立复核通过。**

## 修改内容

- `GameplayMapDef` 新增必填 `partyCharacterIds` 与 `initialPlayerCost`。
- Registry 校验队伍非空、角色 ID 非空且唯一、角色在当前 Registry 或本 Datapack 中存在；校验 PlayerCost 为非负安全整数。
- 正常 Gameplay B Map 样例声明固定队伍 `['shiroko']`、初始 PlayerCost `0`。
- 既有 `MapRunService` typed fixture 补齐新字段，不改运行时断言。

## 验证

- `npx vitest run tests/data/gameplay-b-map-registry.test.ts`：35/35 通过。
- `npx tsc --noEmit`：通过。
- 独立 Luna Max 复核：无阻塞发现。非阻塞观察：当前引用验证覆盖同包和“角色包先加载、Map 包后加载”；不支持未加载角色包的前向引用。现有 Map 正常加载依赖先加载 base 角色包，当前冻结合同不要求逆序包引用。

## 边界与影响审查

- 改动限制于五个 U1 Allowed Files；未触及 MapRun 运行逻辑、PlayerState、UI、旧 Operation 语义或生成 Schema。
- 只读 `graph_health(check="changed")`：Registry validator 与样例有直接 Evidence/maps_to，显示 `content_changed` / 旧 Evidence 待维护；Map contract 和两份测试没有直接 Evidence/maps_to，返回 `unreferenced_path`。按本 Task 限制未写图、未刷新 freshness。
- 未完成事项由 U2 固定队伍准入与 MapRun-local 状态承接。
