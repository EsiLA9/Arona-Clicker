# UI 风格体系 — 项目本地入口

> 本目录回答：ACProgram 游戏 UI 继承哪些视觉约定、复用哪些入口，以及当前核验状态。

## 按任务读取

| 需要 | 页面 |
| --- | --- |
| 颜色、字体、间距、表面与状态的已有基础 | [[ui-style/foundations]] |
| 工作区、顶栏、控件、卡片与内容来源的复用模式 | [[ui-style/patterns]] |
| 通用设计、视觉方向确认与风格资料维护 | Agent 的 `frontend-design` skill |
| 游戏 UI 数据边界、刷新与施工补充 | [[docs/ai/frontend-design-project-overlay]] |
| 项目主题运行机制与 DOM 更新 | [[docs/docs-829/06-wiki/50-ui/presentation-theme]]、[[docs/docs-829/06-wiki/50-ui/refresh-update]] |

## 范围与状态

- 范围：`src/ui/` 游戏 UI，包含游戏内编辑界面；独立 Datapack Editor 不默认套用本基线。
- 状态：初始条目由当前 CSS、共享组件和相关测试核对，分别标明已有实现与复用约定。尚无逐页浏览器视觉验收，不表示所有旧页面已完全统一。
- 权威：这里维护视觉角色与复用模式；具体值以源码和运行时主题为准。机制、架构、刷新正文继续由 `docs/docs-829/` 维护，通用施工与维护流程由 skill 维护，项目补充见覆盖协议。

## 主要依据

主要依据：`src/ui/css/variables.css`、`src/ui/css/layout.css`、`src/ui/css/cards.css`、`src/ui/components/shared/workspace-frame.ts`、`src/ui/components/shared/tabs.ts`。结构验证入口：`tests/ui/workspace-frame.test.ts`，它不证明视觉质量。
