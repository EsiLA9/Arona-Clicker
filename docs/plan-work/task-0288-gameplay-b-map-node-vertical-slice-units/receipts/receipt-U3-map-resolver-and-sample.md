# Receipt：Task 0288-U3 Map Resolver 与正式样例

## 完成内容

- 新增 `MapContentResolver` contract 与 Registry adapter；只读取 `Registry.maps`，未知 Map ID 返回 `null`，不依赖 Operation Resolver / Event / Location。
- 在既有 `gameplayBCarouselDatapack` bundle 中加入 Map A→B→C、B 上声明 `completion: { kind: 'manual', label }` 的 Encounter，以及引用同包 Map ID 的 Spot `mapEntry`。
- Resolver 测试按实际 Datapack Spot 的 `mapId` 定位 Map 定义，并从 `defaultDatapack` + Gameplay B bundle 经 Registry 加载后验证真实解析结果。
- 未修改 Runtime 包注册、默认启用选择、UI 或生成 Schema。

## 验证

- `npx vitest run tests/engine/gameplay-b-map-resolver.test.ts`：通过，1 个测试文件、2 个测试。
- `npx tsc --noEmit`：通过。
- `git diff --check`：无输出。

## GALHCG 直接路径只读复核

- 对新增 `map-content-resolver.ts`、`registry-map-content-resolver.ts` 与 `gameplay-b-map-resolver.test.ts` 执行 `graph_health(check="changed")`：均返回 `unreferenced_path`，当前图没有这些新路径的直接 Evidence 或 maps_to 关联。
- 本任务只做只读复核；没有负责人授权进行 `graph_edit`、刷新或写入图。源码与测试仍是实现事实来源。
