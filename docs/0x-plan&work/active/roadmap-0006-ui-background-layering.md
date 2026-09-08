# Roadmap 0006：UI 背景视觉层叠服务

> 本文记录 UI 背景图片、渐变与 SVG 装饰叠层的目标、施工切片和验收口径。B0–B4 的运行时、字段映射与编辑器接入已经落地；颜色主题的机制权威仍是 `src/engine/core/theme-runtime.ts` 与 `src/ui/theme-tree.ts`，图片资源机制权威仍是 `src/data-services/contracts/pic.ts` 及其解析链。

**状态：🟡 进行中（B0–B4 运行时、字段映射与编辑器接入已完成，专用预览与视觉回归待补）。**

## 目标

为前端 UI 增加可由 Datapack 声明的背景视觉层栈，支持：

- 纯色与渐变背景；
- SVG 几何装饰层，尤其是蔚蓝档案风格的小三角形组合；
- JPG、PNG 等场景图片；
- 多层透明度、顺序、定位、尺寸和混合模式；
- player / init / area / student / user / preview / ephemeral 作用域；
- 主题切换、场景切换和剧情临时演出时的平滑刷新；
- 图片失效时的确定性回退，不影响 UI 可用性。

## 当前事实

### 已有基础

- `RuntimeThemeManager` 已提供 `player → init → area → student` 的主题层合并与优先级机制；`user`、`preview` 与 `ephemeral` 是独立于该四级链的来源。
- `ColorSystem` 已提供色彩组、主题 token、实体主题槽和剧情临时主题。
- `controller-theme.ts` 已负责运行时层同步及 CSS 变量注入。
- `PicDef`、`ImageStore`、`PicService` 已支持按 `mod:type(pic):id` 解析图片。
- 数据包导入已经识别并登记 `svg/png/jpg/jpeg/webp/apng/avif/bmp/ico` 等图片资源。

### 立项基线（B1–B4 已补齐）

以下条目是本路线立项时记录的缺口，现由 B1–B4 的契约、服务、渲染与测试实现覆盖；剩余工作集中在编辑器专用预览和跨窗口视觉回归：

- 主题定义只有颜色 token，没有背景视觉层字段；
- 图片资源主要用于头像和聊天图片，没有背景用途语义；
- 页面背景曾由 `body` 上的单个 CSS 线性渐变承担；当前已由 `body > #ui-background-layer` 接管；
- `.panel` 使用不透明面板色，背景视觉无法自然穿透到三栏内容区域；
- `setTheme` 只能修改颜色主题，不能声明或替换背景层；
- 没有背景层的只读 View、合并服务、渲染容器和测试契约。

## 设计方向（按 ADR 0006 裁定）

### 1. 背景与颜色主题分开建模，共享运行时层级

不把图片字段直接塞进颜色 token，也不让 `ColorSystem` 负责图片解析。建议增加独立的 `BackgroundService` / `BackgroundView`，但复用现有的四级运行时作用域与优先级语义。

候选数据结构：

```text
BackgroundLayer
  source: solid | gradient | image
  value: CSS 色值、渐变描述或 Pic 引用
  order
  opacity
  position / size / repeat
  blendMode
  attachment
```

`ThemeDef` 可以先持有背景配置；如果后续出现独立背景复用、动画或编辑器需求，再拆为 `BackgroundDef` 注册表。正式落地前需要裁定这两种方案的取舍。

### 2. 使用独立 DOM 背景容器

运行时在 `body` 直系建立 `#ui-background-layer`，将最外层背景与 `#app` 内容层分离：

```text
body
  ├─ #ui-background-layer.console-background
  │   ├─ layer-0：底色 / 渐变
  │   ├─ layer-1：JPG / PNG 场景图
  │   ├─ layer-2：SVG 三角形装饰
  │   └─ layer-3：纹理 / 光晕
  └─ #app
      └─ .console-shell
```

不建议把所有层拼为一个 `background-image` 字符串，也不再让 `body` 直接消费主题背景变量。独立节点更容易控制透明度、混合模式、动画、调试和无障碍属性，也能避免装饰层与 UI 面板互相影响。

### 3. 安全与资源规则

- 背景图片优先使用现有 Pic 引用，直接 URL 只作为受控兼容入口。
- SVG 默认作为图片资源使用，不把 SVG 文本直接注入 DOM。
- 对直接 URL、数据 URL、图片格式和资源大小设置校验边界。
- 图片加载失败时移除该层并保留其余背景层。
- 不允许背景层遮挡交互元素；装饰容器默认 `pointer-events: none`。

## 施工切片

### B0：形成 ADR 与契约裁定 ✅

- [x] 裁定 ThemeDef.background 与独立 BackgroundDef 的边界。
- [x] 裁定覆盖规则：同一作用域替换、追加，还是按 layer id 合并。
- [x] 裁定背景层是否参与主题层排序，以及 ephemeral 的清理时机。
- [x] 裁定 CSS 支持范围、直接 URL 政策、SVG 安全策略和资源大小上限。

### B1：背景数据结构与解析服务 ✅

- [x] 增加背景层类型和只读 View。
- [x] 增加 Pic 引用解析与 CSS 属性白名单校验。
- [x] 实现 player / init / area / student / user / preview / ephemeral 的背景合并。
- [x] 为无配置、缺图、非法值提供默认渐变回退。
- [x] 如修改 src/engine/types/，执行 npm run gen:schema 并同步编辑器映射。

### B2：UI 背景渲染 ✅

- [x] 在 `body` 直系增加 `#ui-background-layer` 背景容器和层节点。
- [x] 在 controller-theme.ts 中注入背景 View。
- [x] 保持 .console-shell、三栏面板和弹窗的层级与交互不变。
- [x] 通过独立背景容器保持背景可见，不改变现有面板透明度契约。
- [x] 主题刷新时随现有 render 管线更新背景，不增加每秒刷新。

### B3：示例内容与视觉验收 ✅

- [x] 增加一个渐变背景示例。
- [x] 增加一个 PNG 场景背景示例。
- [x] 增加数据包声明的受控装饰/多层背景示例，验证透明度和混合模式（示例通过已登记的 `ba_triangles_svg` Pic 引用）。
- [x] 通过主题树、背景服务和运行时专项测试验证浅色/深色回退与层级。
- [x] 通过 cover、百分比定位和 fixed 层配置覆盖宽窄窗口的布局规则。

### B4：剧情与编辑器接入

- [x] 扩展 setTheme，使剧情可推入临时背景层。
- [x] 沿用 Story 临时主题清理规则，结束后恢复背景。
- [x] 为数据包编辑器增加背景字段与图片引用提示。
- [ ] 为数据包编辑器增加背景层可视化预览。
- [x] 更新 UI 模块文档和本 Roadmap 状态；数据契约以引擎类型为准。

## 验收口径

- 同一背景配置在无 JS、缺少资源和资源加载失败时都有可接受回退。
- Area 背景能覆盖玩家默认背景，学生对话背景能按既定优先级生效，剧情临时背景结束后能恢复。
- 渐变、JPG/PNG 和 SVG 可以同时存在并按声明顺序叠加。
- SVG 装饰层不拦截按钮、滚动和弹窗交互。
- 背景变更不破坏现有主题的文字明暗判断、面板可读性和聊天滚动。
- 资源引用不会绕过现有 Pic/Pack 资源边界，也不会将未验证 SVG 文本直接插入 DOM。
- 必须通过针对背景合并、回退、主题切换、资源解析的专项测试，以及 `npm test`、`npx tsc --noEmit` 和架构检查。

## 依赖与风险

- 依赖现有多包图片注册链；背景字段应使用同一套 Pic 引用，避免出现第二种资源寻址方式。
- 面板不透明度调整可能影响现有 WCAG 对比度判断，需要视觉回归测试。
- CSS `mix-blend-mode`、滤镜和固定背景在不同浏览器上的表现不完全一致，应提供保守回退。
- 背景图层属于表现层，不应进入 PlayerState；只有玩家明确选择且需要跨会话保留时，才另行裁定存储位置。

## 相关文档与代码

- [[docs/docs-828/02-modules/ui]]
- [[docs/docs-828/05-conventions/architecture-discipline]]
- [[docs/docs-828/05-conventions/schema-sync]]
- `src/engine/core/theme-runtime.ts`
- `src/ui/controller-theme.ts`
- `src/ui/outer-background.ts`
- `src/ui/theme-tree.ts`
- `src/ui/components/app-shell.ts`
- `src/data-services/contracts/pic.ts`
- `src/data-services/datapack/zip-loader.ts`

## 评审结论（2026-09-07，B4 收尾）

B0–B3 已完成并通过类型检查、专项测试、全量测试和构建。B4 已接入剧情临时背景恢复规则、编辑器背景字段映射及 UI 文档；当前剩余编辑器专用可视化预览和更完整的多设备视觉回归。实现采用 ThemeDef.background、按 id 覆盖/匿名追加、独立 DOM 背景容器和 Pic 资源解析。选择页的场景/状态变体另由 [[docs/0x-plan&work/active/task-0025-selector-dynamic-theme]] 管理。
