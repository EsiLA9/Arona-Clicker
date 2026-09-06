# 07-audit/00-overview — 设计审查总览（繁简与兜底）

> 本文回答：**2026-08-30 全库设计审查的范围、前提豁免与分组路由。** 这是审查快照，不自动代表 2026-09-06 的实现状态；整改或代码重构后，须回到源码重新核验。各问题条目统一格式：位置（文档:行快照）→ 原因 → 方案组（A = 推荐）。

## 范围与判据

- 对象：docs-828 全库描述的设计（文档层审查，整改前需按各条目核对代码实况）。
- 收录判据（满足其一）：
  1. 同一不变量被 ≥3 层机制反复把守；
  2. 设计复杂到需要跨文档写「勿混淆 / 注意避坑」类防呆警告；
  3. 枚举面 / 分类学远超实际消费方；
  4. 「以防万一」预留且当前无消费方。

## 前提豁免（用户裁定，2026-08-30）

**GameNum 增量失效体系与 Affector 实例对账链是为「潜在第三方无穷多 Datapack」准备的基础设施，不在整改范围。** 覆盖：四级树 + 两级缓存 + 双向脏位 + 三路定向失效 + `gainResourceDeps` 静态扫描（[[docs-828/02-modules/game-num]]）；实例镜像 + 幂等 mount + recheck + `reconcileMounts()` 四点对账 + 事件重同步（[[docs-828/02-modules/affector]]）。配套纪律（单一写入口、grep 审查）随之保留。

豁免前提下的**残留可行改进**（不动架构）：

| 残留项 | 位置 | 动作 |
| --- | --- | --- |
| funclet `calc` 恒返回 0（已实证被静默回落吞掉） | [[docs-828/03-data-structures/declarative-dsl]] §2 | 修复（一行）或移除 Funclet 机制 |
| 静默回落不留痕 | [[docs-828/07-audit/runtime-tolerance]] | 见该组方案 |
| 区表同步触发点清单散于文档 | [[docs-828/04-mechanisms/trigger-effect]] | 表驱动化（一处声明） |

## 分组路由

| 文档 | 一句话 |
| --- | --- |
| [[docs-828/07-audit/runtime-tolerance]] | 加载期抛错 / 运行时软失败 / 静默兜底三轨并存，缺统一容错政策 |
| [[docs-828/07-audit/dual-track-state]] | 双轨与副本状态：剧情 id、阅读记录、equipmentId、SPECS 三重登记 |
| [[docs-828/07-audit/dormant-machinery]] | 休眠与预留机制：无调用点 / 无写入方 / no-op 群 |
| [[docs-828/07-audit/presentation-fallbacks]] | 表现层多级回退链与 UI 防御密度 |
| [[docs-828/07-audit/enum-taxonomy]] | 枚举面与分类学超配：阶梯 / 错误码 / EffectOp 语义混一 |
| [[docs-828/07-audit/stats-ledgers]] | 统计五套并记与 worldTilt 预留体系 |
| [[docs-828/07-audit/sync-burden]] | 同步义务与流程负担（schema / 事件 / 文档 / 双数据源），含漂移实证 |

## 相关文档

[[docs-828/00-INDEX]] · [[docs-828/03-data-structures/id-reference-semantics]]（§六已载引用语义评审意见，本库不重复其结论，只补方案组）
