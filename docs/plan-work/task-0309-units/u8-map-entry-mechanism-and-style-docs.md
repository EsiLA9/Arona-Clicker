# Unit 0309-U8：MapEntry 机制与视觉复用记录

## Goal

把已施工的 MapEntry 路由、信息责任、局部刷新与来源失效行为写入机制文档和风格复用表；同步 Task 当前状态与剩余验收项，不覆盖并行 Area Map 文档更新。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| Task | `docs/plan-work/task-0309-maprun-staging-and-reentry-workspace.md` | 保持交付事实、限制与未完成项一致 |
| 机制 | `docs/docs-829/06-wiki/50-ui/refresh-update.md` | 唯一权威点记录区域更新与失效恢复边界 |
| 风格 | `ui-style/patterns.md` | 记录新 Workspace 的视觉与组件复用关系 |
| 源码 | `src/ui/components/map-entry-workspace.ts`、`src/ui/controller.ts` | 复核当前真实结构与更新入口 |

## Constraints

- 仅写源码已确认的事实；不声称完成浏览器视觉验收或行为测试。
- 风格文档只写复用模式，不复制完整 DOM、机制细节或 CSS 数值。
- Task 状态改为施工中，明确 Schema 冲突、测试 / 浏览器验收和其他待续事项仍未完成。
- `ui-style/patterns.md` 有并行 Area Workspace 改动；新增独立 MapEntry 行，不回滚或重写已有 Area 内容。

## Allowed Files

- `docs/docs-829/06-wiki/50-ui/refresh-update.md`
- `ui-style/patterns.md`
- `docs/plan-work/task-0309-maprun-staging-and-reentry-workspace.md`

## Explicit Non-goals

- 不改源码、测试、生成 Schema、Task 索引或 GALHCG 图。
- 不运行测试或文档生成任务。

## Completion Criteria

- [x] 机制页准确说明 MapEntry 专属 region 更新、keyed reconciliation 与返回条件。
- [x] 风格页新增准备页的组件复用 / 展示责任条目，保留并行 Area Map 内容。
- [x] Task 正文从待开工更新为施工中，并列出真实完成和阻塞项。
- [x] 记录独立 Receipt 与验证范围。
