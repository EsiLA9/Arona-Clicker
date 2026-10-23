# Receipt Task 0322-U36

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | `character/bond-content.ts`与`character/affection-content.ts`改为nodes/stages声明；新增U36 Unit说明。合计5篇Story。 |
| 未完成内容 | 无；全量类型/播放测试待root联合收尾。 |
| 范围外变更 | 无 |
| GALHCG影响闭环 | 未写图、刷新或写freshness；集中Task收尾时复核。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| AST迁移 | `node scripts/migrate-story-content.mjs --include src/arona-clicker/content/character/bond-content.ts --include src/arona-clicker/content/character/affection-content.ts --write` | 通过 | 5篇转换；0 skip/0 issue |
| 旧作者形状扫描 | `rg -n "story\(|talklets\s*:|\.scene\(" src/arona-clicker/content --glob "*.ts"` | 通过 | 仅有新`story().stages().nodes()`调用；没有旧Talklet/scene字段 |
| Base源码载入 | `node scripts/sync-base-datapack-bundle.mjs` | 通过 | 后续Unit执行；完整Base TypeScript源已载入 |
| 类型/测试 | 未执行 | 延后 | root负责联合验证 |

## 遇到问题

- 无；showOpeningTitle移到第一段正文之前，addAffectionExp和互动阶段按原Story含义保留。

## 需上游确认项

- 无。

## 事实更新建议

- 羁绊/好感Story作者内容已切为新原语；StoryEntry owner与奖励规则未在本Unit修改。
