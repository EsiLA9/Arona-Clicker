# Task 0297：Gameplay B MapRun 敌我统一单位卡与行为牌叠放

状态：implemented — 源码与类型检查完成；待浏览器视觉验收。

> 归档冻结：2026-10-19。保留实现状态；浏览器视觉验收仍待完成。

## 目标

将新版 Gameplay B MapRun Workspace 的我方与敌方单位呈现为共用的 UnitCard：统一身份、类型、HP 与 sCost 信息面；把行为卡作为稳定叠放的纸牌呈现在单位卡右下方，并支持可逆的 Override 选择。正式行动仍只由中下指挥区 Commit。

## 设计边界

- 本 Task 包含：共同 UnitFace；HP / sCost 位置；Buff 预留空间；右下不可见 CardAnchor；只悬挂当前已选且会生效的准备行为牌；点击该牌展开未选替换候选，重按当前牌取消，选择浮层牌只修改当前草稿。
- 我方与敌方共享尺寸、信息层级与卡牌容器结构；阵营只使用轻量视觉标记区分。
- 明确非目标：新增多行动槽、改变抽牌或 MapRun 规则、提前结算 Action、伪造敌方手牌 / sCost、使用战斗 RNG 计算旋转角度。
- 卡牌投影只消费只读 MapRun View 与现有 `hands` / `overrides` / `draftVersion`；缺少合法敌方数据时呈现意图、卡背或空态。

## 当前事实与代码落点

| 已核实事实 | 源码依据 | 对本 Task 的影响 |
| --- | --- | --- |
| MapRun 我方单位由 `renderActivePartyMember` / `renderPassivePartyMember` 输出；敌方由 `renderEnemyRegion` 输出。旧实现将全部 Hand 候选都画在单位卡上，容易被理解为多张牌会同时生效。 | `src/ui/components/map-workspace.ts`、`src/ui/css/map-workspace.css` | 单位右下只悬挂当前生效的一张牌；未选候选只在点击当前牌后临时展开。 |
| Encounter View 提供 `preparedActions`、每人的 `hand`、`overrides`、legal targets 与 `draftVersion`；Run 提供 party current HP / actor resources。MapRun 没有专属 sCost 字段，actorResources 是通用资源，不能直接冒充 sCost；Run 的 party HP 也不含 maxHP，Encounter View 才含 party HP 上限。Enemy view 只有 ID、HP、damage，没有敌方 Hand 或专属 sCost。 | `src/arona-clicker/contracts/runtime.ts`、`src/arona-clicker/contracts/map-run.ts` | 我方卡牌使用现有候选与草稿；sCost 保留未提供占位，HP 上限仅使用 Encounter 的权威投影；敌方只显示当前投影可证明的数据，不伪造卡牌与资源。 |
| Map DOM 以语义 region key 协调刷新，控制器通过 `data-map-*` 委托处理换牌和目标选择。 | `src/ui/controller.ts`、`src/ui/controller-actions-operation.ts`、`src/ui/workspace/map-dom-updates.ts` | 保留当前 UnitFace / 卡牌的 region identity、Focus、target selection 与滚动位置。 |

## 施工切片

### P0：共用单位信息面

- 整理 MapRun 只读单位投影与共用 UnitFace，统一名称/类型、HP、sCost 布局；当前 MapRun Enemy 没有头像字段，头像只在有可信 Presentation 查询时显示。
- 敌方 UnitFace 直接排列于右栏，不额外套带标题、边框与底色的“活动敌方”大容器。
- 保留单位目标入口、卡牌语义标记、Focus 与滚动 owner。

### P1：右下行为卡叠与 Override

- 单位右下只显示当前生效的 `preparedAction` 一张牌。点击它展开未选候选；再次点击当前牌取消候选层；点击浮层候选才执行 Override 草稿更新。未选牌从不作为悬挂牌呈现，避免暗示多张牌同时生效。
- 卡片可超出 UnitFace；布局为叠放保留空间并避免被单位列裁切。当前 MapRun Enemy 缺少可公开行为卡时保留空态 / 意图态。
- 从稳定视觉 Key 派生当前牌的小角度，不访问 MapRun RNG。
- 点击可替换牌只展开合法候选；选择仅更新本地 Override 草稿并收起候选，不结算。

## 验收

- [x] 我方、敌方共用同一 UnitFace 几何和信息层级；缺少的数据不伪造。
- [x] HP / sCost 共用信息槽位；只在有权威 maxHP 时呈现比例，MapRun 未投影的 sCost 显示未提供。当前生效牌在单位卡右下延伸，角度从稳定 Key 派生。
- [x] 仅当前生效牌悬挂；点击打开未选候选，再点当前牌取消；选择浮层候选沿用现有草稿命令，不提交，Commit 仍是唯一结算入口。
- [x] 保留原单位目标委托与 Map region/focus key；换牌按钮独立命中，不复用单位目标按钮。
- [x] `npx tsc --noEmit` 通过（2026-10-19）。尚未进行浏览器人工视觉验收。

## 当前核验（2026-10-19）

- 已完成共用 UnitFace、仅悬挂当前生效牌与 Override 候选浮层接入；再次点击当前牌取消浮层，候选选择才更新草稿。替换命令执行前显式关闭 manual Popover，避免 Map DOM 按稳定 ID 复用候选层时残留打开状态。本次修复不改变状态命令。`npx tsc --noEmit` 通过（2026-10-19）；未运行测试或浏览器验收。
- 当前数据限制：MapRun 没有 sCost 字段，Run Party HP 未提供最大值，Enemy 没有公开行为牌；界面保留占位或未投影提示，不从通用资源或旧 Operation 数据推导。

## GALHCG 影响闭环

- 发现路径：从 `AGENTS.md` UI 入口读取 UI Presentation 包，核对 MapRun Runtime Workspace contracts、renderer、DOM update 与委托 controller。
- 变更审查：实现后对直接变更路径只读复核；未获图谱维护授权前不提交图编辑。
- 地图维护：本 Task 的 UI 呈现不改变领域状态归属；暂不做图写入或 freshness 刷新。

## 剩余工作

- 浏览器人工确认卡牌遮挡、列边界与 Popover 定位；如发现视觉问题再按实际观感微调。未运行测试。

## 相关路由

- `docs/ai/goal-workflow.md`
- `docs/ai/context-packs/ui-presentation.md`
- `ui-style/patterns.md`
- `src/ui/components/map-workspace.ts`
- `src/ui/css/map-workspace.css`
- `src/ui/workspace/map-dom-updates.ts`
