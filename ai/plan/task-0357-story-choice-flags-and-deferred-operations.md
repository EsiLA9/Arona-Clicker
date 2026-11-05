# Task 0357：Choice 收敛为条件与局部 flags，业务效果迁至后续节点

状态：待施工 — 已记录用户方向并核对现有表达能力；本轮仅建档，未修改内容、编辑器或引擎

## 目标与范围

- 目标：大量撤离多选 Choice 内的效果内容。Choice 负责展示选项、按需判断选项是否可行，以及为所选分支提供 Entry 局部 flags；后续 Operation 根据 flags 承担业务效果与演出。
- 范围：盘点并迁移内置 Story 的 Choice `sharedActions` / `options[].result`；同步游戏内 Story 编辑器的作者入口、投影与校验、运行时相关调用方、内容样例和测试。是否收紧正式合同另见下方待裁定项。
- 迁移后的作者规则：选项保留身份、文案和可选 `condition`；选项结果仅保留 `localFlag` 写入 / 移除，共享动作仅承担必要的局部标记维护。资源、物品、持久 flag、旅行、表现、Entry 请求等实际行为从 Choice 中撤出。
- 非目标：不扩大到单按钮 Button、入口卡或 Entry 完成奖励的全面重构；不新增全局分支状态、不改成按 flag 值比较、不设计通用条件执行语言；本 Task 建档不代表施工已经开始。

## 已核对事实与约束

| 事实 | 依据与实施含义 |
| --- | --- |
| 当前 Choice 可直接携带任意 StoryAction 和 transfer | `src/data-services/contracts/story-node.ts` 的 `StoryChoiceInteraction`、`StoryChoiceOption`、`StoryNodeResult`；播放器先执行 sharedActions，再执行所选结果 actions，之后处理转移。不能只隐藏 UI 或静默丢弃旧字段。 |
| 现有局部标记已足够表达选择到后续节点的门控 | `StoryNodePlayer` 使用 Entry 运行中的 `localFlags`；`requiresFlag` 只检查键存在。false、0 等值仍会通过，迁移默认写入 `true`，未选择分支必须缺键。 |
| flags 生命周期与持久 flag 不同 | `goto` / `insert` 共用本次局部表；新 Entry 不自动继承，明确子调用的返回白名单除外。`state.effects[].setFlag` 写持久状态，必须迁到后续 Operation，不能直接替换为 localFlag。 |
| 编辑器已有绑定与清理能力 | `bindStoryNodeToChoiceOption()`、`choiceOptionFlagBindings()`、局部标记级联改名等位于 `src/ui/story-editor/model.ts`；Task 0341 已有配对标记、重复 Choice 清理和拖放复用。优先复用，不另建绑定存储。 |
| Operation 与 Transfer 职责分开 | Operation 携带一个 StoryAction；其 state 动作可保留有序 effects 批次。goto / insert 需移为后续带 `requiresFlag` 的顶层 Transfer；移动可使用已有移动节点，不把转移塞入 Operation。 |
| 拆出 Operation 会改变等待点与错误边界 | 当前 Choice 提交预检所选结果，Operation 到达时独立预检 / 执行并呈现。迁移须核对副作用顺序、失败时是否部分执行、存读档与重播，不能仅比较最终数值。 |
| 已发现实际迁移样例 | `story-abydos-main.ts` 的 Choice 写持久 `abydos_choice`；`story-millennium-main.ts` 含持久分支标记及选项 goto；`story-schale-main.ts` 含带持久标记的 insert / goto。此为入口样例，尚非完整盘点。 |

机制依据：[[story-and-effects]]；相关既有工作：[[ai/plan/task-0341-story-choice-flag-bindings]]、[[ai/plan/task-0344-story-operation-checkpoints]]。

## 施工步骤与验收条件

### 1. 完整盘点并确定收紧边界

- [ ] 列出内置 Choice 的 Story ID、节点 ID、选项 ID、condition、共享 / 结果动作、transfer、flags 写入及消费者，形成逐项迁移清单；区分纯标记、业务效果和混合顺序。
- [ ] 查找旧持久分支 flag 的全部读写方；确认迁移后持久写入仍在正确位置，既有条件与外部消费者不失效。
- [ ] 核对未应用草稿、包导入、构造器和测试夹具的旧 Choice 形状；决定正式合同是否收紧及旧内容处理方式，再实施相应限制。

### 2. 按分支迁移内容

- [ ] 为迁移选项写入无冲突的局部标记；后续 Operation / Talklet / Transfer / 移动节点复用 `requiresFlag`。保留选项 ID、文案、可行性条件与原有用户选择结果。
- [ ] 重复进入 Choice 时先清理本 Choice 的旧分支标记，再写入当前分支；不清空其他 Choice、初始投入或明确回传的 flags。
- [ ] 业务动作按原顺序迁移，原 state effects 批次尽量保持为一个 Operation；共同业务动作位于选择成功后的正确位置，不能无条件搬到 Choice 前面而提前执行。
- [ ] 原选项 transfer 移到对应分支最后的受控 Transfer；insert 仍返回正确后继，goto 不吞掉本应先发生的对白或效果。仅互斥标记命中的分支执行，其余节点无副作用地跳过。
- [ ] 对混合 flags / 业务动作、Entry 替换、失败预检等不能直接等价平移的项目逐项说明处理，不静默改变顺序或接受部分结算。
- [ ] 同步实际使用的基础包内容产物，并验证 Registry 装载；生成与导出入口施工时核对，不手改生成 Schema 或构建目录。

表达示例（作者结构示意，非新增合同）：

```text
Choice.sharedActions：移除本 Choice 旧分支标记
  选项 A（可选 condition）→ localFlag set route_A = true
  选项 B（可选 condition）→ localFlag set route_B = true
Operation [requiresFlag=route_A] → 原 A 的资源 / 持久 flag / 演出等动作
Operation [requiresFlag=route_B] → 原 B 的动作
Transfer  [requiresFlag=route_A] → 原 A 的 goto / insert（如有）
Transfer  [requiresFlag=route_B] → 原 B 的 goto / insert（如有）
```

具体节点排序以各分支原始动作与转移顺序为准；不要把所有分支动作机械地按类型重新分组。

### 3. 收敛作者入口并贯通验证

- [ ] Choice 编辑页优先呈现选项条件与局部 flags，移除普通业务动作 / 内嵌 transfer 的新建入口；保留原有绑定卡、标记改名、复用与反查能力。
- [ ] 已有旧字段或本地草稿须可见地诊断 / 迁移；类型切换、加载、保存和正式投影不能静默丢内容，也不能把休眠旧字段误当有效新内容提交。
- [ ] 若决定收紧合同，联动类型、投影、校验、构造器、Schema 与独立编辑器协议；按 [[ai/guide/conventions/schema-sync]] 生成并验同步，不手工编辑生成协议。
- [ ] 更新调用关系视图与对应测试：已迁出的 Choice 效果 / transfer 不再作为原选项调用位置，后续 Operation / Transfer 的关系可正确查询和跳转。

### 4. 行为验收与文档

- [ ] 两个互斥选项只触发各自 flags 与后续效果；不可用选项拒绝提交，不写 flags、不发生业务效果。补充可重复 Choice 由 A 改选 B 的回归。
- [ ] 覆盖多项有序效果、共同效果、持久 flag 消费者、Entry 请求、goto / insert 返回及跨文档局部 flags；不得重复执行或泄漏到其他 Entry。
- [ ] 覆盖 Choice 提交前后和 Operation 等待点的存读档、不重复结算、失败预检与重播跳过持久效果。已有运行游标遇到改动后的定义，沿用当前显式失配 / 重启策略，不写旧存档迁移或暗中补状态。
- [ ] 验证编辑器输入焦点、滚动、绑定 / 解除、草稿保存再载入和发布。按实际影响运行定向 `npm test -- ...`；输出统一归 `.test-artifacts/`。
- [ ] 更新 [[story-and-effects]]、[[runtime-editor-and-project-checks]]，若调整 UI 则同步 `ui-style/patterns.md`；执行文档、类型及必要的 Schema / 架构检查。地图只读复核在完整工作节点收尾集中完成。

## 待裁定问题

1. **正式合同收紧程度**：推荐先完成清单和内置内容 / 作者入口迁移，再按覆盖结果决定是否让 Choice 的共享 / 结果动作正式只接受 localFlag、禁止 option transfer。用户目前确认的是撤离方向，不把“大量撤离”自行解释成立即拒绝所有外部旧包。
2. **旧草稿与外部包**：若执行严格拒绝，需确定采用显式迁移工具还是诊断后人工修改；不能自动删掉不再支持的效果。该决定不涉及新增玩家存档兼容层。
3. **难以等价平移的边界**：若拆分等待点或预检确实需要改变失败语义，列出具体样例、影响和最小方案后裁定；不默认引入新批处理或事务框架。

## 相关文件与资料

| 路径或链接 | 用途 | 当前状态 |
| --- | --- | --- |
| `src/data-services/contracts/story-node.ts`、`story-node-actions.ts` | Choice、结果、局部 flag 与 Operation / Transfer 合同 | 已核对现状；未修改 |
| `src/arona-clicker/services/story/story-node-player.ts` | 条件准入、动作顺序、局部 flags、等待点与恢复 | 已核对关键路径；待行为基线 |
| `src/data-services/authoring/story-definition-projection.ts`、`src/data-services/validation/story-run-flags.ts` | 正式投影与局部标记验证 | 已定位；待按裁定核对 |
| `src/ui/story-editor/model.ts`、`property-fields.ts`、`property-model.ts`、`controller.ts` | 配对标记、作者表单、草稿分支与编辑交互 | 已核对绑定和共享动作入口；待迁移 |
| `src/ui/story-editor/relations-model.ts`、`relations-view.ts` | Story / Entry 调用关系与来源显示 | 本会话已有实现；待验证迁移后的调用位置 |
| `src/arona-clicker/content/story/`、`src/arona-clicker/content/def-factory/story.ts`、`src/arona-clicker/content/base-pack/content.json` | 内容源、构造器与实际基础包 | 仅初步定位样例；完整清单和产物路由待核对 |
| `tests/engine/story-node-player.result.test.ts`、`story-run-flags.test.ts`、`story-run-flags.integration.test.ts`、`story-node-save.integration.test.ts` | 选择、标记、运行状态与保存回归 | 已定位；本轮未运行 |
| `tests/data/story-node-authoring.test.ts`、`story-node-structure.test.ts`、`tests/ui/story-editor-*.test.ts` | 投影、形状、绑定与编辑流程 | 已定位；本轮未运行 |
| `docs/docs-830/05-domains/story-and-effects.md`、`docs/docs-830/07-tooling/runtime-editor-and-project-checks.md`、`ui-style/patterns.md` | 当前机制与作者规范 | 已有入口；施工后按影响更新 |

文件表用于交接，不是修改白名单。工作区已有未提交的 Story 迁移和编辑器改动，施工时保留并核对，不把已有改动归为本 Task 产出。

## 当前进度与验证

- [x] 核对 Choice 结果执行顺序、localFlags / requiresFlag 能力及现有绑定卡。
- [x] 建立迁移范围、待裁定项、实施步骤与验收条件，登记活动索引。
- [ ] 完成逐 Story / 节点迁移清单，开始内容与作者入口施工。
- 正在进行：无；等待后续施工指令。
- 下一步：从完整盘点和既有行为基线开始，先核对混合动作 / transfer 与持久 flag 消费者。
- 本轮验证：`npm run check:docs` 通过（123 篇 Markdown，0 错误），定向 `git diff --check` 通过；未运行产品测试或浏览器验收。
- 地图只读复核：Task 与索引精确路径均返回 `unreferenced_path`，没有直接 Evidence / maps_to 可比对；已核对实际文档，未改图、未刷新、未写 freshness。
- 剩余风险：完整迁移规模、外部旧包和草稿处理策略尚未核定；不得把本 Task 的提案当作已经生效的合同。
