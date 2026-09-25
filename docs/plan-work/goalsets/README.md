# Goal Sets — 可删除的讨论区

这里承载一轮最终目标及其阶段 Goal，不是当前机制事实源，也不是施工入口。工作流、准入与删除规则见 [[docs/ai/goal-workflow]]。

## 创建

1. 用 `gs-YYYYMMDD-简短主题` 作为唯一 set-id，新建同名目录。
2. 从 [[docs/ai/templates/goal-set]] 复制 `<set-id>-set.md`；每个独立可验收阶段从 [[docs/ai/templates/goal-card]] 复制 `<set-id>-g01.md`、`<set-id>-g02.md` 等。
3. 只在 Goal 进入实际讨论时，另立全局编号的 `draft-*.md` 并登记到 `docs/plan-work/00-index.md`。Goal Card 可链接 Draft；Draft 不链接本目录内的可删除文件。
4. Goal Set 完成或需要清爽重启时，删除整个 `<set-id>/`，运行 `npm run check:docs`；正式 Draft / Task 仍可独立阅读。

## 文件边界

- 本目录的 `README.md` 是稳定路由；具体目标集均在 set-id 子目录。
- Goal Set 记完整终点、阶段关系和未知项；Goal Card 记阶段结果。Task 状态和测试结果在 Task，不复制到这里。
- 目录外文档不能建立指向具体目标集文件的 WikiLink；文档检查器执行这一规则。
