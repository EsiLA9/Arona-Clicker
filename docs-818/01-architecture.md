# 01 — Architecture 系统架构总览

## 技术栈

- **语言**：TypeScript strict mode（`[[tsconfig.json]]`）
- **构建**：Vite 5（`[[vite.config.ts]]`），MPA 入口路由
- **测试**：Vitest（`[[vitest.config.ts]]`），26 个测试文件
- **UI**：原生 DOM + innerHTML 模板字符串，无框架
- **存档**：localStorage（key `acprogram_save`）
- **唯一外部依赖**：`jszip`（Mod 压缩包加载）

## 项目结构

```
ACProgram/
├── src/
│   ├── engine/              # 引擎核心（17 个子系统 + types + game 服务）
│   │   ├── types/           # 拆分后的类型定义（8 个文件）
│   │   ├── game/            # GameInstance 拆出的领域服务
│   │   │   ├── story-service.ts
│   │   │   ├── spot-service.ts
│   │   │   ├── snapshot.ts
│   │   │   └── debug-labels.ts
│   │   └── *.ts             # 各子系统（event-bus / registry / game-num / ...）
│   ├── ui/                  # UI 层
│   │   ├── components/      # 13 个渲染组件
│   │   ├── controller.ts    # UI 控制器（事件绑定 + 刷新策略）
│   │   ├── context.ts       # UIContext（只读视图）
│   │   ├── modal.ts         # 弹窗母版
│   │   ├── styles.css       # 全部样式
│   │   └── main.ts          # UI 入口
│   ├── data/                # 基础数据包
│   │   ├── base/            # 11 个数据文件（TS 常量）
│   │   ├── index.ts         # 导出 baseDatapack
│   │   └── zip-loader.ts    # Mod 压缩包加载器
│   ├── save/
│   │   └── storage.ts       # localStorage 存档
│   └── main.ts              # 引擎入口（纯控制台日志）
├── tools/datapack-editor/   # 数据包编辑器
├── datapack/                # 打包好的数据包 zip + 分片 JSON
├── scripts/                 # 构建脚本
└── docs-818/                # 本设计文档
```

## 核心设计原则

### 1. 单一写入口（Single Write Entry）

所有 PlayerState 修改集中在 [[src/engine/state-mutation-service.ts]]。每个 mutation 走固定管道：

```
① 写 PlayerState（自身改变）
② 同步更新 StatsService 三层统计
③ emit 事件到 EventBus（事件携带变更时点的 stats 上下文）
④ 订阅者按兴趣判断并执行
```

这保证内容作者只需声明 `TriggerDef`（事件模式 + 条件 + 效果），不直接接触 EventBus。

### 2. 事件驱动（Event-Driven）

所有系统通过 [[src/engine/event-bus.ts]] 解耦：
- TriggerSystem 用 `onAny` 侦测事件
- AffectorEngine 订阅 item/spotLevel/enhancement 事件
- UIController 用事件驱动重绘
- DevLog 自动记录事件

### 3. 数据包声明式（Datapack-Driven）

新机制优先设计成 Datapack 字段（JSON Schema 同步），而非硬编码。内容编辑者通过 [[tools/datapack-editor/]] 或直接编辑 JSON 分片定义游戏内容。

### 4. 只读 UI（Read-Only UI）

UI 只消费 `getView()` / `createUIContext()`，不持有写引用。所有交互通过 GameInstance 的公开 API 完成。

### 5. 三层状态（Three-Layer State）

新增"跨世界线保留"数据时需想清楚放哪一层：
- **全局层**（global）：跨 Init 保留（如 `globalResources`、`unlockedInits`、`extras`）
- **per-Init 层**：随世界线隔离（如 `resources`、`spotLevels`、`inventory`）
- **快照层**：软重启时保存/恢复（`initSnapshots`）

## 子系统组装

所有子系统在 [[src/engine/game-instance.ts]] 构造函数中组装并接线：

```
GameInstance
├─ registry          Registry
├─ eventBus          EventBus
├─ mutations         StateMutationService
├─ valueSystem       ValueSystem
├─ conditionSystem   ConditionSystem
├─ funcletExecutor   FuncletExecutor
├─ effectEngine      EffectEngine
├─ tickSystem        TickSystem
├─ gameNumSystem     GameNumSystem
├─ affectorEngine    AffectorEngine
├─ triggerSystem     TriggerSystem
├─ visibilityEngine  VisibilityEngine
├─ lootSystem        LootSystem
├─ characterSystem   CharacterSystem
├─ spotFunctionalitySystem  SpotFunctionalitySystem
├─ statsService      StatsService
├─ devLog            DevLog
├─ storyService      StoryService      # 从 GameInstance 拆出
└─ spotService       SpotService       # 从 GameInstance 拆出
```

## 数据流概览

```
数据包 ──load──→ Registry ──→ 各子系统
                                  │
用户操作 ──→ GameInstance API ──→ StateMutationService
                                  │
                                  ├─→ PlayerState（状态变更）
                                  ├─→ StatsService（统计同步）
                                  └─→ EventBus.emit（事件广播）
                                        │
                              ┌─────────┼─────────┐
                              ↓         ↓         ↓
                        TriggerSystem  Affector  UIController
                        (条件→执行)   (持续效果) (重绘)
```
