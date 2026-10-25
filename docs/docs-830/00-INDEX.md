# docs-830/00-INDEX — 基础机制入口

这组页面从系统组成、启动顺序、内容装载、状态更新和 UI 查询，介绍 ACProgram 的基础运行机制。

## 阅读顺序

### 架构

1. [[docs/docs-830/01-architecture/system-composition]]：有哪些职责模块，它们如何组合。
2. [[docs/docs-830/01-architecture/startup-and-runtime]]：游戏如何启动、装载内容并进入 Lobby。

### 数据与状态

3. [[docs/docs-830/02-data-and-state/datapack-and-registry]]：定义如何进入 Registry 并供系统查询。
4. [[docs/docs-830/02-data-and-state/state-and-events]]：运行状态如何变更并通知其他系统。

### 运行与呈现

5. [[docs/docs-830/03-runtime/session-and-tick]]：会话如何推进 Tick 与自动产出。
6. [[docs/docs-830/04-presentation/read-model-and-ui]]：状态与派生结果如何投影到界面。

### 领域流程

7. [[docs/docs-830/05-domains/00-INDEX]]：世界与 Init、角色养成、剧情效果、地图与作战。

```text
启动 → 应用数据包 → Registry 与 Runtime 初始化 → Lobby / Init / Tick
                                               ↓
状态写入与事件 → 派生查询 → GameView → UIContext → 界面
```

本组只提供基础机制入口。领域细节按角色、世界、剧情、经济等主题继续扩展。
