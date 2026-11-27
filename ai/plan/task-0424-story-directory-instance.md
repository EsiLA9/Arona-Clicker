# Task 03（新建）：目录实例接入、文档归档目标分离及特殊模式退出

状态：已完成（自动化验证通过；浏览器手验留用户）

正式 Task：Task 0424；原施工节点：Task 03。
前置：Task 0423。
后继：Task 0427。
完整原始指令保存在 ai/plan/upper-chat-tasks/03-directory-instance.md；本 Task 正文保留该指令全文。

## 施工目的

将自动角色目录、手动目录、路径目录及 Init 根目录等可管理业务资源接入已有 BrowseInstanceManager，成为普通实例。目录管理可与 Story、Entry、World 自由切换，并保持自身工作状态；不需要返回编辑或强制三栏。Task 02 已提供可独立恢复的状态，不得退回将旧 DirectoryManager 对象塞入 Manager 的方式。

## 1. 接入领域身份与实际 Provider

检查 workspace/editor-browse-instances.ts 当前 StoryBrowseInstanceState | WorldBrowseInstanceState、browse-instance-manager.ts、editor-resource-request.ts、story-editor/workspace-session.ts、controller.ts 的 editStoryDirectory()/closeDirectoryManagement()/directoryReturn/directoryPlacement/directoryBrowseProjection、sidebar-tree.ts 的 directoryManagementAttrs 及目录内引用链接。

定义目录实例 payload（复用 Task 02 的状态）：

```ts
interface StoryDirectoryBrowseState {
  resource: StoryDirectoryResource;
  writeBinding?: StoryDirectoryWriteBinding;
  navigation: StoryDirectoryNavigation;
  editor: StoryDirectoryWorkingState;
  unavailable?: { reason: string };
}
```

选择独立 providerKey `story-directory` 或 Story provider 下明确的 kind `directory`，两者只选一种实际身份机制。Explorer work type 仍是 Story，不因添加目录实例新增独立 Work Type。若使用独立 providerKey，扩展现有类型联合和实际生命周期分发；公共 Manager 不认识目录领域字段。若用 Story provider 分支，保证目录与普通 Story 状态判别明确，不通过强制 cast 或旧 Story state 空壳满足类型。

resourceKey/reuseKey 从归一化读取来源、Init、逻辑目录 identity 生成，沿用实际 storyHierarchyNodeId、自动角色 ID、手动定义 ID 或根目录已有语义；具体 design candidate 不参与逻辑目录去重。不得用显示名称拼接冒充 identity，不另造第三套树路径。根目录空 ID 不能被现有 editorResourceOpenRequest 的非空 id 校验误拒绝：选择有明确语义的合法 ref 或明确解析策略。对于聚合来源，逻辑节点与具体写入记录分开。默认同资源复用同一目录实例；如当前无复制业务需求，禁用复制，不复制共享草稿造成冲突。

## 2. 真实打开与生命周期

从 Explorer gear/管理入口、目录内容内子目录、文档归档入口等实际调用追踪用户意图。目录管理打开使用已有 typed resource open / Manager prepare/openOrReuse；不能先切换 Story route、改 current draft、设置 directoryManagement 再创建装饰性标签。直接从 World 活动或空 Workbench 进入目录实例也应工作。保留点击实际 Placement；普通激活不改变左栏来源、查询、展开与选中。目录实例切换使用与其他实例相同的门禁、激活、close 和 empty fallback。

将目录中右栏和 Ribbon 作为业务投影，由统一 Workbench project() 装配。删除目录分支的 temporaryView、viewOverride='three'、instancesVisible 等专用策略；继承当前有效布局，不创建特殊实例条、返回编辑按钮或目录专有 shell。真实关闭遵守未保存状态保护：切换优先挂起保留，关闭 dirty 实例或真实退出才按业务门禁/明确保存或放弃处理。对已启动的瞬时提交使用现有互斥与失败处理，不默认丢弃。

目录管理内部的导航须与 resource identity 一致：默认从子目录链接打开或复用对应目录实例；若保留当前实例内部导航，则通过同一 Manager 更新 resourceKey/reuseKey/presentation，并定义遇到已打开目标的复用/拒绝策略，不能在单实例中悄悄换资源而标签不变。两种策略不要在同一动作中混用。

## 3. 彻底分离目录编辑和文档归档

现有 editStoryDirectory() 同时提供目录自身管理与 place()（将指定 Story/Entry 放入目录）。后者实际修改 StoryDraft 或 Entry placements，不能隐式取当前 active Story。

建立或复用明确的文档归档请求：至少包含文档 kind/id、真实 draftId 或可可靠解析的资源来源、写入目标绑定，以及目标 Init/目录 ref。打开归档操作时捕获身份而非可变对象；执行时重新解析并验证目标草稿仍存在、可编辑、归属和 Init 合法。使用原 place 领域逻辑和原草稿命令，不能直接改另一个当前文档。若目标已失效，明确拒绝并保留目录工作状态。对没有文档目标的普通目录实例不显示“将当前内容放在这里”的隐式动作。归档可使用既有公共目录查询/选择能力及局部工具，也可在目录实例中显示明确目标，但不得建立第二目录管理器。目录本身的 save 与文档归档的 mutation 分开，各自反馈与刷新实际消费者。

## 4. 权限、版本与身份变化

当前 save 回调会读取 state.sourceSelection、explorerState.source、writeBlocked；这些不能作为独立目录实例写入权威。改为实例 writeBinding + 当前合法 pack catalog/编辑态权限 + 对应领域限制。验证 packRecordId、modName、expectedDigest；成功保存后从真实结果/最新 pack 更新该实例 expectedDigest，并使相关目录查询失效。另一个实例的旧 digest 不得被无条件提升以掩盖并发编辑；它应按实际冲突/显式重载规则处理。无 writeBinding 只读；显式选择新的写入目标需要验证合法性并在有未保存变更时处理，不因 Explorer 改来源而变。

路径移动/重命名可能改变逻辑 ID。领域操作返回或解析明确的新身份，保持原 BrowseInstanceId，原子更新资源和复用身份及标题；若新身份已由其他实例占用，不静默合并脏状态，采用明确复用/冲突处理。目录删除/来源卸载时转为 unavailable 或根据关闭合同关闭，不匹配同名对象。处理可能受移动影响的其他目录实例和 Explorer placements，按实际可证明的映射更新，无法解析则明确失效，不猜测。

## 5. 旧模式退出

迁移 view.ts 的目录中右栏和工具带分支为目录业务投影。StoryEditorState.directoryManagement、directoryReturn、directoryBrowseProjection、directoryPlacement 等已被实例接管的权威删除。移除 restoreBrowseInstance 因 directoryManagement 一律返回 false 的条件；closeDirectoryManagement 不再作为普通切换前置。检查 beforeLeave、activate/close/open、syncSource、pendingDirectoryReveal、目录事件和滚动恢复所有调用者。仍有 Classic 专属交互时可单向委托同一目录业务服务，不保留第二份可写状态。不要删除试播合法临时行为。更新旧入口测试到真实公共生命周期。

## 验收及检查点

CP1：身份/Provider/typed open 接入，目录实际显示为普通实例。CP2：状态恢复、明确归档目标与写入绑定接入。CP3：旧特殊模式退出、资源变更和失败验证。

从 Story A 打开目录→填表/排序→切换 Story B→World→回目录，内容及工作状态保持；World 活动/空 Workbench 也能打开目录；改变 Explorer 包/查询后目录保存仍针对原绑定；版本冲突不写错包且表单保留；目录改名/移位后同实例标签与去重一致；删除后明确失效；打开归档目标 A 后活动切到 B，操作仍仅影响 A 或明确拒绝；关闭 dirty/真实退出门禁；Classic 仍可使用原目录业务。验证普通布局不被强制修改，实例条、Ribbon 和关闭语义真实正确。Task 07 再完成全部表现细节，当前至少不得伪装成 Story 文档图标。

## 实际施工检查点

- Provider：新增 `story-directory` Provider 和 `StoryDirectoryBrowseState`，进入公共 `EditorBrowseInstanceState` 联合；身份为归一化 source + Init + 逻辑目录 key。根目录通过 `directory-root` typed ref 表达非空 Init ID；目录行携带独立 owner hint，避免聚合运行来源丢失写入归属。
- 打开/投影：Story 的目录入口、Entry/Story 归档按钮、目录内容子目录和 Explorer typed resource 都进入 `BrowseInstanceManager.openOrReuse()`。业务列由 `createStoryDirectoryBusinessProjection()` 提供；Explorer type 不因实例打开而切换。关闭最后一个目录实例保留 Workbench；关闭脏实例/退出时有明确确认。Work Type/实例切换保留目录状态。
- 归档：`StoryDirectoryArchiveTarget` 单独捕获 kind/id/source/draftId/pack/mod/Init/digest。执行时重新解析草稿、Entry 和编辑包，不读取后来活动 Story；归档后停留在目录实例，切回 Story 才看到目标草稿变化。失效/权限/digest 失败保留工作内容。
- 写入版本：目录保存只认实例 `writeBinding`、实时编辑态包权限及预期 digest；成功写入后刷新当前绑定 digest。明确打开同一资源时，只有该目录没有未保存输入才采用最新绑定；脏实例拒绝切换。版本冲突显示“放弃未保存输入并重新载入”操作，必须二次确认后清空输入并重载 digest。
- 身份变化：保存、移动、删除后同步当前实例 resource/reuse key 与标题；目标 key 已占用时保留当前实例并明确标记 unavailable，不合并脏状态。目录内子目录链接按目标资源身份打开/复用实例。
- 旧模式退出：`StoryEditorState.directoryManagementState`、`directoryReturn`、`directoryBrowseProjection`、`directoryPlacement`、`editStoryDirectory()` 与 `closeDirectoryManagement()` 特殊路由均不再作为工作态/实例入口。Story 保留只对其浏览投影有效的局部 reveal 行为。
- 验收：`npm test -- tests/ui/story/directory-management-state.test.ts tests/ui/story/story-editor-pack-source.test.ts tests/ui/runtime-editor/runtime-editor-world-browser.test.ts`，3 suites / 27 tests 通过。覆盖目录真实 CRUD/移动/排序/引用、同实例身份更新与冲突失效、从 Story Entry 捕获归档目标并修改其草稿、World 活动时打开目录且 Explorer 不变、最后一个 Story 关闭后的空 Workbench 打开目录。`npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs`（144 Markdown / 0 errors）、`git diff --check` 通过。
- 浏览器：遵从用户授权未做浏览器直接核验；真实布局、普通切换观感、Ribbon/标签和关闭确认留用户手动验收。无提交或推送。
- 下一步：Task 0425 只建立搜索前节点数据并由 Story 真实消费者使用；现阶段仍存在的 Story 搜索/递归树渲染由 Task 0426 实际接管并退出，Task 0428 汇总检查这两个后继，不把任一中间态当成公共 Explorer 最终交付。
