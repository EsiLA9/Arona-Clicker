---
kind: logging_system
name: DevLog 运行时开发日志系统
category: logging_system
scope:
    - '**'
source_files:
    - src/engine/core/dev-log.ts
    - src/engine/game/wiring.ts
    - src/engine/game-instance.ts
    - src/ui/context.ts
    - tests/engine/dev-log.test.ts
---

## 1. 使用的系统与框架

本项目没有引入第三方日志库，而是自实现了一个轻量级的运行时开发日志模块 `src/engine/core/dev-log.ts`，类名为 `DevLog`。它面向引擎运行期（尤其是早期原型 UI）提供结构化、可导出、可节流的生产/资源变动追踪，并通过事件总线与 UI 层联动。

## 2. 核心文件与位置

- `src/engine/core/dev-log.ts`：日志核心实现，定义 `DevLogLevel`、`DevLogEntry`、`DevLogOptions`、`DevLogRecordOptions` 类型及 `DevLog` 类。
- `src/engine/game/wiring.ts`：组合根装配处，集中创建 `DevLog` 实例并注入到各子系统（`SpotService`、`InitService`、`ItemService`、`EnhancementService`、`SessionService` 等），同时把 `AffectorEngine.devLog` 指向该实例。
- `src/engine/game-instance.ts`：对外暴露 `devLog` 字段，供外部（如测试或调试工具）访问。
- `src/ui/context.ts`：UI 层通过 `DevLogEntry` 类型消费日志条目，用于渲染开发面板。
- `tests/engine/dev-log.test.ts`：对日志容量限制、事件映射、tick 汇总节流、verbose 模式、JSON 导出顺序等行为进行断言验证。

## 3. 架构与设计约定

### 3.1 结构化的日志条目
每条日志为 `DevLogEntry`，包含固定字段：
- `id`：自增序号，保证稳定排序；
- `timestamp`：由可注入的 `clock()` 返回，便于测试与回放；
- `level`：四档枚举 `info | success | warning | error`；
- `source`：来源标签（如 `init`、`area`、`spot`、`resource`、`inventory`、`story`、`affector`、`tick`、`runtime`）；
- `message`：人类可读消息；
- `details?`：可选附加信息；
- `frame?`：当前游戏帧号，用于关联 tick 上下文。

### 3.2 记录入口与事件桥接
- `record(message, options)`：通用记录入口，默认 level=`info`、source=`runtime`。
- `recordEvent(event, frame?)`：将引擎 `GameEvent` 统一映射为带语义的消息与 level（例如 `initEntered`/`initUnlocked`→`success`，`affectorUnmounted`→`warning`，消耗资源→`info`，产出→verbose 才记录）。
- `recordTick(result)`：按 tick 汇总生产结算，非 verbose 模式下仅每 30 帧记录一次，避免高频刷屏。

### 3.3 容量与节流策略
- `maxEntries`：默认 80 条，verbose 模式自动放大到 20000 条；超出时采用“新入队头 + slice”保持最新 N 条。
- `verbose` 开关：开启后不节流、记录正入账与逐 spot 产出，适合排障；关闭后只记录消耗与整 30 帧汇总。
- 所有公开读取方法（`getEntries`、`export`）均返回快照副本，避免 UI 直接持有可变集合。

### 3.4 装配与注入点
在 `wiring.ts` 中，`wireGameInstance` 统一创建 `DevLog(options.devLog)`，然后以依赖注入方式传入多个子系统：
- `SpotService`、`InitService`、`ItemService`、`EnhancementService`、`SessionService` 直接持有 `devLog` 引用；
- `AffectorEngine.devLog` 被显式赋值，使数据包校验警告也走 DevLog；
- 全局事件订阅 `eventBus.onAny(...)` 中，先 `console.debug` 再调用 `g.devLog.recordEvent(event, hooks.getState().totalFrames)`，确保所有引擎事件都被捕获。

### 3.5 导出与消费
- `export(meta)`：按时间正序输出 JSON，附带 `exportedAt`、`verbose`、`count` 以及任意 `meta`（如帧号、资源快照），供开发期下载分析。
- UI 侧通过 `DevLogEntry` 类型消费条目，结合 `getEntries()` 渲染开发面板。

## 4. 约定与约束

- **日志级别必须使用枚举**：新增日志应选用 `info | success | warning | error` 之一，禁止随意字符串。
- **source 字段需标注来源子系统**：已有约定来源包括 `init`、`area`、`spot`、`resource`、`inventory`、`story`、`affector`、`tick`、`runtime`；新增子系统应添加对应 source。
- **高频 tick 相关日志必须走 recordTick 或受节流控制**：生产/资源变动不应每帧无差别输出，否则会被测试用例判定为错误行为。
- **verbose 模式是排障专用**：默认关闭，仅在需要详细追踪时启用；其容量上限远高于正常模式。
- **日志不可变性**：所有读取接口返回浅拷贝快照，调用方不得修改返回数组中的条目。
- **时间源可注入**：构造时可通过 `clock` 选项替换 `Date.now()`，以便测试与回放场景获得确定性时间戳。
- **事件统一落盘**：所有 `GameEvent` 都会经 `onAny` 钩子进入 DevLog，新增事件类型需在 `recordEvent` 的 switch 分支中处理，否则不会出现在日志中。

## 5. 适用范围说明

该日志系统专用于引擎运行期的开发与调试追踪，并非面向生产环境的结构化日志管线（如写入文件/远端）。生产环境未集成其他日志框架，业务代码中未见 `console.log` 以外的日志输出；因此本仓库的“logging system”即指此 `DevLog` 模块及其装配约定。