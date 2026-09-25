# Task：Runtime Editor 完整保留 base 数据包导出

状态：done — 2026-09-19 完成

## 目标

在不改变 Runtime 与编辑态 Draft 边界的前提下，使 RuntimeEditor 从 `base` 编辑态导出可重新解析的完整 Datapack ZIP，而不是只导出四张编辑器表。

## 完成内容

- 修复 `base:spot:canteen_vendor` 对不存在 `base:gachapool:canteen_exclusive` 的悬空引用；未凭空添加未经定义的卡池成员与概率。
- 导出以包库记录中的完整源 Datapack 为底，仅用当前 Editor Draft 覆盖 Init / Area / Spot / Enhancement；无来源的空编辑态继续保持原有 metadata-only 行为。
- 导出补齐剧情、角色、物品、掉落、触发器、资源显示、图片索引、角色变体、装备、卡池、商店、Tag 等列表分片。
- Pack 分片解析器支持 `gearConfig`、`characterPersistConfig`、`affectionConfig` 单例字段，导出统一写入 `data/80-singletons.json`。
- 增加源包完整保留、ZIP 再解析、单例字段和默认 Spot 卡池引用回归测试。

## 验收结果

- RuntimeEditor 真实界面从 `base` 编辑态导出成功：`base-1.0.0.zip`，提示 `332 条内容，4 个依赖`。
- `npx tsc --noEmit` 通过。
- `npx vitest run tests/ui/runtime-editor-pack-export.test.ts tests/data/fragment-parser.test.ts tests/engine/arona-runtime-pack.test.ts` 通过，21 项测试通过。
- `npm test` 通过，178 个文件 / 1646 个测试通过。
- `npm run build`、`npm run check:architecture`、`npm run check:docs`、`git diff --check` 均通过。

## 边界

导出仍是语义规范化包，不承诺原始 ZIP 分片布局、注释或未被当前 Datapack 合同识别的未知字段完全保留；图片二进制资产仍不由 RuntimeEditor 导出器生成。
