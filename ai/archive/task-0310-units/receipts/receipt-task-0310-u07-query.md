# Receipt task-0310-U07

- 状态：完成；新增 detached 查询契约与领域 AreaMapQuery，经 GameInstance/GameReadModel 暴露；RuntimeAreaDraft 补充可选地图入口。
- 验证：单图循环读取、隐藏节点/连线与目标脱敏、OR Reveal、定义热改、Map 锁定、broken ref 共 4/4 集成测试通过。
- 查询不依赖 UI，不写存档；公开 revision 只含公开投影。
- 未完成、问题与上游确认：无；运行时输入类型余下一处留后续集成。
- GALHCG：阶段末直接路径复核，无图写入。
