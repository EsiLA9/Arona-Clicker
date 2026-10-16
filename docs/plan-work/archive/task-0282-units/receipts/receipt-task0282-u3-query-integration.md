# Receipt task0282-U3：统一引用与只读查询合同

实现：一般／Operation collector统一正反向索引；local owner/path/context、candidate与sourceCategory透传；确定诊断与覆盖分离；接现成owner并纳入指纹；未知来源不猜namespace；原始DTO与字段树安全读取accessor／循环。

验证：`npx vitest run --silent tests/data/runtime-content-browser.test.ts` 10/10通过；`runtime-content-browser-rules.test.ts`此前3/3通过。开始时新回归曾3失败／6通过，修复后全过。覆盖同ID跨类型、说明／状态键、来源变化复用对象、clear与未知内容、只读快照安全。

地图：contracts与browser、query test直接路径为content_changed（旧Evidence基准已过期）；所有owner分页完整；新types未映射。只读复核，未刷新或写图谱。最终类型／架构结果见父Task最终验收。

边界：定义通过替换／重载更新；不跟踪任意深层原地修改。覆盖始终partial；没有全表来源台账。
