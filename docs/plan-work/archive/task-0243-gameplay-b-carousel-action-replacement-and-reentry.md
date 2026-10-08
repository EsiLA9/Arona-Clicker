# Task 0243：Gameplay B 旋转木马行动替换与重复进入

状态：complete — 首轮行动替换已修复；确认并移除会重开同一单拍遭遇的通道回路。

## 目标

让玩家能在首次推荐时替换角色行动，并查清旋转木马安全行动第二次进入设备区时出现的异常操作。只修复由源码与虚拟回放确认的问题。

## 核查结果

- 目标型替代牌原先拦截鼠标点击，只能拖放目标或用键盘打开目标面板；牌面声明的合法默认目标可直接用于行动修订。
- 通道回返边会重开同一个 `maxBeats: 1` Platform。转场仅重置地点访问计数、批次数和完成状态，不重置全局 beatIndex、角色 HP / 资源、敌人 HP 或事件进度；对手与环境会再次行动，因此不是状态独立的新遭遇。
- Character Hand 会按 seed 与全局 beatIndex 重新抽取。该抽取变化叠加残留的 Run 状态，解释了重复进入时推荐变化，但本 Task 不重做抽取规则。

## 实施记录

- `controller-actions-operation.ts`：目标型备选行动若带有合法默认目标，鼠标点击即提交以该目标为目标的修订；键盘 Enter 仍打开完整目标列表；拖放仍允许改选其他合法目标。
- 从 `carousel-scene-action-slice.ts` 删除通道返回同一 Platform 的路线。正式事件仍从 Platform 开始，经一次安全战斗进入 Concourse，再由员工 / 游客路线前往 Exit；没有复制战斗或重置 Run 状态。
- UI 定向测试覆盖目标型默认目标鼠标选择、键盘目标选择、无目标紧急停机和拖放。样例 Runtime 测试确认战斗完成后不存在重开战斗的回程路线。
- 定向验证：`tests/ui/gameplay-b-operation-controller.test.ts` 与 `tests/engine/gameplay-b-scene-action-sample.test.ts` 共 20 项通过。未进行浏览器验收。

## 留待玩法裁定

若未来确实需要返回旋转木马再打一场，应先明确它是同一 Run 状态延续的重复检查，还是新遭遇。新遭遇需要逐项裁定角色资源 / HP、对手与环境 HP、事件轨道、Hand、随机流和已完成地点结算是否重置。在裁定前，正式样例维持单次安全遭遇。

## 相关路由

- [[task-0240-gameplay-b-operation-card-presentation-and-action-targeting]]
- [[archive/task-0242-gameplay-b-carousel-entry-and-scene-submit]]
- [[docs/docs-829/03-data-structures/operation-view]]
- [[docs/ai/task-read-set-routing]]
