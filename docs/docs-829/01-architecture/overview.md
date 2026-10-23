# 01-architecture/overview — 系统概览

> 本文回答：ACProgram 的主要运行层次是什么，代码如何从内容定义到 UI 呈现协作。

## 概念层

```text
应用启动与组合根（src/app、src/arona-clicker/runtime/runtime*.ts）
├─ 内容与数据服务（src/arona-clicker/content、src/data-services）
├─ 通用引擎（src/engine）
├─ 产品领域与运行状态（src/arona-clicker/services、state、read-model）
├─ UI（src/ui）
└─ 验证与创作工具（tests、tools、scripts）
```

此树表示职责分组，不表示严格单向的完整依赖图。依赖方向见 [[docs/docs-829/01-architecture/dependency-map]]。

## 运行流

```text
src/ui/main.ts
  → createAppRuntime() / AronaClickerRuntime
  → PackManager 应用启用包
  → Registry 装载定义，Runtime 接线机制与领域服务
  → Lobby / Init 生命周期 / Tick
  → GameView / UIContext 提供界面只读数据
```

当前 UI 入口的启动、装配和会话时序见 [[docs/docs-829/01-architecture/run-logic]]。Datapack、Registry、状态及视图之间的数据关系见 [[docs/docs-829/01-architecture/data-flow]]。

## 主要概念不应混为一层

| 概念 | 职责 | 代码入口 |
| --- | --- | --- |
| Datapack | 声明可装载内容 | `src/data-services/contracts/datapack.ts`、`src/arona-clicker/content/default-datapack.ts` |
| Registry | 提供定义表、引用检查与关系查询 | `src/data-services/registry/registry.ts` |
| Engine | 提供求值、事件、效果、统计、可见性和 Tick 等通用机制 | `src/engine/` |
| PlayerState | 保存产品运行进度及持久归属 | `src/arona-clicker/types/state.ts` |
| GameView / GameReadModel | 将状态和派生结果组织成只读查询 | `src/arona-clicker/read-model/`、`src/arona-clicker/contracts/runtime/runtime.ts` |
| UIContext | 为组件组合只读数据和表现查询 | `src/ui/runtime/context.ts` |

## 下一步

- 第一次接触项目：从 [[docs/docs-829/01-architecture/first-read]] 按启动、状态和 UI 读写边界逐步阅读。
- 从 [[docs/docs-829/02-modules/00-index]] 按源代码职责查找模块。
- 从 [[docs/docs-829/06-wiki/00-index]] 按概念和协作主题阅读分功能 Wiki。
- 修改机制前核对 [[docs/docs-829/05-conventions/architecture-discipline]] 与目标源码、测试。
