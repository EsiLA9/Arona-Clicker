# Receipt Task 0322-U31

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | 新增 `scripts/migrate-story-content.mjs`、配套声明`migrate-story-content.d.mts`与`tests/data/migrate-story-content.test.ts`；新增U31 Unit说明 |
| 未完成内容 | 动态Talklet数组/运行时变量不转换；明确输出issue由调用方手工处理。正式内容已迁移并回归检查。 |
| 范围外变更 | 无 |
| GALHCG影响闭环 | 仅核对项目身份 `acprogram` 并只读搜索；未修改图、刷新或写freshness。集中直接影响核对合并到Task收尾。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 脚本语法 | `node --check scripts/migrate-story-content.mjs` | 通过 | 只检查脚本语法，不执行游戏测试 |
| 命令说明 | `node scripts/migrate-story-content.mjs --help` | 通过 | 默认只读预览；写回必须显式传 `--write` |
| 生产内容AST预览 | `node scripts/migrate-story-content.mjs --include src/arona-clicker/content/story --include src/arona-clicker/content/character/bond-content.ts --include src/arona-clicker/content/character/affection-content.ts` | 通过 | 静态识别43篇Story，0 skip/0 issue；未写文件 |
| 测试内容AST预览 | `node scripts/migrate-story-content.mjs --include tests` | 部分完成 | 静态识别41份旧Story，1个含动态变量`[talklet]`的数组被报告，未改文件 |
| 转换器合同测试 | `npx vitest run tests/data/migrate-story-content.test.ts` | 通过 | 7项覆盖Story对象静态/动态数组、choice共享/候选动作、回复归属、14种state命名参数/动作边界、单击/多击确认边界和表现/Entry请求 |
| clickWork边界复核 | 对照HEAD `story-flow.ts:rollClickWorkTotal/clickSend` | 通过 | 静态总量1只生成单个Click并附动作/转移；静态必定大于1保留工作press加确认Click；`base=1, rand>1` 可随机得到1或更高值，转换器返回`ambiguous-click-confirm`并保留源码，要求人工重写 |
| HEAD回放审计 | 将9份Story作者文件从`git show HEAD:<path>`输入`convertSourceText`并对照当前文件 | 通过 | 43篇Story，0 issue；确认旧choice页面忽略sendText，修正阿比多斯p5与千年p4的误映射reply |
| Story结构检查 | 通过Vite SSR载入Base源，对43篇执行`validateStoryNodeStructure` | 通过 | 43篇，0 invalid |
| TS调用声明 | `npx tsc --noEmit` | 转换器导入通过 | 全仓仅剩另一StoryService工作中的2个`validateCursors`类型错误，与新声明无关 |
| 测试套件 | 未执行 | 未执行 | 按主Agent分工由root负责全量fixture迁移和验证 |
| GALHCG | 只读 | 延后集中核对 | 无图写入或freshness写入 |

## 遇到问题

- `tests/engine/game-instance.test.ts` 中一份测试Story的 `talklets` 数组引用了运行时变量，不能安全静态展开；脚本保留原文本并报告 `dynamic-talklets` / `unknown-talklet`，交root按测试意图手工迁移。
- 卡片/入口请求需要目标Entry类别和owner；工具API可经`options.entryTypes/entryOwners`显式提供，未提供时拒绝猜测。
- choice页面旧服务转入`mode:'choice'`时不使用Talklet级`sendText`；转换器不把它提升成候选reply。旧页面级效果映射到sharedActions，所选候选动作和transfer维持其后顺序。
- 旧`clickSend`仅当按击总量大于1时，把总量内的点击作为工作进度并要求额外确认；静态总量恒为1时同一次点击即推进。随机总量在1与大于1之间变化的页不能通过固定节点序列精确保留，转换器明确报issue而不猜测。

## 需上游确认项

- 无；动态变量的手工处理已由root接管。

## 事实更新建议

- 当前Task正文对Story源仍记为后续全量切换；本Unit只交付离线迁移工具，正式切换与Runtime JSON需等U32以后完成后再由root更新正文状态。
