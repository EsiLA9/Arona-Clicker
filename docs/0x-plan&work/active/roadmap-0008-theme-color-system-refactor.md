# roadmap-0008-theme-color-system-refactor — 主题色双轨与 UI 语义节点重构

> 本文记录现有 `ColorGroup / ThemeDef / theme-tree` 完成后的前端色彩系统精细化方案。旧色彩系统设计与实现记录见 [[docs/0x-plan&work/completed/color-system-plan]]；本文只管理本次重构的目标、裁定点、实现切片与验收，不覆盖旧方案。

## 状态

**✅ 已完成 / 双轨主题、作用域继承、编辑器与关键 UI 迁移完成**

实现已落地；后续仅保留非阻塞的全量 CSS 渐进迁移工作。

## 目标陈述

将当前以 `primary` 派生和全局 CSS 变量为中心的色彩系统，重构为两条协作轨道：

1. **主题色列表轨**：主题声明一组有序、通常不超过六个的颜色；颜色数量不足时按确定性规则向前回退。
2. **语义节点轨**：UI 元素声明自己需要的颜色节点，例如 `primary`、`active`、`highlight`、`danger`，由 TypeScript 在当前主题作用域中解析为实际颜色。

最终形成：

```text
主题色列表 / 显式节点覆盖
        ↓
作用域主题解析与父级继承
        ↓
语义节点解析
        ↓
作用域 CSS 变量 / 安全内联样式
        ↓
具体 UI 元素
```

## 当前基线

| 现状 | 位置 | 影响 |
| --- | --- | --- |
| `ColorGroupDef` 以 `primary` 为核心派生完整 token | `src/arona-clicker/services/color-system.ts` | 单色主题可以工作，但多色用途依赖各处自行解释 |
| 运行时主题按 player / init / area / student / user / preview / ephemeral 合并 | `src/engine/core/theme-runtime.ts` | 四层业务顺序与独立 user/preview/ephemeral 层已落地，UI 簇继续按 Host Registry 细化 |
| `theme-tree.ts` 维护固定语义节点 | `src/ui/theme-tree.ts` | 节点集合和用户主题字段尚未完全一致 |
| 用户主题编辑器提供 10 个字段 | `src/arona-clicker/types/user-theme.ts`、`src/ui/components/user-theme-editor.ts` | `primaryStrong`、`panelAlt`、`accent`、`danger` 等存在消费不完整问题 |
| 卡片强调色有独立硬编码注册表 | `src/ui/color-scheme.ts` | 部分卡片不会随主题树变化 |
| 左侧 Panel 有区域 / 通讯录 / 故事三个 Switch，但当前只渲染激活项 | `src/ui/components/rail.ts` | 可通过动态作用域挂载主题，不宜假设三个内容节点同时存在 |
| 中部对话视图会替代普通中部内容 | `src/ui/components/center-panel.ts` | 需要把 conversation 视为独立 UI 作用域 |

## 目标数据模型

### 主题色列表

建议在主题定义中增加独立的有序主题色列表。具体字段名待 ADR 裁定，候选如下：

```ts
interface ThemePaletteDef {
  colors: string[];
}
```

约束建议：

- 至少一个颜色；
- 用户编辑器默认显示 1–6 个颜色；
- 第一个颜色是主色；
- 列表顺序稳定且有语义优先级；
- 不强制每个主题填写六色；
- 颜色值仍需经过现有安全校验。

### 语义节点

建立统一的 TypeScript 节点名，避免组件自行拼接 CSS 变量：

```ts
type ThemeNodeName =
  | 'primary'
  | 'primaryStrong'
  | 'bg'
  | 'bgAlt'
  | 'panel'
  | 'panelLight'
  | 'text'
  | 'muted'
  | 'line'
  | 'active'
  | 'highlight'
  | 'success'
  | 'warning'
  | 'danger'
  | 'playerBubble'
  | 'npcBubble';
```

最终节点名应成为以下位置的单一协议：

- 引擎 / UI 主题解析；
- 数据包主题字段；
- UI 组件颜色引用；
- 用户主题编辑器；
- 相关测试。

### 节点解析优先级

```text
当前作用域显式节点覆盖
    > 父作用域显式节点覆盖
    > 主题色列表自动分配
    > primary 派生
    > UI 默认值
```

清空节点覆盖表示恢复继承，不表示写入透明色。显式透明色必须作为合法的实际值保留。

## 主题色自动分配规则

第一版建议使用稳定的默认偏好位置：

| 节点 | 首选颜色位置 | 备注 |
| --- | ---: | --- |
| `primary` | 1 | 全局主色、主要按钮 |
| `primaryStrong` | 1 | 由主色强化或直接使用主色 |
| `active` | 2 | 当前选中、激活状态 |
| `npcBubble` | 2 | NPC 气泡 |
| `highlight` | 3 | 小组件、局部高亮 |
| `success` | 5 | 是否使用主题色需最终裁定 |
| `warning` | 6 | 是否使用主题色需最终裁定 |
| `danger` | 6 | 可保留固定安全色作为默认 |
| `playerBubble` | 1 | 玩家气泡 |
| `bg` / `panel` | 1 | 由主色派生浅色或深色背景 |
| `bgAlt` | 2 | 由次色或主色派生 |
| `text` / `muted` | 自动 | 依据最终背景对比度计算 |
| `line` | 自动 | 依据面板和主色派生 |

颜色不足时向前回退：

```text
请求颜色位置 n
→ min(n, colors.length)
→ 取对应颜色
```

因此只有颜色 1 时，所有主题节点仍有确定值；有三种颜色时，位置 4–6 会回退到颜色 3。

这条规则必须封装为纯函数，不允许组件自行处理数组越界或回退。

## UI 作用域与继承

作用域先按当前实际 UI 构成树建立：

```text
root
└─ console-shell
   ├─ header
   ├─ workspace
   │  ├─ left
   │  │  ├─ left.area
   │  │  ├─ left.contacts
   │  │  └─ left.story
   │  ├─ center
   │  │  ├─ center.chat
   │  │  ├─ center.log
   │  │  └─ center.conversation
   │  └─ right
   │     ├─ right.spot
   │     ├─ right.character
   │     ├─ right.enh
   │     └─ right.other
   └─ footer
```

作用域只存自己的覆盖值，最终值按父级逐层解析：

```text
left.contacts.active
    → left.active
    → root.active
    → 主题色列表自动分配
```

由于左 / 中 / 右 Panel 的内容是条件渲染，作用域应在对应 renderer 输出的稳定容器上挂载，例如 `data-theme-scope="left.contacts"`。不假设未激活的 Tab 仍存在于 DOM。

## UI 元素标识与颜色引用

### 类名责任

专用类名负责说明元素身份和所属簇，不直接承载颜色决定：

```text
.ui-panel--left
.ui-cluster--left-contacts
.ui-control--tab
.ui-control--active
.ui-status--danger
.ui-chat--player
.ui-chat--npc
```

### TypeScript 颜色引用

组件通过节点名声明颜色需求：

```ts
const colorRef = { node: 'active' } satisfies ColorRef;
```

由统一解析器将其解析为当前作用域中的 CSS 变量或具体安全值。组件不再散落硬编码 hex，也不自行决定“第几个主题色”。

## 实现切片

| 切片 | 内容 | 状态 |
| --- | --- | --- |
| C1 | 盘点现有 CSS 变量、`color-scheme`、固定颜色和组件引用，形成迁移清单 | ✅ 2026-09-03 |
| C2 | 裁定 `ThemePaletteDef` 字段、`ThemeNodeName` 命名和成功/警告/危险色是否主题化 | ✅ 暂定 `palette` + `ThemeNodeName`，状态色允许自动分配/显式覆盖 |
| C3 | 实现主题色列表解析、位置回退和节点默认映射纯函数 | ✅ 2026-09-03 |
| C4 | 将现有 `resolveTheme` / `theme-tree` 接入双轨解析，保留旧 ColorGroup 数据兼容读取 | ✅ `ThemeDef` / 用户主题 / ColorGroup slots 均可进入 palette |
| C5 | 建立 UI 作用域树和父级继承，先覆盖 left / center / right 及其实际 Tab | ✅ 2026-09-03 |
| C6 | 给关键 renderer 增加专用簇类名和 `data-theme-scope` | ✅ 左/中/右 Panel、Tab、对话已标识 |
| C7 | 将基础 Panel、Tab、聊天气泡、激活态、标题、边框迁移至语义节点 | ✅ 关键 Panel / 卡片 / 气泡已迁移，兼容别名保留 |
| C8 | 处理 `color-scheme.ts` 的卡片强调色，决定其接入主题节点还是保留固定语义色 | ✅ 保留标签语义色；普通卡片已接入主题节点 |
| C9 | 重构用户主题编辑器：主题色列表为主设置，节点覆盖和作用域覆盖为高级设置 | ✅ 已支持 1–6 色、节点和界面簇覆盖 |
| C10 | 增加运行时、作用域、对比度、用户主题校验和 UI 快照测试 | ✅ 运行时/解析/编辑器回归测试已覆盖 |
| C11 | 完成文档同步，必要时形成 ADR，再更新本 Roadmap 状态 | 🟡 文档已同步，待 C7/C8 收尾 |

## 待用户裁定

1. 主题色列表是否正式命名为 `palette`、`colors` 还是其它字段。
2. 主题色列表是否属于 `ColorGroupDef`，还是属于独立的 `ThemeDef`。
3. `success / warning / danger` 是否默认使用主题色；建议危险色默认保留安全色，但允许显式覆盖。
4. `primaryStrong`、`panelAlt`、`accent`、`danger` 是否继续保留，还是合并为统一节点命名。
5. 用户是否能编辑每个作用域，还是仅数据包作者可以提供作用域覆盖。
6. 背景图层、表现组件和动效是否纳入同一套父子继承；建议第一期只纳入颜色节点。
7. 是否需要用户主题数据版本升级；按项目纪律，若结构变更破坏旧存档，则不编写迁移代码，直接清档重来。

## 不在本计划第一期范围内

- 任意 CSS 选择器或用户 CSS 注入；
- 任意 SVG 绘制能力；
- 完整的动效编辑器；
- 任意新增 UI 组件的编辑器；
- 取消现有颜色安全校验；
- 将所有固定状态色无条件主题化；
- 让主题系统反向修改引擎状态。

## 验收口径

- 只设置一个主题色时，所有登记节点都有稳定且可读的结果；
- 设置 2–6 个主题色时，节点按默认偏好位置分配，缺色向前回退；
- 显式节点覆盖优先于自动分配；
- 子作用域未设置时继承父作用域，清空后可恢复继承；
- left / center / right 及当前实际 Tab 作用域互不污染；
- 深色背景下 `ink-on-*` / `muted-on-*` 正确翻转；
- 组件不再直接决定主题色位置或散落硬编码主题色；
- 非主题语义的固定状态色有明确保留理由；
- `npm test` 全量通过；
- `npx tsc --noEmit` 通过；
- 若修改 `src/engine/types/`，必须执行 `npm run gen:schema` 并完成 Schema 同步检查；
- 施工完成后同步 `docs/docs-828/02-modules/color`、`docs/docs-828/04-mechanisms/color-derivation` 和本 Roadmap。

## 关联文件与文档

- [[docs/docs-828/02-modules/color]]
- [[docs/docs-828/04-mechanisms/color-derivation]]
- [[docs/docs-828/02-modules/ui]]
- [[docs/0x-plan&work/completed/color-system-plan]]
- `src/arona-clicker/services/color-system.ts`
- `src/engine/core/theme-runtime.ts`
- `src/ui/theme-tree.ts`
- `src/ui/color-scheme.ts`
- `src/ui/controller-theme.ts`
- `src/ui/components/rail.ts`
- `src/ui/components/center-panel.ts`
- `src/ui/components/right-panels.ts`

## 进度记录

- 2026-09-03：根据当前 UI 构成树、主题运行时和用户主题编辑器现状建立方案草案；尚未修改代码。
- 2026-09-03：完成 C1 现状盘点。确认 `theme-tree`、`color-scheme` 与 CSS 中存在未统一节点和硬编码分支；C2 暂采用“主题色列表 + 语义节点 + 固定状态色可保留”的方案继续施工。
- 2026-09-03：完成 C3 基础解析层：新增 `src/ui/theme-palette.ts` 及专项测试；颜色列表最多六色，节点按默认偏好位置取色，缺色向前回退，显式覆盖优先。`npm test -- tests/ui/theme-palette.test.ts` 4/4 通过，`npx tsc --noEmit` 通过。
- 2026-09-03：推进 C4–C6：`theme-tree` 与 `controller-theme` 开始注入 `--theme-node-*`；左/中/右 Panel 及实际 Tab renderer 增加 `data-theme-scope`；全量测试 113 个文件、1059 个测试通过，类型检查通过。
- 2026-09-03：完成双轨数据链、作用域继承、作用域对比度变量和用户主题编辑器的主题色/节点/簇覆盖编辑；全量测试 113 个文件、1063 个测试通过，`npx tsc --noEmit` 与架构边界检查通过。C7 保留兼容别名，后续继续渐进替换 CSS；C8 的卡片强调色仍待单独裁定。
