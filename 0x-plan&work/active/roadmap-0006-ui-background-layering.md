# Roadmap 0006：UI 背景视觉层叠服务

> 本文记录 UI 背景图片、渐变与 SVG 装饰叠层的目标、施工切片和验收口径。当前属于方案阶段；颜色主题的机制权威仍是 `src/engine/core/theme-runtime.ts` 与 `src/ui/theme-tree.ts`，图片资源机制权威仍是 `src/data-services/contracts/pic.ts` 及其解析链。

**状态：🔵 待裁定 / 未开始施工。**

## 目标

为前端 UI 增加可由 Datapack 声明的背景视觉层栈，支持：

- 纯色与渐变背景；
- SVG 几何装饰层，尤其是蔚蓝档案风格的小三角形组合；
- JPG、PNG 等场景图片；
- 多层透明度、顺序、定位、尺寸和混合模式；
- player / area / student / ephemeral 作用域；
- 主题切换、场景切换和剧情临时演出时的平滑刷新；
- 图片失效时的确定性回退，不影响 UI 可用性。

## 当前事实

### 已有基础

- `RuntimeThemeManager` 已提供 `player → area → student → ephemeral` 的主题层合并与优先级机制。
- `ColorSystem` 已提供色彩组、主题 token、实体主题槽和剧情临时主题。
- `controller-theme.ts` 已负责运行时层同步及 CSS 变量注入。
- `PicDef`、`ImageStore`、`PicService` 已支持按 `mod:type(pic):id` 解析图片。
- 数据包导入已经识别并登记 `svg/png/jpg/jpeg/webp/apng/avif/bmp/ico` 等图片资源。

### 当前缺口

- 主题定义只有颜色 token，没有背景视觉层字段。
- 图片资源目前主要用于头像和聊天图片，没有背景用途语义。
- 页面背景是 `body` 上的单个 CSS 线性渐变。
- `.panel` 使用不透明面板色，背景视觉无法自然穿透到三栏内容区域。
- `setTheme` 只能修改颜色主题，不能声明或替换背景层。
- 没有背景层的只读 View、合并服务、渲染容器和测试契约。

## 设计方向（待 ADR 裁定）

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

建议在 `app-shell` 中将背景层与内容层分离：

```text
.console-background
  ├─ layer-0：底色 / 渐变
  ├─ layer-1：JPG / PNG 场景图
  ├─ layer-2：SVG 三角形装饰
  └─ layer-3：纹理 / 光晕
.console-shell
```

不建议把所有层拼为一个 `background-image` 字符串。独立节点更容易控制透明度、混合模式、动画、调试和无障碍属性，也能避免装饰层与 UI 面板互相影响。

### 3. 安全与资源规则

- 背景图片优先使用现有 Pic 引用，直接 URL 只作为受控兼容入口。
- SVG 默认作为图片资源使用，不把 SVG 文本直接注入 DOM。
- 对直接 URL、数据 URL、图片格式和资源大小设置校验边界。
- 图片加载失败时移除该层并保留其余背景层。
- 不允许背景层遮挡交互元素；装饰容器默认 `pointer-events: none`。

## 施工切片

### B0：形成 ADR 与契约裁定

- [ ] 裁定 `ThemeDef.background` 与独立 `BackgroundDef` 的边界。
- [ ] 裁定覆盖规则：同一作用域替换、追加，还是按 layer id 合并。
- [ ] 裁定背景层是否参与主题层排序，以及 ephemeral 的清理时机。
- [ ] 裁定 CSS 支持范围、直接 URL 政策、SVG 安全策略和资源大小上限。

### B1：背景数据结构与解析服务

- [ ] 增加背景层类型和只读 View。
- [ ] 增加 Pic 引用解析与 CSS 属性白名单校验。
- [ ] 实现 player / area / student / ephemeral 的背景合并。
- [ ] 为无配置、缺图、非法值提供默认渐变回退。
- [ ] 如修改 `src/engine/types/`，执行 `npm run gen:schema` 并同步编辑器映射。

### B2：UI 背景渲染

- [ ] 在 `app-shell` 增加背景容器和层节点。
- [ ] 在 `controller-theme.ts` 中注入背景 View。
- [ ] 保持 `.console-shell`、三栏面板和弹窗的层级与交互不变。
- [ ] 调整必要的面板透明度，使背景可见但不牺牲文本对比度。
- [ ] 支持背景变化时的局部更新，避免每秒重建整个 UI。

### B3：示例内容与视觉验收

- [ ] 增加一个渐变背景示例。
- [ ] 增加一个 JPG/PNG 场景背景示例。
- [ ] 增加两至三层 SVG 小三角形装饰示例，验证旋转、透明度和混合模式。
- [ ] 验证浅色、深色和高饱和主题下的文字可读性。
- [ ] 验证桌面宽屏、窄窗口和移动宽度下的裁切与定位。

### B4：剧情与编辑器接入

- [ ] 扩展 `setTheme` 或新增专用演出效果，使剧情可推入临时背景层。
- [ ] 明确 Story 开始、切换、结束时的背景清理与恢复规则。
- [ ] 为数据包编辑器增加背景字段、图片引用提示和可视化预览。
- [ ] 更新 UI 模块文档、数据包契约文档和本 Roadmap 状态。

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

- [[docs-828/02-modules/ui]]
- [[docs-828/05-conventions/architecture-discipline]]
- [[docs-828/05-conventions/schema-sync]]
- `src/engine/core/theme-runtime.ts`
- `src/ui/controller-theme.ts`
- `src/ui/theme-tree.ts`
- `src/ui/components/app-shell.ts`
- `src/data-services/contracts/pic.ts`
- `src/data-services/datapack/zip-loader.ts`

## 评审结论（2026-09-02）

当前方案可以进入 B0 设计裁定，但不建议直接开始 B1 编码。主要未决项是：背景字段是否属于 `ThemeDef`、层是“追加”还是“替换”、以及 SVG/直接 URL 的安全边界。上述三项确定后，再开始契约设计可以避免后续数据结构返工。
