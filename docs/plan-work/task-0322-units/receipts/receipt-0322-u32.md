# Receipt Task 0322-U32

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | `src/arona-clicker/content/def-factory/story.ts`改为nodes/stages构造；删除`src/arona-clicker/content/def-factory/talklet.ts`；`def-factory/index.ts`移除旧作者helper导出；`story-node.ts`更新为正式StoryDef作者格式说明；新增U32 Unit说明。`src/data-services/contracts/story.ts`中的StoryDef新继承关系由前序工作写入，本Unit保留。 |
| 未完成内容 | 全仓类型检查仍因并行StoryService工作中的`validateCursors`调用与当前服务声明不匹配而报2错；该范围由Root/StoryService agent继续处理。 |
| 范围外变更 | 无 |
| GALHCG影响闭环 | 当前Unit集中只读；未改图、刷新或写freshness。合并到Task收尾核对。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 源码核对 | 阅读StoryBuilder及正式StoryNodeDocument契约 | 通过 | `StoryBuilder`只接收已声明StoryNode和阶段记录，不再构建旧Talklet |
| 源码类型检查 | 针对Base内容源和Registry引用规则运行`npx tsc --noEmit`定向检查；另运行全项目`npx tsc --noEmit` | 本Unit文件通过；全项目有2处外部错误 | 通过（限定于本Unit） | 全项目错误为`runtime-game-instance.ts`与`runtime-save.ts`读取StoryService.validateCursors；已报告Root，不改并行StoryService文件 |
| 空白核对 | `git diff --check` | 通过 | 仅CRLF转换提示，无空白错误 |
| 定向测试 | 未执行 | 延后 | 按主Agent分工由root统一维护并运行测试 |
| GALHCG | 只读 | 延后集中核对 | 未写图或freshness |

## 遇到问题

- 删除`TalkletBuilder`会使仍使用旧factory的测试/非Story调用方暂时类型失败；当前没有保留兼容重载，root已接管测试迁移。

## 需上游确认项

- 无。

## 事实更新建议

- `StoryNodeDocument`已成为正式StoryDef字段来源；后续文档状态由root在Task主文档收尾统一同步。
