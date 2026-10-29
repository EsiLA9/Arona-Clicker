# Receipt Task 0322-U35

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | `story-schale-main.ts`改为nodes/stages声明；新增U35 Unit说明。合计6篇Story。 |
| 未完成内容 | 无；新Overlay/Theme宿主执行由parent的presentation/service Unit负责验收。 |
| 范围外变更 | 无 |
| GALHCG影响闭环 | 未写图、刷新或写freshness；集中Task收尾时复核。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| AST迁移 | `node scripts/migrate-story-content.mjs --include src/arona-clicker/content/story/story-schale-main.ts --write` | 通过 | 6篇转换；0 skip/0 issue |
| 新动作静态核对 | 只读查看生成的nodes/action载荷 | 通过 | Overlay show/clear、Theme、Choice goto/insert、clickWork+确认均使用新字段 |
| Base源码载入 | `node scripts/sync-base-datapack-bundle.mjs` | 通过 | 后续Unit执行；完整Base TypeScript源已载入 |
| 类型/测试/实屏 | 未执行 | 延后 | root负责最终类型和行为验证；此Unit不改UI/Host |

## 遇到问题

- 无；现有演出意图均映射到已声明的StoryAction载荷，没有静默丢弃字段。

## 需上游确认项

- 无。

## 事实更新建议

- 6篇夏莱演出Story已采用新原语；屏幕呈现的执行/owner合同不由内容迁移Receipt证明。
