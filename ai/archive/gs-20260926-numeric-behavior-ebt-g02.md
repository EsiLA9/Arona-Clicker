# G02：评估现有领域行为接入 EB-T 的范围

## 对最终目标的贡献

明确哪些领域可以使用 EB-T Registration 作为可重建的事件唤醒投影，哪些应继续用 ConditionDepIndex、专用调度或 Tick，以及各方案必须保留的状态提交与失败语义。

## 完成定义

- [ ] 建立 EB-T 支持事件、条件依赖事件和真实状态写入事件之间的覆盖矩阵。
- [ ] 比较学生阻断、ColorUnlock、StoryFollowUp、StoryEntryReaction、PassivePool、Visibility、Affector 等消费者。
- [ ] 为每个候选记录唤醒粒度、完整条件复验、Admission/reconcile、一次性/可逆语义、领域写入口与未覆盖条件回退。
- [ ] 将“领域行为触发”和“派生缓存失效”区分开，并给出迁移顺序或不迁移理由。

## 依赖与边界

- 前置 Goal：G01 的实体与调用链地图。
- 本阶段明确暂缓：直接扩展作者可见 Trigger DSL；不将 ConditionDepIndex 的覆盖等同于 EB-T 覆盖；不修改公共 TriggerDef 来容纳领域专用动作，除非单独裁定。

## 会改变方案的未知项

- 产品/架构待裁定：是否接受为不同领域注册不同 typed action；是否优先统一入口还是减少总机制复杂度。
- 本地源码待核对：Stat/ProtoStat 事件闭合、ConditionDepIndex wide 条件消费者回退、运行时 Definition 规模和重检成本。

## 正式文档入口

- 研究底稿：[[gs-20260926-numeric-behavior-ebt-research]]
- Draft：待建立
- Task：待建立
