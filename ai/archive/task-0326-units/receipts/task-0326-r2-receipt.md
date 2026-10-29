# Receipt 0326-R2 — 主保存恢复与生命周期

> Parent Task: [[ai/archive/task-0326-variant-translation-real-card-workspace]]
> Unit: [[ai/archive/task-0326-units/task-0326-r2]]

状态：completed — 2026-10-24。

- `SaveData.mapRun.scenario` 保存准确模板、三份snapshot与完整Run的canonical一致性依据；load先校验来源/顺序/版本/Init/Run，再重建可信地图并恢复主owner。无效场景清空运行绑定并记录拒绝，不部分安装。
- owner 的非枚举兼容getter先转JSON wire再封装；外部恢复仍严格校验JSON。恢复后的core不保留过时Run proof，继续提交或重开后可重新保存。
- 中途恢复不再次应用节点初值；主Runtime 2/3战用例额外执行“load→commit→save→load”，精确保留更新后的Run。新开读取培养、旧局冻结、静态普通地图存档均有定向证据。
- 最新验收套件5文件34/34：main-runtime 8、scenario 5、stage-init 1、Spot UI 5、schema-sync 15。相邻12文件161/161：Variant转译/旧开发演练/培养、Map AG-1 commit/restore、DOM局部更新。共17文件195通过，不重复计数后续重跑。
- `npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs`、`git diff --check`、正式bundle `--check`通过；按源合同运行 `npm run gen:schema`，非手工编辑生成协议。
- 扩大回归曾有6文件126项中26失败；其中2项是施工中高级阶段cap遗漏，已修复并由最终新用例覆盖。其余24项对应本轮前dirty field-investigation样例从manual改condition、增加verify-clue/archive，而旧测试仍要求旧内容。UI vertical-slice另有2项相同样例不一致，未在此改动。E1 Receipt记录HEAD差异与未改测试证据；不将这些套件标成通过。
- 浏览器普通 `localhost:5173/src/ui/index.html`：完整三战并通关；第二战存8/10HP、敌3/6、强力打击、round2，刷新后Spot直续保持；第三战存14/16HP、敌4/6、round2，刷新后仍保持，返回Spot再入也续同局。保存均经正常设置→存档管理；真实Hand/RNG/草稿/版本细节由JSON定向测试核对。
- 证据截图：`battle-owned-hand.png`、`battle-normal-resumed.png`、`battle-enhanced-resumed.png`、`three-battles-complete.png`，位于 `C:/Users/15229/.codex/visualizations/2026/10/24/task-0326/`。
- 机制页和角色领域入口已更新。首期 `partySetup` 用于可信动态场景；Registry静态作者字段专项校验未扩展，所有实际运行/恢复仍由MapRun校验。开发控制台新参数另见Draft0327，仅设计未实现。
