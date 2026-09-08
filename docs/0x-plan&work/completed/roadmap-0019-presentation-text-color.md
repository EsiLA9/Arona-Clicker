# roadmap-0019 — 表现宿主文字颜色统一

> 状态：✅ 已完成（2026-09-05）。本文记录文字颜色控制的施工范围与验收结果；表现层机制以源码与 `docs/docs-828` 为准。

## 目标

为表现宿主和按钮状态提供统一的文字颜色模式：

- `auto`：按最终背景继续使用经典亮度判别；
- `light`：指定白色；
- `dark`：指定黑色。

覆盖 `default`、`active`、`inactive`、`disabled`，并让普通文字、嵌套文字、Unicode 图标和 inline SVG 图形跟随同一前景色。

## 已确认问题

1. 背景状态和文字模式目前由两条解析链路分别计算，存在状态来源不一致的风险。
2. `states.default` 虽在类型中存在，但当前文字解析只读取宿主级默认字段。
3. 部分顶部按钮依赖主题刷新后补写 `data-theme-text-mode`，初始渲染入口不完整。
4. 现有测试验证了背景状态，但未覆盖文字模式优先级、DOM 同步和 SVG 跟随。
5. `engine-defs.gen.json` 尚未同步新增的文字颜色字段。
6. 外部 `<img src="*.svg">` 无法通过外层 CSS 修改内部 path；只有 inline SVG 能直接继承 `currentColor`。

## 方案

### P0：统一解析与 Schema

引入统一的宿主状态解析结果：

```ts
resolvePresentationHostState(hostId, state): {
  background: BackgroundView;
  textColorMode: PresentationTextColorMode;
  source: 'state' | 'default' | 'parent' | 'auto';
}
```

优先级：

```text
当前状态 > 宿主 default > 父级宿主对应状态 > 父级宿主 default > auto
```

`states.default` 与宿主级默认字段的语义需要统一：前者是明确的 default 状态覆盖，后者是宿主默认回退值。

修改类型后执行 `npm run gen:schema`，并通过 Schema 同步测试。

### P1：DOM 与 CSS

- 所有表现目标由统一渲染辅助逻辑写入 `data-theme-state` 和 `data-theme-text-mode`。
- 初始渲染、主题刷新、局部刷新、浮窗开关使用同一状态解析结果。
- 表现目标内部文字使用 `color: inherit`。
- inline SVG 使用 `fill: currentColor`、`stroke: currentColor`。
- hover 只提供交互反馈，不改变用户配置的语义状态颜色。
- 外部 SVG 图片不纳入动态 path 重染色承诺；如确需变色，改用 inline SVG、mask 或预生成资源。

### P1：测试

至少覆盖：

1. 默认黑色、inactive 白色；
2. 默认白色、active 黑色；
3. inactive 未设置时继承默认；
4. inactive 明确设置 `auto` 时不继承默认；
5. 状态切换后 `data-theme-state` 与 `data-theme-text-mode` 同步；
6. 嵌套文字和 inline SVG path 跟随强制颜色；
7. 主题重算、局部刷新、全量 render 后状态保持。

### P2：Edge 验收

在顶部按钮、Tab、卡片操作按钮和聊天气泡中逐项检查四种状态，并验证：

- 关闭/打开主题浮窗；
- 主题重算；
- 局部面板刷新；
- 全量 DOM 重建；
- disabled 与原生 `disabled` 同步；
- 背景图层不会被误当作文字颜色来源。

## 验收命令

```text
npm run gen:schema
npx tsc --noEmit
npm test
npm run build
```

## 当前进度

- [x] 建立问题清单与解决路线
- [x] 现有测试与 Edge 运行态基线检查
- [x] 统一宿主背景/文字状态解析（统一结果已接入主题刷新入口）
- [x] 完成 Schema 生成与同步测试
- [x] 补齐 DOM/CSS/SVG 回归测试
- [x] Edge 四状态实际验收（默认、active、inactive 继承、disabled 配置入口与刷新链已验证）
- [x] 更新本文件与总索引并归档

## 进度记录

### 2026-09-05

- 已生成最新 `engine-defs.gen.json`；Schema 同步测试 7/7 通过。
- `textColorModeForHost()` 已支持 `states.default`，并保持明确 `auto` 不继承宿主模式。
- 顶部默认按钮初始渲染已直接写入 `data-theme-text-mode`。
- 相关定向测试 14/14 通过，TypeScript 检查通过。
- 全量测试 115/115 文件、1088/1088 测试通过；生产构建通过。
- Edge 已验证：默认 `dark`、active `light` 的 DOM 属性与计算色分离正确；inactive 显示继承默认态；disabled 可独立配置。
- 已新增 Tab DOM 状态断言和 inline SVG CSS 契约断言。
- 回归修复：解析顺序明确为“当前状态显式值（含 auto）> 宿主默认态 > 父级 > auto”，并补充默认为 auto/light/dark 时 inactive 显式配置均不被覆盖的测试。
- 运行时跨 player/scene/preview 合并时保留状态级文字模式，补充 RUNTIME-21 回归测试。

## 验收结果

- Schema 同步测试：7/7 通过。
- 专项测试：24/24 通过。
- 全量测试：116 个文件、1091 个测试通过。
- TypeScript：`npx tsc --noEmit` 通过。
- 构建：`npm run build` 通过。
- Edge：已验证 default、active、inactive 继承和 disabled 独立配置入口；主题浮窗与编辑器预览修改未保存，已取消。
- 回归复核：Edge 中 inactive 显式 light 在状态切换、主题重算后仍保持 `data-theme-text-mode="light"` 与白色计算色。
- SVG 边界：inline SVG 的 `fill/stroke` 跟随 `currentColor`；外部 `<img src="*.svg">` 不承诺动态修改内部 path。

## 关联文档

- [[docs/0x-plan&work/active/roadmap-0017-theme-state-and-semantic-storage]]
- [[docs/0x-plan&work/active/roadmap-0018-button-state-unification]]
- [[docs/docs-828/04-mechanisms/color-derivation]]
- [[docs/docs-828/05-conventions/schema-sync]]
