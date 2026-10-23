# 04-mechanisms/00-index — 机制入口

> 本文按机制所属的大模块路由到行为流程与验证入口。

第一次接触状态、事件和 Runtime 时序，可先看 [[docs/docs-829/01-architecture/first-read]]。

## Engine

- [[1-项目/ACProgram/docs/docs-829/04-mechanisms/engine/production]] — GameNum 与 Tick 生产结算。
- [[1-项目/ACProgram/docs/docs-829/04-mechanisms/engine/effect-trigger]] — Effect、Trigger 与事件协作。

## Data Services

- [[pack-loading]] — 包解析、启用集与 Registry 应用。

## AronaClicker

- [[arona-clicker/gameplay-b-cards]] — Gameplay B MapRun Encounter Hand、行动卡身份、Swap / PlayerCommand、卡牌目标与整轮结算。
- [[arona-clicker/story-node-playback]] — StoryNode 作者类型、节点播放器、动作宿主与 StoryService 会话生命周期。
- [[1-项目/ACProgram/docs/docs-829/04-mechanisms/arona-clicker/state-mutation]] — 玩家业务状态提交与事件。
- [[1-项目/ACProgram/docs/docs-829/04-mechanisms/arona-clicker/world-lifecycle]] — Init、Area、Spot 生命周期。
- [[gacha-cultivation]] — 招募和角色培养入口。
- [[operation-runtime]] — Gameplay B 的 EventRun 局内状态 owner、局部转移与清理边界。

各页记录可观察行为与具体源代码；状态类型布局见 [[docs/docs-829/03-data-structures/00-index]]，跨模块概览见 [[docs/docs-829/06-wiki/00-index]]。
