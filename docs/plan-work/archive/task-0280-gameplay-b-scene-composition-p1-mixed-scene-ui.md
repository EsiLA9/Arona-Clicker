# Task 0280：Gameplay B 场景组合 P1——混合 Scene UI 与人工验收

**状态：代码待人工验收（Pending Manual Acceptance）**  
**范围：** Operation Workspace、View 投影、Controller、正式 Rest 样例、Atomic Scene 内容修订及自动化回归。  
**边界：** 不增加 Scene Runtime owner、Rest 专属页面、结算器或新的卡牌生命周期；不启动 Task 3。

## 当前结果

- 混合 Scene 可显示我方 Character 的自动 Action、Target、Wait 和单槽 Intervention 状态；未修改的自动计划可直接提交。
- 玩家 SceneCard、固定 SceneAction 与 Character 自动计划进入同一批次。普通 Decision / Shop 不会因此触发 Character 自动计划。
- 新增正式入口 `Gameplay B 休整演示`：两名学生按各自的 Character Hand、Profile 优先级和合法目标行动；玩家初始获得两张 SceneCard，可在后续批次选择其中一张；未用卡保留。
- Atomic Scene 的「检查故障设备」现在要求玩家主动选择；Skip 不会揭示线索。
- 重新开始入口仅在行动结束后显示，启动一个新的演示 Run。

## 变更文件

本 Task 直接涉及的主要文件：

- `src/arona-clicker/contracts/operation-view.ts`
- `src/arona-clicker/services/operation-view-projector.ts`
- `src/ui/components/operation-workspace.ts`
- `src/ui/controller-actions-operation.ts`
- `src/ui/components/center-panel.ts`
- `src/arona-clicker/content/operation-samples/rest-scene-demo.ts`（新增）
- `src/arona-clicker/content/operation-samples/gameplay-b-datapack.ts`
- `src/arona-clicker/content/operation-samples/atomic-scene-demo.ts`
- `tests/ui/gameplay-b-rest-scene-ui.test.ts`（新增）
- `tests/ui/gameplay-b-operation-entry-registry.test.ts`
- `tests/ui/gameplay-b-operation-controller.test.ts`
- `tests/engine/gameplay-b-save-resume.test.ts`
- `docs/docs-829/02-modules/ui.md`
- `docs/docs-829/03-data-structures/operation-view.md`
- `docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md`

`tests/engine/operation-scene-character-actions.test.ts`、Runtime 合同、内容校验与 Schema 文件还包含此前 Task 1 / P0 工作区中的变更，本 Task 未将它们全部重新归为 UI 工作。

## 自动化验证

定向测试命令：

```text
npx vitest run tests/engine/gameplay-b-save-resume.test.ts tests/engine/operation-scene-character-actions.test.ts tests/engine/operation-view-projector.test.ts tests/engine/operation-runtime-service.test.ts tests/engine/gameplay-b-scene-action-sample.test.ts tests/engine/gameplay-b-operation-sample.test.ts tests/ui/gameplay-b-operation-entry-registry.test.ts tests/ui/gameplay-b-operation-controller.test.ts tests/ui/gameplay-b-rest-scene-ui.test.ts tests/ui/operation-workspace-view.test.ts --silent
```

结果：10 个文件、117 项通过。另已通过：

- `npx tsc --noEmit`
- `npm run check:architecture`
- `npm run check:docs`
- `npm run gen:schema`
- `git diff --check`（仅有既存文件的 CRLF/LF 提示）

未运行浏览器点击、截图或视觉模型验收。Headless DOM 测试不代表视觉通过。

## 人工验收指南

### 环境与入口

1. 在项目根目录运行 `npm run dev:game`。Vite 配置使用本地 `5173` 端口；若终端报告端口被占用，以终端给出的实际地址为准。该脚本打开 `src/ui` 游戏入口，默认地址为 `http://localhost:5173/`。
2. 在夏莱办公室聊天流找到 Operation 入口。若当前安装的包库没有 Gameplay B 入口，打开「数据包管理」，在「未启用」中将 **Gameplay B Carousel Demo** 加入启用集并 Apply，然后回到办公室。
3. 演示要求账号已持有且解锁小鸟游星野、黑见芹香。Operation 入口不会补发角色；缺少任一角色时需换用已具备这两名角色的存档。
4. 选择「Gameplay B 休整演示」并开始。完成后回到聊天流，使用该入口上的「重新开始Gameplay B 休整演示」按钮重开初始状态。不要为本指南清除或覆盖现有存档。

### 推荐的最少操作路线

**Run A：直提交流程、第二轮与玩家卡。**

1. 打开「Gameplay B 休整演示」。检查两名学生各自的自动行动/目标、两张当前角色候选牌、两张玩家场景手牌，以及固定的「整理休整清单」行动（M01）。
2. 不选择角色牌、不指定目标、不选玩家手牌，直接按「确认本批」。应同时结算两名学生与 fixed 行动，出现结果并进入下一批（M02）。
3. 在第二批提交前，检查两名学生的新候选手牌及仍保留的一张未使用玩家手牌（M06）。
4. 选择一张玩家场景手牌，确认费用预览只扣 1 Cost，然后按「确认本批」。角色自动行动和玩家卡应同批结算，剩余 Cost 与未使用手牌保留；整备度达标后显示完成（M03、M08）。

**Run B：单角色目标覆盖与撤销。**

5. 重开演示。在星野当前指向队友的目标行动上，将目标改为星野本人；确认只显示星野为「玩家覆盖」，芹香保持自己的自动计划（M04）。
6. 对星野按「取消修订」，确认目标恢复为自动选择的队友。可直接提交一批；结果中星野使用恢复后的自动方案（M05）。

**Run C：Skip。**

7. 再次重开演示，第一批按「跳过本批」。固定行动与两名学生的自动行动仍应结算；玩家手牌不应被使用。第二批可直接提交以完成演示（M07、M08）。

**常规场景回归。**

8. 回到聊天流，开始「场景选择与临时购买演示」，进入「补给采购与库存复核」。不应出现本 Task 新增的自动 Character 计划；原有 PurchaseOffer / SceneAction 交互仍可用（M09）。
9. 回到聊天流，开始「原子场景演示」，在「调查故障设备」选择「跳过本批」。不应获得调查线索，场景应保持未完成；之后选择「检查故障设备」并成功提交，线索才出现（M10）。

M01–M08 是本 Task 核心人工验收；M09–M10 是常规场景与 Atomic 内容回归。请同时留意三栏布局、标签区分、目标覆盖提示、费用说明、重复提交反馈和窄窗口溢出；这些视觉结论只由实际观察填写。

## 人工反馈记录

初始状态：**未测试**。请按实际操作更新，不要将自动化测试结果填作人工通过。

| 编号 | 结果（通过 / 失败 / 未测试） | 实际观察、操作前后关键状态 | 截图或录屏位置 | Console 错误 |
|---|---|---|---|---|
| M01 | 未测试 |  |  |  |
| M02 | 未测试 |  |  |  |
| M03 | 未测试 |  |  |  |
| M04 | 未测试 |  |  |  |
| M05 | 未测试 |  |  |  |
| M06 | 未测试 |  |  |  |
| M07 | 未测试 |  |  |  |
| M08 | 未测试 |  |  |  |
| M09 | 未测试 |  |  |  |
| M10 | 未测试 |  |  |  |

**视觉与交互观察：**

- 三栏布局与窄窗口：未测试。
- 自动行动、玩家手牌、固定行动的辨识：未测试。
- 被覆盖目标和撤销反馈：未测试。
- 费用提示、提交反馈和多轮状态刷新：未测试。
- 其他问题 / 复现步骤：

## 限制与后续

- 浏览器中的实际入口、交互连续性、屏幕适配和视觉可接受性尚未验证。
- 当前账号需预先拥有并解锁星野、芹香。
- 当前只保留已有单槽 Action/Target Intervention；没有增加额外发牌、每批补牌、洗牌、角色独立干预槽或作者预设向导。
- **Task 3 Readiness：** Task 1 Runtime 合同与本 Task 的混合 Scene UI / Rest 样例已为作者侧 Pattern 预设提供可复用基础；在 M01–M08 人工验收及反馈处理前，Task 2 保持未完成，本 Task 不启动 Task 3。

## 收口条件

用户完成并反馈 M01–M08；处理发现的 P0/P1 阻断；确认没有严重视觉阻断后，才将本 Task 移入 `archive/` 并更新索引状态。
