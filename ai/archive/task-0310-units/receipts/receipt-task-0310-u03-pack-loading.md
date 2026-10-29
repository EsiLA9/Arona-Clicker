# Receipt task-0310-U03

- 状态：完成；parser 贯通 areaMaps，补齐既有 maps 列表；Runtime 配置/选择/apply 与 GameInstance.init 接最终引用验证；新增 ZIP/分片测试。
- 验证：三个文件 12/12 测试通过。ZIP fixture 首次缺 name/version，被既有 manifest 一致性校验拒绝；补齐后通过。`npx tsc --noEmit` exit 0。
- 未完成、范围外变更、上游确认：无。
- 另经负责人复核 U02：RevealTrigger 实际判别为 reveal，condition 可选；修正验证器并加回归，属于 U02 原白名单。
- GALHCG：阶段末直接路径复核；无地图维护授权。
- 事实更新建议：完整启用集必须执行 validateAreaMapRefs。
