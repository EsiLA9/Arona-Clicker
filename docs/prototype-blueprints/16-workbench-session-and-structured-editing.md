# 首个作者工作台与复杂字段怎样接起来

**待评审的 R4 试点宿主选为现有游戏内 Advanced Workbench。** 它已有 World、Story、实例条、检查器和试播入口，可以在一处核对共享草稿与现有游戏测试。长期产品形态仍归 [D05](10-decision-register.md)。沿用工作台、引用选择与条件树的呈现约定。现有操作详见 [P2](03-authoring-workbench.md)，领域覆盖见[实体编辑表](17-entity-editing-coverage.md)。

## 三个实际入口分别接什么

| 入口 | 使用的输入与服务 | 真实职责 |
| --- | --- | --- |
| 游戏内 Advanced Workbench | `EditorWorkbench.project`、`editor-workspace.ts`、`world-browser-provider.ts` 接项目目录、引用和草稿 | R4 的首个宿主。从实际 World 与 Story 入口打开可写源或只读记录，验证同实体共用草稿 |
| 独立 Datapack Editor | `tools/datapack-editor/ui/io.ts` 与现有模型和 Schema 字段表单接 P1 读写、P0 检查，后续消费共同编辑动作 | R1/R2 的首个文件操作入口，可由浏览器导入或下载。依靠当前运行入口验证应用 |
| Runtime Editor / Story 既有在线工具 | 已启用 Registry、Runtime Editor policy/命令和 Story 提交从共同规则与引用目录取数据 | 继续运行态查看、显式热写、应用和试播。候选作者定义只经明确的试播、构建和应用进入 Runtime |

R4 先给 World 试点一个可明确读写的测试副本。宿主提供读取、比较摘要、写入的能力，作者服务接项目相对路径。若只有 ZIP 或上传，草稿留在会话，操作只能导出指定产物。浏览器没有目录写权限时可下载改过的文件，终端按同一计划写进测试副本再重读。R4 的“保存回源”必须在实际有写能力的一条路径验收。 `ThemeContentEditorService.save` 的摘要比较和 editing pack 生命周期可作包记录对照。保存 PackManager 的包记录和本地目录写入使用不同的存储入口。

## 一次项目会话的由来和结束

1. 进入现有工作台，显式打开“作者项目”并选择测试副本。从 [ProjectRead](13-authoring-service-contract.md) 得到可写源、只读依赖、版本与目录。实例定位记录项目和 Owner。标签、历史、滚动和焦点留在 Workbench。查看已启用定义时显示来源，即使同逻辑 ID，也独立于作者草稿。
2. 同项目从地图、文件目录或引用打开同一 Owner，共享一份底稿、文件摘要、草稿值、草稿版本与撤销记录。实例可以分别选择节点。异步结果核对版本。关闭一个实例只关闭该视图，最后一个实例有未保存内容时可保存、保留会话草稿或丢弃。关闭项目时处理剩余草稿并释放独立试播。
3. 保存时按实体来源找到文件，比较底稿摘要后写入。成功重读位置与引用并局部刷新。另一会话中已打开的草稿保持旧底稿，冲突展示基础、磁盘和拟改值，重新确认后可以提交。只读内容仍可查询和跳转。
4. 预览绑定显式提交的候选版本。源文件保存只推进作者底稿。Runtime 应用与在线更新继续使用现有命令和准入。对照用相同 ID、不同内容的两份定义，分别打开测试作者源和已启用包，核对读写对象与生效时刻。

## 复杂字段共用哪些编辑动作

首次只接条件树，后续将已验证的树或有序集合操作供更多适配使用。每个具体字段提供自己的说明。

~~~ts
type StructuredField = {
  owner: Owner; field: string; baseDraftRevision: number;
  label: string; root: 'condition' | 'entryCondition' | 'orderedList';
  allowedKinds: readonly string[];
  limits?: { depth?: number; childrenPerGroup?: number };
};
type StructuredAction =
  | { type: 'set'; node: string; field: string; value: unknown }
  | { type: 'insert'; parent: string; before?: string; value: unknown }
  | { type: 'move'; node: string; parent: string; before?: string }
  | { type: 'remove'; node: string };
~~~

领域适配器读取现有值，按节点类型给出合法参数与其引用范围，校验后串回实际字段形状。共用部分负责临时节点键、插删移排序、选择、嵌套与深度检查、编辑副本、取消、确认和一次批量撤销。临时键只用于编辑会话。有序集合禁止嵌套。候选引用用同版本的公共目录，当前弹窗可补尚未进入文件编辑的局部候选。

| 字段 | 适配范围 | 第一处接线和验收 |
| --- | --- | --- |
| `Area.enterCondition` | 普通 AND/OR，可添加合法条件和子组，当前 Init、Area 提供候选上下文 | `AREA_CONTENT_POLICY` 与 `renderAtomicConditionEditor/readAtomicConditionEditor` 对照真实参数。一组 hasEnh 在 Runtime 旅行中应有相同结果 |
| `StoryEntry.triggerCondition` | Entry 的 True 模式保留子树，按现有合同返回值 | `openConditionTreeDialog`、现有叶编辑、选择器。取消不写，切 True 并保存后还能切回原子树，旧 Entry 可打开 |
| `Enhancement.effects` | 有序 Effect 列表。按 op 展开 target/value，允许类型由当前领域字段给出 | 沿 `ENHANCEMENT_CONTENT_POLICY` 与 Runtime Editor 现有效果字段。未知旧数据保留且可读，不能确认不受支持的操作 |
| StoryNode Operation 的 `action.effects` | `action.kind` 为 `state` 时接有序列表，参数来自 `StoryAction`。`action` 为单条局部标记、移动或其他命令时接各自字段，不强制转换成列表 | 沿 Story 的 `property-fields.ts` 和 `story-definition-projection.ts`。验收排序、参数保存与当前执行回执一致 |

打开弹窗时复制目标字段。移动前查循环和字段的局部限制。参数缺失时保留该编辑行。确认先检查结构，再用预期草稿版本写一次字段替换。版本已变展示当前值与拟改值，允许重开。取消与关闭把焦点交还实际入口。选择器沿 `condition-reference-picker.ts`、`reference-navi.ts` 改接共同候选。旧重复结构/引用读取在两消费者对照通过后退出。现有运行命令依然验证生效条件。

## 装到现有界面后如何验收

Workbench 左栏 Explorer、实例条、中栏文档和右栏检查器使用原外壳、主题与滚动宿主。项目切换时更新目录，单字段修改只协调属性行与受影响的预览、诊断。复杂弹窗用 ModalManager，标题和确认/取消固定，树和属性各自滚动。切到候选并返回时保留树和当前输入节点，关闭后定位回入口。新增项目状态不改变 Story 与 World 实例切换规则。

R4 第一段从 Base 地图 → 节点 → Area → Spot 找回源，修改普通字段、撤销并保存一次。第二段接 Area 与 Entry 条件，演示多入口共享、插子树、取消、确认、撤销、外部冲突、对象移走、只读和焦点。沿 `tests/ui/runtime-editor/runtime-editor-world-browser.test.ts`、`tests/ui/story/story-editor-workspace.test.ts`、`tests/ui/story/story-editor-authoring.test.ts`、`tests/ui/story/story-editor-reference-navi.test.ts` 对照。后一组有历史失败，先核对当前行为，再独立记录迁移结果。增强效果与 StoryAction 各设以后可独立交付的工作。
