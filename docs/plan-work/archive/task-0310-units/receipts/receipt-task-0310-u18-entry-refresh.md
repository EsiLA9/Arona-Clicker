# Receipt task-0310-U18

- 状态：完成；无地图 session 时原位更新 Hero/地图入口 disabled/aria/title，并随 Area 入口关联变化增删地图按钮；AreaHero 页面中的地图入口提示先返回游戏。
- 原因：真实浏览器中到达剧情完成后旧按钮仍禁用；仅靠 Reveal 指纹不能表达前台门控变化。
- 验证：新增真实 Story 开始/清理、按钮身份保留、关联变化与无 full render 回归；最终 Controller 10/10 测试通过。浏览器复验剧情完成后 Hero/Map 均恢复，再次打开共享入口图成功。
- 范围外修改、未完成与确认：无。
- GALHCG：rail/controller/测试直接路径已只读复核，无图维护。
