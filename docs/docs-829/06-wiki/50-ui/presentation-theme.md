# 06-wiki/50-ui/presentation-theme — 背景与实体表现

> 本文回答：界面宿主如何组合背景、主题和实体表现数据。

## 表现查询来源

`UIController` 通过 `controller-theme.ts` 生成背景与表现视图，再和 `GameReadModel` 一起传入 `createUIContext()`。展示组件以宿主 ID 查询背景层、形状参数、装饰和文本颜色模式；实体自身的头像、名称等展示信息由实体表现查询提供。

主题状态变更由 `controller-events.ts` 监听。全局主题、实体主题和用户主题事件会安排结构渲染；单个实体表现事件使用 `refreshEntityPresentation(entityKey)` 定向刷新。主题浮窗状态由控制器保留，并通过 `controller-theme.ts` 应用。

## 背景与文字颜色

背景解析支持全局层与宿主自有层组合，并可按 default、active、inactive、disabled 等状态选择状态层。缺少精确状态时可继承宿主默认值或父级设置。自动文字颜色基于宿主背景层和下方背景合成后的明暗计算；宿主没有自有背景时保持 `auto`，让具体语义节点沿用其颜色 token。

实体展示配置、可用宿主和主题配置的定义不在组件内推断；UI 只通过表现视图与上下文的公开查询读取。数据定义和同步边界见 [[docs/docs-829/05-conventions/schema-sync]]。

## 色彩组、主题来源与解析

`ColorGroupDef` 的色槽提供头像配色，也可作为主题 token 的基底；色组没有显式主色 token 时，`ColorSystem.resolveTheme()` 从主色槽派生默认 token。`ColorEquipmentDef` 关联色组并声明效果；`ColorEquipmentSystem` 提供色槽颜色、装备效果和解锁查询。色彩组、主题和颜色装备的字段契约见 [[docs/docs-829/03-data-structures/datapack-contracts]]。

实体主题解析会先考虑启用的实体自定义主题，再查实体槽中的 custom / design 来源，然后解析当前装备主题，最后回退到实体声明默认主题。`RuntimeThemeManager` 将 player、init、area、student 场景层按可配置顺序合并，另处理 user、preview 与最高优先级的剧情临时层；颜色 token、节点覆盖、背景与 Presentation 数据分别按其合并规则投影给 UI。产品侧解析见 `src/arona-clicker/services/color-system.ts` 和 `color-equipment-system.ts`，通用运行时合并见 `src/engine/core/theme-runtime.ts`。

## 代码与测试

表现服务见 `src/ui/presentation-service.ts`、`presentation-targets.ts`、`presentation-config.ts` 与 `controller-theme.ts`；上下文解析见 `src/ui/context.ts`。相关测试有 `tests/ui/context.test.ts`、`presentation-service.test.ts`、`condition-presentation.test.ts`、`header-theme-layer-order.test.ts`、`tests/engine/color-system.test.ts`、`color-equipment-system.test.ts`、`color-derive.test.ts` 和 `theme-runtime.test.ts`。
