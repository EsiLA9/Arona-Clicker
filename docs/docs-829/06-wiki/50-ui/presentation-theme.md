# 06-wiki/50-ui/presentation-theme — 背景与实体表现

> 本文回答：界面宿主如何组合背景、主题和实体表现数据。

## 表现查询来源

`UIController` 通过 `controller-theme.ts` 生成背景与表现视图，再和 `GameReadModel` 一起传入 `createUIContext()`。展示组件以宿主 ID 查询背景层、形状参数、装饰和文本颜色模式；实体自身的头像、名称等展示信息由实体表现查询提供。

主题状态变更由 `controller-events.ts` 监听。全局主题、实体主题和用户主题事件会安排结构渲染；单个实体表现事件使用 `refreshEntityPresentation(entityKey)` 定向刷新。主题浮窗状态由控制器保留，并通过 `controller-theme.ts` 应用。

## 背景与文字颜色

背景解析支持全局层与宿主自有层组合，并可按 default、active、inactive、disabled 等状态选择状态层。同一宿主缺少状态专属层时使用该宿主自己的默认层及状态默认表现；active 在宿主没有自有默认层或状态层时使用主题色默认表现。父宿主的背景层与装饰不会因子宿主缺少状态配置而回退复用。根级全局背景仍按查询的 `inheritGlobal` 语义作为页面底层参与；局部宿主显式层照常生效。同一宿主的状态层仍覆盖同 ID 默认层、并追加不同 ID 层。自动文字颜色基于宿主背景层和下方背景合成后的明暗计算；宿主没有自有背景时保持 `auto`，让具体语义节点沿用其颜色 token。文字颜色模式的父级回退规则独立保留。

运行时主题解析统一把最终合并 token 的 `bg` / `bgAlt` 派生为保留 ID `system-color-background` 的画布底层；它始终置于该页面全局显式背景图层下方，层栈非空时也不省略。UserTheme 不再单独注入同一系统层。`ThemeLayer.systemColorLayerIgnored` 作为统一的渲染过滤标记；ThemeDef 与 ColorGroup 可声明同名可选项，优先级沿主题来源层级覆盖，玩家 UserTheme 继续由 UserTheme 存储 owner 管理。外部 Init 选择页在合并运行时底层、聚焦主题和恢复 Area 图层后复用同一底层构造入口；Init 主题仍不会进入游戏运行时。

实体展示配置、可用宿主和主题配置的定义不在组件内推断；UI 只通过表现视图与上下文的公开查询读取。数据定义和同步边界见 [[docs/docs-829/05-conventions/schema-sync]]。

## 色彩组、主题来源与解析

`ColorGroupDef` 的色槽提供头像配色，也可作为主题 token 的基底；色组没有显式主色 token 时，`ColorSystem.resolveTheme()` 从主色槽派生默认 token。`ColorEquipmentDef` 关联色组并声明效果；`ColorEquipmentSystem` 提供色槽颜色、装备效果和解锁查询。色彩组、主题和颜色装备的字段契约见 [[docs/docs-829/03-data-structures/datapack-contracts]]。

实体主题解析会先考虑启用的实体自定义主题，再查实体槽中的 custom / design 来源，然后解析当前装备主题，最后回退到实体声明默认主题。外部 Init 选择页直接投影聚焦 Init 的声明主题与背景变体；进入游戏后，Init 主题不进入运行时层。游戏内 `RuntimeThemeManager` 将 player、area、student 场景层按可配置顺序合并，另处理 user、preview 与最高优先级的剧情临时层；颜色 token、节点覆盖、背景与 Presentation 数据分别按其合并规则投影给 UI。一般主题编辑态由 `ThemeContentEditorService` 按 Datapack 编辑态 Pack record 与内容来源寻址：ColorGroup / ThemeDesign 使用稳定内容 ID；实体持有的 ThemeDef 使用 owner 表、实体 ID 与字段路径定位，覆盖 Init / Area / Spot / Enhancement / ColorEquipment / ThemeDesign / Shop / CharacterVariant 的直接主题字段及 EntityPresentation 默认项、附加项主题。编辑 session 绑定开始时的 pack content digest；Preview 走同一 RuntimeThemeManager 并可按 source ID 替换原主题贡献，保存前校验 digest 与 editing owner，再通过 PackManager 写回原内容。保存不会自动 Apply Pack，玩家 UserTheme 仍走独立 UserThemeService。产品侧解析见 `src/arona-clicker/services/color-system.ts`、`color-equipment-system.ts` 与 `theme-content-editor-service.ts`，通用运行时合并见 `src/engine/core/theme-runtime.ts`。

## 代码与测试

表现服务见 `src/ui/presentation-service.ts`、`presentation-targets.ts`、`presentation-config.ts` 与 `controller-theme.ts`；上下文解析见 `src/ui/context.ts`。相关测试有 `tests/ui/context.test.ts`、`presentation-service.test.ts`、`condition-presentation.test.ts`、`header-theme-layer-order.test.ts`、`tests/engine/color-system.test.ts`、`color-equipment-system.test.ts`、`color-derive.test.ts` 和 `theme-runtime.test.ts`。
