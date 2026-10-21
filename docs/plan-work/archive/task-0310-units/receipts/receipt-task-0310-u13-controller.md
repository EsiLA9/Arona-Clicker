# Receipt task-0310-U13

- 状态：完成；Controller 接地图 coordinator，region dispatcher、Tick/Reveal/Chat 局部刷新、导航和 destroy/reset 生命周期。
- 实际验证：`npx tsc --noEmit` exit 0；`npm run check:architecture` 通过。首次类型检查发现 WorkspaceLocation.route 含 legacy 字符串，已使用既有 normalizeWorkspaceRoute 修正。
- 动作：点击重核会话/图/节点/投影版本；同步提交锁覆盖命令与嵌套 EventBus；失败保留会话，成功只排一次移动通知并合并退出结构更新。
- 未完成：U15 真实 Controller 回归与最终浏览器验收。
- 范围外修改、确认项：无。
- GALHCG：阶段末直接路径只读复核。
