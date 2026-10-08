# Task 0247：Gameplay B 卡牌二次拖拽与全牌目标语义

状态：complete — U0 调查、U1/U2 实施、定向验证、GALHCG 写后核验与独立验收均已完成。

## 目标

统一“外部场景牌拖到角色卡”的后续操作：第一次拖放给出执行角色；挂靠后，再拖卡牌只选择它当前可选的效果目标；再次单击卡面则退出/卸下该外部牌。移除角色牌上的 `operation-player-card__tools` 下拉工具栏，不再用 Alt 拖动区分执行者与目标。

同时逐项审查当前移植的所有 Gameplay B 卡牌，将牌面说法、Runtime 实际效果、目标集合与目标是否可重拖列成可核对的清单，并修正确定无歧义的错文案/目标范围。目标为 `none` 或当前唯一合法目标的牌不伪装成可重选目标的卡；多名合法对象才开放二次目标拖放。

## 已核实的现行合同

1. Gameplay B 角色战斗牌来自 `OperationCharacterHandSnapshot` / `OperationViewActor.profile.actionOptions`；当前计划牌已经使用“角色牌 → 合法目标”拖放，不经过场景批次。
2. Location SceneAction 与有限 PlayerSceneCard 是外部场景牌。第一次拖到角色时，写入 `OperationSceneDraft` 的 `actorId`；玩家牌同时作为本批已选牌。Action 的 `targetActorIds` 另存，不能把 performer 与 target 合并。
3. 当前外部牌已挂靠后仍会走 `scene-owner-target`，另一名合法 performer 会触发改派；legal target 与 performer 候选重叠时还需 Alt。PlayerSceneCard 通过 `operation-player-card__tools` 里的执行者/目标控件绕过拖拽。这与经典角色牌的二次目标拖放不同。
4. PlayerSceneCard 点卡可撤销并回到共享手牌；Global SceneAction 点卡不会解除角色挂靠。Individual SceneAction 本来就是按角色提供的选择，不能误作“拖入后外部牌”的退出操作。
5. Resolution planner 对每个 `targetActorId` 应用整份 Action effects。因此含 Actor effect 的全队行动是对选择列表逐对象结算；场景牌成本属于 PlayerSceneCard 实例或 SceneAction 包装，不应固化在共享 Action 描述中。

## 全量卡牌语义审查表

审查范围是当前 `gameplay-b@1.0.0` Strategy Park 13 地点与 Carousel Safety 样例，按 Action 定义合并重复包装，但分别记录实例成本、SceneAction 选择策略和目标集合。

### Carousel Safety：战斗牌及现场牌

| 卡牌 | 当前效果 | 目标语义 / 二次拖放 | Task 处理 |
| --- | --- | --- | --- |
| 压住制动杆 | 旋转木马 HP +1，并可与节奏信号合流 | 唯一合法对象是旋转木马；硬目标，不可拖去重选 | 保留 `allowedActorIds=ride`；展示固定目标，不启动目标拖拽 |
| 节奏信号 | 危险度 -1；技能规则另有 5% 获得专注；以同一目标匹配制动合流 | 旋转木马是组合锚点，不是 HP effect recipient；硬目标，不可重选 | 保留唯一锚点；清楚标为固定合流对象，目标 hover 只呈现固定关系 |
| 护住设备外框 | 旋转木马 HP +1 | 唯一目标，硬指示 | 保留固定目标，不启动目标拖拽 |
| 紧急停机 | 星野体力 -1、危险度 -4 | `target:none` | 直接生效，无目标拖拽 |
| 疏导游客 | 小组协调 -1、危险度 -3 | `target:none` | 直接生效，无目标拖拽 |
| 破坏安全闩 | 任意 Actor HP -1；当前 `any` 会把学生、对手、设施都列入候选 | 内容名指向设施安全闩，但目标过宽 | 将目标范围收窄到旋转木马；唯一候选后固定，不可拖选其他角色 |
| 制造混乱 / 机械惯性 | 分别危险度 +2 / +1 | `target:none` | 直接生效，无目标拖拽 |
| 检查控制台 / 引导游客 | 揭示事实+获得员工证 / 危险度 -1 | `target:none`；Individual，每名角色各有一个 required 选择 | 角色已预分配；不出现虚构目标拖拽 |
| 全队急救 | 对每个选定队员 HP +1、危险度 -1；SceneAction 包装 2 Cost，玩家牌副本 1 Cost | sameTeam 多目标；Global 默认可选多名，牌实例费用不同 | 共享 Action 文案去掉硬编码 Cost，说明逐名结算；UI 费用读 SceneAction 或 card instance；多个合法目标允许重拖 |

### Strategy Park：角色牌与敌方意图

| 卡牌 | 当前效果 | 目标语义 / 二次拖放 | Task 处理 |
| --- | --- | --- | --- |
| 快速射击 | 选中对手 HP -2 | otherTeam，单名 effect recipient；多对手时可重拖 | 保留；文案明确所选的一名对手 |
| 压制射击 | 对所选对手 HP -1，并危险度 -1 | otherTeam；同一目标逐次结算 effect | 保留；文案明确逐名目标与实际效果 |
| 掩护同伴 / 前排护卫 | 同队目标 HP +1 / +2 | sameTeam，若合法目标多于一人则可重拖 | 保留；单一合法对象自动固定，多对象可重选 |
| 观察战场 | 危险度 -1 | `target:none` | 直接生效 |
| 进入前排 | 执行者自身改为前排 | `target:none` | 直接生效，不把执行者错误呈现成效果目标 |
| 倾听维修员 / 缓和交涉 / 请求维修通行证 | 分别风险 -1；风险 -2+揭示配合事实；揭示事实+发通行证 | otherTeam 选择交涉对象；对象是叙事参与者，数值/事实/物品写入仍是事件级，不改变该 NPC 状态 | 保留为“交涉对象”选择；说明中明确对象用途与全局效果，多个可交涉对象可重拖 |
| 领取巡查任务、追踪轮迹、联系服务亭、搜索镜面迷宫、检查摩天轮面板、寻找员工入口、搜索维修抽屉、检查控制台、东门交接 | 揭示事实或发放物品；不消费 Actor target | `target:none` | 均直接生效；任何仅因 UI 形状而出现的 Actor 目标都视为缺陷 |
| 急救队员 / 后台休整 | 同队所选目标 HP +2 | sameTeam，多人可重拖，单人则固定 | 保留；目标由效果实际消费 |
| 复位备用电源 | 当前只有同队目标 HP +1；Strategy Park 没有电力轨道 | 牌面“电力复位”与实际治疗效果不符 | 本 Task 选择不新增轨道/效果，改名与描述为控制室协助队员，并明确 HP +1；若以后要实际复位电力，另立规则变更 Task |
| 登记控制台记录 | 揭示控制台事实，不作用于 Actor | `target:none`；Global SceneAction 固定纳入、免执行者、不可取消 | 保留固定纳入语义；作为非交互的固定牌展示，不提供点击退出或目标拖放 |
| 碰碰车冲撞 / 烟花骚乱攻击 / 领头者攻击 | each Action 一次对 target HP -1，不是全队 AoE | otherTeam 单名目标，可重拖 | 保留单体结算，统一改成明确“一名队员受到 1 点伤害”的描述 |

总计复核 36 个不同 Action 定义（Carousel 11、Strategy Park 25），并核对 SceneAction/PlayerSceneCard 的所有重复包装、费用和 fixed/required 策略。初始清点漏掉 Strategy Park 的固定行动“登记控制台记录”；施工时按源码补入清单和回归覆盖。`target:none` 与硬目标均不会进入目标拖拽；合法目标超过一个才启用目标重拖。Narrative target 明确区别于 Action Effect 的 Actor recipient。

## 施工范围

### U0 — 现状调查（完成）

- 子 Agent 逐项核对两个 Gameplay B 样例、13 地点、角色卡池、场景牌副本、Action target/effect、SceneAction selection/performer 及现有测试。
- 子 Agent 只读核对 drag/click/controller/DOM 生命周期；未修改文件。

### U1 — 外部牌的角色挂靠与经典目标拖放

- 对首次拖进角色的 required PlayerSceneCard 和 Global SceneAction：写入 performer/owner，并保留各自 SceneDraft 事务。
- 挂靠后第二次拖动只从该卡 `legalTargetActorIds` 选择目标；绝不再次解析 performer 候选。不得出现 `scene-owner-target`、Alt 特判或因目标与角色集合重合而改派。
- 挂靠后单击卡面解除 owner/选择：PlayerSceneCard 回公共手牌；Global SceneAction 回地点公共选择面且保留当前 required action，等待再次拖入角色。fixed 卡不可退出。
- Individual SceneAction 与战斗 CharacterHand 保留各自“角色已拥有”的原交互；不要把其单击误作外部牌退出。
- 删除 `.operation-player-card__tools` 与执行者/目标 `<select>`。保留键盘操作：焦点牌面用 ArrowDown 展开直接按钮 tray；按钮完成 performer 或 target 动作；Escape 收起；目标拖放是鼠标主路径，目标 tray 不是下拉栏。
- `target:none` 没有第二拖拽；合法 target 单例显示硬指向并拒绝目标重拖；多个合法目标时拖到目标更新 SceneDraft 并绘制同一关系线。

### U2 — 数据文案与目标合同校正

- 按审查表修正 Carousel sabotage 的目标范围、团队急救共享 Action 描述、Strategy Park 三个敌方单体攻击描述和 Control Room 误称电力效果的 Action/SceneAction 标题文案。
- Narrative conversation target 保留为交谈对象，效果是 event-level；明示两者边界，不把其误描述为改变 NPC 属性。
- 不新增 Track、Effect DSL、Schema、保存字段、每角色物理牌堆或编辑器；目标选择性由当前 `legalTargetActorIds` 多重性决定，不改变 Cost、effect resolution、batch 数和 fixed/required。

### U3 — 实现与独立验收

- 实现子 Agent 修改 UI/controller/CSS、当前样例内容和必要测试。
- 验收子 Agent 独立核对任务每项、运行目标 Engine/UI tests 与类型检查，不编辑实现文件。发现问题反馈实现子 Agent修复，直到回归闭环。
- 覆盖首次挂靠→二次合法目标拖放→单击退出的 PlayerSceneCard 与 Global SceneAction；target 与 performer 候选重合时验证二次拖动只改 target；硬目标和无目标卡不误进目标拖拽。
- 验证 ArrowDown target/perfomer 按钮 tray 可操作、Escape 收起、fixed 不可取消、所有目标 summary/hover relation 与实际合法目标一致；dom 不再含 `.operation-player-card__tools` 或任何 performer `<select>`。
- 逐项断言全量卡审查表所列 target/effect 描述、单例锁定与可多选性；证明牌实例/SceneAction 费用与提交仍独立。
- 更新 `docs/docs-829/03-data-structures/operation-view.md` 与对应测试/卡牌机制说明；完成 GALHCG maps_to/Evidence 写后核验。无需浏览器，使用确定性 UI/Runtime 测试验收。

## 实施记录

- U1/U2 已完成：首次拖放只绑定执行者，挂靠后拖放仅处理多名合法效果目标；挂靠牌单击退出；Keyboard ArrowDown 展开直接 button tray、Escape 收起；单目标牌作为硬目标保留，无目标牌不提供目标交互。删除 performer/target 下拉路径与 `operation-player-card__tools`。
- 修正了安全闩目标过滤、团队急救说明、敌方单体攻击说明、控制室治疗牌名称与交涉对象说明；场景费用仍由 SceneAction / 物理 PlayerSceneCard 包装持有。
- 定向验证已通过：`npx tsc --noEmit`；`npx vitest run tests/ui/gameplay-b-operation-controller.test.ts tests/ui/operation-workspace-view.test.ts tests/engine/gameplay-b-operation-sample.test.ts tests/engine/gameplay-b-strategy-park-sample.test.ts --reporter=dot --silent`（4 files / 37 tests；含36个 Action 定义的表驱动语义断言）。`npm run check:docs` 通过（717 Markdown，0 errors）。
- 独立验收通过：验收 Agent 复跑 37 项定向测试与已列检查，并确认补充覆盖 Global SceneAction 二次拖放、fixed 卡不可取消及全量 36 Action 语义断言。
- GALHCG：刷新 5 个相关 Concept Evidence；更新/补齐 UI 命令、工作区渲染、EventRun Runtime、角色手牌解析、学生档案准入的代码/测试/文档映射及 Task/内容文案映射；`review_changes` 写后复核完成，证据令牌为当前读取快照。

## 验收清单

- [x] 外部牌首次拖到角色只设 performer；第二次拖动只设 legal target，绝不改派 owner；single click 退出且牌回正确来源。
- [x] Global SceneAction 与 PlayerSceneCard 同一行为；各自费用、batch 与 instance discard 行为不变。
- [x] 没有 `operation-player-card__tools`、执行者下拉/目标下拉及 Alt 目标模式；ArrowDown 直接按钮 tray 与 Escape 可用。
- [x] target:none 不显示目标拖放；单一合法目标硬指示/不可拖重选；多名合法目标支持目标拖放与 hover/focus 连线。
- [x] 36 个 Action 定义与 scene/card 包装通过语义表校验；已定的描述/范围错误修正，叙事目标与机械效果差异有清晰文案。
- [x] fixed 不可退出，required 可退出并可重选；无 Run 写入/费用/提交路径回归。
- [x] 子 Agent 独立验收确认实现符合 Task；TypeScript、相关 Vitest、check:docs 与 diff-check 通过。

## 文本-潜在解决方案

- Carousel 的芹香「节奏信号」对旋转木马的 TargetSpec 仅用于 `same-target` 合流，Effect 本身只改危险度/随机技能资源。Task 将其保留为固定合流锚点，而不是错误开放一个没有 gameplay 分支的可重选目标。
- Control Room 的「复位备用电源」没有电力 Track，实际仅给队员恢复 HP。本 Task 选用改正文案保留现有效果；添加电力数值与设备变化会扩大关卡规则、目标和验收，不在本轮默认隐式新增。
- 社交行动的 `otherTeam` Actor 是叙事交涉对象；当前状态变化写入事件轨道/事实/物品。保留对象选择，但牌面不得让玩家误以为对象的 HP/关系会改变。

## 相关资料

- [[archive/task-0246-gameplay-b-unified-actor-card-interface]]
- [[archive/task-0245-gameplay-b-operation-scene-card-performer-target-cost-model]]
- [[docs/docs-829/03-data-structures/operation-view]]
- [[docs/docs-829/04-mechanisms/arona-clicker/operation-runtime]]
