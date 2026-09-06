# addition-test

用于验证多数据包 Registry、Tag、图片、故事、统计、图鉴、存档残留和数据包服务的综合测试包。

## 覆盖内容

- `datapack.json`：`modName`、版本、作者、依赖和图标。
- 世界：新增 Init、Area、Spot；世界线解锁使用全局青辉石，设施经营使用当前世界线信用点，验证两种资源作用域的区别。
- Registry：物品、角色、角色差分、培养曲线、增强、掉落表、Affector、Trigger。
- Tag：本包顶层 Tag、子 Tag 和层级筛选。
- 剧情：主动剧情、选项、奖励、可重读、被动故事池。
- 视觉：Pic、Area Theme、ColorGroup、ColorEquipment、ThemeDesign、UI presentation。
- 招募：扩展包 GachaPool、UP、保底、重复奖励。
- Extra：作者、覆盖范围和跨包测试标记。

## 使用

将本目录压缩为 ZIP 后，在数据包服务中导入。它依赖内置 `base`，会被自动登记为 `addition-test@0.1.0`；导入后不会自动替换当前运行内容。
