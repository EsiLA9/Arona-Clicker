# Recruitment V2：Pool 与 Banner

## 解耦

```text
RecruitmentPool = 抽什么
Banner = 玩家看到什么、付什么、遵循什么活动规则
```

同一 Pool 可被多个 Banner 复用。Banner 可声明成本、Pick Up、保底、条件、生命周期与可用时间。

```yaml
pool: TrinityStudents
banner:
  id: trinity-recruitment
  cost:
    pyroxene: 120
  pickup: mika
  availability: limited
```

## Recruitment Point

每次招募使 `Recruitment Point +1`；达到阈值后，玩家主动选择当前 Banner 的 Pick Up Variant；Banner 结束时按明确规则清算点数。

井可视作 Banner 内的特殊 Offer：

```text
Cost: recruitmentPoint 200
Reward: acquireVariant(Hoshino_Swimsuit)
```

这样 Spark 与商店共享 Offer 语义，并形成“继续抽到井，还是现在停”的决策。

## 重复处理

重复 Variant 进入统一 Duplicate Reward，MVP 先转为角色 Eleph，不引入过多并行碎片种类。

