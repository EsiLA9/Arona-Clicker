# Task 02（新建）：目录管理工作状态、资源上下文与领域操作提取

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
