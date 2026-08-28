# 01-architecture/overview — 系统全貌

> 本文回答：**这个系统是什么、核心思想是什么、仓库有哪些目录。**
> 时序细节见 [[docs-828/01-architecture/run-logic]]；模块定位见 [[docs-828/00-INDEX]] 的模块卡片索引。

## 核心思想

这是一个**事件驱动 + 声明式数据包**的放置类角色扮演游戏引擎。

| 思想 | 含义 | 落点 |
| --- | --- | --- |
| 数据包声明式 | 游戏逻辑尽量写成 `Datapack`（JSON/TS 定义），由引擎子系统解释执行，而非硬编码 | `src/engine/types/` 是唯一事实源；`tools/datapack-editor/` 可视化编辑 |
| 单一写入口 | 所有状态变更经 `StateMutationService`，禁止绕过直改 `PlayerState` | [[docs-828/04-algorithms/state-mutation]] |
| 事件驱动 | 写状态后广播事件，联动逻辑做成 Trigger / Affector 订阅响应 | [[docs-828/04-algorithms/trigger-effect]] |
| 只读 UI | UI 只消费 `getView()` / `createUIContext()` 的不可变快照，类型面收窄为 `UIFacingGame` | [[docs-828/02-modules/ui]] |
| 三层状态 | 跨世界线（global）/ per-Init 快照 / per-Init 当前 | [[docs-828/01-architecture/state-layers]] |

## 主干调用链

```text
main.ts
  └─ new GameInstance()          wiring.ts 按域装配全部子系统（构造器只剩 new + wire）
       └─ init(datapacks)        加载数据包 → 校验 → 建索引 → 建产出树 → 进入默认世界线
            └─ start()           启动 1 tick/秒 会话循环
                 └─ tick()       每帧：生产结算 → 持续效果 → 剧情推进 → 阻断复检 → 统计
```

完整时序见 [[docs-828/01-architecture/run-logic]]。

## 目录速览

| 目录 | 一句话职责 |
| --- | --- |
| `src/engine/core/` | 事件总线、Tag 路径、DevLog、运行时主题等横切基础 |
| `src/engine/types/` | 全部实体/状态/表达式/事件类型定义（**数据结构的唯一事实源** + `EVENT_CATALOG` 事件登记表） |
| `src/engine/registry/` | 数据包注册表 + 加载校验（表驱动 merge/clear，恒只读） |
| `src/engine/def-factory/` | 各实体的 builder（测试与数据包构造用） |
| `src/engine/expression/` | 数值表达式、条件系统、Funclet、统一数值（GameNum） |
| `src/engine/effect/` | Effect 引擎、Affector 持续效果、Trigger 事件触发、演出响应器 |
| `src/engine/system/` | 各领域系统：状态写入、Tick、角色、抽卡、培养、色彩、通讯录… |
| `src/engine/game/` | 高层门面服务：装配接线（wiring）、Init、Story、Spot、Session、存档 |
| `src/engine/stats/` | 三层统计（global / init / session）+ Tag 统计 |
| `src/engine/visibility/` | 可见性快照引擎（事件驱动增量） |
| `src/engine/extra/` | Extra 附加数据树（三层合并） |
| `src/engine/image/` | 图片资产（PicDef 登记与解析） |
| `src/data/base/` | **默认数据（TypeScript，默认加载的是这里）** |
| `src/ui/` | 前端 UI，只读消费 |
| `tests/` | vitest 测试（与引擎实现目录基本镜像） |
| `tools/datapack-editor/` | 数据包编辑器 + Schema 协议（`engine-defs.gen.json` 为生成产物） |
| `datapack/` | 可选导入的 JSON 数据包（**非默认加载**） |
| `scripts/` | 构建辅助脚本（gen:schema / 打包 / 历史重构迁移脚本） |

## 技术栈与工程配置

- TypeScript + Vite（构建）+ vitest（测试）；无框架依赖的 DOM UI（`src/ui/`）。
- 命令见 [[docs-828/00-INDEX]] 命令速查。
- 存档走 localStorage（`src/save/storage.ts`）；**项目不做存档迁移**（结构可破坏性变更，旧档直接清）。

## 下一步

- 建立运行心智模型 → [[docs-828/01-architecture/run-logic]]
- 理解数据怎么放 → [[docs-828/01-architecture/state-layers]] + [[docs-828/01-architecture/data-flow]]
