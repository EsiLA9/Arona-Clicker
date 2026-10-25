# Receipt 0326-R1 — 主 Runtime 场景准入与命令

> Parent Task: [[docs/plan-work/archive/task-0326-variant-translation-real-card-workspace]]
> Unit: [[docs/plan-work/archive/task-0326-units/task-0326-r1]]

状态：completed — 2026-10-24。

- 正式 `enterVariantTraining` 校验 Spot/Area/Init/utility/功能和条件，缺准确 Hoshino 时原位给出领取提示；三来源由可信转译实例依序预览确认，不接受UI数值。
- 主 resolver 仅为本场绑定提供可信动态地图；主 MapRun 及所有卡牌查询/命令共用该定义。普通 `startMap` 不能绕过场景准入；其他活动地图阻塞入场。
- 活动局重开回首战并使用原三份冻结构筑；放弃与 Init 切换清理状态。旧 `variantTraining` 只保留为开发单战诊断。
- 补齐 `schedulerTerminal` 的 Workspace 只读投影，修复实屏路径原有 TS2339。
- 行为先红：新增7个测试最初均因缺少主命令失败；接线后全部通过。独立Luna审查发现结束演练再开普通地图时存档误挂绑定，新增第8个测试先红，再以成功普通开局清绑定及保存时按mapId限制包装修复。
- 最终 `variant-training-main-runtime.test.ts` 8/8通过，覆盖准入、阻塞、真实换牌/目标、顺序、培养冻结、重开/放弃/Init，以及普通地图后续保存。最终 `npx tsc --noEmit` 通过。
- 实屏无开发参数由夏莱 Spot 点击一次进入第一战；展开Hand选择强力/快速打击、选敌方目标并提交，第一战结束4HP，第二战按普通构筑重置10HP，第三战重置16HP。截图在 `C:/Users/15229/.codex/visualizations/2026/10/24/task-0326/`。
- 未完成内容：无本Unit必需项；通用编队、Tag/候选来源注册和其他模式仍在范围外。
