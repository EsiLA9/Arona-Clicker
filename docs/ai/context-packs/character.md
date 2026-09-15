# 上下文包：角色、招募与培养

适用：Character、Variant、Roster、Gacha、Cultivate、好感、装备和通讯录角色域。

## Required Read Set

- [[docs/docs-828/05-conventions/architecture-discipline]]
- [[docs/docs-828/02-modules/character]]
- [[docs/docs-828/04-mechanisms/gacha]]
- [[docs/docs-828/04-mechanisms/roster]]
- [[docs/docs-828/04-mechanisms/cultivate]]
- [[docs/docs-828/03-data-structures/character-entities]]
- 目标角色服务、`StateMutationService` 和测试

## Optional Read Set

- [[docs/docs-828/01-architecture/state-layers]]
- [[docs/docs-828/04-mechanisms/gear]]

## 默认不读

- `docs/plan-work/archive/**` 中关于角色拥有体系的历史计划，除非任务明确恢复该方向
- 独立 Datapack 编辑器文档

## 最小验证

角色域定向测试、`npx tsc --noEmit`；涉及字段时补 Schema 同步。
