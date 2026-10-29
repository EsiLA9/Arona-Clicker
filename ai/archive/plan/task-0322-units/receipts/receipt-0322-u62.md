# Receipt 0322-U62

| 项 | 内容 |
| --- | --- |
| 状态 | 完成；真实Controller回归通过 |
| 实际修改 | Controller合并storyTriggered/storyRunEnded后的移动锁刷新，在同步结算与重入结束后读取最终锁值；仅锁状态改变时调用左侧Panel刷新 |
| 未完成内容 | 无 |
| 范围外变更 | 不调用整页render；AreaMap/Workspace与焦点维持既有专用局部刷新路径；Story领域准入不变 |
| GALHCG影响闭环 | 合并到Task收尾复核；本Unit未改图、刷新或写freshness |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 真实Controller回归 | `npx vitest run tests/ui/controller-story-movement-lock.test.ts` | 通过 | 2项；自动完成开幕正文后rail note清除移动锁提示、区域按钮可用，中心Panel身份保留且不全量render |
| 替换重入 | 同上 | 通过 | 同owner新run先安装后关闭旧run，rail不会短暂解锁或重复刷新 |
| 空白核对 | `git diff --check` | 待Task收尾复核 | 与全Task检查统一执行 |
| 文档检查 | `npm run check:docs` | 待Task收尾复核 | 由主Agent合并检查 |

## 需上游确认项

- 无。
