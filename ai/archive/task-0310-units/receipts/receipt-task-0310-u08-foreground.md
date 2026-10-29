# Receipt task-0310-U08

- 状态：完成；共享 UI 前台门控，Hero 渲染/点击共同消费。
- 验证：4/4 门控测试通过；覆盖全局/owner、选择、确认、提交、passive leaveArea:false。
- 限制：UI modal 属于 Controller，点击时补其 isOpen，不向 Runtime 注入 PanelState；打字阶段不一概阻断。
- 未完成、范围外变更、需确认：无。
- GALHCG：阶段末直接路径复核，无写图。
