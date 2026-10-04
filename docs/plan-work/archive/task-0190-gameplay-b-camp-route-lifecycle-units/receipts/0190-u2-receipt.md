# Receipt 0190-U2

| 项 | 内容 |
| --- | --- |
| 状态 | Route 核心 Unit 完成；GPT-6-Luna 上游只读复核通过，接口问题已修复；原组合 Route/camp U2 已 supersede，不作为单一完成 Unit |
| 实际修改 | `prototypes/gameplay-b/src/model.ts`、`prototypes/gameplay-b/src/runtime.ts`、新增 `prototypes/gameplay-b/tests/route-runtime.test.ts`、`0190-u2.md`；本 Receipt |
| 未完成内容 | 无 |
| 范围外变更 | 无 |

## 验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npm test -- route-runtime.test.ts runtime.test.ts`（在 `prototypes/gameplay-b/`） | 通过：2 个文件、24 项测试 | 覆盖 U1 五节点内容可赋值、活动起始且显式传 `initialParty`、入队/复活/名册顺序、seed 重放、HP 延续、全队活动倒地立即终止与 Click 边界 |
| 类型检查 | `npm run typecheck`（在 `prototypes/gameplay-b/`） | 通过 | `tsc --noEmit --project ./tsconfig.json` |
| 根文档检查 | `npm run check:docs`（仓库根） | 通过：546 篇 Markdown、0 错误 | Unit/Receipt 文件名去重，链接均解析 |
| 净行数 | 按 U2 新增块核算 | 451 行 | model 59、runtime 231、route-runtime.test.ts 99、Unit spec 44、Receipt 18；未计继承 0187–0189 文件内容 |

## 问题与交接

- R06/R09/R10 仍为原型暂定状态；全队活动后归零立即结束为用户确认边界。
- U2 仅交付 Route Runtime 核心；camp sCost 计算与消费由 U3 实现和验证。
- 独立复核发现战斗节点类型暴露了未被消费的 party/round/camp 字段；现已收窄为 `encounterId`/`enemies`，并加入 `shortRouteNodes` 赋值编译回归。
