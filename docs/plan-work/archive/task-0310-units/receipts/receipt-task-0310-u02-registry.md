# Receipt task-0310-U02

- 状态：完成；修改 Registry、validateDatapack，新增 area-map-validation.ts 与 area-map-registry.test.ts。
- 实际验证：新增 10 测试先失败，实施后 `npx vitest run tests/data/area-map-registry.test.ts` 10/10 通过。
- 未完成：Runtime 最终启用集入口留 U03。
- 问题、范围外变更、需上游确认：无。
- GALHCG：阶段结束按直接路径只读复核，不维护图。
- 事实更新建议：load/validate 仅证明形状，validateAreaMapRefs 证明最终引用集。
