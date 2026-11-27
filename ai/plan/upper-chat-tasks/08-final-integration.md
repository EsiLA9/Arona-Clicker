# Task 08（新建）：连续行为集成、旧权威退出、Provider 接入与最终交付

## 施工目的

完成本轮结构收敛，而不是以新增 interface、通过局部测试或新旧实现相互兼容作为完成依据。以实际工作树和已经完成的 Task 01–07 为准，检查所有真实消费者、最终状态所有权、失败恢复、公共搜索与标签行为。Task 0422 的原最终验收和接入文档职责迁入本 Task。

## 1. 建立最终运行路径与权威清单

从真实 UIController 进入编辑器、WorkspaceRouter/DEV Navigation、EditorWorkbench.project()、WorkspaceColumns、BrowseInstanceManager、EditorExplorerService 及 Provider 入口追踪。为以下操作写出实际符号链（入口→领域准备→权威写入→公共投影→DOM 更新）：

- 打开/复用 Story、Entry、目录、World；激活/关闭/最后实例关闭；真实退出。
- 左栏 Work Type 切换、来源/筛选/搜索、展开、选择、显式定位。
- Story 普通内容编辑/节点选择，目录设计保存/移动，World 关系跳转。
- 临时辅助工具、试播的合法进入退出，以及布局变化。

清单用于核对实际代码，不另造长篇体系说明。确认 activeExplorerType、activeBrowseInstanceId、layout、Explorer 基础状态、目录工作状态、各实例业务状态、DOM 生命周期各只有一个实际权威。Explorer active marker 与 selected placement 不混淆。确认 public projection 是唯一组合入口，所有局部更新真实消费它；正常 Provider 不越权提供左栏或自行画全套 Chrome。

## 2. 审查旧路径退出与允许保留的适配

搜索前序任务记录中的旧符号、直接写入及其实际调用者，重点检查：StoryEditorState.directoryManagement、directoryReturn、旧 mode/temporaryView 门禁、directoryBrowseProjection/directoryPlacement、普通恢复自动 reveal、旧来源/草稿捕获回调、Story inSearch/独立递归树 HTML、World 独立 renderWorldTree 递归/展开、重复搜索输入、业务完整 Frame/Chrome、重复事件分发、route 驱动 active provider、未定型 SVG fallback。实际名称以本地改造为准。

允许合法 wrapper：只把旧调用签名转成新的正式请求并单向委托，既不拥有状态也不执行重复算法。每个保留入口说明真实调用者、职责及是否仍需保留；无调用者删除。禁止双向同步、getter/setter 镜像、两套搜索/树渲染因“兼容旧 UI”长期共存、在新增 Provider 时修改大量公共领域分支。保留真正专属领域算法、Classic 的明确模式策略和试播合法临时表现，不为减少行数删除有效功能。

审查目录实例 snapshot 是否只保存合法业务状态，而非旧工厂闭包、DOM、UIContext；写入绑定是否独立于当前 Explorer/Story；目录身份变化及冲突是否有实际处理。检查公共树输入确实在文本搜索之前生成，且 Story/World 真实调用相同搜索与树渲染符号。检查公共实例条不再猜测业务 kind/icon。发现缺陷应回到相关消费者修正，不通过新增补偿服务掩盖。

## 3. 建立真实连续操作回归矩阵

优先扩展项目现有 UI/Happy DOM、workspace、story、runtime-editor tests 和 UIUpdate/WorkspaceColumns 设施。每个场景必须调用实际生产入口或真实控件事件，断言状态和实际 DOM；不把 mock 的自制演示组件当成集成证据。已有覆盖且未受影响的用例不重复添加。以下为最小必要场景，允许将相关场景合并到同一测试序列，但失败应可定位。

### A. 左栏与活动实例持续独立

Story A 活动→World Explorer→输入查询并展开→编辑 Story 节点、触发真实 Story refresh→核对 rail、实际 World DOM、搜索值、展开、scroll host identity、业务中右栏与 Ribbon；随后再切回 Story Explorer，核对各自状态。World 活动→Story Explorer 选择包 B/Init/filter/query→World 内部切实体→完整渲染或公共刷新→Story 来源/控件/树结果保持；来源下拉仍可操作。验证实际 DOM 而非只断言 activeExplorerType。

### B. 目录工作状态与正常实例生命周期

从 Story、World 或空 Workbench 的 Story Explorer 打开真实目录；编辑名称/描述/设计候选，开启排序或移动；切换到 Story B、Entry、World 再返回；表单、tab、候选、工作状态和滚动恢复。布局不强制 three，无返回编辑前置；目录实例实际出现在同一标签条。关闭 dirty/真实退出按门禁处理，不丢输入；普通切换能挂起可恢复状态。若同时打开两个目录，工作状态不共享。

### C. 写入绑定、资源身份和归档目标

目录实例绑定包 A，Explorer 切包 B、活动 Story 切 C，再保存目录，验证命令只指向 A 且 digest 合法；模拟版本冲突/权限失效，保留输入、无错误写入。移动/重命名导致逻辑身份变化时 Instance ID 保持，资源/复用 key 与实际内容一致，重新打开正确复用；已有目标冲突不静默覆盖。删除/卸载时明确失效。文档归档目标 A 后活动 B，实际修改 A 草稿或合法拒绝；不改变 B。

### D. 公共搜索、树与空节点

分别用 Story 与 World 实际输入框搜索名称/ID，确认共用实现；匹配祖先、目录名称匹配策略、无结果、领域筛选、普通与搜索折叠、清空恢复。真实空角色目录、手动空目录、World 空 Init/Area 不存在无效 data-editor-expand/Chevron，仍可管理/打开；父目录含空子节点仍可展开，延迟渲染不误判数据为空；筛选后无子项不标真实空。验证多 placement 的 Entry 从第二位置打开，切换实例不覆盖选择；显式定位在查询阻挡时按临时 reveal 策略工作，清除恢复基础状态。

### E. 挂载、事件、滚动与实际刷新

连续三次切换 Explorer，分别实际输入、展开、source filter、打开资源、管理目录，确认每次恰好一次语义效果且旧监听释放。普通实例激活不重绑无关 Explorer，业务修改不重建左栏，查询不重建中右栏，更新相关资源名称时使用当前 Explorer 投影。切换隐藏布局并恢复，滚动不被零值覆盖；同 slot 下不同 Explorer 的 scroll 不互相写入。对实际 DOM node identity、输入焦点/caret、overlay anchor 使用项目已有测试能力，不能保证的真实浏览器行为单独登记。

### F. World 复用与实例表现

World 搜索 Spot→打开→中栏关系链接 Area/Init，保持同实例 ID，标题/内容/类型/状态一致且查询保持。混合 Story、Entry、目录、World 标签，未定型 icon 无 fallback；Story/目录重命名后实际标签更新。关闭后台实例不改变活动；关闭最后一个实例保留空 Workbench，从任何 Explorer 再打开资源。检查普通激活不改左栏；真实退出恢复原路由和主题。

### G. 失败与原子性

验证保存门禁拒绝、资源不存在、来源失效、目标准备/恢复失败、创建失败、目录版本冲突、显式定位失败等真实可失败路径。检查原活动 ID、实际内容、未保存数据、实例集合、Explorer 基础状态、临时覆盖、宿主可操作性；合法成功的持久化保存不宣称回滚。并发导航如已有 busy/串行机制，验证不产生孤儿实例。不要只改测试期待值令失败通过。

### H. 合法兼容与 DEV 导航

Classic 已有单文档、目录业务、来源策略不被 Advanced 破坏；试播/文档辅助工具仍有明确所有者和退出行为。已有 DEV Navigation 通过正式公共入口快速进入目标资源，不绕过业务门禁、不写无关持久状态；真实可用的 navigate/current/ready 语义以本地实现为准，禁止给用户虚构命令。验证至少一次实际测试入口的就绪/目标正确性。

## 4. 选择验证并处理失败

运行相关测试文件、TypeScript 检查、架构/文档检查和 git diff 检查，命令以项目 package.json/AGENTS 为准。若前序 0421 的 9 项失败已修复，报告其最终状态和证据；若仍有基线问题，明确真实影响及不能完成的条件。不要将已归因但未修复的本轮回归算作通过。不因测试总数增长宣称质量提高。

浏览器验收遵循用户既有约定，由用户实际观察；只提供必要且可执行的快速入口和简短步骤。手验重点：目录普通实例切换与长标题、World/Story 同一搜索控件、真实空目录图标/对齐、Hover-only scrollbar 与实际宽度、SVG 尺寸、正文输入连续性/浮层锚点。记录具体 URL 或脚本、资源 ID 来源、预期、实际未观察项；不虚构测试已跑或截图已验。

## 5. 更新机制与 Provider 接入文档

优先修改现有 docs/docs-830/04-presentation/workspace-columns-and-layout.md 及实际 Workbench/Explorer 机制入口、Authoring patterns 和索引；以本地路径为准。提供一个新 Explorer 接入示例：领域数据→公共节点→已有公共搜索/树渲染→来源/过滤与动作委托→open/locate。提供一个新 Browse Instance 接入示例：resource/reuse identity→业务 state→prepare/restore/gate→中右栏/commands/presentation→公共更新范围。引用真实符号与文件，不写虚构示例 API。

执行反事实审查：若未来 Character Explorer 必须再实现 searchCharacterTree/renderCharacterTree/bindCharacterSearch/restoreCharacterExpansion/revealCharacterPlacement，则本轮没有真正公共化；如果新增目录工具必须修改 Story 全局模式或另造标签，同样未收敛。只做接入审查，不实际建设 Character Editor。按知识保全规则局部维护视觉记录，保留既有尺寸和状态等施工知识，不重摘要整个 ui-style。修正旧文档中已退出路径，明确合法差异和兼容入口。

## 6. 最终交付及停止条件

保存实际 Task 结果、主要变更/删除符号、权威清单、连续测试结果、未验证的浏览器项、DEV 导航实际示例、遗留问题与恢复信息。已完成任务按现有工具归档，保留活动索引和证据。未经用户授权不 push、不改写历史。若某项核心合同仍失败，标明未完成并修正；不能以“兼容旧实现”作为通过理由。完成本 Task 后停止，不自行扩大到其他编辑器或游戏系统。
