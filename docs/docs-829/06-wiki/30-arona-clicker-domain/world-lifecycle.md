# 06-wiki/30-arona-clicker-domain/world-lifecycle — 世界线与区域的运行周期

本文从产品使用概念解释 Init 选择、恢复、重启和 Area 移动，机制细节以同域文档为准。

Init 表示一个可选择的世界线运行环境。进入前可以处于 Lobby；选择 Init 后，运行时恢复该 Init 的快照，或为其建立新的局部起点。软重启保存进度并退出当前 Run；硬重启清除该 Init 的快照。跨 Init 保留与局部字段的区别由状态快照登记表决定。

Area 移动受当前 Init、连通关系、可见性和剧情阻断条件约束。成功移动会记录访问、处理默认 Spot、触发进入事件与效果，并让相关派生系统重新评估。

详细转换顺序见 [[docs/docs-829/04-mechanisms/arona-clicker/world-lifecycle]]；状态范围见 [[docs/docs-829/03-data-structures/player-state]]。
