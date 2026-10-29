# Receipt task-0283-U3：详情分区与引用阅读

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | src/ui/runtime-editor/codex-details/render.ts：完成“资料／被引用／技术详情”三层；按真实引用者、用途和完整路径分组；分离 direct/self/derived/runtime-rule/candidate；加入局部位置提示与定位、部分覆盖说明、primitive 引用数组导航，并避免 resolved 引用重复展示候选。 |
| 未完成内容 | 本 Unit 内无未完成项；浏览器与整合检查由主线程统一验收。 |
| 范围外变更 | 无；未修改 Schema、玩法写入流程或玩家存档。 |

## 验证

- npx vitest run --silent tests/ui/runtime-editor-codex-details.test.ts：13/13通过，覆盖资料字段、来源路径分组、候选与覆盖提示、技术出向及字段树。
- 主线程五文件 UI 批次：5 个文件、62/62通过；npx tsc --noEmit、npm run check:architecture、npm run check:docs、git diff --check通过。
- 1440×900桌面浏览器：真实Area显示13个引用者／14条引用路径；点击跨筛选Spot后显示筛选外提示与主动定位，返回恢复原筛选、条目和“被引用”页签。Operation详情展示出向关系、局部路径、缺失推断、覆盖说明与字段树；长ID布局未造成页面横向溢出。
- 窄屏浏览器验收按用户要求排除在本轮范围，不作为本 Unit 的阻塞条件。
- 截图保存在当前任务的 Codex visualization 输出目录；未操作用户现有 Edge 标签页。

## GALHCG

沿用 project_id=acprogram 做直接路径只读复核；未刷新、写入 freshness 或维护图谱。
