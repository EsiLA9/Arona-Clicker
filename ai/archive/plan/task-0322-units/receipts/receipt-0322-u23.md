# Receipt 0322-U23

| 项 | 内容 |
| --- | --- |
| 状态 | 进行中（Host快照行为通过；服务集成验收与全局类型检查待上游收尾） |
| 实际修改 | 新增闭合StoryPresentationSnapshot；Host按run跟踪ephemeral主题/story实体覆盖/Overlay，支持纯保存及新runId恢复 |
| 未完成内容 | Task集成验证中的旧owner字段期望由上游更新；全局 `tsc` 尚被其它迁移文件错误阻断 |
| 范围外变更 | 无 |
| GALHCG影响闭环 | 合并到所属Task收尾复核；本Unit未获图维护授权 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/story-node-presentation-host.test.ts` | 通过 | 7项通过；覆盖隔离清理、owner/run事件、卡片请求、主题背景、Overlay增删及恢复不重放标题 |
| 集成测试 | `npx vitest run tests/engine/story-node-playback.integration.test.ts` | 失败 | 6项中5项通过；剩余1项期望值未含新增的 `owner:null` 字段，事件实现正确，待上游同步断言 |
| 类型检查 | `npx tsc --noEmit --pretty false` | 失败 | 当前全局9项错误在其它服务/存档/旧测试迁移文件；本Unit模块未出现类型错误 |
| 架构检查 | `npm run check:architecture` | 通过 | Engine / Data Services 未新增越界依赖 |
| 差异检查 | `git diff --check` | 通过 | 仅CRLF转LF提示，无空白错误 |
| 文档检查 | `npm run check:docs` | 失败 | 30项全局遗留错误：旧 StoryFlow / Talklet 路径、未创建的其他Unit测试路径、重复U30名称；未指向U20–U23文件 |
| GALHCG | 合并到Task收尾 | 未维护 | 本Unit未授权写图或刷新 |

## 遇到问题

- 无（Unit实施尚未开始）。

## 需上游确认项

- 无。

## 事实更新建议

- 无。
