# Receipt task0282-U6：真实发布内容回归

实现：内存GameInstance加载defaultDatapack、Carousel与StrategyPark，并使用Runtime补充Affector／Trigger源。断言剧情入口、Spot→OperationEvent、信用点反向关系、真实actor team与多actor-type候选存在，而不仅断言已发出的关系没有错误。

验证：`npx vitest run --silent tests/engine/runtime-content-browser-published-content.test.ts tests/data/runtime-content-operation-references.test.ts` 2files/7tests通过。全部确定非candidate关系无missing／ambiguous。

边界：正式样例heldItemIds为空，持有物品缺失／合法判定由U8夹具验证。只读内存加载，不写存档／包库／发布包。地图直接路径返回unreferenced_path，未维护图谱。
