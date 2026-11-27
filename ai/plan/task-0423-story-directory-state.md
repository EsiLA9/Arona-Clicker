# Task 02（新建）：目录管理工作状态、资源上下文与领域操作提取

状态：已完成

正式 Task：Task 0423；原施工节点：Task 02。
前置：Task 0421。
后继：Task 0424。
完整原始指令保存在 ai/plan/upper-chat-tasks/02-directory-state.md；本 Task 正文保留该指令全文。

阶段边界：本 Task 只把现有目录工厂的状态写入者迁移到唯一可恢复 payload；在 Task 0424 完成 Manager 接入和旧入口退出前，不得宣称目录已成为公共 Browse Instance，也不得把旧入口的暂时持有描述为最终架构。

## 施工目的

把 createStoryDirectoryManagement() 的可恢复状态从工厂闭包与 Story Controller 特殊模式中提取出来。此 Task 首先改造原有真实消费者，使现有目录页面在仍沿用旧入口期间也使用新状态；下一 Task 再接入公共 Manager。不可仅新增一个 Snapshot 类型或把旧管理器对象装入实例。

基线：src/ui/story-editor/directory-management.ts 约 530 行；DirectoryNavigation 只有 tab/tabScroll/expanded；工厂闭包还持有 selectedId、candidateId、create、editingDesign、values、moving、moveQuery、moveParent、sorting、removing、status、pendingScroll、editing、tree 等。src/ui/story-editor/controller.ts 的 editStoryDirectory() 构造捕获 draft、source、expected、writeBlocked 的 save/place 回调。先核对本地变化。

## 1. 逐类提取实际数据

检查所有字段初始化、读取、赋值、reset、输入事件与提交后的变化。输出到本 Task 的字段迁移表（实际变量、原写入者、新权威、恢复/清理条件、消费符号）。不要仅写设计原则。

建议状态分层（命名可适配现有风格）：

```ts
interface StoryDirectoryResource {
  sourceKey: string; // 明确归一化 runtime / pack / draft 等，不是当前 Explorer 的实时值
  initId: string;
  logicalDirectoryKey: string;
}
interface StoryDirectoryWriteBinding {
  packRecordId: string;
  modName: string;
  expectedDigest: string;
}
interface StoryDirectoryNavigation {
  selectedDirectoryKey: string;
  selectedDesignId?: string;
  tab: 'design' | 'contents';
  tabScroll: Record<'design' | 'contents', number>;
  expanded: Set<string>;
  rightScroll?: number;
}
interface StoryDirectoryWorkingState {
  create?: 'legacy' | 'path' | 'design';
  editingDesign: boolean;
  values: Map<string, string>;
  moving: boolean;
  moveQuery: string;
  moveParent?: string;
  sorting?: string[];
  removing: boolean;
  status: string;
}
```

这些是迁移参考，不是必须复制的最终接口。若 create/edit/move/sort/remove 确实互斥，可使用 discriminated union，但须核对现有合法组合与转移行为，不能因类型美观删掉功能。selectedId 如果表示内部导航所选目录，与实例 resource 所指逻辑目录是否同步由 Task 03 裁定；本 Task 先区分其含义，避免两份同义权威。candidateId 对应实际手动设计记录，不能作为整个资源 ID。pendingScroll 属于一次性 DOM 恢复请求，恢复后清除，不必作为持久编辑内容保存。status 区分业务反馈与短暂 DOM 提示。

## 2. 从工厂内闭包迁移到唯一工作状态

修改 createStoryDirectoryManagement() 及 DirectoryManagementOptions，使工厂明确消费传入的工作状态与合法查询/写入能力。原 action()/input()/renderDetails()/renderPreview()/renderTabs()/renderContent() 操作同一权威对象，而不是在工厂中复制一份 values、tab 或 expanded，再在离开时同步。对于仍需暂留的局部运行值，说明其生命周期和为何无需恢复。

原 navigation() 若仍被调用，可退化为只读投影或捕获函数，不再成为额外导航权威。定义必要的初始化、捕获/复制、恢复函数；复制 Map/Set/数组，避免两个独立实例共享可变 UI 工作状态。不要深拷贝完整 catalog、Registry、草稿银行。目录状态不要求写入玩家存档或跨应用启动持久化，本轮只要求编辑会话内可恢复。

工厂返回的控制方法可以短期缓存，但不能作为唯一存储，也不能把 UIContext、DOM、AbortController、绑定回调、当前活动 Story Controller 或过期 pack 对象放入长期业务状态。重新装配时从资源身份和合法当前查询取得投影，旧运行对象释放。

## 3. 提取投影和业务上下文

将 editing/readPack/directoryDefinitions/build、story/entry 查询、目录引用、权限和标题视作派生查询。查询输入为当前实例明确的读取来源和写入绑定，当前合法 pack/catalog 与草稿银行；不是 active Story 或当前 Explorer 源。数据修订后重新计算必要投影，复用原有领域 buildStoryDirectory、mergeDirectoryDesigns、reference 查询等，不重写目录算法。

当前 factory 使用 options.target 兼容文档归档。先把目标解释提取为明确的业务输入：目录管理可不含文档；文档归档必须携带可重新解析的文档/草稿 ref。禁止以当前 state.target 或旧 draft 引用作为未来长期上下文。此 Task 可保留单向旧调用适配，在 Task 03 移除。

保存和归档操作的实际命令不应由 UI render 直接触发外部状态变化。保留现有领域校验和错误反馈。对于 action() 中从 DOM read('...') 读取表单的路径，检查所有可编辑字段是否已由 input/change 进入工作状态；将命令提交所需值从权威状态读取，或者在提交边界统一同步实际表单输入，不能让未挂载 DOM 成为数据唯一来源。检查 checkbox、number、select、未输入默认值及清除行为。

## 4. 处理未保存过程与版本变化

定义哪些状态可安全挂起（普通表单、排序草稿、移动选择），哪些动作是瞬时提交或确认。切换实例不等于取消这些过程。不可把操作进度标记为已成功；提交失败保留 values、目标、排序等。危险确认弹层可以在离开时关闭，但不得偷偷执行或丢失未保存内容；返回后按原业务策略重新确认。

写入绑定的 expectedDigest 由明确操作更新，不从当前 Explorer/Story 来源推断；旧回调的版本校验暂通过输入适配保留，Task 03 完成正式迁移。无写入权限仍可查询，不通过伪造 packId 获取权限。

## 验收和检查点

CP1：字段/上下文清单及实际工厂签名改变，原消费者使用传入状态。CP2：输入和各操作状态实际读写迁移，移除已迁出的闭包变量。CP3：重建投影并恢复状态的测试。

测试同一工作状态重新装配后表单、tab、candidate、排序/移动选择、展开和滚动保持；不同状态对象的 Map/Set/数组隔离；保存失败不清除用户输入；只读实例可渲染；不含文档时目录查询/管理不依赖当前 Story；现有目录设计、创建、移动、排序、引用等真实命令语义不回归。测试真实工厂消费者，而非仅测试 snapshot 深复制。

本 Task 不必完成 Manager 接线，不新增目录全局状态服务。迁移后暂由旧入口持有唯一目录工作状态；在 Task 03 将这个所有权直接转给实例并删除旧权威。保存实际变更、验证和下一步。

## 实际施工检查点

### 状态与字段迁移

实际唯一 payload 为 `StoryEditorState.directoryManagementState: StoryDirectoryManagementState`，定义及复制函数位于 `src/ui/story-editor/directory-management-state.ts`。旧 UI 方法对象移至 `StoryEditorController.directoryManagement`，仅作当前投影短期缓存；每次 Story Explorer / 业务投影都由 `buildDirectoryManagement()` 根据 payload、捕获的来源键和当前 pack 查询重建。`StoryEditorState` 不再持有捕获 UIContext、目录树或命令回调的 factory closure。

| 原字段/变量 | 新权威与数据形状 | 恢复、清理及消费者 |
| --- | --- | --- |
| 来源选择与目录所属者 | `resource.sourceKey`、`resource.ownerModName` | 固定进入目录模式时的读取来源和运行内容所属者；重建时按 sourceKey 查询，写入不随 Explorer 当前筛选来源漂移。 |
| `location.initId` 与目录目标 | `resource.initId`、`resource.target`；目标仅保存 `{kind,id}` | 工厂通过该身份和当前目录/草稿投影重新解析 Story/Entry；关闭目录管理时清掉整个 payload。 |
| 初始 `location.directoryId` | `resource.logicalDirectoryKey` | 表示打开时的逻辑资源身份；与可变导航选择分开，不因树内选择而改写。 |
| 当前 `selectedId` | `navigation.selectedDirectoryKey` | 目录行选择、标题、层级路径、排序/移动/删除消费；工厂可根据 target 解析初始目录。 |
| `candidateId` | `navigation.selectedDesignId` | 保留 undefined（自动主资料）、空串（路径默认）与明确 design ID 的差异。 |
| `tab`、`tabScroll`、`expanded` | `navigation.tab`、`tabScroll`、`expandedPlacementKeys` | 工厂直接读写 payload。切 Tab 时记录离开位置；可变 Set/对象由 clone helper 深复制。 |
| `pendingScroll` | `navigation.pendingScrollTop` | 一次性恢复请求，在 DOM 恢复后清除；不是持续编辑内容。 |
| `create`、`editingDesign`、`values` | `working.create`、`editingDesign`、`values: Map<string,string>` | 输入/change 事件写入 values；保存从 values 和目录定义默认值读取，不依赖未挂载 DOM。成功保存按原策略清表单，失败保留。 |
| `moving`、`moveQuery`、`moveParent` | `working.moving`、`moveQuery`、`moveParent` | 移动查询、目标选择和确认继续由同一 payload 提供；失败不清查询/选择。 |
| `sorting`、`removing`、`status` | `working.sorting`、`removing`、`status` | 排序顺序与移除确认跨重新投影恢复；提交失败保留，确认成功后由既有领域逻辑清理。 |
| 原 `options.packId` / Controller 局部 `expected` | `writeBinding: {packRecordId, modName, expectedDigest, purpose}` | `purpose` 区分目录、内容归档和新目录写入；digest 在成功写入并刷新来源后更新。每次命令重新检查当前包/权限，工作状态不因来源暂时失效而清除。 |
| `editing`、`tree`、definitions/candidates、引用和权限结果 | 不入 payload；由 `buildDirectoryManagement()` 每次根据资源身份、writeBinding、当前合法 catalog/草稿来源构造 | 目录构建仍复用 `buildStoryDirectory`、`mergeDirectoryDesigns` 和原引用查询。PackRecord 与 UIContext 只存在于这次短期投影闭包。 |
| `directoryBrowseProjection`、`directoryPlacement` | 删除 | 来源键与 target 已在 payload 中；投影按来源键重算，目录所属 Story/Entry 从 resource ref 解析。`directoryReturn` 仍仅承担 Story 特殊页返回 Visit，不是目录表单或写入来源的权威。 |

`createStoryDirectoryManagement()` 现在必须消费 `state`，不再接收独立 `location`、`navigation`、`target`、`packId` 副本；`navigation()` 旧捕获入口已移除。`cloneStoryDirectoryManagementState()` 对嵌套 target、writeBinding、tabScroll、Set、Map 和排序数组逐层复制，不复制 catalog/Registry/草稿银行。

### 验收结果

- CP1：字段迁移表对应实际接口与调用链；状态对象传入原有工厂与 Story Controller 消费者。
- CP2：真实目录管理输入、设计、候选、创建、移动、排序、移除、Tab、展开、反馈均直接读取/写入 payload；每次 Workbench 投影重建目录投影。DOM 输入不再是保存命令的唯一数据来源。权限/digest 失败后表单值保留，提交回调重新读取当前包状态。
- CP3：Story pack-source 集成用例通过真实 UI 编辑输入后主动刷新并确认 payload 对象、表单值仍在；同一场景验证失效门禁保留输入且恢复后可重试。专用 clone 用例验证 Map/Set/数组/写入绑定不共享可变对象。既有真实目录设计、创建、Entry 归档、移动、排序、引用及安全移除场景均保留。
- 暂由 StoryController 的 `directoryManagementState` 持有目录 payload；尚未接 BrowseInstanceManager，不能据此宣称目录已是公共实例。Task 0424 负责让 Manager 实例成为唯一 owner、处理切换恢复并删除该过渡 owner。
- 本 Task 不做真实浏览器验收；用户可在人工验收时重点检查目录表单保留、移动/排序恢复与切换来源后的写入门禁。无提交或推送。

### 后继闭合证据

Task 0423 是渐进迁移节点，不是目录公共化的最终交付。Task 0424 已把目录 payload 实际挂入 `story-directory` Browse Instance、接通真实打开/归档/关闭生命周期，并删除 Story 特殊模式权威。后续总验收须以 0424 的实例化证据为准，不能仅凭本 Task 的状态提取宣称目录职责已统一。
