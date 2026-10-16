# Receipt task-0283-U8：类型资料 Profile

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | src/ui/runtime-editor/codex-details/profiles.ts、types.ts：补齐六类 Operation Profile 与 progression 嵌套路径；Event maxLocationVisits 按总访问数语义标记“位置访问总上限”；移除由身份栏负责且资料渲染会过滤的重复身份字段。 |
| 未完成内容 | 本 Unit 内无未完成项；详情断言按当前三层资料合同迁移归 U9。 |
| 范围外变更 | 无；未修改 render.ts、Schema、玩法或写入流程。 |

## 字段核对

- operation.ts 与 operation-route-evaluator.ts：Event maxLocationVisits 与累计访问数比较；OperationLocation.maxVisits 仍是单位置“访问上限”。
- character-variant.ts 与 character-progression-def.ts：嵌套字段为 skills、gearSlots、favoriteItem、uniqueWeapon、initialTraits；Profile路径与契约一致。curve仍在 CharacterVariant 顶层。
- render.ts 在身份栏／JSON中负责完整身份字段，资料Profile不重复输出 stories.name、resourceDisplays.resourceId 与 resourceDisplays.label。

## 验证

- U9完成断言迁移后，npx vitest run --silent tests/ui/runtime-editor-codex-details.test.ts：13/13通过。
- 主线程五文件 UI 批次：62/62通过；npx tsc --noEmit通过。
- 真实桌面浏览器已读取长 Operation ID 与实际 Operation Profile；详情文字和字段在 1440×900 视口内可访问。
- 窄屏验收按用户要求不在本轮执行。

## GALHCG

沿用 project_id=acprogram 对两个源码文件及Receipt做直接路径只读复核；未刷新、写入 freshness 或维护图谱。
