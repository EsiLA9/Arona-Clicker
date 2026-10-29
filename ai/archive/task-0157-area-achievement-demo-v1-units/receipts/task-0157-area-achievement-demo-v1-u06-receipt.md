# Execution Receipt：Task 0157 U06

日期：2026-09-26

## 结果

- Runtime Wiring 将既有 EffectEngine 与 DevLog 注入 MilestoneAdapter；新增依赖位于构造参数尾部并可选，兼容现有直接构造点。
- 只有 `completeMilestone()` 返回 `true` 时才查找关联 Listener 并运行非空 `then`。完成事实提交后先撤出 Watch，再同步执行 EffectEngine；旧的无 Listener Milestone 仍只写完成事实。
- EffectEngine 抛错时吞掉异常并记录 error DevLog，消息包含 Milestone 与 Listener ID；完成事实不回滚，也不会在读档、`resumeInit` 返回或定义更新后重放。
- Runtime 测试验证 `addResource` 对原唤醒资源产生同步事件时仍只执行一次；异常路径验证完成事实、错误日志和不重试；旧 Milestone 验证无效果。

## 验证

| 命令 | 结果 |
| --- | --- |
| `npx vitest run tests/engine/milestone-runtime.test.ts tests/engine/milestone-adapter.test.ts` | 通过；2 个文件、17 项测试通过 |
| `npx tsc --noEmit` | 通过；无输出 |
| `npm run check:docs` | 通过；errors: 0，scanned markdown: 317 |

## 限制

- EffectEngine 的 `void` 接口无法识别未抛异常的业务拒绝；本 Unit 只记录可捕获异常，不回滚、不重试或补发。
