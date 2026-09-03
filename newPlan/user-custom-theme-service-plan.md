# 用户自定主题与编辑服务计划

## 1. 目标

新增一个“用户自定主题”能力：玩家可以在 UI 编辑器中调整自己的主题颜色、区域表现、图片组件和有限的动效预设，并将结果保存为全局用户设置。

该能力不是默认开放的设置项。只要任意一个处于 `Active` 状态的 Affector 声明支持“开放自定主题”能力，即可进入编辑服务并应用自定主题。GlobalEnh 可以作为其中一种解锁来源，但服务不绑定具体的强化 ID、挂靠类型或单一 Affector。

本计划只设计接口、权限边界、限制器和施工顺序；不在本轮修改实现。

## 2. 已有机制与设计约束

### 开发测试临时约定

当前默认内容中的 `base:enhancement:user-theme-editor` 价格暂时设为 `0`，用于手动测试主题编辑入口。现有测试不依赖该价格：只准备足够资源并断言购买成功、能力开启和保存结果，不断言具体扣费数值。恢复正式价格时无需修改这些测试。

项目当前已经具备：

- `EnhancementDef.attachment.kind === 'global'` 的 GlobalEnh 语义；
- `EnhancementDef.affectorPackIds` 到 Affector 的挂载关系；
- `AffectorEngine` 的 `Latent → Active → Removed` 生命周期；
- `StateMutationService` 的主题及全局状态写入口；
- `PresentationDef` / `PresentationView` 的区域化表现协议；
- Schema 生成、编辑器字段映射和导入校验链路。

因此新功能必须复用这些机制：

1. UI 不直接写 `PlayerState`，编辑器保存必须经过 `StateMutationService`；
2. UI 不直接判断 `unlockedEnhancements`，服务权限必须读取 Affector 的有效能力；
3. 自定主题保存于 Global 层，不进入 `InitSnapshot`；
4. 自定主题是受限数据，不是 Datapack、HTML 模板或脚本；
5. 所有资源、图片、条件和表现值都必须经过 Registry、Schema、语义校验和转义。

## 3. 用户数据接口

建议在 `src/arona-clicker/types/state.ts` 增加全局字段：

```ts
interface UserThemeState {
  enabled: boolean;
  draft?: UserThemeDraft;
  applied?: UserThemeDraft;
  updatedAtFrame?: number;
}
```

`PlayerState` 增加：

```ts
userTheme?: UserThemeState;
```

`draft` 和 `applied` 分离：

- 编辑过程中只修改编辑器内的临时 draft；
- 点击保存后才通过单一写入口替换 `applied`；
- 点击取消或编辑器关闭不影响正在使用的主题；
- `enabled` 只允许在能力已启用时切换；
- 能力失效时不删除保存内容，仅停止应用并将编辑器切为只读。

### 3.1 UserThemeDraft

```ts
interface UserThemeDraft {
  version: 1;
  tokens?: Partial<Record<UserThemeToken, string>>;
  presentation?: UserThemePresentation;
  motionPreferences?: {
    reducedMotion?: 'system' | 'always' | 'never';
  };
}
```

`UserThemePresentation` 只允许用户主题需要的静态子集：

```ts
interface UserThemePresentation {
  layers?: UserThemeLayer[];
  components?: UserThemeComponent[];
}
```

建议首版允许的 `UserThemeToken`：

```ts
type UserThemeToken =
  | 'primary'
  | 'primaryStrong'
  | 'bg'
  | 'bgAlt'
  | 'panel'
  | 'panelAlt'
  | 'text'
  | 'muted'
  | 'accent'
  | 'danger';
```

用户主题不能写入任意 token 名称，避免通过 CSS 变量污染未声明的页面结构。

## 4. Affector 服务能力授权接口

Affector 本身继续负责持续效果生命周期，但增加声明式能力授权元数据：

```ts
type ServiceCapabilityId = 'user-theme.editor';

interface AffectorCapabilityGrant {
  kind: 'service';
  id: ServiceCapabilityId;
  mode: 'enable';
}

interface AffectorPackDef {
  id: string;
  entries: AffectorEffect[];
  capabilities?: AffectorCapabilityGrant[];
  extra?: ExtraCompound;
}
```

默认内容可以新增一个专用 GlobalEnh 作为首个能力来源，但这只是产品内容选择，不是服务契约要求：

```ts
enhancement('base:enhancement:user-theme-editor')
  .name('主题编辑权限')
  .desc('解锁用户自定主题与表现编辑服务。')
  .tags(['core'])
  .attachGlobal()
  .affectorPack('base:affectorpack:user-theme-editor')
  .cost(PYROXENE, 0)
  .build()
```

对应 Affector Pack 只声明能力，不声明资源流、每 Tick 效果或一次性奖励：

```ts
{
  id: 'base:affectorpack:user-theme-editor',
  capabilities: [{ kind: 'service', id: 'user-theme.editor', mode: 'enable' }],
  entries: [{ id: 'enable', effects: [] }],
}
```

### 4.1 能力判定

新增只读查询接口，不让 UI 直接依赖 AffectorEngine 内部 Map：

```ts
interface ServiceCapabilityQueryPort {
  isActive(id: ServiceCapabilityId): boolean;
  source(id: ServiceCapabilityId): string | undefined;
}
```

判定必须同时满足：

1. 能力声明来自已注册且结构合法的 Affector Pack；
2. 该 Pack 至少有一个实例处于 `Active`；
3. 若能力来自某个实体挂载，挂载实体本身仍满足现有 Affector 对账条件；
4. 若 Affector 条件翻转为 `Latent` 或实例被移除，能力立即失效；
5. 前端传入 `enabled: true`、直接传入 Pack ID 或直接传入 Enhancement ID，都不能绕过能力判定。

服务只依赖能力 ID，不判断能力来源是 GlobalEnh、普通 Enhancement、Item、Spot 还是未来的其他挂载点。多个 Active Affector 同时提供同一能力时视为幂等，不重复执行服务效果；查询接口可返回全部来源用于诊断。

## 5. 编辑服务接口

新增领域服务，例如 `UserThemeService`：

```ts
interface UserThemeService {
  capability(): ServiceCapabilityStatus;
  get(): Readonly<UserThemeState>;
  beginEdit(): UserThemeEditSession | UserThemeEditError;
  apply(sessionId: string, draft: UserThemeDraft): UserThemeResult;
  discard(sessionId: string): boolean;
  setEnabled(enabled: boolean): UserThemeResult;
}
```

编辑会话是内存态，不进入存档：

```ts
interface UserThemeEditSession {
  id: string;
  baseRevision: number;
  draft: UserThemeDraft;
  readonly: boolean;
}
```

`apply` 必须重新读取当前能力和当前主题 revision，避免编辑器旧页面覆盖新主题。能力失效、版本冲突、校验失败时返回结构化错误，不部分写入。

## 6. 限制器

### 6.1 数据规模限制

首版建议固定上限：

| 项目 | 上限 |
| --- | ---: |
| 自定主题配置 | 1 份 |
| 区域图层 | 24 |
| 组件 | 32 |
| 组件树深度 | 4 |
| 每个 ID 长度 | 64 |
| 图片引用数量 | 32 |
| 字符串长度 | 256 |
| 数值范围 | -10000 ～ 10000 |

超过上限时拒绝保存，而不是截断后保存。

### 6.2 可编辑范围限制

- 只允许固定的八个 `PresentationRegion`；
- `parent` 只能是区域名或同一份主题中的组件 id；
- 只允许 `top-left`、`top-right`、`bottom-left`、`bottom-right`、`center`；
- 不允许页面级坐标、任意 `z-index`、DOM selector 或自由 `transform`；
- 图片只能引用 Registry 中已存在的 Pic；
- SVG 只能作为 `<img>` / CSS background image 资源，不解析 SVG 文本，不执行脚本；
- 图层 CSS 仅允许现有表现服务的枚举和白名单值；
- 用户主题不允许声明 `visibleWhen`，首版避免用户条件表达式影响页面结构；
- 动效只能引用已注册的命名预设，不能提交 CSS keyframes、脚本或回调；
- 用户主题不允许修改 Datapack、ColorGroup、Enhancement 或 Affector 定义。

### 6.3 颜色与资源限制

- 颜色只接受 hex、受控 `rgb/rgba/hsl/hsla` 或已存在的颜色 token 引用；
- 禁止 `url()`、`expression()`、`behavior`、`@import`、分号拼接和 HTML；
- 图片 URL 必须经过 PicService 解析，不接受编辑器直接提交外部 URL；
- `alt`、ID、诊断信息进入 HTML 属性前必须统一转义；
- 缺失图片、非法尺寸、循环父级和不可识别字段导致该项被拒绝或安全回退，不得导致整页空白。

## 7. 编辑器服务设计

编辑器增加“用户主题”入口，但入口状态由 `ServiceCapabilityQueryPort` 决定：

| 能力状态 | 编辑器表现 |
| --- | --- |
| 无 Active 能力来源 | 显示锁定说明和能力来源提示，不显示可写表单 |
| 已声明但 Affector 非 Active | 显示只读保存内容，提示能力暂时不可用 |
| Active | 开放颜色、图层、组件树和预览编辑 |
| 保存冲突 | 保留本地 draft，要求重新载入或合并 |

编辑器必须复用运行时 `PresentationView` 的资源解析、父级校验和转义逻辑。预览使用 DOM API 或已转义的安全渲染片段，不允许为预览新增一套宽松解析器。

### 7.1 编辑界面布局

用户主题编辑器建议采用“三栏 + 底部操作栏”结构：

```text
┌──────────────┬──────────────────────────────┬──────────────────┐
│ 主题导航      │ 安全预览画布                  │ 属性检查器        │
│              │                              │                  │
│ 颜色          │ 选择区域：中栏 / 顶栏 / 左栏…  │ 当前选中项        │
│ 区域图层      │                              │ 锚点              │
│ 组件树        │   [运行时同源 Presentation]    │ 偏移 / 尺寸        │
│ 动效偏好      │                              │ 图片 / 适配        │
│              │                              │ 校验提示          │
├──────────────┴──────────────────────────────┴──────────────────┤
│ 能力状态 / 未保存提示                         取消   保存并应用 │
└────────────────────────────────────────────────────────────────┘
```

实现上不新增一套独立的主题数据编辑格式：编辑器打开时由 `UserThemeService.beginEdit()` 得到 `UserThemeEditSession`，三栏控件都读写 session 内的 draft；预览则把 draft 交给运行时同源的 `PresentationService`，只消费 `PresentationView`。

### 7.2 左栏：导航与结构

左栏按语义分组，而不是按底层 JSON 路径展示：

- **颜色**：编辑固定的 `UserThemeToken`，显示颜色选择器、预设色板和文本值；
- **区域图层**：按 `PresentationRegion` 分组，支持拖拽排序、隐藏/显示和复制；
- **组件树**：显示区域 → 父组件 → 子组件的层级，支持新建、移动、复制和删除；
- **动效偏好**：选择系统跟随或 reduced-motion 策略。

组件树移动前先执行父级存在性、循环引用和深度检查；非法移动不改变 draft，并在操作位置显示原因。

### 7.3 中栏：安全预览画布

中栏提供区域切换和视口预设：

- 区域切换：shell、header、leftPanel、centerPanel、rightPanel、footer、story、modal；
- 视口预设：桌面、窄屏；
- 可选显示锚点、父级边界、组件 ID 和层级顺序辅助线；
- 拖动组件时只产生允许的 `anchor + offset + size` 变化，不生成页面级绝对坐标；
- 图片缺失时显示占位框和资源引用错误，不让整个预览白屏；
- `prefers-reduced-motion` 预览强制关闭动态效果，确保编辑器也能检查无动效回退。

预览不得把数据包字段直接拼成 HTML。推荐让预览调用运行时表现服务生成安全 View，再用 DOM API 创建节点；如果沿用字符串渲染，则只允许使用已经完成属性转义的渲染结果。

### 7.4 右栏：属性检查器

右栏根据当前选中对象显示有限字段：

| 选中对象 | 可编辑字段 |
| --- | --- |
| 颜色 Token | 预设色、合法颜色值、恢复默认 |
| 区域图层 | 类型、Pic 引用、透明度、位置、尺寸、重复、混合模式、附着方式 |
| 组件 | 父级、图片引用、左上/右上/左下/右下/中心锚点、相对偏移、尺寸、适配方式 |
| 动效 | 预设名称、进入/退出/悬停、快/普通/慢、reduced-motion 策略 |

组件的锚点使用五宫格按钮或明确的五个中文按钮，不要求用户手写 `anchor`。偏移编辑器按当前单位显示百分比或像素，并在旁边显示父区域边界；默认单位为百分比。

所有控件使用枚举、颜色选择器、资源下拉和数字输入，不提供任意 CSS 文本框、HTML 编辑框、选择器输入框或脚本输入框。

### 7.5 保存与失败反馈

底部操作栏持续显示：

- 当前能力状态和授权来源；
- 未保存变更数量；
- 校验错误数量与最高级错误；
- “取消”恢复进入编辑时的 draft；
- “保存并应用”执行完整限制器、能力复查和 revision 检查。

保存失败时：

1. 保留本地 draft，不丢失用户编辑；
2. 在左栏定位到错误对象；
3. 在属性字段旁显示可读错误；
4. `applied` 和当前运行主题保持不变；
5. 若是 revision 冲突，提供“重新载入”“保留本地 draft”两种选择，不静默覆盖。

能力在编辑过程中失效时，编辑器立即停止写入并切换为只读：预览可以继续查看本地 draft，但“保存并应用”按钮禁用。能力恢复后，只有再次通过服务校验才允许保存。

### 7.6 与现有 Datapack Editor 的关系

该界面应作为 Datapack Editor 的“用户设置 / 用户主题”服务面板接入，而不是把 `userTheme` 加入 `areas`、`spots` 或 `enhancements` 表：

- Datapack Editor 继续编辑开发者提供的 Datapack；
- 用户主题面板编辑 PlayerState 的 Global 用户设置；
- 两者共享 Schema、Pic Registry、表现校验和预览组件；
- 用户主题面板不能修改原始 Datapack 文件，也不能把用户数据导出为可执行内容。

如果当前编辑器暂时只支持 Datapack 表编辑，则先抽取可复用的表单、资源选择器、预览画布和校验面板，再新增独立的 `UserThemeEditor` 入口，避免把两种数据生命周期混在同一保存按钮中。

推荐编辑流程：

1. `beginEdit()` 创建 session；
2. 编辑器只改 session draft；
3. 每次输入执行轻量限制器并展示结构化错误；
4. 预览通过同源 PresentationService 渲染；
5. 点击保存时执行完整校验、能力复查和 revision 检查；
6. 通过 `StateMutationService.setUserTheme()` 原子替换 `applied`；
7. 发出 `userThemeChanged`，UI 重新获取只读视图。

## 8. 主题合并优先级

建议用户自定主题作为独立的最高级“用户层”，但不覆盖安全和系统强制样式：

```text
系统安全样式 / 可访问性回退
        ↑
用户自定主题（仅允许字段）
        ↑
其他 Affector 来源 / Area / Student 表现主题
        ↑
ColorGroup 基础主题
```

用户主题只覆盖已声明的 token、区域图层和组件；当 `enabled === false`、能力失效或数据校验失败时，立即回退到现有主题链路。

## 9. 事件与状态写入

建议新增事件：

```ts
userThemeChanged: {
  purpose: '用户主题保存或启停',
  emit: ['StateMutationService'],
  subscribe: ['ColorSystem', 'UIController'],
}
```

禁止编辑器直接触发 `themeChanged` 代替用户主题事件，也禁止把 draft 写进 `InitSnapshot`。能力状态变化由 `affectorStateChanged` 驱动 UI 重新计算编辑权限。

## 10. Schema 与校验同步

实施时需要同步：

- `src/engine/types/`：能力授权枚举、Affector service grant、用户主题受限结构；
- `src/data-services/contracts/`：Affector Pack 与用户主题契约；
- `src/arona-clicker/types/state.ts`：全局 `userTheme`；
- `tools/datapack-editor/schema/editor-extras.ts`：颜色、区域图层、组件树和动效预设编辑器；
- `tools/datapack-editor/validate/`：规模、引用、父级、循环、URL 和 CSS 白名单校验；
- `npm run gen:schema`：重新生成 Schema；
- `EVENT_CATALOG`：登记 `userThemeChanged`。

用户主题本身是 PlayerState 数据，不能混入 Datapack 表；编辑器应提供专门的服务面板，而不是把它伪装成 `areas` 或 `spots` 的普通字段。

## 11. 测试计划

### 能力与权限

- 无 Active 能力来源：编辑器不可写，`apply` 拒绝；
- 任意来源的 Affector `Active`：可以创建会话、保存和启停；
- 全部能力来源失效：服务不可用，已保存主题保留但不再应用；
- 伪造前端 `enabled`、直接传 enhancement id 或无 Active 挂载：均拒绝；
- 多个 Pack 声明同一 service capability：允许并视为多个来源，不重复授权或执行。

### 数据限制

- 超过图层、组件、深度、字符串和引用上限；
- 循环父级、未知父级、非法区域、非法锚点；
- 非 Registry 图片、`javascript:` URL、危险 CSS、HTML、SVG script 文本；
- 非法 token、自由 z-index、selector、transform 和 motion CSS；
- 保存失败时原 applied 主题保持不变。

### UI 与回退

- 编辑器预览与正式 UI 的图片解析结果一致；
- 桌面、窄屏和 reduced-motion 下稳定回退；
- 能力失效后 UI 恢复默认表现；
- `userThemeChanged` 后只读 View 更新，不出现直接写状态路径。

## 12. 分阶段施工

### U1：能力授权基础

- 增加 `ServiceCapabilityGrant` 和只读查询端口；
- 将 Affector Active 状态投影为服务能力；
- 增加能力 ID 合法性校验、来源聚合和事件测试。

### U2：用户主题全局状态

- 增加 `UserThemeState` / `UserThemeDraft`；
- 通过 `StateMutationService` 实现原子保存、启停和 revision；
- 加入 Global 层状态读写测试。

### U3：限制器与服务门面

- 实现 `UserThemeService`；
- 实现结构、资源、颜色、CSS、数量和父级树校验；
- 能力失效、并发编辑和安全失败回退。

### U4：编辑器与运行时接入

- 用户主题专用编辑器入口；
- 组件树编辑、排序、区域预览；
- 将合法 UserThemeDraft 转为只读 `PresentationView`；
- 接入 ColorSystem/UIController，保持旧主题链路回退。

### U5：默认内容与验收

- 可选增加 `base:enhancement:user-theme-editor` 及专用 Affector Pack，作为默认首个能力提供者；
- 更新默认数据、Schema、事件目录和文档索引；
- 运行 `npm test`、`npx tsc --noEmit`、`npm run check:architecture`；
- 完成桌面、窄屏、reduced-motion 和安全注入回归测试。

## 13. 验收标准

- 只要至少一个声明能力的 Affector 处于 Active，就能编辑和应用用户主题；
- 能力失效不会删除用户已保存的主题；
- 用户主题只存在 Global 层，不污染 Init 快照和 Datapack；
- 保存通过单一状态写入口，支持 revision 冲突保护；
- 编辑器与正式 UI 使用同源表现解析和安全校验；
- 不接受 HTML、脚本、任意 CSS、任意选择器、任意坐标和任意动画代码；
- 非法数据不会进入 PlayerState，也不会造成 UI 空白；
- Schema、Registry、事件、测试和文档同步完成。
