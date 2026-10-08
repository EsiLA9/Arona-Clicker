# 06-wiki/30-arona-clicker-domain/00-index — AronaClicker 领域导航

本文按产品领域中的状态、世界线与玩家功能组织阅读路线，并链接到 docs-829 的当前模块、结构和机制说明。

第一次读项目时，可把本分区当作“玩家操作如何变成游戏进度”的路线图。先从状态页理解统一写入和读取，再按问题进入世界线、角色或剧情页。Init 是可进入和恢复的世界线；Spot 是其中可购买或升级的设施；角色的定义、拥有进度和培养结果也分别属于不同的数据层。

| 主题 | Wiki 概念页 | 结构 / 机制 |
| --- | --- | --- |
| 状态写入与派生更新 | [[docs/docs-829/06-wiki/30-arona-clicker-domain/state-and-mutation]] | [[docs/docs-829/03-data-structures/player-state]] · [[1-项目/ACProgram/docs/docs-829/04-mechanisms/arona-clicker/state-mutation]] |
| 世界线和区域 | [[docs/docs-829/06-wiki/30-arona-clicker-domain/world-lifecycle]] | [[1-项目/ACProgram/docs/docs-829/04-mechanisms/arona-clicker/world-lifecycle]] |
| 角色获取与成长 | [[docs/docs-829/06-wiki/30-arona-clicker-domain/character-acquisition-growth]] | [[gacha-cultivation]] |
| 剧情与聊天 | [[docs/docs-829/06-wiki/30-arona-clicker-domain/story-and-chat]] | 代码入口见该页 |

概念模块边界见 [[docs/docs-829/02-modules/arona-clicker]]；UI 读取结构见 [[docs/docs-829/03-data-structures/game-view]]。

遇到陌生名词时按需跳转：PlayerState / 快照读 [[docs/docs-829/03-data-structures/player-state]]；定义从 Datapack / Registry 来，分别见 [[docs/docs-829/03-data-structures/datapack-contracts]] 与 [[docs/docs-829/03-data-structures/registry]]；机制级顺序见各页链接的 04-mechanisms。页面中的 service 是执行某类领域工作的对象；它不一定就是 UI，也不一定拥有所操作的存档字段。
