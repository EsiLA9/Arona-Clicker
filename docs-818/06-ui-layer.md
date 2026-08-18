# 06 — UI Layer UI 层

---

## 1. UIController 控制器

**文件**：[[src/ui/controller.ts]]（750 行）

UI 的核心控制器，管理事件绑定、刷新策略、聊天流、tooltip、导入 Mod、日志导出。

### 两种刷新路径

| 路径 | 方法 | 触发 | 行为 |
|------|------|------|------|
| 轻量刷新 | `refreshLight()` | 每秒 setInterval | 只更新资源数字 / Spot 产出的 textContent，不重建 DOM |
| 事件驱动重建 | `render()` | EventBus 非高频事件 | 重算揭示指纹 → 指纹变化才 innerHTML 重建整个 #app |

### 刷新策略

- **tick / spotProduced** 高频事件不参与揭示评估（由 refreshLight 覆盖数值）
- **其余事件** → `refreshRevealIfChanged()` → 节流 200ms → 重算指纹 → 变化才 render()
- render() 前捕获聊天流滚动比例，重建后恢复

### 事件绑定

`bindActions()` 通过 data 属性委托绑定：

| data 属性 | 说明 |
|-----------|------|
| `data-tab` | Tab 切换 |
| `data-area` | 区域移动 |
| `data-upgrade` | 设施升级/解锁 |
| `data-purchase-enh` | 强化购买 |
| `data-start-story` | 启动剧情 |
| `data-story-choice` | 剧情选项 |
| `data-send` | 回复按钮 |
| `data-use-item` | 使用物品 |
| `data-restart-init` | 软重启 |
| `data-hard-reset-init` | 硬重置 |
| `data-open-enh-manager` | 强化管理弹窗 |

### Tooltip 浮层

`bindPopovers()` 使用事件委托 + 防抖：鼠标停留 80ms 才显示，移出 60ms 后隐藏。

**实现位置**：[[src/ui/controller.ts]] `bindPopovers()`

---

## 2. 组件结构

**目录**：[[src/ui/components/]]

| 组件 | 文件 | 说明 |
|------|------|------|
| App Shell | [[src/ui/components/app-shell.ts]] | 主布局（header + 三面板） |
| Header | [[src/ui/components/header.ts]] | 顶栏（品牌 + 资源条 + 操作按钮） |
| Rail | [[src/ui/components/rail.ts]] | 左侧面板（Area / 世界线 / 故事） |
| Center Panel | [[src/ui/components/center-panel.ts]] | 中间面板（聊天 / 日志） |
| Right Panels | [[src/ui/components/right-panels.ts]] | 右侧面板（设施 / 强化 / 其他） |
| Production | [[src/ui/components/production.ts]] | 设施卡片渲染 |
| Enhancements | [[src/ui/components/enhancements.ts]] | 强化购买/管理 |
| Story | [[src/ui/components/story.ts]] | 聊天流/剧情对话 |
| Tooltip | [[src/ui/components/tooltip.ts]] | 揭示阶段计算 + 详情面板 |
| Init Select | [[src/ui/components/init-select.ts]] | 世界线选择页 |
| Tabs | [[src/ui/components/tabs.ts]] | Tab 按钮组 |
| Toast | [[src/ui/components/toast.ts]] | 全局 Toast 通知 |
| Errors | [[src/ui/components/errors.ts]] | 操作错误码文案 |

### UIContext

**文件**：[[src/ui/context.ts]]

UI 渲染的只读上下文，包含 `view`（GameView 快照）+ 格式化函数 + `nameOf()`（displayName）。

---

## 3. 布局结构

### 三面板布局

```
┌─────────────────────────────────────┐
│ Header（品牌 + 资源条 + 操作按钮）    │
├──────┬──────────────┬───────────────┤
│ Left │    Center    │    Right      │
│ Panel│    Panel     │    Panel      │
│ 230px│   自适应      │   300px       │
│      │              │               │
│ Area │   聊天流      │   设施卡片     │
│ 世界线│   / 日志     │   强化购买     │
│ 故事  │              │   背包/效果    │
├──────┴──────────────┴───────────────┤
│ Footer                              │
└─────────────────────────────────────┘
```

### 左侧面板 Tab

| Tab | 内容 |
|-----|------|
| 区域 | 当前 Area hero + 相邻区域导航 |
| 故事 | 主动故事列表 + 触发按钮 |
| 世界线 | 所有世界线列表 + 解锁状态 |

### 中间面板 Tab

| Tab | 内容 |
|-----|------|
| 聊天 | 聊天流（气泡）+ 当前剧情 + 回复按钮 |
| 日志 | DevLog 条目列表 |

### 右侧面板 Tab

| Tab | 内容 |
|-----|------|
| 设施 | 当前 Area 的 Spot 卡片（升级/解锁） |
| 强化 | 可购买的 Enhancement 卡片 |
| 其他 | 背包 + 效果追踪 |

---

## 4. 聊天流与剧情演出

### 聊天流 ChatEntry

**定义位置**：[[src/ui/components/story.ts]]

```typescript
interface ChatEntry {
  id: number;
  kind: 'talk' | 'system';
  speaker?: string;
  text: string;
  storyType?: 'active' | 'passive';
  isPlayer?: boolean;
  timestamp: number;
}
```

### 聊天流渲染

- `renderChatHistory()`：渲染累积的聊天历史（气泡流）
- `renderCurrentStory()`：渲染当前进行中的剧情（对话 + 选项）

### 回复按钮（Send Button）

本质是承载推进的 Talklet 的演出形态：

| 状态 | 行为 |
|------|------|
| `advance` | 单次点击推进剧情 |
| `idle` | 无进行中剧情，点击触发被动闲聊 |
| `choice` | 有选项，按钮让位 |
| `working` | 多击任务（clickWork），进度条从左往右填充 |

### 多击任务（clickWork）

`StoryPage.clickWork`：要求玩家连续点击 `base + rand(0, rand)` 次才能推进。按钮上显示进度条。

---

## 5. Tooltip 信息揭示

**文件**：[[src/ui/components/tooltip.ts]]

### 详情面板

每个实体类型有独立的详情面板渲染函数：

| 函数 | 说明 |
|------|------|
| `renderSpotDetail(ctx, spot, level)` | Spot 详情（等级/产出/升级/Manager/功能/标签） |
| `renderEnhancementDetail(ctx, enh)` | Enhancement 详情（状态/条件/花费/倍率） |
| `renderAreaDetail(ctx, area)` | Area 详情（所属世界线/设施/相邻区域） |
| `renderInitDetail(ctx, init)` | Init 详情（区域/设施/花费/进度） |
| `renderResourceDetail(ctx, resourceId)` | 资源详情（当前值/产出/统计） |
| `renderItemDetail(ctx, item)` | 物品详情（类型/效果/售价） |

### 揭示遮挡

未揭示的字段用 `???`（OBFUSCATED）遮挡。揭示状态由 `getXxxReveal()` 计算。

### 条件文本描述

`describeCondition(cond, nameOf)` 将条件转为可读中文文本。

---

## 6. Toast 通知

**文件**：[[src/ui/components/toast.ts]]

全局 Toast 通知服务，挂载在 body 上，独立于 #app 的 render() 重建周期。

```typescript
toast.show('消息', 'success' | 'error' | 'info')
```

- 自动 2500ms 消失
- 最多同时显示 4 条
- 超过上限移除最旧的

---

## 7. Modal 弹窗

**文件**：[[src/ui/modal.ts]]

通用弹窗母版（ModalManager），挂载在 body 级。

```typescript
modal.open({ title, body, footer?, onClose? })
modal.close()
```

关闭方式：右上角 × / 点击遮罩 / Esc

---

## 8. Init 选择页

**文件**：[[src/ui/components/init-select.ts]]

### 渲染逻辑

根据 RevealStage 渲染不同状态的卡片：

| 阶段 | 渲染 |
|------|------|
| `invisible` | 不渲染 |
| `presence` | 占位黑盒（???） |
| `owned` | 可进入按钮 |
| `purchaseable` | 可购买按钮（显示价格） |
| `partial/known/utility` | 锁定状态（部分信息） |

### 操作

- 已解锁 → 点击进入（新游戏 / 恢复）
- 未解锁可购买 → 点击购买（先扣费，再进入）
- 有存档 → 读取存档按钮

---

## 9. 响应式设计

**文件**：[[src/ui/styles.css]]

| 断点 | 布局变化 |
|------|----------|
| ≤620px | 单列布局，顶栏堆叠，资源条纵向 |
| ≤950px | 双列布局，center-panel 跨两列 |
| >950px | 三列布局（230px / 自适应 / 300px） |

`prefers-reduced-motion: reduce` 时禁用所有动画和过渡。
