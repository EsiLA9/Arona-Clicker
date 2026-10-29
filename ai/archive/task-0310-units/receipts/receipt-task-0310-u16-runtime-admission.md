# Receipt task-0310-U16

- 状态：完成；GameInstance.init 在清理当前服务/Registry 前加载候选 Registry 并验证地图最终引用；RuntimeAreaInput 补可选 navigationMapId。
- 验证：area-map-runtime.test.ts 1/1 通过，证明失败不改变位置、当前表或 Runtime generation；最终类型/架构检查通过。
- 未完成、范围外修改、问题与上游确认：无。
- GALHCG：Runtime/Init/作者契约直接路径已只读复核，owner 分页读至 owner_complete=true；新测试无关联。
