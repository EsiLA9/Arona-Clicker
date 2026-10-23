# Task 0320-U28 屏幕验收记录单

状态：自动化验证完成；屏幕验收待填写。本单记录人工屏幕检查需求，不表示已执行或通过。

## 验收入口

在开发版 Gameplay B 迷你控制台使用正式路线示例：

```text
startMap gameplay-b:map:fact-gated-pool-example --enter-office
```

需要验证事实写入后的开放状态时，重新启动示例并提交一轮：

```text
startMap gameplay-b:map:fact-gated-pool-example --enter-office --commit-rounds 1
```

该示例 `survey → advance` 的 Edge 条件为 `route-step >= 1`。手动完成遭遇后，再从地图流查看路线选项。

## 检查项

1. 未提交记录路线行动的运行中，完成 `survey` 后路线卡显示 `地图计数 route-step ≥ 1（未满足）`，不可选；尝试点击不能改变当前位置。
2. 第二次运行通过迷你控制台提交一轮，确认 `route-step` 增加到 1；手动完成 `survey` 后，同一条路线卡显示 `地图计数 route-step ≥ 1（已满足）` 并可选。
3. 选择并前往 `advance` 后，当前位置更新为“路线推进”；运行状态与路线卡保持一致。
4. 刷新页面或恢复存档后，若仍位于 `survey`，Facts 与 Edge 可用状态一致；没有为 Edge gate 新增 Receipt 或独立存档事实。
5. 原有 Team 资源门槛仍以已有文案显示，事实门槛显示 MapRun Counter / Flag ID，不互相误标为资源。

## 人工记录

- 浏览器与版本：
- 检查时间：
- 结果：未执行 / 通过 / 未通过
- 观察或偏差：
