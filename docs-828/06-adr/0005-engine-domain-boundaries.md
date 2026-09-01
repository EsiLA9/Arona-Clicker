# 06-adr/0005 — 基础引擎与 AronaClicker 领域边界

- **状态**：已确认（2026-09-01）
- **决策者**：项目维护者 + AI 协作
- **来源**：项目结构探索与后续内聚任务设计
- **关联 Roadmap**：[[docs-828/08-roadmap/0005-engine-domain-consolidation]]

## 背景

当前项目已经完成一次引擎内部整理（T1-T7），但 `src/engine/` 仍同时包含两种性质不同的代码：

- 可复用的声明式机制：EventBus、Value、Condition、GameNum、Effect、Trigger、Affector、Reveal、Stats、Registry 等；
- AronaClicker 领域内容：Character、Story、Init、Area、Spot、Gacha、Color、Cultivate、Inventory 以及对应的 `PlayerState` 和服务。

`src/data/base/` 目前更接近测试/示例 Datapack，不应被视为引擎内置的生产内容。当前 `GameInstance` 也已经是 AronaClicker 运行时的组合根，而不是基础引擎对象。

## 决策

### 1. 基础引擎只负责机制执行

基础引擎负责：

- 事件分发与运行时基础设施；
- Value / Condition / Funclet / Stat DSL 求值；
- GameNum 数值树、缓存与失效；
- Effect / Trigger / Affector 响应机制；
- Reveal / Visibility 揭示机制；
- 统计与派生统计；
- Datapack 注册、合并、引用校验的通用机制；
- 统一状态变更管道及其事件、统计副作用。

基础引擎不直接负责：

- Character、Story、Init、Area、Spot 等 AronaClicker 实体；
- AronaClicker 的资源、抽卡、培养、色彩、库存规则；
- 具体 Datapack 内容；
- UI 页面和交互流程。

### 2. 领域语义通过适配器接入引擎

基础机制不直接写死 AronaClicker 字段，而通过上下文或适配器读取领域数据：

```text
Engine Condition / GameNum / Reveal / Stats
                    ↓
        Domain Context / Source Adapter
                    ↓
          AronaClicker State / Registry
```

引擎只依赖查询契约；AronaClicker 负责提供资源、实体等级、标签、拥有状态、故事完成状态等具体查询。

### 3. `GameInstance` 定位为 AronaClicker Runtime

`GameInstance` 的职责是组合并驱动 AronaClicker：

- 创建基础引擎服务；
- 创建 AronaClicker 领域服务；
- 注入领域适配器；
- 管理 init / tick / save / load / reset 生命周期；
- 生成 UI 所需只读视图。

后续目标名称为 `AronaClickerRuntime`。迁移期间可保留 `GameInstance` re-export 兼容层，避免一次性破坏测试与 UI 入口。

### 4. 基础数据服务独立于运行时门面

Datapack 的物理读取、解析、合并、校验，以及 SaveData、LocalStorage、图片资源加载，属于基础数据服务，不应依赖 `GameInstance`。

目标依赖方向：

```text
SaveStorage / PackLoader → Data Contract
AronaClickerRuntime      → SaveCodec / PackManager
UI                        → Runtime ReadModel + Commands
```

### 5. `base` 作为测试/示例数据包

`base` 不再作为引擎的隐式默认内容。测试和示例入口显式注入测试 Datapack；正式内容包拥有独立入口。

引擎不得导入：

```text
src/data/base/*
datapack/AronaClickerCore/*
```

### 6. UI 依赖能力接口，而不是具体引擎实现

UI 最终只依赖：

- `GameReadModel`：GameView、StoryView、实体显示信息、日志等；
- `GameCommands`：故事推进、移动、购买、使用物品等命令；
- 基础持久化服务和 UI 自身服务。

UI 不直接依赖 `StateMutationService`、`Registry`、`GameNumSystem`、`ConditionSystem` 等内部实现。

## 目标模块布局

```text
src/
├─ engine/
│  ├─ core/
│  ├─ contracts/
│  ├─ expression/
│  ├─ effect/
│  ├─ visibility/
│  ├─ stats/
│  ├─ registry-core/
│  └─ runtime/
│
├─ data-services/
│  ├─ datapack/
│  ├─ persistence/
│  └─ assets/
│
├─ arona-clicker/
│  ├─ types/
│  ├─ state/
│  ├─ registry/
│  ├─ adapters/
│  ├─ services/
│  └─ runtime/
│
├─ datapacks/
│  ├─ test-base/
│  └─ arona-clicker-content/
│
└─ ui/
   ├─ components/
   ├─ controllers/
   ├─ read-model/
   └─ adapters/
```

这是目标语义布局，不要求一次性按目录搬迁。迁移必须先建立入口和依赖约束，再按切片移动实现。

## 约束与非目标

- 不改变现有 tick 调用顺序和状态变更语义；
- 不在本目标内引入新框架或新运行时依赖；
- 不编写存档迁移；状态结构变化按项目纪律直接更新测试与文档；
- 不把所有实体强行泛化为通用引擎实体；只有确实属于机制契约的部分进入 `engine`；
- 迁移期间允许使用 re-export 兼容层，但兼容层不是最终结构；
- 每个切片必须通过 `npx tsc --noEmit` 和 `npm test`。

## 后果

正面后果：

- 基础机制可以脱离 AronaClicker 内容单独测试；
- 测试 Datapack、正式 Datapack、未来其他 Datapack 可以共享引擎；
- UI 不再被内部服务类和具体数据包绑死；
- `GameInstance` 的职责从“所有服务集合”收拢为应用运行时。

代价：

- 需要增加 Engine Context、领域 Adapter、ReadModel、Commands 等接口；
- Registry、PlayerState、SaveData 需要分阶段拆分；
- 迁移期会存在 re-export 和新旧入口并存；
- 与 [[docs-828/08-roadmap/0001-datapack-management-rollout]] 的多包管理工作存在交叉，需要按本 ADR 更新 base 语义。

## 实现记录

尚未开始。实现进度记录在 [[docs-828/08-roadmap/0005-engine-domain-consolidation]]；设计变更只更新本 ADR。

## 相关文档

[[docs-828/00-INDEX]] · [[docs-828/01-architecture/overview]] · [[docs-828/05-conventions/architecture-discipline]] · [[docs-828/05-conventions/refactoring]]
