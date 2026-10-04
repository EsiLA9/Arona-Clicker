# Task：玩法 B 三栏界面与结算可读性验收

状态：complete — 0192-U1/U2/U3 均完成；Gameplay B UI 与路线游玩流程验收通过

## 范围更新（2026-10-03）

用户将剩余 UI 验收聚焦为游玩效果：确认冻结行动、结算结果、唯一 Click、路线推进与日志阅读是否清楚。U2、U3 各自在一个实际原型窗口完成游玩检查（U2 为 `1280×720`；U3 完整路线实测为 `1331×811`）；记录尺寸只为复核场景，不作多分辨率/响应式兼容判断。U1 已完成的两视口结果保留为历史收据，不扩展其验证范围。

## 目标

让玩家在桌面三栏中读懂 4/5/6 名我方学生、Click 前预览与 Click 后结算，并在滚动、追加日志、连续输入和终态时保持操作连续性。

## 设计边界

- 本 Task 分为 0192-U1 稳定三栏与角色卡、0192-U2 只读预览与日志连续性、0192-U3 唯一 Click/终态与浏览器验收，依序执行。
- 直接前置 `task-0191-gameplay-b-complete-park-demo.md` 已完成并归档；U1–U7 Receipt、固定路线、完整入口与 26 Click 浏览器走局已交接。U1 开工已满足前置门槛；U2/U3 仍按依赖顺序等待前序 Unit 完成。
- 设计只消费实际 Runtime/内容/事件视图。UI 不选择牌、不计算伤害/概率、不改状态、不补写玩法规则。玩家只有固定的 Click 推进操作，无编队、改牌或额外继续按钮。
- 玩法 B 保持在 `prototypes/gameplay-b/` 独立运行；不引入 AC 组件、服务、样式、资源、状态或其他运行时依赖。
- 施工应用通用 `frontend-design` skill，并以 `docs/ai/frontend-design-project-overlay.md` 的 DOM budget、behavior/region/structure 刷新等级、稳定节点及 scroll/focus/hover 连续性为硬约束。视觉签名须源自游乐园巡查题材，装饰优先使用已有节点、CSS token 或 pseudo-element，不靠增加纯装饰 DOM。
- 每项游玩场景、人数和 seed 的浏览器验收都必须在相应 Unit Receipt 提供真实证据后才可勾选；U2/U3 固定使用一个 1280×720 原型窗口，不据此作其他尺寸兼容判断。
- 非目标：移动端版型、复杂动画、AC 集成、AC 主题/组件复用、编队与手动行动选择、自动播放、额外推进操作、业务状态变更和超出 UI 边界的 Runtime 修复。

## 依赖与开工门槛

直接前置：`task-0191-gameplay-b-complete-park-demo.md` 的验收和实际交接，已于 2026-10-03 完成并归档。U1 现在可施工；每个后续 Unit 仍需按 Read Set 复核对应 Receipt 与源码事实。

0192 各 Unit 开始前都要读 0191 最终 Receipt 并按其交付清单核实当前页面、角色名单、路线/战斗场景、事件和只读视图的真实路径及签名。现存路径或计划中的白名单不构成 0191 已交付证明。路径、节点归属或调用签名不符时，先修订对应 Unit 的 Read Set/Allowed Files 和验证方式；缺少的玩法数据/Runtime 行为退回 0191，不在 UI 绕过。

## 当前已核实事实

| 已核实事实 | 依据 | 对本 Task 的影响 |
| --- | --- | --- |
| 0191 Task 已 complete 并归档；U1–U7 Receipts 已记录运行、路线、内容、只读 View、回归与浏览器结果 | `docs/plan-work/archive/task-0191-gameplay-b-complete-park-demo.md` 与 `docs/plan-work/archive/task-0191-gameplay-b-complete-park-demo-units/receipts/` | 固定 seed `park-inspection-demo` 完整通过 12 节点与 26 Click；0192 只消费已交接数据和 View，不改 Runtime |
| 正式原型入口使用独立 package，HTML 载入 `prototypes/gameplay-b/src/main.ts`；唯一 Click 由入口监听器推进 `GameplayBRouteRuntime` | `prototypes/gameplay-b/index.html`、`prototypes/gameplay-b/src/main.ts`、U6 Receipt | 以实际 view API 和场景为事实源，不能从旧 0187 页面快照推断 |
| `mountRouteGameView` 以角色 ID 缓存卡片节点，`syncParty` 只插入新卡或移除离队卡；三栏为两个 side panel 与中栏 Click/预览/日志 | `prototypes/gameplay-b/src/view.ts`、`prototypes/gameplay-b/src/style.css` | 初步代码显示已有稳定更新路径；U1 重点核验密度、顺序、可见性与视口，不预设需要新增列表模块 |
| 0192 尚无专属视口矩阵、场景截图和 Console/Network Receipt | 本文各 Unit Receipt 区 | 不把 0191 入口 smoke 当成 0192 的视觉/连续性通过证据 |
| 本机 Edge 可通过 headless `--screenshot` 将 1280×720 原型页面保存为 PNG；探针文件已生成并目视检查 | 2026-10-03 在 `http://127.0.0.1:5173/` 使用隔离临时用户目录的实际运行结果 | 仅证明 PNG 可落盘，不证明任何 0191 场景或验收项通过；具体场景证据仍须现场采集 |

## 截图证据约定

- 可保存的验收 PNG 放到 `prototypes/gameplay-b/evidence/task-0192/`，Receipt 写仓库相对路径、精确 viewport、场景/节点、seed、浏览器版本与观察结果。若当前浏览器操作接口只提供 inline screenshot，Receipt 必须记录真实截图所在的当前 Task 线程消息、scene/viewport/seed，并明确未生成本地 PNG；不得填造路径。可落盘图片使用 `u1-<viewport>-roster-<4|5|6>.png`、`u2-<viewport>-<reading-old-log|following-bottom>.png`、`u3-<viewport>-<victory|defeat|draw|exit|demo-complete>.png` 命名；`<viewport>` 取实际截图尺寸。
- 该目录只放本 Task 实际验收截图，不放脚本、临时浏览器 profile 或产品资源；截图是验证产物，不计入代码补丁的 3–5 源文件预算。截图不得伪造/合成来代表未实际操作的场景。
- 本机 Edge headless PNG 导出能力已验证。采集具体场景前仍须确认启动页面与 0191 的当前 seed/fixture 相同，并真实推进/滚动到对应场景；启动页探针不得充当场景证据。若可用浏览器操作只返回 inline screenshot、无法提供本地文件路径，Receipt 必须保留真实 inline 截图并明确标注未落盘，不得填造 PNG 路径。

## Must Read / Read Set

- 路由与施工协议：`docs/docs-829/00-INDEX.md`、`docs/ai/PROJECT-CONSTITUTION.md`、`docs/ai/templates/patch-unit.md`、`docs/ai/templates/execution-receipt.md`。
- UI 设计：`draft-0183-gameplay-b-ui.md` 的三栏、角色密度、日志和 Click 规范；`docs/ai/frontend-design-project-overlay.md` 全文；`frontend-design` skill。方案需先声明 DOM budget、刷新等级与 interaction preservation，再开始代码施工。
- 规则：`task-0186-gameplay-b-prototype-rule-baseline.md` 的 UI 会展示的胜负/平局、前后排、角色加入与已采纳/暂定规则；UI 只忠实展示，不重新裁定。
- 实际前置：`task-0191-gameplay-b-complete-park-demo.md` 最终状态/Receipt 和 Receipt 列出的真实入口、投影、内容、日志及直接测试。各 Unit 只读取自己需要的实际交付部分。
- 本 Task 的 Unit 目标文件与其直接调用方/测试；全部源码路径须带 `prototypes/gameplay-b/` 前缀，函数/DOM 节点签名以开工时读到的实际文件为准。

## Patch Unit 0192-U1（P0）：稳定三栏布局与 4/5/6 人卡片

### Goal

在前置实际交付的三栏页面上完善前后排角色卡密度和桌面适配；角色状态更新、场景变化和 4→5→6 人加入时维持未变角色卡的稳定节点身份。

### Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 设计 brief | `draft-0183-gameplay-b-ui.md` 的主布局、左右栏、4/5/6 人密度 | 确认两种桌面视口、卡片字段和分排语义 |
| 项目 overlay | `docs/ai/frontend-design-project-overlay.md` 第 1–6 节 | 落实 DOM budget、刷新等级、稳定节点与连续性 |
| 交接 | 0191 Receipt 中实际 `view` / 角色列表 / 场景加入接口及浏览器截图 | 确认页面节点所有者、角色 ID/顺序与真实 roster 变化时点 |
| 当前代码 | `prototypes/gameplay-b/src/view.ts`、`prototypes/gameplay-b/src/style.css`、0191 实际交付的对应测试 | 了解既有 DOM 结构、token、选择器及测试能力，不假设现有节点可重建 |
| 当前节点 owner | `mountRouteGameView`、`syncParty`、`createRoutePartyCard` in `prototypes/gameplay-b/src/view.ts` | 角色稳定性已由 `partyCards` Map 缓存实现；不另建角色列表子模块 |

### Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–30k token，含 0191 对应交接、目标 UI 文件与直接测试 |
| 文档 Read Set | 默认 3–8 篇；只读本 Unit 指定章节 |
| 历史文档 | 0 篇；不读无关旧 UI 方案 |
| 净改动 | 最多 4 个允许文件；目标 120–240 行，500 行为硬上限。现成 roster Map/卡片 owner 保留，只改密度/主题/现有状态文字，不新建 UI 子模块；低于目标先核对矩阵和 Receipt 覆盖，不为凑行数扩大代码 |
| 超预算处理 | 不扩大到 AC UI 或全树；按停止条件修订/拆分 |

### Optional Read Set

- 如果角色节点实际由一个直接调用方创建而本 Read Set 无法定位，先停止并申请读取那一个调用方。

### Do Not Read by Default

- AC 仓库的游戏内界面、AC 组件/服务/样式、无关页面模块、仓库级设计系统；不把 AC 外观当成待复用资源。

### Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| Draft 0183 要求桌面三栏、两种视口，并展示四、五、六人 | `draft-0183-gameplay-b-ui.md` | 设计要求，不是已验收实现 |
| 当前原型 CSS 有 `.desk-layout`、`.side-panel`、`.event-scroll` 和角色卡规则 | `prototypes/gameplay-b/src/style.css` | 是当前代码现状，不代表足以容纳最终路线内容 |
| 0191 最终 Receipt 表明角色卡按 Chara ID 缓存、节点 6/10 将队伍从 4→5→6 | 0191-U6/U7 Receipt、`prototypes/gameplay-b/src/view.ts` 的 `partyCards` / `syncParty`、Park Route | U1 直接核验真实 4/5/6 场景和既有节点 identity |

### UI / DOM Budget

| 项 | 预算与约束 |
| --- | --- |
| 新增 wrapper / 节点 | 最多新增一个有列表语义的 roster root；每名学生一个卡片根；前后排仅用必要的语义标题，不加装饰 wrapper |
| 稳定复用节点 | 三栏 root、左右侧栏、Click 区、每个既有 Chara ID 的卡片；装饰优先 CSS/pseudo-element |
| behavior | HP/sCost/状态文字、class、属性与 CSS variable 的更新 |
| region | 仅真实 roster 集合变化时更新角色列表区域，保留未变成员卡片节点身份 |
| structure / full render | 仅首次挂载或页面 owner 改变；加人、换场、Click 和普通数值变化不得重建 `#app` |
| scroll / focus / hover / click | 侧栏滚动独立；状态更新不移动焦点或破坏 hover 锚点；唯一 Click 节点保持 identity |

### Constraints

- 施工前在 Receipt/设计说明中给出简短的视觉计划：面向玩法 B 玩家，页面任务是“Click 前看懂将发生什么、Click 后看懂发生了什么”；以游乐园巡查记录台为主题，包含 4–6 个以名称+HEX 值列出的色彩 token、标题/正文/数据三种字体职责、三栏 wireframe、一个可辨识但非装饰 DOM 的视觉签名；结合 0191 实际代码审视通用 skill 建议并写明采纳/调整理由。
- 明确 DOM budget：复用现有三栏与角色卡节点；新增容器最多为一个有真实列表语义的 roster region；每名学生至多一个稳定卡片根；仅为前/后排分组保留必要语义标题，不加纯装饰 wrapper。发现实际 0191 结构不同需先修订预算。
- 声明刷新等级：HP/sCost/状态文字与 class 更新为 behavior；只有 roster 成员集合变化才局部更新 character-list region；普通数值 Tick、scroll、hover、focus 和 click 不重建 `#app`/全页结构。
- 以 Chara ID 稳定标识卡片。4/5/6 人更新或状态改变时，原有成员对应 DOM 节点保持 identity、顺序、焦点和 hover 锚点；只为真实新增成员插入节点，不通过整组重建恢复滚动。
- 1280×720 与 1440×900 均保持三栏和唯一 Click 控件可见。六人、失能/倒地/新增状态有文字或形状表达，不能只靠颜色；尊重 reduced-motion 与可见键盘焦点。
- 所有样式限于独立原型 `prototypes/gameplay-b/src/style.css`；不复制 AC token、组件或 CSS。

### U1 Visual Plan (pre-implementation)

- **受众与任务：**玩法 B 玩家在每次 Click 前扫一眼六人队形、HP 与 sCost，不遮住中间的场所/预览/唯一 Click。
- **视觉方向：**游乐设施维护/巡查用的搪瓷告示牌与检修记录簿。现有暖纸底色、衬线标题、陶土色组合正是通用 frontend-design skill 列出的常见默认方案；本轮改用冷色搪瓷、夜场栏杆墨色与高可见检修信号，避免把页面做成通用咖啡馆式纸面仪表板。
- **Token palette：**轨道墨蓝 `#142F3A`、雾面 `#E4ECE9`、搪瓷霜白 `#F7FAF7`、巡查青 `#36747A`、检修黄绿 `#D7E84F`、警示珊瑚 `#EF7457`。黄绿只标记当前节点/预告，珊瑚表达警告或倒地；关键状态同时显示文字与数值。
- **字体角色：**标题用本机可用的重字重无衬线告示字（`Arial Black` 后接中文系统 UI 回退）；正文用 `Yu Gothic UI` / `Segoe UI`；HP、sCost、序号使用 `Cascadia Mono` / `Consolas`。不引入远程字体/资源。
- **三栏 wireframe：**`[我方编组：前排卡列 / 后排卡列] | [节点牌 → 当前行为与预览 → 事件簿 → 单一 Click] | [敌方前排 / 后排]`。现有卡片与顺序不变，只缩短每张卡的纵向留白，让 4 名前排加 2 名后排在两种视口中同时读到。
- **视觉签名：**复用现有节点序号章 `.sample-seal`，以检票冲孔边缘和一条检修色切口呈现当前路线编号；只用现有 span 的伪元素/边框，不加装饰 DOM。
- **DOM budget：**新 wrapper/节点 0；复用三栏、两个 roster group、每个 Chara ID 的卡片根、稳定 Click 与 event list；HP/角色状态仅 behavior 更新；成员集合变化只插入新增卡片；除初次挂载外不允许重建 `#app`。
- **Interaction preservation：**party/enemy 侧栏独立滚动；四名既有角色卡在加入千世/玲奈时保持 node identity、顺序与 hover；普通 Click、焦点移动、滚动不改 Runtime、不触发 full render；focus-visible 保留高对比轮廓并尊重 reduced-motion。

### Allowed Files

- `prototypes/gameplay-b/src/view.ts`
- `prototypes/gameplay-b/src/style.css`
- `prototypes/gameplay-b/tests/park-demo.test.ts`（仅当需要为 roster projection 增加不引入 DOM 依赖的回归）
- `docs/plan-work/task-0192-gameplay-b-three-column-ui-acceptance.md`（在开工前更新实际交接/Allowed Files/视觉计划；追加本 Unit Receipt）

### Explicit Non-goals

- 不改变编队、角色顺序、前后排归属、场所加入时机或 Runtime 只读接口；不处理战斗规则。
- 不重建整页来实现视觉效果，不新增 AC UI 依赖、纯装饰 wrapper 或额外操作。

### Stop Conditions

遵守 `docs/ai/PROJECT-CONSTITUTION.md` 六项停止条件。若 U7 Receipt/当前源码未交付真实 roster/加入场景；实际节点身份不能由当前模型标识；新增测试/依赖需要白名单外文件；需读 AC UI 或需改 Runtime/模型；两种视口无法同时保留唯一 Click/三栏；或必需验证失败/无法执行/无法解释，停止并记录差异，先修订 Unit 或退回 0191。

### Completion Criteria

- [x] 有 0191 实际交接核对记录和视觉计划，包含目标受众/页面任务、调色/token、字体角色、三栏线框、签名与 skill 自我审阅。
- [x] 两种视口均实测：1280×720、1440×900；每个视口覆盖有证据的 4、5、6 人场景，六人全部可读、无需隐藏名单。
- [x] 原有 Chara 卡 DOM 节点按 ID 保持 identity；普通状态更新和 click 不触发全页重建；成员加入只更新相应 roster region。
- [x] 侧栏滚动独立；现有角色卡不因 4→5→6 人变化而重排或丢失焦点/hover。
- [x] 每个勾选的视口/场景都在 Receipt 中有可复核的真实截图（本地 PNG 路径或 inline screenshot 所在 Task 消息）、精确 viewport、场景标识/seed 和结果。

### Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 前置核实 | 检查 0191 最终 Receipt 与其实际 view/roster 文件 | 接口、节点 owner、4/5/6 场景和 seed 有来源 |
| 浏览器矩阵 | 用前置交接的真实场景，分别在 1280×720、1440×900 浏览器检查 4/5/6 人 | 三栏和 Click 可达，卡片身份/滚动稳定；每种实测组合写入 Receipt |
| 节点身份 | 在浏览器或已有 UI 测试中，保存原角色卡节点引用后更新状态/加入新人并比较节点引用 | 未变 roster 成员仍为同一个 DOM 节点；无全页替换 |
| 类型/构建 | 在 `prototypes/gameplay-b/` 按实际脚本执行 typecheck/build | 通过；脚本和 bundle root 以 0187–0191 实际交接为准 |
| 边界检查 | 审查本 Unit 差异 | 没有 AC import、样式、资源或白名单外变更 |

### Execution Receipt 0192-U1

状态：complete。

实际修改：

- `prototypes/gameplay-b/src/style.css` 将牌面改为检修台冷色搪瓷 palette；把角色卡垂直占用从约 108px 压至约 80px，六名 Chara 无需侧栏滚动即可同时查看。现有序号章改为检票式冲孔轮廓，复用伪元素，没有新增 wrapper。
- `prototypes/gameplay-b/src/view.ts` 为千世/玲奈显示具体支援角色名；HP=0 时复用既有 role 行显示“倒地”，补充 `aria-valuetext` 与卡片状态 class；角色卡节点仍按 ID 缓存/更新。
- 本 Task 记录视觉/DOM 计划、U1 收据和 120–240 行紧凑预算。实际仅修改 view、CSS 与本 Task 文档；未修改 Runtime、测试依赖或 AC。

视觉计划回顾：为玩法 B 玩家制作一张能在每次 Click 前快速确认 4/5/6 人队伍、HP/sCost 与前后排的巡查台。使用轨道墨蓝 `#142F3A`、雾面 `#E4ECE9`、搪瓷霜白 `#F7FAF7`、巡查青 `#36747A`、检修黄绿 `#D7E84F`、警示珊瑚 `#EF7457`；标题用本机粗体无衬线，正文用系统 UI 字体，数值用等宽字体。三栏为“我方分排卡列 | 节点、行为预览、事件簿、唯一 Click | 敌方分排卡列”。序号章是唯一签名装置，通过既有节点边框和伪元素呈现。技能提出的暖纸/衬线/陶土常见方案与现有旧版过近，已采用冷色搪瓷与检修信号色；未增加装饰 DOM 或远程字体。

实际验收矩阵：

| 视口 | 队伍/节点 | 操作与结果 | 证据 |
| --- | --- | --- | --- |
| 1280×720 | 4 人 / node-1 | 固定 seed `park-inspection-demo` 初始场景；四张角色卡可读，三栏与 Click 可见 | 当前 Task 线程中的 1280×720 inline screenshot |
| 1280×720 | 5 人 / node-6 | 9 次已显示 Click 进入急救补给站；千世在本节点活动前加入，队伍为前排3/后排2 | 当前 Task 线程中的 node-6 inline screenshot |
| 1280×720 | 6 人 / node-10 | 18 次已显示 Click 进入后台休息室；玲奈入队后前排4/后排2，六张卡全显 | 当前 Task 线程中的 node-10 inline screenshot |
| 1440×900 | 4 人 / node-1 | 正式入口初始队伍；三栏与 Click 可见 | 当前 Task 线程中的 1440×900 inline screenshot |
| 1440×900 | 5 人 / node-6 | 相同固定 seed，真实进入千世加入节点；五张卡全显 | 当前 Task 线程中的 node-6 inline screenshot |
| 1440×900 | 6 人 / node-10 | 相同固定 seed，真实进入玲奈加入节点；六张卡全显 | 当前 Task 线程中的 node-10 inline screenshot |

节点/交互观察：从 node-1 到 node-6 的 9 次 Click 前后，AX 中小栞、由理、芽衣、纺希对应节点 id 均保持 `12/19/29/36`，千世追加为新卡；队伍计数显示 5，焦点仍在同一个“Click · 急救补给站”按钮。按 Tab 后焦点环先到预览滚动区，再到唯一 Click，截图显示黄绿 focus-visible 轮廓。悬停小栞卡时其边框计算色由默认边线变为 `rgb(54, 116, 122)`，节点仍为同一卡片。六人时 1280 的 party panel 为 683/683px、1440 为 863/863px，均无侧栏/页面溢出；4 个前排与 2 个后排顺序稳定。

检查结果：`npm test -- park-demo.test.ts content.test.ts` 通过（2 files / 19 tests）；`npm run typecheck`、`npm run build`、项目根 `npm run check:docs` 通过（561 Markdown，0 errors）；U1 源文件与 Task 文档尾随空白为 0。浏览器 Console errors 读取结果为 `[]`；本次重载 Network 只请求 `127.0.0.1:5173` 的入口、Vite client、本地 package/client runtime 与 `prototypes/gameplay-b/src/` 模块，没有 AC、CDN 或外部资源。浏览器控制接口返回 inline screenshot，未生成本地 PNG；已按本 Task 证据规则记录六张实测画面，不填写虚构文件路径。

未完成项：U1 无。U2/U3 继续按 Task 顺序执行。C2 实际变更范围为 3 个白名单文件；原型目录整体未被 Git 跟踪，行数按实际 CSS/View/Task 改动块估算，控制在 U1 的 120–240 行预算内，不据整份新目录膨胀行数。

## Patch Unit 0192-U2（P1）：Click 预览与追加日志连续性

### Goal

展示前置只读视图中的本次 Click 预览和已结算/新增日志，使玩家能解释行动与数值变化；新增事件不夺走用户正在阅读的旧日志位置。

### Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 设计 brief | `draft-0183-gameplay-b-ui.md` 的中栏预览、战斗日志和场所转场小节 | 核对预览/已结算内容职责与唯一 Click 文案 |
| 项目 overlay | `docs/ai/frontend-design-project-overlay.md` 第 1–6 节 | 核对局部刷新、region、scroll/focus/hover 与锚点处理 |
| 规则基线 | `task-0186-gameplay-b-prototype-rule-baseline.md` 中 UI 涉及的行动/效果/终态语义 | 确保显示配置来源，不在视图中重算 |
| 前置交接 | 0191 Receipt 实际交付的 preview/event/view model 与回归测试 | 核实实时意图、Click 结算记录和场所转换的数据接口 |
| 当前代码 | `prototypes/gameplay-b/src/view.ts` 的 `renderPreview`、`appendParkText`、`appendRouteEvent` 与事件滚动节点；`prototypes/gameplay-b/src/style.css` | 当前没有 preview/event-log 子模块；沿用现有 View owner，只有实际证据需要时才另立拆分 Unit |

### Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–30k token，含视图/日志/预览和直接测试 |
| 文档 Read Set | 默认 3–8 篇；只读本 Unit 指定内容 |
| 历史文档 | 0 篇；不复制 AC 日志系统的实现 |
| 超预算处理 | 不扩读全项目；按停止条件上报或拆分 |

### Optional Read Set

- 如预览和 event 之间的数据 owner 不能从交接/目标文件确认，停下后申请读取一个直接投影调用方。

### Do Not Read by Default

- AC Story/chat/UI 模块、内容规则实现或 Runtime 的无关分支；不引入新的 DOM 测试框架。

### Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| 0183 设计要求中栏预览、统一时间顺序事件日志与固定 Click 区 | `draft-0183-gameplay-b-ui.md` | 设计候选；细节以实际 0191 交接和 0186 基线为准 |
| 当前 prototype 有一个 `.event-scroll` 日志滚动容器和 append-style event list 样式 | `prototypes/gameplay-b/src/style.css` | 只确认选择器存在，不代表最终 0191 log 组件/自动滚动行为 |
| 0191-U6/U7 已交付冻结战斗预览投影、Route Event 顺序和追加日志行为 | 0191-U6/U7 Receipt、`view.ts` 的 `renderPreview` / event append 区 | U2 只消费已准备/已结算数据；复核旧日志阅读与底部跟随连续性 |

### UI / DOM Budget

| 项 | 预算与约束 |
| --- | --- |
| 新增 wrapper / 节点 | 不新增 preview/log 外层 wrapper；每个真实事件最多一个 log item |
| 稳定复用节点 | 中栏、Click 区、preview root、event scroll/list root 和全部既有历史事件节点 |
| behavior | 原地更新预览文本、进度与状态属性，不改变日志阅读位置 |
| region | 新事件只 append 到 event-log region；历史记录不重建 |
| structure / full render | 仅首次挂载或页面 owner 真正改变；普通 Click/追加日志不得 full render |
| scroll / focus / hover / click | 只有原在底部才跟随；阅读旧日志时保留锚点/相对位置；历史 tooltip、焦点和唯一 Click 节点保持连接 |

### Constraints

- 先记录 DOM budget：复用一个稳定的 preview 容器和一个稳定的 log scroll/list root；不为标签、日期、装饰拆新 wrapper；每条真实事件至多对应一个日志项。
- 声明刷新等级：预览文字/状态变化为 behavior；事件新增只 append 到 event-log region；普通 Click 不重建 `#app`、中央栏或历史 log item。
- 写清 scroll contract：若 append 前用户位于日志底部，则允许跟随新事件；若用户向上阅读旧日志，追加消息不得抢滚动，保留原锚点/相对位置。侧栏滚动、中央日志滚动和预览内容互不耦合。
- 历史日志节点保持 identity；append 不打断其 hover/popover 锚点。若更新局部 region，只关闭受影响区域的悬浮提示并校验剩余锚点仍连接；不通过父级重建复位 scroll/focus。
- 预览只读显示引擎已准备/已结算数据，明确当前状态，不推断概率、不计算伤害、不重新匹配、不操作状态。Click 仍是唯一推进输入。
- UI 更新后焦点位置可预测且可见；hover/scroll 不触发 Runtime mutation 或全量 render。

### Allowed Files

- `prototypes/gameplay-b/src/view.ts`
- `prototypes/gameplay-b/src/style.css`
- `prototypes/gameplay-b/tests/park-demo.test.ts`（仅当实际预览/日志投影回归需要）
- `docs/plan-work/task-0192-gameplay-b-three-column-ui-acceptance.md`（仅追加本 Unit Receipt）

### Explicit Non-goals

- 不改 Event/Preview 数据契约、Runtime 事件顺序、随机数、费用、牌选择、结算或场所路线。
- 不重写历史日志或在 UI 中模拟“下一回合”；不通过更改 scrollTop 掩盖重建问题。

### Stop Conditions

遵守 `docs/ai/PROJECT-CONSTITUTION.md` 六项停止条件。另：实际 U6/U7 Receipt 与当前 view 源码若不一致；视图需自行生成机制值/修改状态；日志局部刷新会破坏节点但需改白名单外调用方；需新增测试依赖；读取 AC UI/服务；或 scroll/focus/hover/锚点验证失败、无法执行，立即停止并修订本 Unit。

### Completion Criteria

- [x] Click 前预览对应 0191 实际只读状态；Click 后日志保留同一次冻结预览并呈现结算事件，不重算规则。
- [x] 新日志仅追加一个对应 RouteEvent 的节点，既有节点 identity 不变；阅读旧记录时 scrollTop 不跳到底部。
- [x] 用户原本贴近底部时可跟随最新消息；中央日志独立滚动，Click 后仍聚焦唯一推进按钮。
- [x] 普通 Click 更新不触发全页 render；预览更新和事件追加限于现有中栏 region，无新增 wrapper。
- [x] `1280×720` 固定 seed 的首战与长路线日志有真实 inline screenshot 和 scene/seed/scroll 结果。

### Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 前置数据合同 | 对照 0191 Receipt 与实际 preview/event 类型 | UI 只显示已交付字段，不补算 |
| 长日志场景 | 在交接 seed/场景运行至多条日志，滚到旧事件后 Click 追加，再测试底部状态 | 旧日志阅读位置保留；底部时可看见最新消息 |
| 节点/刷新观察 | 观察历史 log item identity、refresh diagnostics 或浏览器 DOM；按 overlay 允许用已有工具 | history stable，新增事件局部 append，不全量 render |
| scroll/focus/hover | 浏览器操作两侧和中栏滚动、聚焦 Click、停留已存在日志项，再触发普通状态更新 | 未受影响区域连续；受影响锚点安全关闭，无断开 tooltip |
| 包级检查 | 在 prototype 包执行已交接的定向 UI/Runtime 测试及 typecheck | 通过；不添加新测试框架或 package 依赖 |

### Execution Receipt 0192-U2

### Execution Receipt 0192-U2

状态：complete。

变更范围与数据边界：

- 只修改 `prototypes/gameplay-b/src/view.ts`、`prototypes/gameplay-b/src/style.css` 和本 Task Receipt；未修改 Runtime、Event/Preview 契约、规则、测试依赖或 AC 文件。
- 每个 `RouteEventRecord.sequence` 现在只生成一个 `.event-item`。场所文本作为同一项的 `.event-context` 附文；保留原始 event 节点和 Runtime 顺序，新增 `data-click` 便于对照输入轮次。
- 在推进按钮自身的 click handler 中读取当时已显示的冻结预览文本快照，将其原样附到同一 Click 的首条战斗事件；没有重抽牌、计算结果或更改状态。结算事件里的 `actorId:` 标签只用冻结快照中的姓名映射为显示名。
- 路线事件滚动容器获得可访问名称和键盘焦点入口，并用既有色彩 token 显示 `focus-visible`；没有新增 wrapper。预览仍使用现有独立滚动区。
- behavior：按钮、三栏、既有角色卡原位更新；region：预览内容更新、事件项 append；普通 Click 不替换 `#app`、`eventList` 或任何历史事件节点。底部距离阈值沿用现有 `<36px` 跟随约定。

浏览器验收使用固定 seed `park-inspection-demo`，单一原型窗口 `1280×720`：

| 状态 | 实际观察 | 证据 |
| --- | --- | --- |
| Node 5 / 首战 Click 前 | 路线已推进 5 Click，日志有 26 个 Runtime event item；当前冻结预览显示 12 项，包括敌我行动、目标、技能检定和配方。唯一按钮为“Click · 结算第 1 轮”。 | 本线程中 1280×720 Node 5 预览 inline screenshot |
| Node 5 / Click 6 结算第 1 轮 | 日志追加 6 个事件项；记录 27 同项显示配方结果与 Click 6 的原预览（敌意图、我方牌、全部技能检定、配方预览），记录 28–32 将五条 delta 显示为对应角色名与 HP/sCost 变化。预览和结果可逐项对照。 | 本线程中 Click 6 后 AX/DOM 实测结果 |
| Node 5 / 旧日志阅读 | `eventScroll.scrollTop=1759.33`、最大滚动量 `2615` 时执行 Click 7；追加后 `scrollTop` 仍为 `1759.33`，最大值扩至 `3444`，仍离底。Record 01 AX node ID 为 `93`，Click 10 后仍为 `93`；历史项未被重建。 | 本线程中旧日志阅读截图与 Click 前后实测输出 |
| Node 5 / 底部跟随 | 贴底时 Click 8 将 40 个事件项增至 46，滚动位置从 `3443.33/3444` 跟随至 `4138.67/4139`；Click 9 胜利转 Node 6 并加入千世后，56 项仍贴底 `5060/5060`。 | 本线程中 Click 8/9 AX/DOM 位置实测结果 |
| Node 7 / 长路线日志 | Click 10 结算急救补给并进入镜面迷宫；5 人（前排 3 / 后排 2），日志 64 项，滚动位于最新记录。单击后只进入一个后续活动，不连锁结算。 | 本线程中 1280×720 Node 7 长日志 inline screenshot |

Node 7 长日志时 `document.documentElement` 为 1280×720，无整页溢出；左右侧栏各自 `scrollHeight === clientHeight`、`scrollWidth === clientWidth`。日志容器单独滚动，焦点环实测可见，滚轮/键盘输入作用于日志区；Click 后焦点保持在同一推进按钮。U1 已覆盖 4/5/6 人卡片顺序；本 Unit 不再扩展分辨率矩阵。

检查：原型全量 `npm test` 通过（12 files / 107 tests）；`npm run typecheck`、`npm run build` 通过（Vite 8.3.2，22 modules）。浏览器 Console errors 为 `[]`。Network 重载观察到 21 项请求，全部是 `http://127.0.0.1:5173/` 入口、Vite client、本地 `node_modules/vite/` 或 `prototypes/gameplay-b/src/` 模块，无 AC、CDN 或外部 origin。本地 PNG 未生成；实际 inline screenshot 已留在本线程列出的状态消息，没有填写虚构路径。

未完成项：U2 无。U3 当前接续，按范围更新在单一 1280×720 窗口完成正式路线可达终态与唯一 Click 实测。

## Patch Unit 0192-U3（P2）：唯一 Click、终态与浏览器验收

### Goal

让唯一 Click 按钮在整局各阶段准确提交一次已准备行为，在战斗/出口终态明确停用；用一个代表性原型窗口核验游玩流程、终态、控制台与网络资源。

### Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 交互 brief | `draft-0183-gameplay-b-ui.md` 的固定 Click、预览、转场/终态 | 确认唯一推进输入和既有文案/时序 |
| 前置交接 | 0191 最终 Receipt 中 main/view/Runtime/终态/场景/seed 及通关/失败/平局测试 | 找出真实状态字段、场景顺序和可复现终态，不猜 API |
| 项目 overlay | `docs/ai/frontend-design-project-overlay.md` 第 1–5 节 | 验证普通点击局部刷新、DOM identity、焦点和重入连续性 |
| 目标代码 | `prototypes/gameplay-b/src/main.ts`、`prototypes/gameplay-b/src/view.ts`、`prototypes/gameplay-b/src/style.css`、`prototypes/gameplay-b/tests/runtime.test.ts` | 核实真实 Click 绑定、按钮语义、终态状态和当前测试能力 |
| 直接回归 | 0191 Receipt 列出的整局测试和本 Unit 白名单内 `runtime.test.ts` | 覆盖唯一提交、终态幂等和已知路线结局 |

### Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–30k token，含最终场景/终态、直接 UI/Runtime 测试和浏览器证据 |
| 文档 Read Set | 默认 3–8 篇；前置只读 0191 最终交接所需部分 |
| 历史文档 | 0 篇；不扩读 AC 实现作为参照 |
| 超预算处理 | 停止并缩小终态覆盖或另立 Unit，不扩展白名单 |

### Optional Read Set

- 如果终态按钮状态由另一个 view subscriber 控制，先停下，只申请读取其一个直接 owner 并更新白名单后再施工。

### Do Not Read by Default

- AC 页面、AC button/tooltip/CSS 组件、未来 0193 的校准实现、与按钮无关的原型模块。

### Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| 0191-U7 已交接胜利/失败/平局 Runtime 结果、终态幂等、默认 seed 和完整路线 | 0191-U7 Receipt、`GameplayBRouteRuntime.click()` | U3 使用现有正式路线实测可达的胜利/出口/完成状态；失败/平局复用已交接 Runtime fixture，不改变终态语义 |
| 正式入口只有一个 `advanceButton`，由 `currentView.terminal` 防止终态推进；View 设置 native disabled 与 `aria-disabled` | `prototypes/gameplay-b/src/main.ts`、`prototypes/gameplay-b/src/view.ts` 的 `update` | 验收切到 0191 正式路线页面，不引用 0187 页面快照 |
| CSS 已声明 `:focus-visible` 与 `prefers-reduced-motion` | `prototypes/gameplay-b/src/style.css` | 代码已存在；仍需在目标视口确认可见效果 |

### UI / DOM Budget

| 项 | 预算与约束 |
| --- | --- |
| 新增 wrapper / 节点 | 不新增按钮或装饰容器；复用一个语义推进 button 与现有结果/status region |
| 稳定复用节点 | 页面 root、三栏、角色卡、历史日志和同一个 Click button |
| behavior | button 文案、`disabled`/ARIA 状态、结果标识原地更新 |
| region | 只更新终态提示/当前行为说明需要变化的局部区域 |
| structure / full render | 只允许首次挂载；终态、重复输入或转场不重建页面 |
| scroll / focus / hover / click | handler 绑定到稳定节点；状态更新保留可见焦点，不移动滚动区，不破坏无关 hover 锚点 |

### Constraints

- DOM budget：沿用既有一个语义 button 作为唯一推进控件；除 0191 实际交接要求外不新增推进 wrapper/按钮。按钮状态只做 behavior 更新，终态不得重建整个 UI。
- 仅一个可操作的推进按钮。不同阶段可改变准确文案；不增加“继续/确认/结束/下一战”第二控件。键盘可聚焦，focus-visible 清晰，禁用/终态有文本说明而非仅变灰。
- 一次 DOM click 只调用一次前置交接规定的 Click；阻止同一次 handler 重入/重复提交，不实现连点计时或速率玩法。之后的下一次独立 Click 才能推进下一回合/行为。
- 按真实终态显示胜利、失败、平局、Demo 完成/出口状态；禁用后重复 click/Enter 不追加事件、不推进 RNG、不重复结算。
- 浏览器检查必须记录控制台错误与网络资源：控制台不得有未解释 error；页面只能请求原型本地/dev server 和实际声明必要的本地资源，不得请求 AC URL、AC 资源、CDN 或父级源码。
- 本 Unit 所有游玩效果/交互勾选必须由 Receipt 中可复核的实际 screenshot（本地 PNG 或 inline Task 消息）、真实 viewport、scene/node 与 seed 支持。不得为覆盖终态而虚构 seed 或强改规则；缺真实 fixture 退回 0191。

### Allowed Files

- `prototypes/gameplay-b/src/main.ts`
- `prototypes/gameplay-b/src/view.ts`
- `prototypes/gameplay-b/src/style.css`
- `prototypes/gameplay-b/tests/runtime.test.ts`
- `docs/plan-work/task-0192-gameplay-b-three-column-ui-acceptance.md`（仅追加本 Unit Receipt）

### Explicit Non-goals

- 不改 Runtime/terminal 规则、Click 单位、战斗/路线状态；缺陷退回 0191。
- 不添加新按钮、菜单、AC UI 组件/服务/样式、远程资源、CDN、跟踪或存储。

### Stop Conditions

遵守 `docs/ai/PROJECT-CONSTITUTION.md` 六项停止条件。另：U7 Receipt 与当前终态/seed/场景不一致；实现唯一 Click 需改 Runtime 白名单外代码；存在重复终态更新无法从 view 层安全处理；控制台错误或越界网络请求无法解释；浏览器或 viewport 无法运行；Receipt 无法取得截图/版本/scene/seed证据；任一情况均停止并记录/退回，不通过删除错误或写假日志掩盖。

### Completion Criteria

- [x] 全页始终只有一个可推进的 Click button；其文案和可操作状态匹配当前场所/战斗；不出现第二个隐式推进输入。
- [x] 固定 seed 的正式 UI 路线逐次 Click 至 `click=26`；实际战斗按 4/5/6 轮结算，胜利/出口交接没有同一次输入内多推进。终态唯一按钮变为 disabled，ARIA 状态为 disabled。
- [x] 正式路线可达的战斗胜利、出口/完成场景正确显示；失败/平局由既有 Runtime fixtures 覆盖，终态重复 click 幂等测试通过。
- [x] 一个实际浏览器窗口完成代表性队伍、战斗预览、长日志和终态检查；唯一 Click 文案清楚，日志和焦点连续性已实测。
- [x] Receipt 提供完整路线终态 inline screenshot、真实 viewport、场景/seed、浏览器结果；没有虚构本地截图路径。
- [x] 浏览器控制台无未解释错误；Network 只有原型本地服务/Vite 和本地源码资源，无 AC/CDN/外部请求。
- [x] 类型检查、构建和定向整局/Runtime 回归通过；没有修改 AC 或超出 Allowed Files。

### Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| Runtime 回归 | 在 `prototypes/gameplay-b/` 执行 runtime.test.ts 定向过滤及 0191 整局测试（实际源文件为 `prototypes/gameplay-b/tests/runtime.test.ts`） | 一次提交、终态幂等/不追加事件通过 |
| 游玩场景 | 在一个实际原型窗口使用 0191 的固定 seed，观察起始/加入后队伍、预览、长日志和路线可达终态 | 玩家能读懂行动和结果、只用 Click 推进，日志阅读连续；记录该窗口实际尺寸与 Receipt |
| Console/Network | 开 DevTools 清空记录，重载并逐场景操作；检查 console 与网络请求目标 | 0 未解释错误；无 AC、CDN、父路径或外部资源请求 |
| 节点/连续性 | 比对视口操作前后卡片/日志/button 节点、焦点/hover/scroll | 普通交互无全页重建，历史阅读不被追加事件抢走 |
| 包检查 | 按实际 package 脚本运行定向 test/typecheck/build | 全部通过，记录准确命令与输出 |

### Execution Receipt 0192-U3

### Execution Receipt 0192-U3

状态：complete。

正式入口 `prototypes/gameplay-b/src/main.ts` 使用固定 seed `park-inspection-demo`。在本地 Vite 原型页面从开局逐次操作一个按钮：

- 从起始状态到完整出口交接共 26 次 Click；事件的 `data-click` 集合完整覆盖 `0–26`，最大 Click 值为 26，日志共有 192 个 Runtime event item。按钮每次显示当前节点活动或当前冻结战斗轮次；战斗胜利只准备下一节点，不会在同一次 Click 内连锁结算。
- Node 5 战斗 4 轮、Node 9 战斗 5 轮、Node 11 Boss 战 6 轮；节点 6 千世与节点 10 玲奈按入场时点加入，全程队伍最终为 4+2。
- Node 12 出口交接后状态为 `complete`，当前文案“巡查完成”；整页只有 1 个 button，`disabled=true`、`aria-disabled=true`。浏览器控制台错误列表为 `[]`。
- 完整路线结束时的真实窗口为 `1331×811`。本线程中 Node 12 的 inline screenshot 显示终态、6 人队伍、出口文案和唯一禁用按钮。未生成本地 PNG，未填写虚构路径。

失败与平局不可由正式固定路线自然到达，复用 0191/现有 Runtime 测试 fixture；`runtime.test.ts` 有 victory/defeat/draw 终态重复 Click 幂等覆盖，`park-demo.test.ts` 有失败战斗与平局用例。终态 UI 不为测试增设第二入口或伪造页面状态。

环境与请求：Network 重载采集 21 个请求，全部为 `http://127.0.0.1:5173/` 入口、Vite client、本地 `node_modules/vite/` 或 `prototypes/gameplay-b/src/` 源码；没有 AC URL/资源、CDN、父级源码或外部 origin。固定路线通过已加载页面内的本地 Runtime 推进。

命令结果：原型 `npm test` 全量通过（12 files / 107 tests）；`npm run typecheck` 与 `npm run build` 通过（Vite 8.3.2，22 modules）；根 `npm run check:docs` 通过（561 Markdown，0 errors）。

未完成项：U3 无。Task 0192 的 U1/U2/U3 均完成，可进入最终归档与 0193 交接。

## Context Budget 与全局停止条件

- 每个 Unit 的代码白名单连同本 Task Receipt 为 3–5 个文件，默认净改动约 300–500 行；U1 复用现成三栏/角色节点，仅做角色密度与视觉 token 收敛，按 120–240 行紧凑预算执行，禁止为凑默认行数拆模块或膨胀 DOM。禁止用目录通配扩大文件范围。
- 当前三个 Unit 的白名单连同 Task Receipt 分别为 4、4、5 个文件；实际 0191 路径/签名不符时先修订白名单，不能直接扩张。
- 遵守 `docs/ai/PROJECT-CONSTITUTION.md` 六类停止条件：白名单外修改、预算/文件数超限、Read Set 越界、交接/源码事实冲突、需改变规则/架构/目标、必需验证失败/无法执行/不可解释。
- 每个 Unit 开工前重新核对 0191 最终 Receipt 和源文件；U1 已核实角色列表由 `prototypes/gameplay-b/src/view.ts` 的 `partyCards`/`syncParty` 持有，U2 预览/日志也在该 View owner 中；不得按不存在的拆分模块扩白名单。
- overlay 的 visual hierarchy、DOM budget、behavior/region/structure 与 interaction preservation 贯穿三个 Unit；不以截图好看为由牺牲 stable node identity、唯一 Click 或日志阅读位置。
- 不改根 package、AC 源码/组件/服务/样式、生成 Schema 或其他 Task/Draft；不能在 UI 补写玩法逻辑。

## 测试与验收

- [x] 0191 最终交接中的真实场景/状态用于游玩验收；U2/U3 各在一个实际窗口检查队伍、预览、长日志和正式路线可达终态，没有扩为兼容矩阵。
- [x] 原角色卡和历史日志稳定节点，名单新增局部更新；scroll、focus、hover 不受无关刷新影响。
- [x] 用户旧日志不被追加事件带到底部；原本贴底时跟随新事件；长日志独立滚动，Click 和侧栏状态保持稳定。
- [x] 整页仅一个推进 Click；每次 click 单次提交，完整路线终态后按钮禁用；失败/平局 Runtime fixtures 与终态幂等回归通过。
- [x] Runtime/view 套件、typecheck/build、真实浏览器与 Console/Network 核验通过；没有 AC 依赖或外部请求。
- [x] 每项实际游玩场景/seed 实测已在各 Unit Receipt 记录真实 screenshot inline message、viewport 与场景/seed。

## 验证入口

所有原型命令均在 `prototypes/gameplay-b/` 执行，具体脚本参数以 0187–0191 实际交接为准。至少运行 runtime.test.ts 定向过滤、0191 整局回归、typecheck/build；对应源码为 `prototypes/gameplay-b/tests/runtime.test.ts`。U2/U3 各使用一个实际原型窗口完成代表性队伍、战斗预览、长日志和正式路线终态场景游玩检查；Receipt 记录尺寸，只用于复核操作过程。

截图保存在上述证据目录并将实际路径写入对应 Receipt；每行同时记录 viewport、场景/节点、seed、浏览器与结果。检查控制台和 Network，证据缺失的场景不得勾选。文档修改后仅执行与文档有关的 `npm run check:docs` 和空白检查，不运行游戏测试。

## Execution Receipt 与交接

每个 Unit 完成或中断后，在其小节追加实际修改、未完成项、命令与输出、问题和需确认项。视觉/浏览器证据写在实际执行的 Receipt，不在计划中预填。U1 交接 roster 稳定节点与布局结果；U2 交接预览/日志连续性及事件呈现；U3 交接终态、真实截图/场景矩阵、控制台/网络边界和包检查结果。

全部验收通过；最终核验结果见下。已交接 `task-0193-gameplay-b-calibration-and-standalone-delivery.md`。

## 剩余工作

无。移动端、美术素材、复杂动画、数值校准与项目外交付属于 Task 0193。

## 最终核验与交接

2026-10-03 最终核验：

- Gameplay B 原型全量 `npm test`：12 files / 107 tests passed；`npm run typecheck`、`npm run build` 通过，Vite 8.3.2 转换 22 modules。
- 根 `npm run check:docs` 通过，扫描 561 篇 Markdown，0 errors；Task、索引、源码与样式没有尾随空白。
- 固定 seed `park-inspection-demo` 在正式浏览器页面走完 12 节点与 26 Click，Node 5/9/11 分别进行 4/5/6 轮战斗；胜利后自动进入下一场所但不连锁消费 Click；Node 12 完成态全页仅一个 disabled 按钮。
- Console errors `[]`；重载 Network 采集 21 项请求，均为 `127.0.0.1:5173` 下的入口/Vite/dev source，没有 AC、CDN 或外部请求。
- U2 与 U3 证据均为当前 Task 线程内真实 inline screenshot；没有可落盘截图，因此未写本地 PNG 路径。

交接到 Task 0193 继续进行固定 seed 诊断、证据支持的校准判断和仓库外独立交付验证；本 Task 与 0193 不改动 AC 运行路径。

## 相关路由

- `draft-0183-gameplay-b-ui.md`
- `task-0186-gameplay-b-prototype-rule-baseline.md`
- `task-0191-gameplay-b-complete-park-demo.md`
- `task-0193-gameplay-b-calibration-and-standalone-delivery.md`
