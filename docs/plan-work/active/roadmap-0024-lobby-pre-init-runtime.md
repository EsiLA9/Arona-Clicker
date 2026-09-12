# Roadmap 0024 — Lobby / Pre-Init Runtime

> 状态：🟡 收尾验收（运行时已落地）
> 目标：让 Runtime 在尚未进入 Init 时也能提供一般游戏的界面服务；Lobby 是运行时阶段，不新增伪造的 `InitDef`。

## 设计边界

- `activeInit === ''` 表示 Runtime 已加载但尚未进入世界线。
- Lobby 不调用 `enterInit()`，不发 `initEntered`，不挂载 Init 专属 Trigger，不启动 Tick。
- Lobby 复用通用 Header、主题、帮助和服务工作区。
- 只有进入 Init 或读取带 `activeInit` 的存档才启动一般游戏会话。

## 已完成

- [x] UI 启动通过 `applyEnabledPacks()` 加载数据包后保持 Lobby。
- [x] `GameInstance.init()` 支持 `enterDefaultInit` 选项，保留旧调用方兼容性。
- [x] Init 选择页增加数据包、存档、记录、主题和帮助入口。
- [x] Lobby 可进入数据包服务，返回时回到 Init 选择页。
- [x] Lobby 存档读取不会启动 Tick，也不会补造默认 Init。
- [x] Active Init 存档读取会恢复会话并启动 Tick。
- [x] 增加 Runtime/UI 回归测试。

## 待完成

- [ ] 将 Lobby 的“数据包/存档/记录”文案和空状态进一步区分“当前世界线”与“全局内容”。
- [ ] 增加服务权限守卫，确保 Lobby 中不存在依赖当前 Init 的写操作入口。
- [ ] 增加浏览器级视觉验收：不同窗口高度、主题浮窗、服务切换和 Init 选择轮盘。
- [ ] 更新服务工作区与存档机制文档中的 Lobby 交互流程。

## 验收

- `activeInit === ''` 时 `running === false`。
- Lobby 可打开数据包、存档、记录、主题和帮助。
- 读取 Lobby 存档后仍显示 Init 选择页。
- 读取 Active Init 存档后进入一般游戏界面。
- 不因 Lobby 初始化触发 `initEntered` 或 Init 专属世界初始化。
