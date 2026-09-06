# 01-architecture/module-dependency-baseline — 模块依赖基线

> 本文回答：当前模块归属、依赖方向和主要交叉点是什么。本文记录代码实况，不定义最终设计；历史施工背景见 [[0x-plan&work/completed/adr-0005-engine-domain-boundaries]]。

> 核对基准：2026-09-06 工作区代码。未提交改动可能使主题、Datapack 工作区和 UI Host Registry 相关文件继续变化。

## 核对范围

已检查 `src/engine/`、`src/data-services/`、`src/data/`、`src/ui/`、`src/main.ts`、`src/ui/main.ts`、`tests/`、`tools/datapack-editor/` 以及 `package.json`、`vite.config.ts`、`tsconfig.json`。

本基线只描述 import 和入口关系，不改变代码行为。

## 当前模块归类

| 当前目录 | 当前实际职责 | 目标归属 |
|---|---|---|
| `src/engine/core/` | EventBus、Tag、EntityId、DevLog、显示名、主题运行时 | 基础引擎；图片/主题相关部分需另评估 |
| `src/engine/types/` | 机制实体定义、事件与仍在迁移中的共享类型 | 拆为 Engine Contracts 与 AronaClicker Types；Datapack 汇总契约已迁至 `src/data-services/contracts/` |
| `src/data-services/registry/` | Registry 表、合并、清理、引用校验 | 基础数据服务 Registry；AronaClicker Runtime 组合使用 |
| `src/engine/def-factory/` | 各类定义 builder | 按机制契约/领域实体拆分 |
| `src/engine/expression/` | Value、Condition、Funclet、Stat DSL、GameNum | 基础引擎 |
| `src/engine/effect/` | Effect、Trigger、Affector、响应器 | 基础引擎 |
| `src/engine/visibility/` | Reveal、Visibility 快照和增量失效 | 基础引擎，领域通过查询适配器接入 |
| `src/engine/stats/` | 三层统计、Tag 统计、World Tilt | 基础引擎机制 + 领域统计源适配器 |
| `src/engine/extra/` | Extra 数据树构造、读取、合并、校验 | 基础数据/机制服务，归属待 M2 裁定 |
| `src/data-services/assets/` | 图片存储、Pic 解析与 PicService | 基础数据服务 |
| `src/engine/system/` | 基础 Tick 管道 | 产品状态写入、角色、抽卡、培养、色彩、头像等已归入 AronaClicker |
| `src/arona-clicker/` | Runtime 编排、Init、Story、Spot、Item、Enhancement、状态与领域适配 | AronaClicker Runtime 与领域服务 |
| `src/arona-clicker/runtime-game-instance.ts` | 产品运行时门面与引擎子系统组合宿主 | `AronaClickerRuntime` |
| `src/data-services/datapack/zip-loader.ts` | ZIP Datapack 解包和解析 | 基础数据服务 |
| `src/data/base/` | 当前测试/示例 Datapack | 测试/示例 Datapack |
| `src/data-services/persistence/storage.ts` | LocalStorage 存档入口 | 基础持久化服务 |
| `src/ui/` | 游戏 UI、Controller、组件、主题和交互状态 | UI 表现层 |
| `tools/datapack-editor/` | Schema 驱动的 Datapack 编辑器 | 独立工具，依赖 Schema 契约 |

## 当前依赖图

```text
src/ui/main.ts
  ├─ src/arona-clicker/content/default-datapack.ts
  ├─ AronaClickerRuntime ──> src/engine/*
  └─ UIController ──────> src/data-services/persistence/storage.ts

src/main.ts
  ├─ src/arona-clicker/content/default-datapack.ts
  ├─ src/arona-clicker/runtime.ts ──> src/engine/*
  └─ SaveSystem ─────────> 泛型 JSON 文档（产品 SaveData 由 AronaClicker 组合）

src/arona-clicker/runtime.ts
  ├─ 基础机制：Core / Expression / Effect / Visibility / Stats
  ├─ 产品领域：Character / Color / Gacha / Story / Spot / Init
  ├─ 状态与存档：arona-clicker/state / data-services/persistence
  └─ 资源：data-services/assets

src/data/base/datapack.ts
  └─ 组装 src/arona-clicker/content 为测试/示例 Datapack

tools/datapack-editor/
  └─ 主要依赖自身 schema 与生成的 engine-defs.gen.json
```

## 已确认的边界事实

### 1. `src/engine` 没有直接依赖 `src/data` 和 UI

当前没有明显的：

```text
engine → data
engine → ui
```

这是后续内聚的有利条件。主要问题是 `engine` 内部的基础机制与 AronaClicker 领域服务没有语义隔离。

### 2. `src/data/base/datapack.ts` 仅由测试包入口组装

正式应用从 `src/arona-clicker/content/default-datapack.ts` 读取产品内容；测试通过 `src/data/test-datapack.ts` 显式注入测试包。测试数据不进入基础引擎依赖图。

### 3. UI 具备只读门面，但仍依赖具体实现

`src/ui/context.ts` 通过 `GameReadModel` 提供只读视图；控制器通过 `GameCommands` 调用产品 Runtime，组件不再接触具体写入服务。

UI 仍有少量表现工具与领域查询的直接依赖，但主要读写边界已通过 ReadModel / Commands 与 Runtime 能力端口收敛；后续继续清理具体服务类型泄漏。

### 4. 存档层反向依赖 Runtime 门面

当前关系为：

```text
src/data-services/persistence/storage.ts → 泛型 JSON 文档；具体 SaveData 位于 src/arona-clicker/contracts/save-data.ts
```

该目标已完成：基础持久化服务不再依赖完整 Runtime 或产品 SaveData。

### 5. 存在两个游戏启动路径

当前同时存在 `src/main.ts` 和 `src/ui/main.ts`。前者自行处理存档、默认 Init 和启动；后者创建 Runtime 后交由 UIController 处理启动流程。Vite 游戏 HTML 当前指向 `src/ui/main.ts`，但 `src/main.ts` 仍保留独立启动逻辑。

### 6. 测试目前偏向完整 Runtime 集成

大量测试同时依赖：

```text
GameInstance + baseDatapack + 具体 engine 实现
```

这对全链路回归有效，但不足以证明基础引擎可以脱离 AronaClicker 内容独立运行。后续需要增加不加载 base 的基础机制测试。

## 当前大型文件热点

| 文件 | 行数约 | 说明 |
|---|---:|---|
| `state/state-mutation-service.ts` | 678 | 统一写入口；产品 EffectOp 分发与状态写入仍集中于此域 |
| `data-services/registry/registry.ts` | 649 | Registry 表驱动装载、合并与索引 |
| `services/color-system.ts` | 671 | 领域服务与主题派生 |
| `types/character.ts` | 44 | 产品角色状态/类型入口，已不再是大型实体总表 |
| `services/story-flow.ts` | 514 | Story 领域流程 |
| `runtime-game-instance.ts` | 425 | AronaClicker Runtime 组合根实现 |
| `ui/controller.ts` | 686 | UI 编排门面，委托 Commands/ReadModel 与职责模块 |

## 历史施工结论（保留作变更背景）

下一步不应立即搬迁文件，而应先新增稳定公共入口：

```text
src/engine/index.ts
src/data-services/index.ts
src/arona-clicker/index.ts
src/app/index.ts
```

入口职责：

- Engine 只导出基础机制和机制契约；
- Data Services 只导出加载、持久化和资产服务；
- AronaClicker 导出领域类型、Runtime、领域服务和适配器；
- UI 不向组件暴露完整 `GameInstance` 类型；
- 测试包由测试夹具或应用入口显式注入。

上述入口已新增；当前仍是迁移期兼容层，不能视为最终目录已经完成搬迁。

当前边界施工进展：

- 产品运行时实现位于 `src/arona-clicker`：GameInstance、wiring、Story/Spot/Init/Item/Enhancement/ChatFlow 服务、运行时重置与存档恢复编排均由该层承载。
- `src/data-services` 负责存档快照组装、存储、数据包管理与图片资产服务；不负责恢复产品领域运行态。
- `src/engine/contracts` 只保留跨层 DTO/Port，例如 `StoryCursorSnapshot`、`StoryEffectPort`、`ChatTextEffectValue`；剧情播放瞬态和具体 StoryService 不进入基础引擎，演出文本仅以最小请求契约跨层传递。
- 当前代码中未保留 `src/engine/game` 目录；架构检查会阻止新的引擎向上层实现扩散依赖。

## 当前基线结论

当前已确认：

1. `src/engine` 与 `src/data-services` 的禁止向上依赖由 `npm run check:architecture` 守护，当前检查通过；
2. 产品 Runtime、状态、领域服务和存档恢复编排集中在 `src/arona-clicker/`；
3. 数据包加载、PackManager、Registry、持久化和资产服务位于 `src/data-services/`；
4. 游戏页面入口是 `src/ui/main.ts`，兼容性的 `src/main.ts` 仍保留独立启动路径；
5. UI 仍在持续收敛到 ReadModel / Commands，主题宿主注册和服务工作区属于当前未提交施工范围；
6. 测试既包含完整 Runtime 集成测试，也包含基础引擎与数据服务测试，不能再概括为“主要依赖 baseDatapack”。
